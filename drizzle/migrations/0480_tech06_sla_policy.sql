-- Tecnologia L06: matriz impacto × urgência → prioridade, prazos de resposta/resolução e limiares de alerta são
-- POLÍTICA versionada (fonte obrigatória), utilizável só na última versão aprovada por pessoa ≠ autor. Avaliação do
-- chamado é ato append-only que cita a versão. Prazo e alerta são projeção na leitura; nada é gravado por cron.
CREATE TABLE public.tech_sla_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE CHECK (version >= 1),
  impacts jsonb NOT NULL CHECK (jsonb_typeof(impacts) = 'array' AND jsonb_array_length(impacts) BETWEEN 1 AND 10),
  urgencies jsonb NOT NULL CHECK (jsonb_typeof(urgencies) = 'array' AND jsonb_array_length(urgencies) BETWEEN 1 AND 10),
  matrix jsonb NOT NULL CHECK (jsonb_typeof(matrix) = 'object'),
  deadlines jsonb NOT NULL CHECK (jsonb_typeof(deadlines) = 'object'),
  alert_percents jsonb NOT NULL CHECK (jsonb_typeof(alert_percents) = 'array'),
  pause_on_wait boolean NOT NULL,
  source text NOT NULL CHECK (length(btrim(source)) >= 10),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.tech_sla_policy_approvals (
  policy_version_id uuid PRIMARY KEY REFERENCES public.tech_sla_policy_versions(id),
  decision text NOT NULL CHECK (length(btrim(decision)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_ticket_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  policy_version_id uuid NOT NULL REFERENCES public.tech_sla_policy_versions(id),
  impact text NOT NULL, urgency text NOT NULL, priority text NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq), CHECK (seq = 1 OR reason IS NOT NULL)
);
GRANT SELECT ON public.tech_sla_policy_versions, public.tech_sla_policy_approvals, public.tech_ticket_assessments TO authenticated;
GRANT ALL ON public.tech_sla_policy_versions, public.tech_sla_policy_approvals, public.tech_ticket_assessments TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_sla_policy_versions, public.tech_sla_policy_approvals, public.tech_ticket_assessments FROM anon, authenticated, service_role;
ALTER TABLE public.tech_sla_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_sla_policy_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_ticket_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech sla read" ON public.tech_sla_policy_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech sla appr read" ON public.tech_sla_policy_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech assess read" ON public.tech_ticket_assessments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
  AND (r.requester_person = public.current_person_id() OR public.tech_can_read(r.school_id))));
CREATE TRIGGER tech_sla_immutable BEFORE UPDATE OR DELETE ON public.tech_sla_policy_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_sla_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_sla_policy_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_assess_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_assessments FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Política completa: toda célula impacto|urgência tem prioridade; toda prioridade tem resposta ≤ resolução (horas > 0); alertas em (0,100).
CREATE OR REPLACE FUNCTION public.tech_sla_policy_valid(_i jsonb, _u jsonb, _m jsonb, _d jsonb, _a jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(_i) i, jsonb_array_elements_text(_u) u
      WHERE jsonb_typeof(_m->(i || '|' || u)) <> 'string' OR jsonb_typeof(_m->(i || '|' || u)) IS NULL
         OR NOT (_d ? (_m->>(i || '|' || u))))
  AND NOT EXISTS (SELECT 1 FROM jsonb_each(_d) d WHERE NOT (
      jsonb_typeof(d.value->'response_hours') = 'number' AND jsonb_typeof(d.value->'resolution_hours') = 'number'
      AND (d.value->>'response_hours')::numeric > 0 AND (d.value->>'response_hours')::numeric <= (d.value->>'resolution_hours')::numeric))
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_a) a WHERE jsonb_typeof(a) <> 'number' OR a::text::numeric <= 0 OR a::text::numeric >= 100)
  AND (SELECT count(*) = count(DISTINCT x) FROM jsonb_array_elements_text(_i) x)
  AND (SELECT count(*) = count(DISTINCT x) FROM jsonb_array_elements_text(_u) x)
$$;

CREATE OR REPLACE FUNCTION public.record_tech_sla_policy(_impacts jsonb, _urgencies jsonb, _matrix jsonb, _deadlines jsonb, _alerts jsonb,
  _pause_on_wait boolean, _source text, _reason text, _key text) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int;
BEGIN
  SELECT version INTO _v FROM public.tech_sla_policy_versions WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-prazos-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF NOT public.tech_sla_policy_valid(_impacts, _urgencies, _matrix, _deadlines, _alerts) THEN RAISE EXCEPTION 'politica-incompleta'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('techsla'));
  SELECT coalesce(max(version), 0) + 1 INTO _v FROM public.tech_sla_policy_versions;
  INSERT INTO public.tech_sla_policy_versions(version, impacts, urgencies, matrix, deadlines, alert_percents, pause_on_wait, source, reason, person_id, idempotency_key)
  VALUES (_v, _impacts, _urgencies, _matrix, _deadlines, _alerts, _pause_on_wait, btrim(_source), _reason, _p, _key);
  RETURN _v;
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_sla_policy(_version uuid, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_sla_policy_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-prazos-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _c FROM public.tech_sla_policy_versions WHERE id = _version;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _c.person_id = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_sla_policy_approvals WHERE policy_version_id = _version) THEN RETURN; END IF;
  INSERT INTO public.tech_sla_policy_approvals(policy_version_id, decision, person_id) VALUES (_version, btrim(_decision), _p);
END $$;

CREATE OR REPLACE FUNCTION public.tech_assess_ticket(_request uuid, _expected_seq int, _impact text, _urgency text, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _pol public.tech_sla_policy_versions; _last int; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_ticket_assessments WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request AND sector = 'tecnologia' FOR UPDATE;
  IF _r.id IS NULL OR NOT public.tech_can_manage(_r.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_ticket_assessments WHERE request_id = _request;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT v.* INTO _pol FROM public.tech_sla_policy_versions v ORDER BY v.version DESC LIMIT 1;
  IF _pol.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tech_sla_policy_approvals a WHERE a.policy_version_id = _pol.id)
  THEN RAISE EXCEPTION 'sem-politica-aprovada'; END IF;
  IF NOT (_pol.impacts ? _impact AND _pol.urgencies ? _urgency) THEN RAISE EXCEPTION 'valor-fora-da-politica'; END IF;
  INSERT INTO public.tech_ticket_assessments(request_id, seq, policy_version_id, impact, urgency, priority, reason, person_id, idempotency_key)
  VALUES (_request, _last + 1, _pol.id, _impact, _urgency, _pol.matrix->>(_impact || '|' || _urgency), _reason, _p, _key);
  RETURN _last + 1;
END $$;

REVOKE ALL ON FUNCTION public.record_tech_sla_policy(jsonb, jsonb, jsonb, jsonb, jsonb, boolean, text, text, text),
  public.approve_tech_sla_policy(uuid, text), public.tech_assess_ticket(uuid, int, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_sla_policy(jsonb, jsonb, jsonb, jsonb, jsonb, boolean, text, text, text),
  public.approve_tech_sla_policy(uuid, text), public.tech_assess_ticket(uuid, int, text, text, text, text) TO authenticated;
