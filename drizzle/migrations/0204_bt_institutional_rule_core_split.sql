-- BT.1 — Separa autorização (endpoint) de núcleo (versão/estado), para provar o núcleo
-- em transação de teste sem forjar policy. Núcleos não têm EXECUTE para nenhum papel de app.

CREATE FUNCTION public.institutional_rule_record_draft_core(_domain text, _logical text, _expected integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text, _actor uuid, _person uuid, _engagement uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head integer; issue text;
BEGIN
  IF _actor IS NULL OR _person IS NULL OR _engagement IS NULL THEN RAISE EXCEPTION 'institutional-rule:author-required'; END IF;
  IF public.institutional_rule_capability(_domain, 'configurar') IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF coalesce(_logical,'') !~ '^[a-z0-9][a-z0-9-]{2,79}$' THEN RAISE EXCEPTION 'institutional-rule:id-invalid'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'institutional-rule:reason-required'; END IF;
  issue := public.institutional_rule_payload_issue(_domain, _payload, _valid_from, _valid_until);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('institutional-rule:' || _domain || ':' || _logical));
  SELECT GREATEST(coalesce((SELECT max(version) FROM public.institutional_rule_drafts WHERE domain = _domain AND logical_id = _logical), 0),
                  coalesce(public.institutional_rule_target_head(_domain, _logical), 0)) INTO head;
  IF head IS DISTINCT FROM coalesce(_expected, 0) THEN RAISE EXCEPTION 'institutional-rule:stale-head'; END IF;
  INSERT INTO public.institutional_rule_drafts(domain, logical_id, version, payload, valid_from, valid_until, reason, source_ref, recorded_by, recorded_person_id, recorded_engagement_id)
  VALUES (_domain, _logical, head + 1, _payload, _valid_from, _valid_until, btrim(_reason), nullif(btrim(coalesce(_source_ref,'')),''), _actor, _person, _engagement);
  RETURN head + 1;
END $$;

