-- BT — Writers governados para as seis regras institucionais consumidas por motores oficiais.
-- Aditivo: nenhuma tabela/consumidor existente é alterado. Rascunhos e atos de homologação
-- vivem em ledgers append-only próprios; só a homologação insere a linha na tabela que o motor
-- já lê (com o status homologado que o motor exige). Nenhuma regra, policy ou concessão é criada.

CREATE TABLE public.institutional_rule_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN ('correcao-diario','correcao-avaliacao','fechamento-ciclo','calculo-frequencia','tipo-ocorrencia-frequencia','configuracao-colegiado')),
  logical_id text NOT NULL CHECK (logical_id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  version integer NOT NULL CHECK (version >= 1),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  valid_from date,
  valid_until date,
  reason text NOT NULL CHECK (btrim(reason) <> '' AND length(reason) <= 2000),
  source_ref text CHECK (source_ref IS NULL OR (btrim(source_ref) <> '' AND length(source_ref) <= 500)),
  recorded_by uuid NOT NULL,
  recorded_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.institutional_rule_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL UNIQUE REFERENCES public.institutional_rule_drafts(id),
  domain text NOT NULL,
  logical_id text NOT NULL,
  version integer NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> '' AND length(reason) <= 2000),
  source_ref text CHECK (source_ref IS NULL OR (btrim(source_ref) <> '' AND length(source_ref) <= 500)),
  homologated_by uuid NOT NULL,
  homologated_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  homologated_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  homologated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, logical_id, version)
);

