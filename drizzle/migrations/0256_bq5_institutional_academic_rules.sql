-- BQ.5 — Regras acadêmicas institucionais (decisão SEMED 2026-10-09).
-- 1) Efeito do tipo de ocorrência na frequência: só "mantem-falta" ou "conta-presenca"; "abono" não existe.
ALTER TABLE public.attendance_occurrence_types ADD COLUMN attendance_effect text
  CHECK (attendance_effect IS NULL OR attendance_effect IN ('mantem-falta','conta-presenca'));
COMMENT ON COLUMN public.attendance_occurrence_types.attendance_effect IS 'BQ.5: efeito declarado na frequência. mantem-falta (falta justificada continua falta) ou conta-presenca (atividade domiciliar formal). Falta abonada não existe.';

CREATE OR REPLACE FUNCTION public.institutional_rule_payload_issue(_domain text, _p jsonb, _valid_from date, _valid_until date)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE allowed text[]; k text; issue text; temporal boolean;
BEGIN
  IF _p IS NULL OR jsonb_typeof(_p) <> 'object' THEN RETURN 'institutional-rule:payload-invalid'; END IF;
  IF pg_catalog.octet_length(_p::text) > 65536 THEN RETURN 'institutional-rule:payload-too-large'; END IF;
  allowed := CASE _domain
    WHEN 'correcao-diario' THEN ARRAY['familyId','appliesWhenOfficialClosing','outcome','requiredCapabilities','requirementCodes','admissibleChanges','definition']
    WHEN 'correcao-avaliacao' THEN ARRAY['classId','appliesWhenPeriodClosing','outcome','requiredCapabilities','requirementCodes','admissibleValueKinds','definition']
    WHEN 'fechamento-ciclo' THEN ARRAY['definition','closingCapabilities','rectificationCapabilities','reopeningCapabilities']
    WHEN 'calculo-frequencia' THEN ARRAY['definition']
    WHEN 'tipo-ocorrencia-frequencia' THEN ARRAY['code','label','description','requiresDocument','attendanceEffect']
    WHEN 'configuracao-colegiado' THEN ARRAY['definition','conductCapabilities']
  END;
  IF allowed IS NULL THEN RETURN 'institutional-rule:domain-invalid'; END IF;
  FOR k IN SELECT jsonb_object_keys(_p) LOOP
    IF NOT (k = ANY (allowed)) THEN RETURN 'institutional-rule:payload-unknown-field:' || k; END IF;
  END LOOP;
  FOREACH k IN ARRAY allowed LOOP
    IF NOT (_p ? k) AND k NOT IN ('admissibleChanges','admissibleValueKinds','classId','description','attendanceEffect') THEN RETURN 'institutional-rule:payload-missing:' || k; END IF;
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
    IF _p ? 'attendanceEffect' AND coalesce(_p->>'attendanceEffect','') NOT IN ('mantem-falta','conta-presenca') THEN RETURN 'institutional-rule:payload-invalid:attendanceEffect'; END IF;
  ELSIF _domain = 'configuracao-colegiado' THEN
    issue := public.institutional_rule_slug_array_issue(_p->'conductCapabilities','conductCapabilities',false);
  END IF;
  RETURN issue;
END $function$;

