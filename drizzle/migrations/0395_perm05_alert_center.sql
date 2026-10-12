CREATE TABLE public.permanence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  school_id text NOT NULL,
  student_id text NOT NULL,
  enrollment_id text,
  rule_version_id uuid NOT NULL REFERENCES public.permanence_rule_versions(id),
  observation jsonb NOT NULL,
  observed_on date NOT NULL,
  origin text NOT NULL CHECK (origin IN ('executor-tecnico','pessoa')),
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(observation) = 'object')
);
CREATE TABLE public.permanence_alert_events (
  alert_id uuid NOT NULL REFERENCES public.permanence_alerts(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('conferido','caso-aberto','caso-associado','encerrado')),
  case_id uuid REFERENCES public.aa_outreach_cases(id),
  justification text,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, seq),
  CHECK (kind NOT IN ('caso-aberto','caso-associado') OR case_id IS NOT NULL),
  CHECK (kind <> 'encerrado' OR length(btrim(coalesce(justification,''))) >= 10)
);
-- um caso por alerta (mesmo evento nunca vira dois casos)
CREATE UNIQUE INDEX permanence_alert_one_case ON public.permanence_alert_events(alert_id) WHERE kind IN ('caso-aberto','caso-associado');
CREATE INDEX permanence_alerts_school_idx ON public.permanence_alerts(school_id, observed_on);

GRANT SELECT ON public.permanence_alerts, public.permanence_alert_events TO authenticated;
GRANT ALL ON public.permanence_alerts, public.permanence_alert_events TO service_role;
ALTER TABLE public.permanence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm alerts by school capability" ON public.permanence_alerts FOR SELECT TO authenticated
  USING (public.has_school_capability('acompanhar-permanencia', school_id));
CREATE POLICY "perm alert events by school capability" ON public.permanence_alert_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.permanence_alerts a WHERE a.id = alert_id AND public.has_school_capability('acompanhar-permanencia', a.school_id)));
CREATE TRIGGER permanence_alerts_immutable BEFORE UPDATE OR DELETE ON public.permanence_alerts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER permanence_alert_events_immutable BEFORE UPDATE OR DELETE ON public.permanence_alert_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- registro idempotente: mesma chave devolve o mesmo alerta (sem repetição)
CREATE OR REPLACE FUNCTION public.register_permanence_alert(_key text, _school text, _student text, _enrollment text, _rule_version uuid, _observation jsonb, _observed_on date, _origin text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF NOT public.has_school_capability('registrar-alertas-de-permanencia', _school) THEN RAISE EXCEPTION 'permalert:forbidden'; END IF;
  IF _origin = 'pessoa' AND _p IS NULL THEN RAISE EXCEPTION 'permalert:no-person'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permanence_rule_approvals ap JOIN public.permanence_rule_versions v ON v.id = ap.rule_version_id
     WHERE v.id = _rule_version AND ap.verdict = 'aprovada' AND ap.approver_person <> v.author_person
       AND v.valid_from <= _observed_on AND (v.valid_to IS NULL OR _observed_on <= v.valid_to)) THEN
    RAISE EXCEPTION 'permalert:rule-not-approved'; END IF;
  IF _observation ?| array['diagnostico','evasao','abandono'] THEN RAISE EXCEPTION 'permalert:label-forbidden'; END IF;
  INSERT INTO public.permanence_alerts(idempotency_key, school_id, student_id, enrollment_id, rule_version_id, observation, observed_on, origin, registered_by)
  VALUES (_key, _school, _student, _enrollment, _rule_version, _observation, _observed_on, _origin, _p)
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.permanence_alerts WHERE idempotency_key = _key AND school_id = _school AND student_id = _student;
    IF _id IS NULL THEN RAISE EXCEPTION 'permalert:key-conflict'; END IF;
  END IF;
  RETURN _id;
END $$;

-- triagem por pessoa: seq esperado (concorrência), idempotência por evento, um caso por alerta
CREATE OR REPLACE FUNCTION public.record_permanence_alert_event(_alert uuid, _expected_seq int, _kind text, _case uuid, _justification text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a public.permanence_alerts; _last int; _lastkind text; _c public.aa_outreach_cases;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permalert:no-person'; END IF;
  SELECT * INTO _a FROM public.permanence_alerts WHERE id = _alert FOR UPDATE;
  IF _a.id IS NULL OR NOT public.has_school_capability('acompanhar-permanencia', _a.school_id) THEN RAISE EXCEPTION 'permalert:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.permanence_alert_events WHERE idempotency_key = _key AND alert_id = _alert) THEN
    RETURN (SELECT seq FROM public.permanence_alert_events WHERE idempotency_key = _key); END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_alert_events WHERE alert_id = _alert;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permalert:stale-base'; END IF;
  SELECT kind INTO _lastkind FROM public.permanence_alert_events WHERE alert_id = _alert AND seq = _last;
  IF _lastkind = 'encerrado' THEN RAISE EXCEPTION 'permalert:closed'; END IF;
  IF _kind IN ('caso-aberto','caso-associado','encerrado') AND NOT EXISTS (SELECT 1 FROM public.permanence_alert_events WHERE alert_id = _alert AND kind = 'conferido') THEN
    RAISE EXCEPTION 'permalert:not-reviewed'; END IF;
  IF _kind IN ('caso-aberto','caso-associado') THEN
    IF NOT public.has_school_capability('abrir-casos-de-busca-ativa', _a.school_id) THEN RAISE EXCEPTION 'permalert:case-forbidden'; END IF;
    SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
    IF _c.id IS NULL OR _c.student_id <> _a.student_id OR _c.school_id <> _a.school_id THEN RAISE EXCEPTION 'permalert:case-mismatch'; END IF;
  END IF;
  INSERT INTO public.permanence_alert_events(alert_id, seq, kind, case_id, justification, author_person, idempotency_key)
  VALUES (_alert, _last+1, _kind, _case, nullif(btrim(_justification),''), _p, _key);
  RETURN _last+1;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'permalert:already-linked';
          WHEN check_violation THEN RAISE EXCEPTION 'permalert:invalid-event';
END $$;

REVOKE ALL ON FUNCTION public.register_permanence_alert(text,text,text,text,uuid,jsonb,date,text), public.record_permanence_alert_event(uuid,int,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_permanence_alert(text,text,text,text,uuid,jsonb,date,text), public.record_permanence_alert_event(uuid,int,text,uuid,text,text) TO authenticated;