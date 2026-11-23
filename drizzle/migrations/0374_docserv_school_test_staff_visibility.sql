-- Exibe os registros explicitamente fictícios importados para teste no painel da escola.
-- Eles permanecem separados do cadastro canônico: não criam pessoa, vínculo, lotação ou autorização.
CREATE OR REPLACE FUNCTION public.docserv_school_roster(_school text, _season text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _out jsonb; _can_validate boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_school_capability('gerir-documentos-funcionais', _school) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _season !~ '^\\d{4}$' THEN RAISE EXCEPTION 'docserv:invalid-season'; END IF;
  _can_validate := public.has_school_capability('validar-documentos-funcionais', _school);
  WITH ppl AS (SELECT * FROM public.docserv_school_people(_school)),
  docs AS (
    SELECT DISTINCT ON (v.person_id, v.type_code) v.person_id, v.type_code, v.document_id, v.version, v.valid_until, v.storage_path, v.school_id,
      e.kind AS last_kind, e.seq,
      (SELECT e2.status FROM public.docserv_document_events e2 WHERE e2.version_id = v.id AND e2.status IS NOT NULL ORDER BY e2.seq DESC LIMIT 1) AS st
    FROM (SELECT DISTINCT ON (document_id) * FROM public.docserv_document_versions ORDER BY document_id, version DESC) v
    JOIN LATERAL (SELECT * FROM public.docserv_document_events x WHERE x.document_id = v.document_id ORDER BY x.seq DESC LIMIT 1) e ON true
    WHERE v.person_id IN (SELECT person_id FROM ppl) AND v.season = _season AND e.kind <> 'excluido-logico'
    ORDER BY v.person_id, v.type_code, v.submitted_at DESC
  ), rows AS (
    SELECT p.person_id, p.sources, p.functions,
      (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = p.person_id) AS masked,
      (SELECT count(DISTINCT g.school_id) FROM public.institutional_engagements g WHERE g.person_id = p.person_id AND g.school_id IS NOT NULL
         AND g.valid_from <= current_date AND (g.valid_until IS NULL OR g.valid_until >= current_date)) AS schools_count,
      (SELECT jsonb_object_agg(d.type_code, jsonb_build_object('document_id', d.document_id, 'version', d.version, 'seq', d.seq, 'path', d.storage_path,
          'valid_until', d.valid_until, 'by_school', d.school_id IS NOT NULL,
          'status', CASE WHEN d.valid_until IS NOT NULL AND d.valid_until < current_date THEN 'vencido' ELSE coalesce(d.st, 'pendente_validacao') END))
        FROM docs d WHERE d.person_id = p.person_id) AS docs
    FROM ppl p
  )
  SELECT jsonb_build_object('school_id', _school, 'season', _season, 'can_validate', _can_validate,
    'staff_records_without_person', (SELECT count(*) FROM public.staff_administrative_records r WHERE r.school_id = _school
       AND NOT EXISTS (SELECT 1 FROM public.staff_reconciliation_decisions d WHERE d.staff_record_id = r.id AND d.person_id IS NOT NULL)),
    'test_records', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.full_name, 'registration', r.registration, 'cargo', r.cargo, 'function', r.funcao,
        'link', r.vinculo, 'group', r.grupo, 'status', r.situacao, 'observation', r.observacao,
        'reference_period', r.reference_period, 'source_file', r.source_file, 'sheet', r.sheet, 'row_no', r.row_no
      ) ORDER BY r.row_no, r.full_name)
      FROM public.staff_administrative_records r
      WHERE r.school_id = _school AND r.source_kind = 'servidores-por-escola'
        AND r.source_file = 'Escola de teste (dados fictícios)'), '[]'::jsonb),
    'people', coalesce((SELECT jsonb_agg(jsonb_build_object('person_id', r.person_id, 'masked_name', r.masked, 'sources', r.sources, 'functions', r.functions,
        'other_schools', greatest(r.schools_count - 1, 0), 'docs', coalesce(r.docs, '{}'::jsonb)) ORDER BY r.masked NULLS LAST) FROM rows r), '[]'::jsonb),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('request_id', q.request_id, 'seq', q.seq, 'kind', q.kind, 'state', q.state, 'reason', q.reason,
        'person_masked', (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = q.person_id), 'at', q.recorded_at) ORDER BY q.recorded_at DESC)
      FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests WHERE school_id = _school ORDER BY request_id, seq DESC) q), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.docserv_school_roster(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.docserv_school_roster(text, text) TO authenticated;