CREATE OR REPLACE FUNCTION public.institutional_rule_homologate_core(_domain text, _logical text, _version integer, _reason text, _source_ref text, _actor uuid, _person uuid, _engagement uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    INSERT INTO public.attendance_occurrence_types(id, version, code, label, description, requires_document, status, homologation_act_ref, valid_from, valid_until, attendance_effect)
    VALUES (_logical, _version, p->>'code', btrim(p->>'label'), coalesce(p->>'description',''), (p->>'requiresDocument')::boolean, 'homologada', ref, d.valid_from, d.valid_until, p->>'attendanceEffect');
  ELSIF _domain = 'configuracao-colegiado' THEN
    INSERT INTO public.collegial_body_configurations(id, version, status, definition, conduct_capabilities, homologated_at, homologation_act_ref)
    VALUES (_logical, _version, 'homologated', p->'definition', ARRAY(SELECT jsonb_array_elements_text(p->'conductCapabilities')), now(), ref);
  END IF;
  RETURN hid;
END $function$;

-- 2) Capacidades novas e regras de estação v4 (sem reabertura pela Direção).
INSERT INTO public.sigem_capability_catalog(capability_id, origin) VALUES
  ('aprovar-diario-pela-orientacao','bq5-decisao-semed-2026-10-09'),
  ('aprovar-diario-pela-direcao','bq5-decisao-semed-2026-10-09'),
  ('conduzir-conselho-de-classe','bq5-decisao-semed-2026-10-09');
INSERT INTO public.sector_station_rule_versions(rules_version, status, valid_from, decision_ref)
VALUES (4, 'homologated', DATE '2026-10-09', 'decisao-semed-bq5-2026-10-09');
INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref)
SELECT 4, r.station_code, r.capability_id, 'decisao-semed-bq5-2026-10-09' FROM public.sector_station_rules r
 WHERE r.rules_version = 3 AND r.station_code <> 'administracao_geral'
   AND NOT (r.station_code = 'direcao_escolar' AND r.capability_id IN ('reabrir-periodo-fechado','reabrir-frequencia-fechada','autorizar-retificacao-pos-fechamento'))
UNION SELECT 4, s, c, 'decisao-semed-bq5-2026-10-09' FROM (VALUES
  ('orientacao_pedagogica','aprovar-diario-pela-orientacao'),('orientacao_pedagogica','conduzir-conselho-de-classe'),
  ('direcao_escolar','aprovar-diario-pela-direcao'),('direcao_escolar','conduzir-conselho-de-classe')) v(s,c)
UNION SELECT 4, 'administracao_geral', k.capability_id, 'decisao-semed-bq5-2026-10-09' FROM public.sigem_capability_catalog k;

-- 3) Aprovações do Diário do professor (OP + Direção), após Conselho de Classe.
CREATE TABLE public.teacher_diary_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id text NOT NULL REFERENCES public.teaching_assignments(id),
  class_id text NOT NULL,
  school_id text NOT NULL,
  period_id text NOT NULL,
  approver_station text NOT NULL CHECK (approver_station IN ('orientacao_pedagogica','direcao_escolar')),
  collegial_minute_id text NOT NULL REFERENCES public.collegial_minute_versions(id),
  author_user_id uuid NOT NULL,
  author_person_id uuid,
  author_principal_id uuid,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, period_id, approver_station),
  CHECK (author_person_id IS NOT NULL OR author_principal_id IS NOT NULL)
);
GRANT ALL ON public.teacher_diary_approvals TO service_role;
ALTER TABLE public.teacher_diary_approvals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teacher_diary_approvals_immutable BEFORE UPDATE OR DELETE ON public.teacher_diary_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();
CREATE INDEX teacher_diary_approvals_class_period ON public.teacher_diary_approvals(class_id, period_id);

