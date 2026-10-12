-- Centro de Operações L16: solicitação e autorização de transporte escolar. Regra de elegibilidade é versão aprovada por
-- pessoa ≠ autor com critérios DECLARADOS (o banco não calcula distância nem idade). Solicitação ancorada na matrícula/
-- enturmação oficial, escola e ponto canônico (school_transport_facts). Decisão humana ≠ solicitante congela matrícula,
-- turma, turno e ponto; mudança acadêmica gera reavaliação (projeção), nunca revogação automática.
CREATE TABLE public.ops_transport_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL CHECK (rule_key ~ '^[a-z0-9-]{2,80}$'),
  version int NOT NULL CHECK (version >= 1),
  basis_ref text NOT NULL CHECK (length(btrim(basis_ref)) >= 3),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'array' AND jsonb_array_length(criteria) >= 1),
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version), CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.ops_transport_rule_approvals (
  rule_version_id uuid PRIMARY KEY REFERENCES public.ops_transport_rule_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_transport_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  enrollment_episode_id text NOT NULL REFERENCES public.class_enrollment_episodes(id),
  stop_logical_id uuid NOT NULL,
  requested_from date NOT NULL,
  justification text NOT NULL CHECK (length(btrim(justification)) >= 10),
  requester_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_transport_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_transport_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('autorizacao','indeferimento','reavaliacao-mantida','revogacao','encerramento')),
  rule_version_id uuid REFERENCES public.ops_transport_rule_versions(id),
  criteria_answers jsonb,
  enrollment_episode_id text REFERENCES public.class_enrollment_episodes(id),
  class_id text,
  shift_value_id text,
  stop_logical_id uuid,
  valid_from date,
  valid_until date,
  justification text NOT NULL CHECK (length(btrim(justification)) >= 10),
  decider_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq),
  CHECK (kind NOT IN ('autorizacao','indeferimento','reavaliacao-mantida') OR (rule_version_id IS NOT NULL AND criteria_answers IS NOT NULL)),
  CHECK (kind NOT IN ('autorizacao','reavaliacao-mantida') OR (enrollment_episode_id IS NOT NULL AND stop_logical_id IS NOT NULL AND valid_from IS NOT NULL)),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
GRANT SELECT ON public.ops_transport_rule_versions, public.ops_transport_rule_approvals TO authenticated;
GRANT SELECT ON public.ops_transport_requests, public.ops_transport_decisions TO authenticated;
GRANT ALL ON public.ops_transport_rule_versions, public.ops_transport_rule_approvals, public.ops_transport_requests, public.ops_transport_decisions TO service_role;
ALTER TABLE public.ops_transport_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_transport_rule_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_transport_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport rules readable" ON public.ops_transport_rule_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport rule approvals readable" ON public.ops_transport_rule_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport requests by school" ON public.ops_transport_requests FOR SELECT TO authenticated
  USING (requester_person = public.current_person_id() OR public.ops_can_read('transporte', school_id));
CREATE POLICY "transport decisions by school" ON public.ops_transport_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_transport_requests r WHERE r.id = request_id AND (r.requester_person = public.current_person_id() OR public.ops_can_read('transporte', r.school_id))));
CREATE TRIGGER opstrv_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_rule_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstra_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_rule_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstrq_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_requests FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstrd_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_decisions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Matrícula/enturmação oficial vigente na data (episódio corrente, não encerrado).
CREATE OR REPLACE FUNCTION public.ops_episode_active_on(_ep text, _student text, _school text, _on date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.id = _ep AND e.student_id = _student AND e.school_id = _school AND e.valid_from <= _on
    AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on <= _on))
$$;
CREATE OR REPLACE FUNCTION public.ops_stop_active_on(_stop uuid, _school text, _on date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_transport_facts f WHERE f.kind = 'ponto' AND f.logical_id = _stop AND f.school_id = _school
    AND f.version = (SELECT max(version) FROM public.school_transport_facts g WHERE g.logical_id = _stop)
    AND NOT f.revoked AND f.valid_from <= _on AND (f.valid_until IS NULL OR f.valid_until >= _on))