CREATE OR REPLACE FUNCTION public.institutional_rule_record_draft(_domain text, _logical text, _expected integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := public.current_person_id(); cap text := public.institutional_rule_capability(_domain, 'configurar'); eng uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF cap IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF NOT public.has_network_capability(cap) THEN RAISE EXCEPTION 'institutional-rule:capability-missing:%', cap; END IF;
  eng := public.institutional_rule_engagement(cap);
  IF eng IS NULL THEN RAISE EXCEPTION 'institutional-rule:engagement-missing'; END IF;
  RETURN public.institutional_rule_record_draft_core(_domain, _logical, _expected, _valid_from, _valid_until, _payload, _reason, _source_ref, auth.uid(), me, eng);
END $$;

CREATE FUNCTION public.institutional_rule_homologate_core(_domain text, _logical text, _version integer, _reason text, _source_ref text, _actor uuid, _person uuid, _engagement uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d record; issue text; hid uuid := gen_random_uuid(); ref text; prev uuid; p jsonb;
BEGIN
  IF _actor IS NULL OR _person IS NULL OR _engagement IS NULL THEN RAISE EXCEPTION 'institutional-rule:author-required'; END IF;
  IF public.institutional_rule_capability(_domain, 'homologar') IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'institutional-rule:reason-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('institutional-rule:' || _domain || ':' || coalesce(_logical,'')));
  SELECT * INTO d FROM public.institutional_rule_drafts WHERE domain = _domain AND logical_id = _logical AND version = _version;
  IF d.id IS NULL THEN RAISE EXCEPTION 'institutional-rule:not-found'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_rule_homologations WHERE draft_id = d.id) THEN RAISE EXCEPTION 'institutional-rule:already-homologated'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_rule_drafts WHERE domain = _domain AND logical_id = _logical AND version > _version)
     OR coalesce(public.institutional_rule_target_head(_domain, _logical), 0) >= _version THEN RAISE EXCEPTION 'institutional-rule:stale-head'; END IF;
  IF d.recorded_person_id = _person THEN RAISE EXCEPTION 'institutional-rule:segregation'; END IF;
  issue := public.institutional_rule_payload_issue(_domain, d.payload, d.valid_from, d.valid_until);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  p := d.payload;
  ref := 'sigem-homologacao:' || hid::text;
  INSERT INTO public.institutional_rule_homologations(id, draft_id, domain, logical_id, version, reason, source_ref, homologated_by, homologated_person_id, homologated_engagement_id)
  VALUES (hid, d.id, _domain, _logical, _version, btrim(_reason), nullif(btrim(coalesce(_source_ref,'')),''), _actor, _person, _engagement);
  IF _domain = 'correcao-diario' THEN
    SELECT id INTO prev FROM public.diary_correction_policies WHERE logical_policy_id = _logical AND status = 'homologada' ORDER BY version DESC LIMIT 1;
    INSERT INTO public.diary_correction_policies(logical_policy_id, version, supersedes_version_id, status, family_id, applies_when_official_closing, outcome,
      required_capabilities, requirement_codes, admissible_changes, definition, valid_from, valid_until, homologated_at, homologation_act_ref)
    VALUES (_logical, _version, prev, 'homologada', p->>'familyId', p->>'appliesWhenOfficialClosing', p->>'outcome',
      ARRAY(SELECT jsonb_array_elements_text(p->'requiredCapabilities')), ARRAY(SELECT jsonb_array_elements_text(p->'requirementCodes')),
      CASE WHEN jsonb_typeof(p->'admissibleChanges') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'admissibleChanges')) END,
      p->'definition', d.valid_from, d.valid_until, now(), ref);
  ELSIF _domain = 'correcao-avaliacao' THEN
    SELECT id INTO prev FROM public.assessment_correction_policies WHERE logical_policy_id = _logical AND status = 'homologated' ORDER BY version DESC LIMIT 1;
    INSERT INTO public.assessment_correction_policies(logical_policy_id, version, supersedes_version_id, status, class_id, applies_when_period_closing, outcome,
      required_capabilities, requirement_codes, admissible_value_kinds, definition, valid_from, valid_until, homologated_at, homologation_act_ref)
    VALUES (_logical, _version, prev, 'homologated', CASE WHEN jsonb_typeof(p->'classId') = 'string' THEN p->>'classId' END, p->>'appliesWhenPeriodClosing', p->>'outcome',
      ARRAY(SELECT jsonb_array_elements_text(p->'requiredCapabilities')), ARRAY(SELECT jsonb_array_elements_text(p->'requirementCodes')),
      CASE WHEN jsonb_typeof(p->'admissibleValueKinds') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'admissibleValueKinds')) END,
      p->'definition', d.valid_from, d.valid_until, now(), ref);
  ELSIF _domain = 'fechamento-ciclo' THEN
    INSERT INTO public.cycle_closing_policies(id, version, status, definition, closing_capabilities, rectification_capabilities, reopening_capabilities, homologated_at, homologation_act_ref)
    VALUES (_logical, _version, 'homologada', p->'definition', ARRAY(SELECT jsonb_array_elements_text(p->'closingCapabilities')),
      ARRAY(SELECT jsonb_array_elements_text(p->'rectificationCapabilities')), ARRAY(SELECT jsonb_array_elements_text(p->'reopeningCapabilities')), now(), ref);
  ELSIF _domain = 'calculo-frequencia' THEN
    INSERT INTO public.attendance_calculation_policies(id, version, status, definition, homologated_at, homologation_act_ref, valid_from, valid_until)
    VALUES (_logical, _version, 'homologada', p->'definition', now(), ref, d.valid_from, d.valid_until);
  ELSIF _domain = 'tipo-ocorrencia-frequencia' THEN
    INSERT INTO public.attendance_occurrence_types(id, version, code, label, description, requires_document, status, homologation_act_ref, valid_from, valid_until)
    VALUES (_logical, _version, p->>'code', btrim(p->>'label'), coalesce(p->>'description',''), (p->>'requiresDocument')::boolean, 'homologada', ref, d.valid_from, d.valid_until);
  ELSIF _domain = 'configuracao-colegiado' THEN
    INSERT INTO public.collegial_body_configurations(id, version, status, definition, conduct_capabilities, homologated_at, homologation_act_ref)
    VALUES (_logical, _version, 'homologated', p->'definition', ARRAY(SELECT jsonb_array_elements_text(p->'conductCapabilities')), now(), ref);
  END IF;
  RETURN hid;
