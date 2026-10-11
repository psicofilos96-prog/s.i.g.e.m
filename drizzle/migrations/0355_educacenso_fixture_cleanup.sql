-- Registros Educacenso só são apagáveis quando de autoria de conta sintética BO da operação em limpeza.
CREATE OR REPLACE FUNCTION public.educacenso_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND public.semed_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'educacenso:append-only';
END $$;
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_educacenso(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.educacenso_school_status_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.educacenso_collection_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.educacenso_layout_registrations e WHERE public.semed_fixture_row(to_jsonb(e))
    AND NOT EXISTS (SELECT 1 FROM public.educacenso_collection_events x WHERE x.layout_registration_id = e.id); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_educacenso(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_educacenso(text) TO service_role;
-- Corrige a coluna do identificador INEP no painel.
CREATE OR REPLACE FUNCTION public.educacenso_control_at(_year text, _stage_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE net boolean; rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  net := public.census_can_read_network() OR public.has_network_capability('preparar-censo-escolar');
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'school_id', s.id,
      'inep', (SELECT i.value FROM public.institutional_school_identifiers i WHERE i.school_id = s.id AND i.identifier_kind = 'inep' LIMIT 1),
      'head', (SELECT jsonb_build_object('seq', e.seq, 'state', e.state, 'protocol_ref', e.protocol_ref, 'reason', e.reason, 'actor_scope', e.actor_scope, 'recorded_at', e.recorded_at)
               FROM public.educacenso_school_status_events e WHERE e.census_year = _year AND e.stage_key = _stage_key AND e.school_id = s.id ORDER BY e.seq DESC LIMIT 1),
      'receipt', (SELECT jsonb_build_object('version', r.version, 'issued_at', r.issued_at, 'closed_at', r.closed_at)
               FROM public.census_official_receipt_snapshots r WHERE r.school_id = s.id AND r.census_year = _year ORDER BY r.version DESC LIMIT 1),
      'enrollments_without_start', (SELECT count(*) FROM public.school_enrollments se WHERE se.school_id = s.id AND se.academic_year_id = _year AND se.opened_on IS NULL)
    ) ORDER BY s.id), '[]'::jsonb) INTO rows
  FROM public.institutional_schools s
  WHERE net OR public.has_school_capability('consultar-pendencias-do-censo', s.id) OR public.has_school_capability('preparar-censo-escolar', s.id);
  RETURN jsonb_build_object('network', net, 'can_configure', public.has_network_capability('preparar-censo-escolar'), 'schools', rows);
END $$;
