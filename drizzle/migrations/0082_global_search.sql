CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.sigem_search_norm(_t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT pg_catalog.lower(pg_catalog.regexp_replace(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(_t,'')), '\s+', ' ', 'g')) $$;

CREATE INDEX IF NOT EXISTS sivs_name_trgm ON public.student_identity_versions USING gin (public.sigem_search_norm(coalesce(social_name,'') || ' ' || civil_name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS persons_name_trgm ON public.institutional_persons USING gin (public.sigem_search_norm(display_name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS classes_name_trgm ON public.institutional_classes USING gin (public.sigem_search_norm(name || ' ' || code) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS school_versions_name_trgm ON public.institutional_school_record_versions USING gin (public.sigem_search_norm(official_name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS student_official_identifiers_value ON public.student_official_identifiers (value);

-- SECURITY INVOKER: cada ramo lê pela RLS de quem pesquisa, antes de qualquer retorno.
-- Sem conteúdo clínico/inclusão/notas/endereço; identificadores oficiais só por igualdade exata.
CREATE OR REPLACE FUNCTION public.global_search(_q text, _categories text[] DEFAULT NULL, _limit int DEFAULT 20, _offset int DEFAULT 0)
RETURNS TABLE(category text, entity_id text, title text, subtitle text, match_kind text, score real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
WITH q AS (SELECT public.sigem_search_norm(pg_catalog.btrim(_q)) n, pg_catalog.btrim(_q) raw),
ok AS (SELECT n, raw FROM q WHERE pg_catalog.length(n) >= 2),
students AS (
  SELECT DISTINCT ON (v.student_id) v.student_id id, coalesce(nullif(v.social_name,''), v.civil_name) nm,
    public.sigem_search_norm(coalesce(v.social_name,'') || ' ' || v.civil_name) k
  FROM public.student_identity_versions v ORDER BY v.student_id, v.version DESC),
schools AS (
  SELECT DISTINCT ON (s.school_id) s.school_id id, s.official_name nm, s.district, public.sigem_search_norm(s.official_name) k
  FROM public.institutional_school_record_versions s ORDER BY s.school_id, s.version_number DESC),
matrices AS (
  SELECT DISTINCT ON (m.matrix_id) m.matrix_id id, m.official_name nm, public.sigem_search_norm(m.official_name) k
  FROM public.curricular_matrix_versions m ORDER BY m.matrix_id, m.version DESC),
components AS (
  SELECT DISTINCT ON (c.component_id) c.component_id id, c.official_name nm, c.is_active, public.sigem_search_norm(c.official_name || ' ' || coalesce(c.short_name,'')) k
  FROM public.curricular_component_versions c ORDER BY c.component_id, c.version DESC),
hits AS (
  SELECT 'aluno'::text cat, s.id, s.nm, NULL::text sub, 'nome'::text mk, extensions.word_similarity(ok.n, s.k) sc, s.k k, ok.n n
    FROM students s, ok WHERE s.k OPERATOR(extensions.%>) ok.n OR s.k LIKE '%' || ok.n || '%'
  UNION ALL
  SELECT 'aluno', s.id, s.nm, 'identificador oficial', 'identificador-exato', 1.5, '', ''
    FROM public.student_official_identifiers i JOIN students s ON s.id = i.student_id, ok WHERE i.value = ok.raw
  UNION ALL
  SELECT 'escola', s.id, s.nm, s.district, 'nome', extensions.word_similarity(ok.n, s.k), s.k, ok.n
    FROM schools s, ok WHERE s.k OPERATOR(extensions.%>) ok.n OR s.k LIKE '%' || ok.n || '%'
  UNION ALL
  SELECT 'turma', c.id, c.name, coalesce(c.school_label_snapshot,'') || ' · ' || coalesce(c.academic_year_label,''),
    CASE WHEN c.code = ok.raw THEN 'codigo-exato' ELSE 'nome' END,
    CASE WHEN c.code = ok.raw THEN 1.5 ELSE extensions.word_similarity(ok.n, public.sigem_search_norm(c.name || ' ' || c.code)) END,
    public.sigem_search_norm(c.name || ' ' || c.code), ok.n
    FROM public.institutional_classes c, ok
    WHERE c.code = ok.raw OR public.sigem_search_norm(c.name || ' ' || c.code) OPERATOR(extensions.%>) ok.n OR public.sigem_search_norm(c.name || ' ' || c.code) LIKE '%' || ok.n || '%'
  UNION ALL
  SELECT 'pessoa', p.id::text, p.display_name, CASE WHEN p.actor_nature = 'orgao-institucional' THEN 'órgão institucional' ELSE NULL END, 'nome',
    extensions.word_similarity(ok.n, public.sigem_search_norm(p.display_name)), public.sigem_search_norm(p.display_name), ok.n
    FROM public.institutional_persons p, ok
    WHERE public.sigem_search_norm(p.display_name) OPERATOR(extensions.%>) ok.n OR public.sigem_search_norm(p.display_name) LIKE '%' || ok.n || '%'
  UNION ALL
  SELECT 'matriz', m.id, m.nm, NULL, 'nome', extensions.word_similarity(ok.n, m.k), m.k, ok.n
    FROM matrices m, ok WHERE m.k OPERATOR(extensions.%>) ok.n OR m.k LIKE '%' || ok.n || '%'
  UNION ALL
  SELECT 'componente', c.id, c.nm, CASE WHEN c.is_active THEN NULL ELSE 'inativo' END, 'nome', extensions.word_similarity(ok.n, c.k), c.k, ok.n
    FROM components c, ok WHERE c.k OPERATOR(extensions.%>) ok.n OR c.k LIKE '%' || ok.n || '%'
)
SELECT h.cat, h.id, h.nm, h.sub,
  CASE WHEN h.mk = 'nome' AND h.k LIKE h.n || '%' THEN 'inicio-do-nome' ELSE h.mk END,
  (CASE WHEN h.mk = 'nome' AND h.k LIKE h.n || '%' THEN 1.2 ELSE h.sc END)::real
FROM (SELECT DISTINCT ON (cat, id) * FROM hits ORDER BY cat, id, sc DESC) h
WHERE _categories IS NULL OR h.cat = ANY(_categories)
ORDER BY 6 DESC, h.nm, h.id
LIMIT LEAST(GREATEST(coalesce(_limit,20),1),50) OFFSET GREATEST(coalesce(_offset,0),0)
$$;
REVOKE EXECUTE ON FUNCTION public.global_search(text, text[], int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_search(text, text[], int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sigem_search_norm(text) TO authenticated;