END $$;

CREATE OR REPLACE FUNCTION public.institutional_rule_homologate(_domain text, _logical text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := public.current_person_id(); cap text := public.institutional_rule_capability(_domain, 'homologar'); eng uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF cap IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF NOT public.has_network_capability(cap) THEN RAISE EXCEPTION 'institutional-rule:capability-missing:%', cap; END IF;
  eng := public.institutional_rule_engagement(cap);
  IF eng IS NULL THEN RAISE EXCEPTION 'institutional-rule:engagement-missing'; END IF;
  RETURN public.institutional_rule_homologate_core(_domain, _logical, _version, _reason, _source_ref, auth.uid(), me, eng);
END $$;

CREATE FUNCTION public.institutional_rule_versions_core(_domain text, _on date, _known_at timestamptz)
RETURNS TABLE(logical_id text, version integer, state text, valid_from date, valid_until date, payload jsonb, reason text, source_ref text,
  recorded_at timestamptz, recorded_person_id uuid, homologation_id uuid, homologated_at timestamptz, homologated_person_id uuid, homologation_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH d AS (
    SELECT r.*, h.id AS hid, h.homologated_at AS hat, h.homologated_person_id AS hperson, h.reason AS hreason
      FROM public.institutional_rule_drafts r
      LEFT JOIN public.institutional_rule_homologations h ON h.draft_id = r.id AND h.homologated_at <= _known_at
     WHERE r.domain = _domain AND r.recorded_at <= _known_at)
  SELECT d.logical_id, d.version,
    CASE
      WHEN d.hid IS NULL AND EXISTS (SELECT 1 FROM d n WHERE n.logical_id = d.logical_id AND n.version > d.version) THEN 'rascunho-superado'
      WHEN d.hid IS NULL THEN 'rascunho'
      WHEN d.valid_from IS NOT NULL AND d.valid_from > _on THEN 'homologada-futura'
      WHEN d.valid_until IS NOT NULL AND d.valid_until < _on THEN 'expirada'
      WHEN EXISTS (SELECT 1 FROM d n WHERE n.logical_id = d.logical_id AND n.version > d.version AND n.hid IS NOT NULL
                     AND (n.valid_from IS NULL OR n.valid_from <= _on)) THEN 'superada'
      ELSE 'vigente' END,
    d.valid_from, d.valid_until, d.payload, d.reason, d.source_ref, d.recorded_at, d.recorded_person_id, d.hid, d.hat, d.hperson, d.hreason
  FROM d ORDER BY d.logical_id, d.version
$$;

CREATE OR REPLACE FUNCTION public.institutional_rule_versions_at(_domain text, _on date, _known_at timestamptz)
RETURNS TABLE(logical_id text, version integer, state text, valid_from date, valid_until date, payload jsonb, reason text, source_ref text,
  recorded_at timestamptz, recorded_person_id uuid, homologation_id uuid, homologated_at timestamptz, homologated_person_id uuid, homologation_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF public.institutional_rule_capability(_domain, 'configurar') IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'institutional-rule:reference-required'; END IF;
  IF NOT (public.has_network_capability(public.institutional_rule_capability(_domain, 'configurar'))
       OR public.has_network_capability(public.institutional_rule_capability(_domain, 'homologar'))) THEN
    RAISE EXCEPTION 'institutional-rule:access-denied'; END IF;
  RETURN QUERY SELECT * FROM public.institutional_rule_versions_core(_domain, _on, _known_at);
END $$;

REVOKE ALL ON FUNCTION public.institutional_rule_record_draft_core(text, text, integer, date, date, jsonb, text, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_homologate_core(text, text, integer, text, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_versions_core(text, date, timestamptz) FROM PUBLIC, anon, authenticated;
