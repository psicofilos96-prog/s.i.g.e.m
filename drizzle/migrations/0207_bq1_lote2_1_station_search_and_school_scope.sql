-- BQ.1 Lote 2.1 — busca global por estação (conta de setor): categorias pela capability efetiva, escola própria para escopo escolar.
CREATE OR REPLACE FUNCTION public.global_search(_q text, _categories text[] DEFAULT NULL, _limit int DEFAULT 20, _offset int DEFAULT 0)
RETURNS TABLE(category text, entity_id text, title text, subtitle text, match_kind text, score real)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE n text := public.sigem_search_norm(pg_catalog.btrim(coalesce(_q,'')));
  raw text := pg_catalog.btrim(coalesce(_q,'')); pat text; p2 text; p3 text; toks text[]; lim int := LEAST(GREATEST(coalesce(_limit,20),1),50);
  c_al boolean := _categories IS NULL OR 'aluno' = ANY(_categories);
  c_es boolean := _categories IS NULL OR 'escola' = ANY(_categories);
  c_tu boolean := _categories IS NULL OR 'turma' = ANY(_categories);
  c_pe boolean := _categories IS NULL OR 'pessoa' = ANY(_categories);
  c_ma boolean := _categories IS NULL OR 'matriz' = ANY(_categories);
  c_co boolean := _categories IS NULL OR 'componente' = ANY(_categories);
  _kind text; _pr uuid; _sch text; _scope text;
