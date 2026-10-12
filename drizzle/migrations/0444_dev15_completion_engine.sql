-- SIGEM Desenvolvimento L15: motor de conclusão por oferta (turma). Critério aprovado → apuração auditável (entradas + hash) → confirmação por competente.
CREATE TABLE public.dev_completion_criteria_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  version int NOT NULL CHECK (version >= 1),
  min_attendance_pct numeric(5,2) NOT NULL CHECK (min_attendance_pct BETWEEN 0 AND 100),
  min_activities_delivered int CHECK (min_activities_delivered IS NULL OR min_activities_delivered >= 0),
  rubric_version_id uuid REFERENCES public.dev_rubric_approvals(rubric_version_id),
  accepted_outcomes text[] NOT NULL DEFAULT '{}' CHECK (accepted_outcomes <@ ARRAY['atingiu','atingiu-parcialmente']::text[]),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, version),
  CHECK (version = 1 OR reason IS NOT NULL),
  CHECK ((rubric_version_id IS NULL) = (cardinality(accepted_outcomes) = 0))
);
CREATE TABLE public.dev_completion_criteria_approvals (
  criteria_version_id uuid PRIMARY KEY REFERENCES public.dev_completion_criteria_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Apuração: fotografia das entradas usadas + veredito + hash canônico. Não é conclusão.
CREATE TABLE public.dev_completion_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  criteria_version_id uuid NOT NULL REFERENCES public.dev_completion_criteria_approvals(criteria_version_id),
  verdict text NOT NULL CHECK (verdict IN ('apto','nao-apto','indeterminado')),
  inputs jsonb NOT NULL,
  input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  computed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Confirmação: ato humano competente sobre uma apuração ainda atual (hash recalculado igual).
CREATE TABLE public.dev_completion_confirmations (
  assessment_id uuid PRIMARY KEY REFERENCES public.dev_completion_assessments(id),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.dev_enrollments(id),
  decision text NOT NULL CHECK (decision IN ('conclusao','nao-conclusao')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  participation_event_id uuid NOT NULL REFERENCES public.dev_participation_events(id),
  confirmer_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_completion_criteria_versions, public.dev_completion_criteria_approvals, public.dev_completion_assessments, public.dev_completion_confirmations TO authenticated;
GRANT ALL ON public.dev_completion_criteria_versions, public.dev_completion_criteria_approvals, public.dev_completion_assessments, public.dev_completion_confirmations TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_completion_criteria_versions, public.dev_completion_criteria_approvals, public.dev_completion_assessments, public.dev_completion_confirmations FROM authenticated, anon;
ALTER TABLE public.dev_completion_criteria_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_completion_criteria_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_completion_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_completion_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev completion criteria read" ON public.dev_completion_criteria_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev completion criteria approvals read" ON public.dev_completion_criteria_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev completion assessments read" ON public.dev_completion_assessments FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE POLICY "dev completion confirmations read" ON public.dev_completion_confirmations FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE TRIGGER devccv_immutable BEFORE UPDATE OR DELETE ON public.dev_completion_criteria_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcca_immutable BEFORE UPDATE OR DELETE ON public.dev_completion_criteria_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcas_immutable BEFORE UPDATE OR DELETE ON public.dev_completion_assessments FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devccf_immutable BEFORE UPDATE OR DELETE ON public.dev_completion_confirmations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_dev_completion_criteria(_class uuid, _expected_version int, _min_pct numeric, _min_acts int,
  _rubric uuid, _outcomes text[], _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_completion_criteria_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  PERFORM 1 FROM public.dev_classes WHERE id = _class FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _rubric IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.dev_rubric_versions r JOIN public.dev_classes k ON k.id = _class
     JOIN public.dev_course_versions v ON v.id = k.course_version_id WHERE r.id = _rubric AND r.course_id = v.course_id) THEN RAISE EXCEPTION 'dev:rubric-other-course'; END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_completion_criteria_versions WHERE class_id = _class;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_completion_criteria_versions(class_id, version, min_attendance_pct, min_activities_delivered, rubric_version_id, accepted_outcomes, reason, author_person, idempotency_key)
  VALUES (_class, _last + 1, _min_pct, _min_acts, _rubric, coalesce(_outcomes,'{}'), nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_completion_criteria(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_completion_criteria_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_completion_criteria_approvals WHERE criteria_version_id = _version AND approver_person = _p) THEN RETURN; END IF;
  IF NOT public.has_network_capability('aprovar-criterios-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_completion_criteria_versions WHERE id = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_completion_criteria_approvals(criteria_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Apuração pura (sem escrita): critério = última versão da turma, que precisa estar aprovada.
CREATE OR REPLACE FUNCTION public.dev_completion_compute(_enrollment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _e public.dev_enrollments; _cv public.dev_completion_criteria_versions; _units jsonb; _missing int; _present int; _absent int;
  _pct numeric; _acts int; _total_acts int; _res record; _v text; _reasons text[] := '{}'; _indet text[] := '{}'; _inputs jsonb;
BEGIN
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _cv FROM public.dev_completion_criteria_versions WHERE class_id = _e.class_id ORDER BY version DESC LIMIT 1;
  IF _cv.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.dev_completion_criteria_approvals WHERE criteria_version_id = _cv.id) THEN RAISE EXCEPTION 'dev:criteria-not-approved'; END IF;
  -- Unidades previstas: encontros cuja última versão está agendada + atividades; registro vigente = maior versão.
  WITH m AS (SELECT mt.id FROM public.dev_class_meetings mt WHERE mt.class_id = _e.class_id
               AND (SELECT status FROM public.dev_class_meeting_versions v WHERE v.meeting_id = mt.id ORDER BY version DESC LIMIT 1) = 'agendado'),
       a AS (SELECT id FROM public.dev_class_activities WHERE class_id = _e.class_id),
       u AS (SELECT 'encontro' AS kind, m.id AS unit,
               (SELECT row_to_json(r) FROM (SELECT id, version, status FROM public.dev_attendance_records x WHERE x.enrollment_id = _enrollment AND x.meeting_id = m.id ORDER BY version DESC LIMIT 1) r) AS rec FROM m
             UNION ALL
             SELECT 'atividade', a.id,
               (SELECT row_to_json(r) FROM (SELECT id, version, status FROM public.dev_attendance_records x WHERE x.enrollment_id = _enrollment AND x.activity_id = a.id ORDER BY version DESC LIMIT 1) r) FROM a)
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'unit', unit, 'record', rec) ORDER BY kind, unit), '[]'),
         count(*) FILTER (WHERE rec IS NULL), count(*) FILTER (WHERE rec->>'status' = 'presente'), count(*) FILTER (WHERE rec->>'status' = 'ausente')
    INTO _units, _missing, _present, _absent FROM u;
  IF _missing > 0 THEN _indet := _indet || format('%s unidade(s) sem frequência lançada', _missing); END IF;
  _pct := CASE WHEN _missing = 0 AND _present + _absent > 0 THEN round(_present * 100.0 / (_present + _absent), 2) END;
  IF _missing = 0 AND _present + _absent = 0 THEN _indet := _indet || 'nenhuma unidade com presença ou falta'; END IF;
  IF _pct IS NOT NULL AND _pct < _cv.min_attendance_pct THEN _reasons := _reasons || format('frequência %s%% < %s%%', _pct, _cv.min_attendance_pct); END IF;
  SELECT count(*) INTO _total_acts FROM public.dev_class_activities WHERE class_id = _e.class_id;
  SELECT count(DISTINCT s.activity_id) INTO _acts FROM public.dev_activity_submissions s JOIN public.dev_class_activities a ON a.id = s.activity_id
    WHERE s.enrollment_id = _enrollment AND a.class_id = _e.class_id;
  IF _cv.min_activities_delivered IS NOT NULL AND _acts < _cv.min_activities_delivered THEN _reasons := _reasons || format('%s de %s atividades entregues exigidas', _acts, _cv.min_activities_delivered); END IF;
  IF _cv.rubric_version_id IS NOT NULL THEN
    SELECT id, version, outcome INTO _res FROM public.dev_learning_results WHERE enrollment_id = _enrollment AND rubric_version_id = _cv.rubric_version_id ORDER BY version DESC LIMIT 1;
    IF _res.id IS NULL THEN _indet := _indet || 'sem resultado de aproveitamento registrado';
    ELSIF EXISTS (SELECT 1 FROM public.dev_result_review_requests q WHERE q.result_id = _res.id AND NOT EXISTS (SELECT 1 FROM public.dev_result_review_decisions d WHERE d.request_id = q.id)) THEN
      _indet := _indet || 'revisão de resultado pendente';
    ELSIF _res.outcome = 'nao-avaliavel' THEN _indet := _indet || 'aproveitamento não avaliável';
    ELSIF NOT _res.outcome = ANY(_cv.accepted_outcomes) THEN _reasons := _reasons || format('aproveitamento "%s" não aceito', _res.outcome); END IF;
  END IF;
  _v := CASE WHEN cardinality(_reasons) > 0 THEN 'nao-apto' WHEN cardinality(_indet) > 0 THEN 'indeterminado' ELSE 'apto' END;
  _inputs := jsonb_build_object('criteria_version_id', _cv.id, 'min_attendance_pct', _cv.min_attendance_pct, 'min_activities_delivered', _cv.min_activities_delivered,
    'units', _units, 'present', _present, 'absent', _absent, 'attendance_pct', _pct, 'activities_delivered', _acts, 'activities_total', _total_acts,
    'learning_result', CASE WHEN _res.id IS NULL THEN NULL ELSE jsonb_build_object('id', _res.id, 'version', _res.version, 'outcome', _res.outcome) END,
    'reasons', to_jsonb(_reasons), 'indeterminate', to_jsonb(_indet));
  RETURN jsonb_build_object('verdict', _v, 'inputs', _inputs, 'sha256', encode(sha256(convert_to(_inputs::text, 'UTF8')), 'hex'));
END $$;
REVOKE EXECUTE ON FUNCTION public.dev_completion_compute(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assess_dev_completion(_enrollment uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _r jsonb; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR public.dev_is_active_trainer(_e.class_id)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'confirmacao') THEN RAISE EXCEPTION 'dev:not-confirmed'; END IF;
  _r := public.dev_completion_compute(_enrollment);
  SELECT id INTO _id FROM public.dev_completion_assessments WHERE enrollment_id = _enrollment AND input_sha256 = _r->>'sha256';
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.dev_completion_assessments(enrollment_id, criteria_version_id, verdict, inputs, input_sha256, computed_by)
  VALUES (_enrollment, (_r->'inputs'->>'criteria_version_id')::uuid, _r->>'verdict', _r->'inputs', _r->>'sha256', _p) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Confirmação: competente ≠ participante; hash recalculado igual ao da apuração (nada mudou); conclusão só se apto; não-conclusão só se não-apto.
CREATE OR REPLACE FUNCTION public.confirm_dev_completion(_assessment uuid, _decision text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a public.dev_completion_assessments; _e public.dev_enrollments; _r jsonb; _last int; _ev uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT participation_event_id INTO _ev FROM public.dev_completion_confirmations WHERE assessment_id = _assessment AND confirmer_person = _p;
  IF _ev IS NOT NULL THEN RETURN _ev; END IF;
  IF NOT public.has_network_capability('confirmar-conclusao-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _a FROM public.dev_completion_assessments WHERE id = _assessment;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _a.enrollment_id FOR UPDATE;
  IF _e.person_id = _p THEN RAISE EXCEPTION 'dev:self-confirmation'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _e.id AND kind IN ('desistencia','cancelamento','conclusao','nao-conclusao')) THEN RAISE EXCEPTION 'dev:terminal'; END IF;
  _r := public.dev_completion_compute(_e.id);
  IF _r->>'sha256' <> _a.input_sha256 THEN RAISE EXCEPTION 'dev:assessment-stale'; END IF;
  IF NOT ((_decision = 'conclusao' AND _a.verdict = 'apto') OR (_decision = 'nao-conclusao' AND _a.verdict = 'nao-apto')) THEN RAISE EXCEPTION 'dev:decision-mismatch'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_participation_events WHERE enrollment_id = _e.id;
  INSERT INTO public.dev_participation_events(enrollment_id, seq, kind, attendance_pct, note, actor_person, idempotency_key)
  VALUES (_e.id, _last + 1, _decision, (_a.inputs->>'attendance_pct')::numeric, btrim(_reason), _p, 'completion:' || _assessment::text) RETURNING id INTO _ev;
  INSERT INTO public.dev_completion_confirmations(assessment_id, enrollment_id, decision, reason, participation_event_id, confirmer_person)
  VALUES (_assessment, _e.id, _decision, btrim(_reason), _ev, _p);
  RETURN _ev;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-confirmed';
END $$;

-- Conclusão/não-conclusão deixam de nascer pelo writer genérico de participação.
CREATE OR REPLACE FUNCTION public.record_dev_participation(_enrollment uuid, _expected_seq int, _kind text, _pct numeric, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _last int; _seq int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF _kind IN ('confirmacao','espera') THEN RAISE EXCEPTION 'dev:use-place'; END IF;
  IF _kind IN ('conclusao','nao-conclusao') THEN RAISE EXCEPTION 'dev:use-completion-engine'; END IF;
  SELECT seq INTO _seq FROM public.dev_participation_events WHERE idempotency_key = _key AND enrollment_id = _enrollment;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR (_kind = 'desistencia' AND _e.person_id = _p)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind IN ('desistencia','cancelamento','conclusao','nao-conclusao')) THEN
    RAISE EXCEPTION 'dev:terminal'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_participation_events WHERE enrollment_id = _enrollment;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_participation_events(enrollment_id, seq, kind, attendance_pct, note, actor_person, idempotency_key)
  VALUES (_enrollment, _last + 1, _kind, _pct, nullif(btrim(coalesce(_note, '')), ''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_completion_criteria(uuid,int,numeric,int,uuid,text[],text,text)','approve_dev_completion_criteria(uuid,text)',
    'assess_dev_completion(uuid)','confirm_dev_completion(uuid,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;