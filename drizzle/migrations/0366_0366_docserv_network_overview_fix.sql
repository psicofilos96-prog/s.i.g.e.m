-- nome da escola vem do cadastro vigente no cliente (readCurrentSchoolNames).
CREATE OR REPLACE FUNCTION public.docserv_network_overview(_season text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT (public.has_network_capability('administrar-docserv') OR public.has_network_capability('validar-documentos-funcionais')) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _season !~ '^\d{4}$' THEN RAISE EXCEPTION 'docserv:invalid-season'; END IF;
  WITH sp AS (
    SELECT s.id::text AS school_id, s.id::text AS school_name, x.person_id FROM public.institutional_schools s CROSS JOIN LATERAL public.docserv_school_people(s.id::text) x
  ), cur AS (
    SELECT DISTINCT ON (v.person_id, v.type_code) v.person_id, v.type_code, v.document_id, v.valid_until, e.kind,
      (SELECT e2.status FROM public.docserv_document_events e2 WHERE e2.version_id = v.id AND e2.status IS NOT NULL ORDER BY e2.seq DESC LIMIT 1) AS st
    FROM (SELECT DISTINCT ON (document_id) * FROM public.docserv_document_versions ORDER BY document_id, version DESC) v
    JOIN LATERAL (SELECT * FROM public.docserv_document_events x WHERE x.document_id = v.document_id ORDER BY x.seq DESC LIMIT 1) e ON true
    WHERE v.season = _season AND e.kind <> 'excluido-logico' ORDER BY v.person_id, v.type_code, v.submitted_at DESC
  ), crim AS (
    SELECT p.person_id, CASE WHEN c.document_id IS NULL THEN 'sem-envio' WHEN c.valid_until < current_date THEN 'problema'
      WHEN c.st = 'valido' THEN 'valido' WHEN coalesce(c.st, 'pendente_validacao') = 'pendente_validacao' THEN 'pendente' ELSE 'problema' END AS st
    FROM (SELECT DISTINCT person_id FROM sp) p LEFT JOIN cur c ON c.person_id = p.person_id AND c.type_code = 'antecedente_criminal'
  )
  SELECT jsonb_build_object('season', _season,
    'can_validate', public.has_network_capability('validar-documentos-funcionais'),
    'totals', jsonb_build_object('servidores', (SELECT count(*) FROM crim),
       'sem-envio', (SELECT count(*) FROM crim WHERE st = 'sem-envio'), 'pendente', (SELECT count(*) FROM crim WHERE st = 'pendente'),
       'problema', (SELECT count(*) FROM crim WHERE st = 'problema'), 'valido', (SELECT count(*) FROM crim WHERE st = 'valido'),
       'multiescola', (SELECT count(*) FROM (SELECT person_id FROM sp GROUP BY person_id HAVING count(*) > 1) m),
       'escolas_sem_servidor', (SELECT count(*) FROM public.institutional_schools s WHERE NOT EXISTS (SELECT 1 FROM sp WHERE sp.school_id = s.id::text))),
    'schools', coalesce((SELECT jsonb_agg(jsonb_build_object('school_id', g.school_id, 'name', g.school_name, 'servidores', g.n, 'sem_envio', g.se, 'pendente', g.pe, 'problema', g.pr, 'valido', g.va) ORDER BY g.school_name)
       FROM (SELECT sp.school_id, sp.school_name, count(DISTINCT sp.person_id) n,
               count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'sem-envio') se, count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'pendente') pe,
               count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'problema') pr, count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'valido') va
             FROM sp JOIN crim c ON c.person_id = sp.person_id GROUP BY 1, 2) g), '[]'::jsonb),
    'queue', coalesce((SELECT jsonb_agg(jsonb_build_object('document_id', c.document_id, 'type', c.type_code,
        'masked_name', (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = c.person_id),
        'status', coalesce(c.st, 'pendente_validacao'),
        'seq', (SELECT max(seq) FROM public.docserv_document_events e WHERE e.document_id = c.document_id),
        'path', (SELECT v.storage_path FROM public.docserv_document_versions v WHERE v.document_id = c.document_id ORDER BY v.version DESC LIMIT 1)))
      FROM cur c WHERE coalesce(c.st, 'pendente_validacao') IN ('pendente_validacao','alerta_revisao_urgente') AND (c.valid_until IS NULL OR c.valid_until >= current_date)
      LIMIT 300), '[]'::jsonb),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('request_id', q.request_id, 'seq', q.seq, 'school_id', q.school_id, 'kind', q.kind, 'nature', q.nature, 'state', q.state, 'reason', q.reason, 'at', q.recorded_at,
        'person_masked', (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = q.person_id),
        'conflict', EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) o
                            WHERE o.person_id = q.person_id AND o.request_id <> q.request_id AND o.state = 'aberta' AND o.nature = 'titular' AND q.nature = 'titular')) ORDER BY q.recorded_at DESC)
      FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) q WHERE q.state = 'aberta'), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('action', a.action, 'school_id', a.school_id, 'at', a.recorded_at, 'detail', a.detail) ORDER BY a.recorded_at DESC)
      FROM (SELECT * FROM public.docserv_audit_events ORDER BY recorded_at DESC LIMIT 200) a), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;