$$;
REVOKE ALL ON FUNCTION public.ops_episode_active_on(text,text,text,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ops_stop_active_on(uuid,text,date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_ops_transport_rule(_key text, _expected_version int, _basis text, _criteria jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstr:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-regras-de-transporte') THEN RAISE EXCEPTION 'opstr:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_criteria) c WHERE coalesce(c->>'key','') !~ '^[a-z0-9-]{2,60}$' OR length(btrim(coalesce(c->>'label',''))) < 5) THEN RAISE EXCEPTION 'opstr:invalid-criteria'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_transport_rule_versions WHERE rule_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opstr:conflict'; END IF;
  INSERT INTO public.ops_transport_rule_versions(rule_key, version, basis_ref, criteria, author_person, reason)
  VALUES (_key, _last + 1, btrim(_basis), _criteria, _p, nullif(btrim(_reason),'')) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opstr:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_transport_rule(_rv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_transport_rule_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstr:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-regras-de-transporte') THEN RAISE EXCEPTION 'opstr:approve-forbidden'; END IF;
  SELECT * INTO _v FROM public.ops_transport_rule_versions WHERE id = _rv;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'opstr:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opstr:self-approval'; END IF;
  INSERT INTO public.ops_transport_rule_approvals(rule_version_id, approver_person, decision_ref) VALUES (_rv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opstr:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opstr:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.request_ops_transport(_student text, _school text, _episode text, _stop uuid, _from date, _justification text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstq:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_transport_requests WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('solicitar-transporte', _school) THEN RAISE EXCEPTION 'opstq:forbidden'; END IF;
  IF NOT public.ops_episode_active_on(_episode, _student, _school, greatest(_from, current_date)) THEN RAISE EXCEPTION 'opstq:no-active-enrollment'; END IF;
  IF NOT public.ops_stop_active_on(_stop, _school, greatest(_from, current_date)) THEN RAISE EXCEPTION 'opstq:invalid-stop'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_transport_requests r WHERE r.student_id = _student AND r.school_id = _school
       AND NOT EXISTS (SELECT 1 FROM public.ops_transport_decisions d WHERE d.request_id = r.id AND d.kind IN ('indeferimento','revogacao','encerramento'))) THEN RAISE EXCEPTION 'opstq:request-open'; END IF;
  INSERT INTO public.ops_transport_requests(student_id, school_id, enrollment_episode_id, stop_logical_id, requested_from, justification, requester_person, idempotency_key)
  VALUES (_student, _school, _episode, _stop, _from, btrim(_justification), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opstq:invalid';
END $$;

-- Decisão humana. _answers: {"<criterio>": {"atende": true|false, "evidencia": "..."}} cobrindo TODOS os critérios da regra.
CREATE OR REPLACE FUNCTION public.decide_ops_transport(_req uuid, _expected_seq int, _kind text, _rule uuid, _answers jsonb, _episode text, _stop uuid,
  _from date, _until date, _justification text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_transport_requests; _last int; _seq int; _rv public.ops_transport_rule_versions;
  _class text; _shift text; _lastkind text; _all boolean;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstd:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_transport_decisions WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _r FROM public.ops_transport_requests WHERE id = _req FOR UPDATE;
  IF _r.id IS NULL OR NOT public.has_school_capability('autorizar-transporte', _r.school_id) THEN RAISE EXCEPTION 'opstd:forbidden'; END IF;
  IF _p = _r.requester_person THEN RAISE EXCEPTION 'opstd:self-decision'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_transport_decisions WHERE request_id = _req;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opstd:conflict'; END IF;
  SELECT kind INTO _lastkind FROM public.ops_transport_decisions WHERE request_id = _req ORDER BY seq DESC LIMIT 1;
  IF _lastkind IN ('indeferimento','revogacao','encerramento') THEN RAISE EXCEPTION 'opstd:closed'; END IF;
  IF (_kind IN ('autorizacao','indeferimento') AND _lastkind IS NOT NULL) OR (_kind IN ('reavaliacao-mantida','revogacao','encerramento') AND _lastkind IS NULL) THEN RAISE EXCEPTION 'opstd:invalid-transition'; END IF;
  IF _kind IN ('autorizacao','indeferimento','reavaliacao-mantida') THEN
    SELECT v.* INTO _rv FROM public.ops_transport_rule_versions v JOIN public.ops_transport_rule_approvals a ON a.rule_version_id = v.id
      WHERE v.id = _rule AND v.version = (SELECT max(version) FROM public.ops_transport_rule_versions x WHERE x.rule_key = v.rule_key);
    IF _rv.id IS NULL THEN RAISE EXCEPTION 'opstd:rule-not-approved'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(_rv.criteria) c WHERE jsonb_typeof(_answers -> (c->>'key') -> 'atende') <> 'boolean'
         OR length(btrim(coalesce(_answers -> (c->>'key') ->> 'evidencia',''))) < 3) THEN RAISE EXCEPTION 'opstd:criteria-incomplete'; END IF;
    SELECT bool_and((_answers -> (c->>'key') ->> 'atende')::boolean) INTO _all FROM jsonb_array_elements(_rv.criteria) c;
    IF _kind IN ('autorizacao','reavaliacao-mantida') AND NOT _all THEN RAISE EXCEPTION 'opstd:criteria-not-met'; END IF;
  END IF;
  IF _kind IN ('autorizacao','reavaliacao-mantida') THEN
    IF NOT public.ops_episode_active_on(_episode, _r.student_id, _r.school_id, greatest(_from, current_date)) THEN RAISE EXCEPTION 'opstd:no-active-enrollment'; END IF;
    IF NOT public.ops_stop_active_on(_stop, _r.school_id, greatest(_from, current_date)) THEN RAISE EXCEPTION 'opstd:invalid-stop'; END IF;
    SELECT class_id INTO _class FROM public.class_enrollment_episodes WHERE id = _episode;
    SELECT shift_value_id INTO _shift FROM public.class_shift_versions s WHERE s.class_id = _class AND s.valid_from <= greatest(_from, current_date)
      AND (s.valid_until IS NULL OR s.valid_until >= greatest(_from, current_date)) AND NOT EXISTS (SELECT 1 FROM public.class_shift_versions z WHERE z.supersedes_id = s.id) ORDER BY s.version DESC LIMIT 1;
  END IF;
  INSERT INTO public.ops_transport_decisions(request_id, seq, kind, rule_version_id, criteria_answers, enrollment_episode_id, class_id, shift_value_id, stop_logical_id, valid_from, valid_until, justification, decider_person, idempotency_key)
  VALUES (_req, _last + 1, _kind, CASE WHEN _kind IN ('autorizacao','indeferimento','reavaliacao-mantida') THEN _rule END, CASE WHEN _kind IN ('autorizacao','indeferimento','reavaliacao-mantida') THEN _answers END,
    CASE WHEN _kind IN ('autorizacao','reavaliacao-mantida') THEN _episode END, _class, _shift, CASE WHEN _kind IN ('autorizacao','reavaliacao-mantida') THEN _stop END,
    CASE WHEN _kind IN ('autorizacao','reavaliacao-mantida') THEN _from ELSE coalesce(_from, current_date) END, _until, btrim(_justification), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opstd:invalid';
END $$;

-- Reavaliação pendente (projeção): autorização vigente cuja matrícula/turma/turno/ponto congelados não correspondem mais.
CREATE OR REPLACE FUNCTION public.ops_transport_reevaluation_queue(_school text, _on date)
RETURNS TABLE (request_id uuid, decision_seq int, reasons text[]) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH cur AS (
    SELECT DISTINCT ON (d.request_id) d.*, r.student_id, r.school_id FROM public.ops_transport_decisions d JOIN public.ops_transport_requests r ON r.id = d.request_id
    WHERE r.school_id = _school ORDER BY d.request_id, d.seq DESC)
  SELECT c.request_id, c.seq, array_remove(ARRAY[
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.id = c.enrollment_episode_id
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on <= _on)) THEN 'matricula-ou-enturmacao-alterada' END,
      CASE WHEN c.shift_value_id IS DISTINCT FROM (SELECT s.shift_value_id FROM public.class_shift_versions s WHERE s.class_id = c.class_id AND s.valid_from <= _on
        AND (s.valid_until IS NULL OR s.valid_until >= _on) AND NOT EXISTS (SELECT 1 FROM public.class_shift_versions z WHERE z.supersedes_id = s.id) ORDER BY s.version DESC LIMIT 1) THEN 'turno-alterado' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.school_transport_facts f WHERE f.kind = 'ponto' AND f.logical_id = c.stop_logical_id
        AND f.version = (SELECT max(version) FROM public.school_transport_facts g WHERE g.logical_id = c.stop_logical_id) AND NOT f.revoked AND (f.valid_until IS NULL OR f.valid_until >= _on)) THEN 'ponto-alterado' END,
      CASE WHEN c.valid_until IS NOT NULL AND c.valid_until < _on THEN 'vigencia-expirada' END], NULL)
  FROM cur c WHERE c.kind IN ('autorizacao','reavaliacao-mantida')
$$;

REVOKE ALL ON FUNCTION public.register_ops_transport_rule(text,int,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_transport_rule(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_ops_transport(text,text,text,uuid,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_ops_transport(uuid,int,text,uuid,jsonb,text,uuid,date,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_transport_reevaluation_queue(text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_transport_rule(text,int,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_transport_rule(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_ops_transport(text,text,text,uuid,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ops_transport(uuid,int,text,uuid,jsonb,text,uuid,date,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_transport_reevaluation_queue(text,date) TO authenticated;