BEGIN
  SELECT a.actor_kind, a.institutional_principal_id, a.school_id, a.scope_kind INTO _kind, _pr, _sch, _scope FROM public.current_actor() a;
  IF _kind = 'institutional' THEN
    IF _scope = 'school' AND _sch IS NULL THEN RETURN; END IF;
    IF _scope <> 'school' THEN _sch := NULL; END IF;
    c_al := c_al AND EXISTS (SELECT 1 FROM public.effective_capabilities() e WHERE e.capability_id = 'consultar-identidade-cadastral-do-estudante');
    c_tu := c_tu AND EXISTS (SELECT 1 FROM public.effective_capabilities() e WHERE e.capability_id IN ('consultar-estudantes-da-turma','consultar-organizacao-da-oferta','manter-matricula-e-enturmacao'));
    c_pe := c_pe AND EXISTS (SELECT 1 FROM public.effective_capabilities() e WHERE e.capability_id IN ('manter-pessoas-institucionais','manter-contas-institucionais','manter-atuacoes-institucionais'));
    c_ma := c_ma AND EXISTS (SELECT 1 FROM public.effective_capabilities() e WHERE e.capability_id = 'manter-matrizes-curriculares');
    c_co := c_co AND EXISTS (SELECT 1 FROM public.effective_capabilities() e WHERE e.capability_id IN ('manter-matrizes-curriculares','manter-componentes-curriculares'));
  ELSE
    _sch := NULL;
  END IF;
  IF pg_catalog.length(n) < 2 THEN RETURN; END IF;
  SELECT array_agg('%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(t,'\','\\'),'%','\%'),'_','\_') || '%' ORDER BY pg_catalog.length(t) DESC)
    INTO toks FROM pg_catalog.unnest(pg_catalog.string_to_array(n, ' ')) t WHERE t <> '';
  pat := toks[1]; p2 := coalesce(toks[2], '%'); p3 := coalesce(toks[3], '%');
  RETURN QUERY
  WITH hits AS (
    SELECT 'aluno'::text cat, x.student_id id, x.nm, NULL::text sub, x.k
    FROM (SELECT DISTINCT ON (v.student_id) v.student_id, coalesce(nullif(v.social_name,''), v.civil_name) nm,
            public.sigem_search_norm(coalesce(v.social_name,'') || ' ' || v.civil_name) k, v.version
          FROM public.student_identity_versions v
          WHERE c_al AND (_sch IS NULL OR EXISTS (SELECT 1 FROM public.school_enrollments se WHERE se.student_id = v.student_id AND se.school_id = _sch))
            AND v.student_id IN (SELECT w.student_id FROM public.student_identity_versions w
                                 WHERE public.sigem_search_norm(coalesce(w.social_name,'') || ' ' || w.civil_name) LIKE pat AND public.sigem_search_norm(coalesce(w.social_name,'') || ' ' || w.civil_name) LIKE p2 AND public.sigem_search_norm(coalesce(w.social_name,'') || ' ' || w.civil_name) LIKE p3
                                    AND public.sigem_search_all_tokens(public.sigem_search_norm(coalesce(w.social_name,'') || ' ' || w.civil_name), toks))
          ORDER BY v.student_id, v.version DESC) x
    WHERE x.k LIKE pat AND x.k LIKE p2 AND x.k LIKE p3 AND public.sigem_search_all_tokens(x.k, toks)
    UNION ALL
    SELECT 'aluno', i.student_id, coalesce((SELECT coalesce(nullif(v.social_name,''), v.civil_name) FROM public.student_identity_versions v WHERE v.student_id = i.student_id ORDER BY v.version DESC LIMIT 1), 'Estudante'),
      'identificador oficial', '#exato'
    FROM public.student_official_identifiers i WHERE c_al AND i.value = raw AND (_sch IS NULL OR EXISTS (SELECT 1 FROM public.school_enrollments se WHERE se.student_id = i.student_id AND se.school_id = _sch))
    UNION ALL
    SELECT 'escola', x.school_id, x.official_name, x.district, x.k
    FROM (SELECT DISTINCT ON (s.school_id) s.school_id, s.official_name, s.district, public.sigem_search_norm(s.official_name) k
          FROM public.institutional_school_record_versions s WHERE c_es AND (_sch IS NULL OR s.school_id = _sch) ORDER BY s.school_id, s.version_number DESC) x
    WHERE x.k LIKE pat AND x.k LIKE p2 AND x.k LIKE p3 AND public.sigem_search_all_tokens(x.k, toks)
    UNION ALL
    SELECT 'turma', c.id, c.name, pg_catalog.concat_ws(' · ', c.school_label_snapshot, c.academic_year_label),
      CASE WHEN c.code = raw THEN '#exato' ELSE public.sigem_search_norm(c.name || ' ' || c.code) END
    FROM public.institutional_classes c
    WHERE c_tu AND (_sch IS NULL OR c.school_id = _sch) AND (c.code = raw OR (public.sigem_search_norm(c.name || ' ' || c.code) LIKE pat AND public.sigem_search_norm(c.name || ' ' || c.code) LIKE p2 AND public.sigem_search_norm(c.name || ' ' || c.code) LIKE p3 AND public.sigem_search_all_tokens(public.sigem_search_norm(c.name || ' ' || c.code), toks)))
    UNION ALL
    SELECT 'pessoa', p.id::text, p.display_name, CASE WHEN p.actor_nature = 'orgao-institucional' THEN 'órgão institucional' END, public.sigem_search_norm(p.display_name)
    FROM public.institutional_persons p
    WHERE c_pe AND public.sigem_search_norm(p.display_name) LIKE pat AND public.sigem_search_norm(p.display_name) LIKE p2 AND public.sigem_search_norm(p.display_name) LIKE p3 AND public.sigem_search_all_tokens(public.sigem_search_norm(p.display_name), toks)
    UNION ALL
    SELECT 'matriz', x.matrix_id, x.official_name, NULL, x.k
    FROM (SELECT DISTINCT ON (m.matrix_id) m.matrix_id, m.official_name, public.sigem_search_norm(m.official_name) k
          FROM public.curricular_matrix_versions m WHERE c_ma ORDER BY m.matrix_id, m.version DESC) x
    WHERE x.k LIKE pat AND x.k LIKE p2 AND x.k LIKE p3 AND public.sigem_search_all_tokens(x.k, toks)
    UNION ALL
    SELECT 'componente', x.component_id, x.official_name, CASE WHEN x.is_active THEN NULL ELSE 'inativo' END, x.k
    FROM (SELECT DISTINCT ON (c.component_id) c.component_id, c.official_name, c.is_active, public.sigem_search_norm(c.official_name || ' ' || coalesce(c.short_name,'')) k
          FROM public.curricular_component_versions c WHERE c_co ORDER BY c.component_id, c.version DESC) x
    WHERE x.k LIKE pat AND x.k LIKE p2 AND x.k LIKE p3 AND public.sigem_search_all_tokens(x.k, toks)
  ), ranked AS (
    SELECT h.cat, h.id, h.nm, h.sub,
      CASE WHEN h.k = '#exato' THEN 'identificador-exato' WHEN pg_catalog.left(h.k, pg_catalog.length(n)) = n THEN 'inicio-do-nome' WHEN pg_catalog.strpos(h.k, n) > 0 THEN 'contem' ELSE 'todas-as-palavras' END mk,
      (CASE WHEN h.k = '#exato' THEN 2 WHEN pg_catalog.left(h.k, pg_catalog.length(n)) = n THEN 1.5 WHEN pg_catalog.strpos(h.k, n) > 0 THEN 1 ELSE 0.8 END)::real sc
    FROM hits h
  )
  SELECT r.cat, r.id, r.nm, r.sub, r.mk, r.sc FROM (SELECT DISTINCT ON (cat, id) * FROM ranked ORDER BY cat, id, sc DESC) r
  ORDER BY r.sc DESC, r.nm, r.id LIMIT lim OFFSET GREATEST(coalesce(_offset,0),0);
END $$;

-- Conta de setor escolar enxerga só a própria unidade (política restritiva; humanos e rede inalterados).
CREATE FUNCTION public.sector_school_visible(_school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.current_actor() a
                     WHERE a.actor_kind = 'institutional' AND a.scope_kind = 'school' AND a.school_id IS DISTINCT FROM _school) $$;
REVOKE ALL ON FUNCTION public.sector_school_visible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sector_school_visible(text) TO authenticated;
CREATE POLICY "sector school scope" ON public.institutional_school_record_versions AS RESTRICTIVE FOR SELECT TO authenticated USING (public.sector_school_visible(school_id));
CREATE POLICY "sector school scope" ON public.institutional_schools AS RESTRICTIVE FOR SELECT TO authenticated USING (public.sector_school_visible(id));
CREATE POLICY "sector school scope" ON public.institutional_school_identifiers AS RESTRICTIVE FOR SELECT TO authenticated USING (public.sector_school_visible(school_id));