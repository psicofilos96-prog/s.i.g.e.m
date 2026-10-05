CREATE OR REPLACE FUNCTION public.global_search(_q text, _categories text[] DEFAULT NULL, _limit int DEFAULT 20, _offset int DEFAULT 0)
RETURNS TABLE(category text, entity_id text, title text, subtitle text, match_kind text, score real)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE n text := public.sigem_search_norm(pg_catalog.btrim(coalesce(_q,'')));
  raw text := pg_catalog.btrim(coalesce(_q,'')); pat text; lim int := LEAST(GREATEST(coalesce(_limit,20),1),50);
BEGIN
  IF pg_catalog.length(n) < 2 THEN RETURN; END IF;
  pat := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(n,'\','\\'),'%','\%'),'_','\_') || '%';
  RETURN QUERY
  WITH hits AS (
    SELECT 'aluno'::text cat, x.student_id id, x.nm, NULL::text sub, x.k
    FROM (SELECT DISTINCT ON (v.student_id) v.student_id, coalesce(nullif(v.social_name,''), v.civil_name) nm,
            public.sigem_search_norm(coalesce(v.social_name,'') || ' ' || v.civil_name) k, v.version
          FROM public.student_identity_versions v
          WHERE v.student_id IN (SELECT w.student_id FROM public.student_identity_versions w
                                 WHERE public.sigem_search_norm(coalesce(w.social_name,'') || ' ' || w.civil_name) LIKE pat
                                    OR n OPERATOR(extensions.<%) public.sigem_search_norm(coalesce(w.social_name,'') || ' ' || w.civil_name))
          ORDER BY v.student_id, v.version DESC) x
    WHERE x.k LIKE pat OR n OPERATOR(extensions.<%) x.k
    UNION ALL
    SELECT 'aluno', i.student_id, coalesce((SELECT coalesce(nullif(v.social_name,''), v.civil_name) FROM public.student_identity_versions v WHERE v.student_id = i.student_id ORDER BY v.version DESC LIMIT 1), 'Estudante'),
      'identificador oficial', '#exato'
    FROM public.student_official_identifiers i WHERE i.value = raw
    UNION ALL
    SELECT 'escola', x.school_id, x.official_name, x.district, x.k
    FROM (SELECT DISTINCT ON (s.school_id) s.school_id, s.official_name, s.district, public.sigem_search_norm(s.official_name) k
          FROM public.institutional_school_record_versions s ORDER BY s.school_id, s.version_number DESC) x
    WHERE x.k LIKE pat OR n OPERATOR(extensions.<%) x.k
    UNION ALL
    SELECT 'turma', c.id, c.name, pg_catalog.concat_ws(' · ', c.school_label_snapshot, c.academic_year_label),
      CASE WHEN c.code = raw THEN '#exato' ELSE public.sigem_search_norm(c.name || ' ' || c.code) END
    FROM public.institutional_classes c
    WHERE c.code = raw OR public.sigem_search_norm(c.name || ' ' || c.code) LIKE pat OR n OPERATOR(extensions.<%) public.sigem_search_norm(c.name || ' ' || c.code)
    UNION ALL
    SELECT 'pessoa', p.id::text, p.display_name, CASE WHEN p.actor_nature = 'orgao-institucional' THEN 'órgão institucional' END, public.sigem_search_norm(p.display_name)
    FROM public.institutional_persons p
    WHERE public.sigem_search_norm(p.display_name) LIKE pat OR n OPERATOR(extensions.<%) public.sigem_search_norm(p.display_name)
    UNION ALL
    SELECT 'matriz', x.matrix_id, x.official_name, NULL, x.k
    FROM (SELECT DISTINCT ON (m.matrix_id) m.matrix_id, m.official_name, public.sigem_search_norm(m.official_name) k
          FROM public.curricular_matrix_versions m ORDER BY m.matrix_id, m.version DESC) x
    WHERE x.k LIKE pat OR n OPERATOR(extensions.<%) x.k
    UNION ALL
    SELECT 'componente', x.component_id, x.official_name, CASE WHEN x.is_active THEN NULL ELSE 'inativo' END, x.k
    FROM (SELECT DISTINCT ON (c.component_id) c.component_id, c.official_name, c.is_active, public.sigem_search_norm(c.official_name || ' ' || coalesce(c.short_name,'')) k
          FROM public.curricular_component_versions c ORDER BY c.component_id, c.version DESC) x
    WHERE x.k LIKE pat OR n OPERATOR(extensions.<%) x.k
  ), ranked AS (
    SELECT h.cat, h.id, h.nm, h.sub,
      CASE WHEN h.k = '#exato' THEN 'identificador-exato' WHEN h.k LIKE n || '%' THEN 'inicio-do-nome' WHEN h.k LIKE pat THEN 'contem' ELSE 'aproximado' END mk,
      (CASE WHEN h.k = '#exato' THEN 2 WHEN h.k LIKE n || '%' THEN 1.5 WHEN h.k LIKE pat THEN 1 ELSE extensions.word_similarity(n, h.k) END)::real sc
    FROM hits h WHERE _categories IS NULL OR h.cat = ANY(_categories)
  )
  SELECT r.cat, r.id, r.nm, r.sub, r.mk, r.sc FROM (SELECT DISTINCT ON (cat, id) * FROM ranked ORDER BY cat, id, sc DESC) r
  ORDER BY r.sc DESC, r.nm, r.id LIMIT lim OFFSET GREATEST(coalesce(_offset,0),0);
END $$;