CREATE FUNCTION public.teacher_diary_closed(_assignment text, _period text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT count(DISTINCT a.approver_station) = 2 FROM public.teacher_diary_approvals a
   WHERE a.assignment_id = _assignment AND a.period_id = _period $$;
REVOKE ALL ON FUNCTION public.teacher_diary_closed(text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.class_period_any_diary_closed(_class text, _period text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.teacher_diary_approvals a WHERE a.class_id = _class AND a.period_id = _period
    GROUP BY a.assignment_id HAVING count(DISTINCT a.approver_station) = 2) $$;
REVOKE ALL ON FUNCTION public.class_period_any_diary_closed(text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.approve_teacher_diary(_assignment text, _period text, _role text, _minute_id text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _class text; _school text; _cap text; _station text; _sess text; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'diary-approval:session-required'; END IF;
  _station := CASE _role WHEN 'orientacao' THEN 'orientacao_pedagogica' WHEN 'direcao' THEN 'direcao_escolar' END;
  IF _station IS NULL THEN RAISE EXCEPTION 'diary-approval:role-invalid'; END IF;
  _cap := CASE _role WHEN 'orientacao' THEN 'aprovar-diario-pela-orientacao' ELSE 'aprovar-diario-pela-direcao' END;
  SELECT a.class_id, c.school_id INTO _class, _school FROM public.teaching_assignments a
    JOIN public.institutional_classes c ON c.id = a.class_id WHERE a.id = _assignment;
  IF _class IS NULL THEN RAISE EXCEPTION 'diary-approval:assignment-not-found'; END IF;
  IF NOT public.has_school_capability(_cap, _school) THEN RAISE EXCEPTION 'diary-approval:capability-missing'; END IF;
  SELECT m.session_id INTO _sess FROM public.collegial_minute_versions m WHERE m.id = _minute_id AND m.class_id = _class;
  IF _sess IS NULL OR NOT EXISTS (SELECT 1 FROM public.collegial_session_events e WHERE e.session_id = _sess AND e.sequence = 1
      AND e.document->'scope'->>'periodId' = _period) THEN RAISE EXCEPTION 'diary-approval:council-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('teacher-diary:' || _assignment || ':' || _period));
  IF EXISTS (SELECT 1 FROM public.teacher_diary_approvals WHERE assignment_id = _assignment AND period_id = _period AND approver_station = _station)
    THEN RAISE EXCEPTION 'diary-approval:already-approved'; END IF;
  INSERT INTO public.teacher_diary_approvals(assignment_id, class_id, school_id, period_id, approver_station, collegial_minute_id,
    author_user_id, author_person_id, author_principal_id)
  VALUES (_assignment, _class, _school, _period, _station, _minute_id, auth.uid(), public.institutional_actor_person(), public.current_principal_id())
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.approve_teacher_diary(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_teacher_diary(text, text, text, text) TO authenticated;

-- Estado projetado (nada persistido): em-andamento | aguardando-conselho | conselho-realizado | aguardando-aprovacao | aprovado-fechado
CREATE FUNCTION public.teacher_diary_state_at(_assignment text, _period text, _on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(state text, council_minute_id text, orientacao_approved_at timestamptz, direcao_approved_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _class text; _school text; _ends date; _minute text; _session boolean; _op timestamptz; _dir timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'diary-approval:session-required'; END IF;
  SELECT a.class_id, c.school_id INTO _class, _school FROM public.teaching_assignments a
    JOIN public.institutional_classes c ON c.id = a.class_id WHERE a.id = _assignment;
  IF _class IS NULL THEN RETURN; END IF;
  IF NOT (public.has_school_capability('consultar-frequencia', _school) OR public.has_school_capability('aprovar-diario-pela-orientacao', _school)
          OR public.has_school_capability('aprovar-diario-pela-direcao', _school)
          OR EXISTS (SELECT 1 FROM public.teaching_assignments_at(_class, _on, pg_catalog.now()) t
                      WHERE t.assignment_id = _assignment AND t.person_id = public.current_person_id())) THEN RETURN; END IF;
  SELECT max(a.approved_at) FILTER (WHERE a.approver_station = 'orientacao_pedagogica'), max(a.approved_at) FILTER (WHERE a.approver_station = 'direcao_escolar')
    INTO _op, _dir FROM public.teacher_diary_approvals a WHERE a.assignment_id = _assignment AND a.period_id = _period;
  SELECT m.id INTO _minute FROM public.collegial_minute_versions m JOIN public.collegial_session_events e ON e.session_id = m.session_id AND e.sequence = 1
   WHERE m.class_id = _class AND e.document->'scope'->>'periodId' = _period ORDER BY m.closed_at DESC LIMIT 1;
  _session := EXISTS (SELECT 1 FROM public.collegial_session_events e WHERE e.class_id = _class AND e.sequence = 1 AND e.document->'scope'->>'periodId' = _period);
  SELECT v.ends_on INTO _ends FROM public.institutional_academic_period_versions v WHERE v.period_id = _period ORDER BY v.version DESC LIMIT 1;
  state := CASE
    WHEN _op IS NOT NULL AND _dir IS NOT NULL THEN 'aprovado-fechado'
    WHEN _op IS NOT NULL OR _dir IS NOT NULL THEN 'aguardando-aprovacao'
    WHEN _minute IS NOT NULL THEN 'conselho-realizado'
    WHEN _session OR (_ends IS NOT NULL AND _ends < _on) THEN 'aguardando-conselho'
    ELSE 'em-andamento' END;
  council_minute_id := _minute; orientacao_approved_at := _op; direcao_approved_at := _dir;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.teacher_diary_state_at(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_diary_state_at(text, text, date) TO authenticated;

-- 4) Período fechado ⇒ Diário, frequência, ocorrências e notas imutáveis (sem reabertura).
CREATE FUNCTION public.bq5_guard_closed_period() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _a text; _p text; _p2 text;
BEGIN
  IF TG_TABLE_NAME = 'lesson_record_versions' THEN
    IF NEW.period_id IS NOT NULL AND public.teacher_diary_closed(NEW.assignment_id, NEW.period_id) THEN RAISE EXCEPTION 'diary:period-closed'; END IF;
  ELSIF TG_TABLE_NAME = 'attendance_record_versions' THEN
    SELECT l.assignment_id, l.period_id INTO _a, _p FROM public.lesson_record_versions l WHERE l.id = NEW.lesson_version_id;
    IF _p IS NOT NULL AND public.teacher_diary_closed(_a, _p) THEN RAISE EXCEPTION 'diary:period-closed'; END IF;
  ELSIF TG_TABLE_NAME = 'assessment_entry_versions' THEN
    SELECT i.assignment_id INTO _a FROM public.assessment_instruments i WHERE i.id = NEW.instrument_id;
    IF (_a IS NOT NULL AND public.teacher_diary_closed(_a, NEW.period_id))
       OR (_a IS NULL AND public.class_period_any_diary_closed(NEW.class_id, NEW.period_id)) THEN RAISE EXCEPTION 'diary:period-closed'; END IF;
  ELSIF TG_TABLE_NAME = 'student_attendance_occurrences' THEN
    _p := public.diary_period_at(NEW.class_id, NEW.from_date, pg_catalog.now());
    _p2 := public.diary_period_at(NEW.class_id, NEW.until_date, pg_catalog.now());
    IF (_p IS NOT NULL AND public.class_period_any_diary_closed(NEW.class_id, _p))
       OR (_p2 IS NOT NULL AND public.class_period_any_diary_closed(NEW.class_id, _p2)) THEN RAISE EXCEPTION 'diary:period-closed'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bq5_guard_closed_period() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bq5_guard_closed_period BEFORE INSERT ON public.lesson_record_versions FOR EACH ROW EXECUTE FUNCTION public.bq5_guard_closed_period();
CREATE TRIGGER bq5_guard_closed_period BEFORE INSERT ON public.attendance_record_versions FOR EACH ROW EXECUTE FUNCTION public.bq5_guard_closed_period();
CREATE TRIGGER bq5_guard_closed_period BEFORE INSERT ON public.assessment_entry_versions FOR EACH ROW EXECUTE FUNCTION public.bq5_guard_closed_period();
CREATE TRIGGER bq5_guard_closed_period BEFORE INSERT ON public.student_attendance_occurrences FOR EACH ROW EXECUTE FUNCTION public.bq5_guard_closed_period();

-- 5) Regras homologadas por decisão institucional da SEMED (ato: decisão do gestor, não ato externo).
INSERT INTO public.diary_correction_policies(logical_policy_id, version, status, family_id, applies_when_official_closing, outcome,
  required_capabilities, requirement_codes, admissible_changes, definition, valid_from, homologated_at, homologation_act_ref)
SELECT 'bq5-' || f || '-' || w, 1, 'homologada', f, w, CASE w WHEN 'absent' THEN 'admissible' ELSE 'forbidden' END,
  '{}', '{}', NULL,
  jsonb_build_object('label', CASE w WHEN 'absent' THEN 'Professor responsável corrige enquanto o período está aberto' ELSE 'Período aprovado/fechado: sem alteração' END,
    'onlyResponsibleTeacher', true, 'deadlineDays', NULL, 'justificationRequired', false, 'priorApprovalRequired', false,
    'pedagogicalVersionsExposed', false, 'technicalAuditTrail', true, 'reopening', false, 'decision', 'decisao-semed-bq5-2026-10-09'),
  DATE '2026-10-09', now(), 'decisao-semed-bq5-2026-10-09'
FROM unnest(ARRAY['registro-de-aula','frequencia']) f, unnest(ARRAY['absent','present']) w;

INSERT INTO public.assessment_correction_policies(logical_policy_id, version, status, class_id, applies_when_period_closing, outcome,
  required_capabilities, requirement_codes, admissible_value_kinds, definition, valid_from, homologated_at, homologation_act_ref)
SELECT 'bq5-notas-' || w, 1, 'homologated', NULL, w, CASE w WHEN 'absent' THEN 'admissible' ELSE 'forbidden' END, '{}', '{}', NULL,
  jsonb_build_object('label', CASE w WHEN 'absent' THEN 'Professor responsável corrige notas enquanto o período está aberto' ELSE 'Período aprovado/fechado: notas imutáveis' END,
    'onlyResponsibleTeacher', true, 'justificationRequired', false, 'pedagogicalVersionsExposed', false, 'technicalAuditTrail', true,
    'reopening', false, 'decision', 'decisao-semed-bq5-2026-10-09'),
  DATE '2026-10-09', now(), 'decisao-semed-bq5-2026-10-09'
FROM unnest(ARRAY['absent','present']) w;

INSERT INTO public.attendance_occurrence_types(id, version, code, label, description, requires_document, status, homologation_act_ref, valid_from, attendance_effect) VALUES
 ('bq5-justificativa-de-falta', 1, 'FJ', 'Justificativa de falta',
  'A escola registra depois a justificativa documental de uma FALTA lançada pelo professor. Continua falta no percentual.', true, 'homologada', 'decisao-semed-bq5-2026-10-09', DATE '2026-10-09', 'mantem-falta'),
 ('bq5-atividade-domiciliar', 1, 'AD', 'Atividade/exercício domiciliar',
  'Regime domiciliar formalmente registrado e vigente. Conta como presença/atendimento válido no período coberto.', true, 'homologada', 'decisao-semed-bq5-2026-10-09', DATE '2026-10-09', 'conta-presenca');

INSERT INTO public.attendance_calculation_policies(id, version, status, definition, homologated_at, homologation_act_ref, valid_from)
SELECT p.id, 1, 'homologada', p.def, now(), 'decisao-semed-bq5-2026-10-09', DATE '2026-10-09' FROM (VALUES
 ('bq5-frequencia-por-dia', jsonb_build_object(
   'label','Frequência por dia letivo','unitKind','dia','scopeKind','turma-integrada','requiresConcludedAttendance',true,'preservesDurationMinutes',false,
   'appliesTo', jsonb_build_object('segmentIds', jsonb_build_array('educacao-infantil','ef-anos-iniciais-1-5','eja-fases-1-5')),
   'minimumPercent',75,'minimumIsReference',true,'automaticOutcome',false,
   'marks', jsonb_build_array('Presente','Falta'),
   'formulas', jsonb_build_array(jsonb_build_object('id','bq5-freq-dia','version',1,'label','Presenças ÷ dias letivos na vigência da matrícula','status','homologada',
     'unitId','dias','scopeDimensionId','turma','aggregation','escopo-unico',
     'denominator', jsonb_build_array(jsonb_build_object('measureId','unidades-aplicaveis')),
     'numerator', jsonb_build_array(jsonb_build_object('measureId','presencas')),
     'occurrenceTreatments', jsonb_build_array(
        jsonb_build_object('occurrenceTypeId','bq5-atividade-domiciliar','measureId','ausencias-em-atividade-domiciliar','effect','somar-ao-numerador'),
        jsonb_build_object('occurrenceTypeId','bq5-justificativa-de-falta','measureId','ausencias-justificadas','effect','sem-efeito')),
     'incompleteData','impede-conclusao','resultFactId','frequencia-percentual')))),
 ('bq5-frequencia-por-componente', jsonb_build_object(
   'label','Frequência por aula, em cada componente curricular','unitKind','aula','scopeKind','componente-ou-campo','requiresConcludedAttendance',true,'preservesDurationMinutes',false,
   'appliesTo', jsonb_build_object('segmentIds', jsonb_build_array('ef-anos-finais-6-9','eja-fases-6-9')),
   'minimumPercent',75,'minimumIsReference',true,'automaticOutcome',false,'officialPerComponent',true,
   'marks', jsonb_build_array('Presente','Falta'),
   'formulas', jsonb_build_array(jsonb_build_object('id','bq5-freq-componente','version',1,'label','Presenças ÷ aulas do componente na vigência da alocação','status','homologada',
     'unitId','aulas','scopeDimensionId','componente-curricular','aggregation','soma-das-medidas',
     'denominator', jsonb_build_array(jsonb_build_object('measureId','unidades-aplicaveis')),
     'numerator', jsonb_build_array(jsonb_build_object('measureId','presencas')),
     'occurrenceTreatments', jsonb_build_array(
        jsonb_build_object('occurrenceTypeId','bq5-atividade-domiciliar','measureId','ausencias-em-atividade-domiciliar','effect','somar-ao-numerador'),
        jsonb_build_object('occurrenceTypeId','bq5-justificativa-de-falta','measureId','ausencias-justificadas','effect','sem-efeito')),
     'incompleteData','impede-conclusao','resultFactId','frequencia-percentual-por-componente','note','O valor agregado é visão complementar; o oficial é o de cada componente.'))))
) p(id, def);

INSERT INTO public.collegial_body_configurations(id, version, status, definition, conduct_capabilities, homologated_at, homologation_act_ref)
VALUES ('conselho-de-classe', 1, 'homologated', jsonb_build_object(
  'label','Conselho de Classe','sessionNatures', jsonb_build_array(jsonb_build_object('id','conselho-de-periodo','label','Conselho do período')),
  'requiredParticipantRoles', jsonb_build_array(
    jsonb_build_object('roleId','professor-da-turma','label','Professores da turma'),
    jsonb_build_object('roleId','orientacao-pedagogica','label','Orientação Pedagógica'),
    jsonb_build_object('roleId','direcao-escolar','label','Direção Escolar')),
  'quorumPolicy', NULL, 'records', jsonb_build_array('data','turma','periodo','participantes-presentes','papeis','ata'),
  'decidesStudentOutcome', false, 'closingAfterCouncil', jsonb_build_object('requiredApprovals', jsonb_build_array('orientacao_pedagogica','direcao_escolar'),'orderFlexible',true),
  'decision','decisao-semed-bq5-2026-10-09'), ARRAY['conduzir-conselho-de-classe'], now(), 'decisao-semed-bq5-2026-10-09');