REVOKE ALL ON public.institutional_rule_drafts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.institutional_rule_homologations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.institutional_rule_drafts TO service_role;
GRANT ALL ON public.institutional_rule_homologations TO service_role;
ALTER TABLE public.institutional_rule_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_rule_homologations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER institutional_rule_drafts_append_only BEFORE UPDATE OR DELETE ON public.institutional_rule_drafts
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_rule_homologations_append_only BEFORE UPDATE OR DELETE ON public.institutional_rule_homologations
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Capacidades por domínio. Reutiliza as já usadas pelo domínio (colegiado/encerramento);
-- as demais são novas e específicas. Nenhuma recebe regra de policy aqui.
CREATE FUNCTION public.institutional_rule_capability(_domain text, _action text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE _domain
    WHEN 'correcao-diario' THEN _action || '-politica-correcao-diario'
    WHEN 'correcao-avaliacao' THEN _action || '-politica-correcao-avaliacao'
    WHEN 'fechamento-ciclo' THEN _action || '-encerramento'
    WHEN 'calculo-frequencia' THEN _action || '-politica-calculo-frequencia'
    WHEN 'tipo-ocorrencia-frequencia' THEN _action || '-tipos-ocorrencia-frequencia'
    WHEN 'configuracao-colegiado' THEN _action || '-colegiado'
  END WHERE _action IN ('configurar','homologar')
$$;

CREATE FUNCTION public.institutional_rule_engagement(_capability text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.engagement_id FROM public.effective_scope_capabilities(current_date) e
   WHERE e.capability_id = _capability AND e.scope_level = 'rede'
   ORDER BY e.engagement_id LIMIT 1
$$;

CREATE FUNCTION public.institutional_rule_slug_array_issue(_v jsonb, _field text, _nullable boolean)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN _v IS NULL OR jsonb_typeof(_v) = 'null' THEN CASE WHEN _nullable THEN NULL ELSE 'institutional-rule:payload-invalid:' || _field END
    WHEN jsonb_typeof(_v) <> 'array' OR jsonb_array_length(_v) > 50 THEN 'institutional-rule:payload-invalid:' || _field
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(_v) x WHERE jsonb_typeof(x) <> 'string' OR NOT ((x #>> '{}') ~ '^[a-z0-9][a-z0-9-]{1,99}$')) THEN 'institutional-rule:payload-invalid:' || _field
    WHEN (SELECT count(*) FROM jsonb_array_elements_text(_v)) <> (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(_v) x) THEN 'institutional-rule:payload-duplicated:' || _field
  END
$$;

-- Contrato fechado por domínio: chaves desconhecidas, tipos errados e enums fora da lista são recusados.
CREATE FUNCTION public.institutional_rule_payload_issue(_domain text, _p jsonb, _valid_from date, _valid_until date)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed text[]; k text; issue text; temporal boolean;
BEGIN
  IF _p IS NULL OR jsonb_typeof(_p) <> 'object' THEN RETURN 'institutional-rule:payload-invalid'; END IF;
  IF pg_catalog.octet_length(_p::text) > 65536 THEN RETURN 'institutional-rule:payload-too-large'; END IF;
  allowed := CASE _domain
    WHEN 'correcao-diario' THEN ARRAY['familyId','appliesWhenOfficialClosing','outcome','requiredCapabilities','requirementCodes','admissibleChanges','definition']
    WHEN 'correcao-avaliacao' THEN ARRAY['classId','appliesWhenPeriodClosing','outcome','requiredCapabilities','requirementCodes','admissibleValueKinds','definition']
    WHEN 'fechamento-ciclo' THEN ARRAY['definition','closingCapabilities','rectificationCapabilities','reopeningCapabilities']
    WHEN 'calculo-frequencia' THEN ARRAY['definition']
    WHEN 'tipo-ocorrencia-frequencia' THEN ARRAY['code','label','description','requiresDocument']
    WHEN 'configuracao-colegiado' THEN ARRAY['definition','conductCapabilities']
  END;
  IF allowed IS NULL THEN RETURN 'institutional-rule:domain-invalid'; END IF;
  FOR k IN SELECT jsonb_object_keys(_p) LOOP
    IF NOT (k = ANY (allowed)) THEN RETURN 'institutional-rule:payload-unknown-field:' || k; END IF;
  END LOOP;
  FOREACH k IN ARRAY allowed LOOP
    IF NOT (_p ? k) AND k NOT IN ('admissibleChanges','admissibleValueKinds','classId','description') THEN RETURN 'institutional-rule:payload-missing:' || k; END IF;
  END LOOP;
  temporal := _domain IN ('correcao-diario','correcao-avaliacao','calculo-frequencia','tipo-ocorrencia-frequencia');
  IF temporal AND _valid_from IS NULL THEN RETURN 'institutional-rule:validity-required'; END IF;
  IF NOT temporal AND (_valid_from IS NOT NULL OR _valid_until IS NOT NULL) THEN RETURN 'institutional-rule:validity-not-applicable'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RETURN 'institutional-rule:validity-invalid'; END IF;
  IF _p ? 'definition' AND jsonb_typeof(_p->'definition') <> 'object' THEN RETURN 'institutional-rule:payload-invalid:definition'; END IF;

  IF _domain = 'correcao-diario' THEN
    IF jsonb_typeof(_p->'familyId') <> 'string' OR NOT ((_p->>'familyId') ~ '^[a-z0-9][a-z0-9-]{1,79}$') THEN RETURN 'institutional-rule:payload-invalid:familyId'; END IF;
    IF coalesce(_p->>'appliesWhenOfficialClosing','') NOT IN ('present','absent','any') THEN RETURN 'institutional-rule:payload-invalid:appliesWhenOfficialClosing'; END IF;
    IF coalesce(_p->>'outcome','') NOT IN ('admissible','forbidden') THEN RETURN 'institutional-rule:payload-invalid:outcome'; END IF;
    issue := coalesce(public.institutional_rule_slug_array_issue(_p->'requiredCapabilities','requiredCapabilities',false),
                      public.institutional_rule_slug_array_issue(_p->'requirementCodes','requirementCodes',false),
                      public.institutional_rule_slug_array_issue(_p->'admissibleChanges','admissibleChanges',true));
  ELSIF _domain = 'correcao-avaliacao' THEN
    IF _p ? 'classId' AND jsonb_typeof(_p->'classId') <> 'null' THEN
      IF jsonb_typeof(_p->'classId') <> 'string' OR NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id::text = _p->>'classId') THEN
        RETURN 'institutional-rule:payload-invalid:classId'; END IF;
    END IF;
    IF coalesce(_p->>'appliesWhenPeriodClosing','') NOT IN ('present','absent','any') THEN RETURN 'institutional-rule:payload-invalid:appliesWhenPeriodClosing'; END IF;
    IF coalesce(_p->>'outcome','') NOT IN ('admissible','forbidden') THEN RETURN 'institutional-rule:payload-invalid:outcome'; END IF;
    issue := coalesce(public.institutional_rule_slug_array_issue(_p->'requiredCapabilities','requiredCapabilities',false),
                      public.institutional_rule_slug_array_issue(_p->'requirementCodes','requirementCodes',false),
                      public.institutional_rule_slug_array_issue(_p->'admissibleValueKinds','admissibleValueKinds',true));
  ELSIF _domain = 'fechamento-ciclo' THEN
    issue := coalesce(public.institutional_rule_slug_array_issue(_p->'closingCapabilities','closingCapabilities',false),
                      public.institutional_rule_slug_array_issue(_p->'rectificationCapabilities','rectificationCapabilities',false),
                      public.institutional_rule_slug_array_issue(_p->'reopeningCapabilities','reopeningCapabilities',false));
  ELSIF _domain = 'tipo-ocorrencia-frequencia' THEN
    IF jsonb_typeof(_p->'code') <> 'string' OR NOT ((_p->>'code') ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$') THEN RETURN 'institutional-rule:payload-invalid:code'; END IF;
    IF jsonb_typeof(_p->'label') <> 'string' OR btrim(_p->>'label') = '' OR length(_p->>'label') > 200 THEN RETURN 'institutional-rule:payload-invalid:label'; END IF;
    IF _p ? 'description' AND (jsonb_typeof(_p->'description') <> 'string' OR length(_p->>'description') > 2000) THEN RETURN 'institutional-rule:payload-invalid:description'; END IF;
    IF jsonb_typeof(_p->'requiresDocument') <> 'boolean' THEN RETURN 'institutional-rule:payload-invalid:requiresDocument'; END IF;
  ELSIF _domain = 'configuracao-colegiado' THEN
    issue := public.institutional_rule_slug_array_issue(_p->'conductCapabilities','conductCapabilities',false);
  END IF;
  RETURN issue;
END $$;

CREATE FUNCTION public.institutional_rule_target_head(_domain text, _logical text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE _domain
    WHEN 'correcao-diario' THEN (SELECT max(version) FROM public.diary_correction_policies WHERE logical_policy_id = _logical)
    WHEN 'correcao-avaliacao' THEN (SELECT max(version) FROM public.assessment_correction_policies WHERE logical_policy_id = _logical)
    WHEN 'fechamento-ciclo' THEN (SELECT max(version) FROM public.cycle_closing_policies WHERE id = _logical)
    WHEN 'calculo-frequencia' THEN (SELECT max(version) FROM public.attendance_calculation_policies WHERE id = _logical)
    WHEN 'tipo-ocorrencia-frequencia' THEN (SELECT max(version) FROM public.attendance_occurrence_types WHERE id = _logical)
    WHEN 'configuracao-colegiado' THEN (SELECT max(version) FROM public.collegial_body_configurations WHERE id = _logical)
  END
$$;

CREATE FUNCTION public.institutional_rule_record_draft(_domain text, _logical text, _expected integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := public.current_person_id(); cap text := public.institutional_rule_capability(_domain, 'configurar'); eng uuid; head integer; issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF cap IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF NOT public.has_network_capability(cap) THEN RAISE EXCEPTION 'institutional-rule:capability-missing:%', cap; END IF;
  eng := public.institutional_rule_engagement(cap);
  IF eng IS NULL THEN RAISE EXCEPTION 'institutional-rule:engagement-missing'; END IF;
  IF coalesce(_logical,'') !~ '^[a-z0-9][a-z0-9-]{2,79}$' THEN RAISE EXCEPTION 'institutional-rule:id-invalid'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'institutional-rule:reason-required'; END IF;
  issue := public.institutional_rule_payload_issue(_domain, _payload, _valid_from, _valid_until);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('institutional-rule:' || _domain || ':' || _logical));
  SELECT GREATEST(coalesce((SELECT max(version) FROM public.institutional_rule_drafts WHERE domain = _domain AND logical_id = _logical), 0),
                  coalesce(public.institutional_rule_target_head(_domain, _logical), 0)) INTO head;
  IF head IS DISTINCT FROM coalesce(_expected, 0) THEN RAISE EXCEPTION 'institutional-rule:stale-head'; END IF;
  INSERT INTO public.institutional_rule_drafts(domain, logical_id, version, payload, valid_from, valid_until, reason, source_ref, recorded_by, recorded_person_id, recorded_engagement_id)
  VALUES (_domain, _logical, head + 1, _payload, _valid_from, _valid_until, btrim(_reason), nullif(btrim(coalesce(_source_ref,'')),''), auth.uid(), me, eng);
  RETURN head + 1;
END $$;

CREATE FUNCTION public.institutional_rule_homologate(_domain text, _logical text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := public.current_person_id(); cap text := public.institutional_rule_capability(_domain, 'homologar'); eng uuid; d record; issue text; hid uuid := gen_random_uuid(); ref text; prev uuid; p jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF cap IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF NOT public.has_network_capability(cap) THEN RAISE EXCEPTION 'institutional-rule:capability-missing:%', cap; END IF;
  eng := public.institutional_rule_engagement(cap);
  IF eng IS NULL THEN RAISE EXCEPTION 'institutional-rule:engagement-missing'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'institutional-rule:reason-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('institutional-rule:' || _domain || ':' || coalesce(_logical,'')));
  SELECT * INTO d FROM public.institutional_rule_drafts WHERE domain = _domain AND logical_id = _logical AND version = _version;
  IF d.id IS NULL THEN RAISE EXCEPTION 'institutional-rule:not-found'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_rule_homologations WHERE draft_id = d.id) THEN RAISE EXCEPTION 'institutional-rule:already-homologated'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_rule_drafts WHERE domain = _domain AND logical_id = _logical AND version > _version)
     OR coalesce(public.institutional_rule_target_head(_domain, _logical), 0) >= _version THEN RAISE EXCEPTION 'institutional-rule:stale-head'; END IF;
  IF d.recorded_person_id = me THEN RAISE EXCEPTION 'institutional-rule:segregation'; END IF;
  issue := public.institutional_rule_payload_issue(_domain, d.payload, d.valid_from, d.valid_until);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  p := d.payload;
  ref := 'sigem-homologacao:' || hid::text;
  INSERT INTO public.institutional_rule_homologations(id, draft_id, domain, logical_id, version, reason, source_ref, homologated_by, homologated_person_id, homologated_engagement_id)
  VALUES (hid, d.id, _domain, _logical, _version, btrim(_reason), nullif(btrim(coalesce(_source_ref,'')),''), auth.uid(), me, eng);
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

-- Pré-visualização: valida o contrato sem gravar (mesma função usada pelo writer).
CREATE FUNCTION public.preview_institutional_rule_draft(_domain text, _payload jsonb, _valid_from date, _valid_until date)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cap text := public.institutional_rule_capability(_domain, 'configurar');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF cap IS NULL THEN RAISE EXCEPTION 'institutional-rule:domain-invalid'; END IF;
  IF NOT public.has_network_capability(cap) THEN RAISE EXCEPTION 'institutional-rule:capability-missing:%', cap; END IF;
  RETURN public.institutional_rule_payload_issue(_domain, _payload, _valid_from, _valid_until);
END $$;

-- Leitor temporal (validOn/knownAt): estado projetado; nunca persistido.
CREATE FUNCTION public.institutional_rule_versions_at(_domain text, _on date, _known_at timestamptz)
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
  RETURN QUERY
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
  FROM d ORDER BY d.logical_id, d.version;
END $$;

-- Writers específicos por domínio (endpoints únicos executáveis por authenticated).
CREATE FUNCTION public.record_diary_correction_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_record_draft('correcao-diario', _logical_id, _expected_version, _valid_from, _valid_until, _payload, _reason, _source_ref) $$;
CREATE FUNCTION public.record_assessment_correction_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_record_draft('correcao-avaliacao', _logical_id, _expected_version, _valid_from, _valid_until, _payload, _reason, _source_ref) $$;
CREATE FUNCTION public.record_cycle_closing_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_record_draft('fechamento-ciclo', _logical_id, _expected_version, _valid_from, _valid_until, _payload, _reason, _source_ref) $$;
CREATE FUNCTION public.record_attendance_calculation_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_record_draft('calculo-frequencia', _logical_id, _expected_version, _valid_from, _valid_until, _payload, _reason, _source_ref) $$;
CREATE FUNCTION public.record_attendance_occurrence_type_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_record_draft('tipo-ocorrencia-frequencia', _logical_id, _expected_version, _valid_from, _valid_until, _payload, _reason, _source_ref) $$;
CREATE FUNCTION public.record_collegial_body_configuration_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_record_draft('configuracao-colegiado', _logical_id, _expected_version, _valid_from, _valid_until, _payload, _reason, _source_ref) $$;

CREATE FUNCTION public.homologate_diary_correction_policy(_logical_id text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_homologate('correcao-diario', _logical_id, _version, _reason, _source_ref) $$;
CREATE FUNCTION public.homologate_assessment_correction_policy(_logical_id text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_homologate('correcao-avaliacao', _logical_id, _version, _reason, _source_ref) $$;
CREATE FUNCTION public.homologate_cycle_closing_policy(_logical_id text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_homologate('fechamento-ciclo', _logical_id, _version, _reason, _source_ref) $$;
CREATE FUNCTION public.homologate_attendance_calculation_policy(_logical_id text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_homologate('calculo-frequencia', _logical_id, _version, _reason, _source_ref) $$;
CREATE FUNCTION public.homologate_attendance_occurrence_type(_logical_id text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_homologate('tipo-ocorrencia-frequencia', _logical_id, _version, _reason, _source_ref) $$;
CREATE FUNCTION public.homologate_collegial_body_configuration(_logical_id text, _version integer, _reason text, _source_ref text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.institutional_rule_homologate('configuracao-colegiado', _logical_id, _version, _reason, _source_ref) $$;

-- Superfície: helpers internos sem EXECUTE para app; endpoints só para authenticated.
REVOKE ALL ON FUNCTION public.institutional_rule_capability(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_engagement(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_slug_array_issue(jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_payload_issue(text, jsonb, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_target_head(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_record_draft(text, text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.institutional_rule_homologate(text, text, integer, text, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.preview_institutional_rule_draft(text, jsonb, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.institutional_rule_versions_at(text, date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_diary_correction_policy_draft(text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_assessment_correction_policy_draft(text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_cycle_closing_policy_draft(text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_attendance_calculation_policy_draft(text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_attendance_occurrence_type_draft(text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_collegial_body_configuration_draft(text, integer, date, date, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_diary_correction_policy(text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_assessment_correction_policy(text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_cycle_closing_policy(text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_attendance_calculation_policy(text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_attendance_occurrence_type(text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_collegial_body_configuration(text, integer, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.preview_institutional_rule_draft(text, jsonb, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_rule_versions_at(text, date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_diary_correction_policy_draft(text, integer, date, date, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_assessment_correction_policy_draft(text, integer, date, date, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cycle_closing_policy_draft(text, integer, date, date, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_calculation_policy_draft(text, integer, date, date, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_occurrence_type_draft(text, integer, date, date, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_collegial_body_configuration_draft(text, integer, date, date, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_diary_correction_policy(text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_assessment_correction_policy(text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_cycle_closing_policy(text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_attendance_calculation_policy(text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_attendance_occurrence_type(text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_collegial_body_configuration(text, integer, text, text) TO authenticated;
