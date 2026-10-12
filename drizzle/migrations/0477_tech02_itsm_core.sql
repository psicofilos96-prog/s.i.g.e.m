-- Tecnologia L02: núcleo ITSM. Chamado = solicitação compartilhada (ops_requests) do setor 'tecnologia' (sem fila paralela);
-- natureza incidente × requisição é ledger próprio do chamado; problema e mudança são entidades distintas com código único,
-- eventos append-only (seq esperado, idempotência, pessoa da sessão) e RLS por escola (capability escolar) ou rede.
ALTER TABLE public.ops_requests DROP CONSTRAINT ops_requests_sector_check;
ALTER TABLE public.ops_requests ADD CONSTRAINT ops_requests_sector_check CHECK (sector IN ('transporte','infraestrutura','patrimonio','tecnologia'));

CREATE OR REPLACE FUNCTION public.open_ops_request(_sector text, _school text, _kind text, _subject text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'ops:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_requests WHERE idempotency_key = _key AND requester_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _sector NOT IN ('transporte','infraestrutura','patrimonio','tecnologia') OR NOT public.has_school_capability('solicitar-' || _sector, _school) THEN
    RAISE EXCEPTION 'ops:unavailable'; END IF;
  INSERT INTO public.ops_requests(sector, school_id, kind, subject, requester_person, idempotency_key)
  VALUES (_sector, _school, btrim(_kind), btrim(_subject), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'ops:invalid';
END $$;

-- Código único por entidade e ano, com lock (nunca reutilizado).
CREATE TABLE public.tech_code_counters (prefix text NOT NULL, year int NOT NULL, last int NOT NULL, PRIMARY KEY (prefix, year));
REVOKE ALL ON public.tech_code_counters FROM anon, authenticated;
GRANT ALL ON public.tech_code_counters TO service_role;
ALTER TABLE public.tech_code_counters ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.tech_next_code(_prefix text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _y int := extract(year FROM now() AT TIME ZONE 'America/Sao_Paulo')::int; _n int;
BEGIN
  INSERT INTO public.tech_code_counters(prefix, year, last) VALUES (_prefix, _y, 1)
  ON CONFLICT (prefix, year) DO UPDATE SET last = public.tech_code_counters.last + 1 RETURNING last INTO _n;
  RETURN _prefix || '-' || _y || '-' || lpad(_n::text, 6, '0');
END $$;
REVOKE ALL ON FUNCTION public.tech_next_code(text) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.tech_ticket_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  ticket_code text NOT NULL,
  nature text NOT NULL CHECK (nature IN ('incidente','requisicao')),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq),
  CHECK (seq = 1 OR reason IS NOT NULL)
);
CREATE UNIQUE INDEX tech_ticket_code_once ON public.tech_ticket_records(ticket_code) WHERE seq = 1;

CREATE TABLE public.tech_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_code text NOT NULL UNIQUE,
  school_id text REFERENCES public.institutional_schools(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 300),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_problem_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.tech_problems(id),
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('investigar','causa-identificada','contorno','vincular-chamado','resolver','encerrar','reabrir')),
  request_id uuid REFERENCES public.ops_requests(id),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_id, seq),
  CHECK (action <> 'vincular-chamado' OR request_id IS NOT NULL)
);
CREATE TABLE public.tech_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_code text NOT NULL UNIQUE,
  school_id text REFERENCES public.institutional_schools(id),
  problem_id uuid REFERENCES public.tech_problems(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 300),
  risk text NOT NULL CHECK (risk IN ('baixo','medio','alto')),
  rollback_plan text NOT NULL CHECK (length(btrim(rollback_plan)) >= 20),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid NOT NULL REFERENCES public.tech_changes(id),
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('avaliar','aprovar','rejeitar','executar','reverter','revisar','encerrar')),
  act_ref uuid REFERENCES public.admin_case_act_versions(id),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (change_id, seq)
);

GRANT SELECT ON public.tech_ticket_records, public.tech_problems, public.tech_problem_events, public.tech_changes, public.tech_change_events TO authenticated;
GRANT ALL ON public.tech_ticket_records, public.tech_problems, public.tech_problem_events, public.tech_changes, public.tech_change_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_ticket_records, public.tech_problems, public.tech_problem_events, public.tech_changes, public.tech_change_events FROM anon, authenticated, service_role;
ALTER TABLE public.tech_ticket_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_problem_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_change_events ENABLE ROW LEVEL SECURITY;

-- Escopo: escola (atender/acompanhar-tecnologia na escola) ou rede (gerir-tecnologia-da-rede). Item de rede só para a rede.
CREATE OR REPLACE FUNCTION public.tech_can_read(_school text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.has_network_capability('gerir-tecnologia-da-rede') OR (_school IS NOT NULL AND public.ops_can_read('tecnologia', _school))
$$;
CREATE POLICY "tech ticket read" ON public.tech_ticket_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
  AND (r.requester_person = public.current_person_id() OR public.tech_can_read(r.school_id))));
CREATE POLICY "tech problem read" ON public.tech_problems FOR SELECT TO authenticated USING (public.tech_can_read(school_id));
CREATE POLICY "tech problem ev read" ON public.tech_problem_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_problems p WHERE p.id = problem_id AND public.tech_can_read(p.school_id)));
CREATE POLICY "tech change read" ON public.tech_changes FOR SELECT TO authenticated USING (public.tech_can_read(school_id));
CREATE POLICY "tech change ev read" ON public.tech_change_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_changes c WHERE c.id = change_id AND public.tech_can_read(c.school_id)));
CREATE TRIGGER tech_ticket_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_records FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_problem_immutable BEFORE UPDATE OR DELETE ON public.tech_problems FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_problem_ev_immutable BEFORE UPDATE OR DELETE ON public.tech_problem_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_change_immutable BEFORE UPDATE OR DELETE ON public.tech_changes FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_change_ev_immutable BEFORE UPDATE OR DELETE ON public.tech_change_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.tech_can_manage(_school text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.has_network_capability('gerir-tecnologia-da-rede') OR (_school IS NOT NULL AND public.has_school_capability('atender-tecnologia', _school))
$$;

-- Abertura do chamado: solicitação canônica + natureza + código CHM único na mesma transação.
CREATE OR REPLACE FUNCTION public.tech_open_ticket(_school text, _nature text, _kind text, _subject text, _key text)
RETURNS TABLE(request_id uuid, ticket_code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r uuid; _t public.tech_ticket_records;
BEGIN
  SELECT * INTO _t FROM public.tech_ticket_records WHERE idempotency_key = _key;
  IF _t.id IS NOT NULL THEN RETURN QUERY SELECT _t.request_id, _t.ticket_code; RETURN; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  _r := public.open_ops_request('tecnologia', _school, _kind, _subject, _key);
  INSERT INTO public.tech_ticket_records(request_id, seq, ticket_code, nature, person_id, idempotency_key)
  VALUES (_r, 1, public.tech_next_code('CHM'), _nature, _p, _key) RETURNING * INTO _t;
  RETURN QUERY SELECT _t.request_id, _t.ticket_code;
END $$;

-- Reclassificação incidente ↔ requisição: nova linha com motivo, só por quem atende.
CREATE OR REPLACE FUNCTION public.tech_reclassify_ticket(_request uuid, _expected_seq int, _nature text, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last public.tech_ticket_records; _sch text; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_ticket_records WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT r.school_id INTO _sch FROM public.ops_requests r WHERE r.id = _request AND r.sector = 'tecnologia' FOR UPDATE;
  IF _sch IS NULL OR NOT public.tech_can_manage(_sch) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _last FROM public.tech_ticket_records WHERE request_id = _request ORDER BY seq DESC LIMIT 1;
  IF _last.seq IS DISTINCT FROM _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  IF _last.nature = _nature THEN RAISE EXCEPTION 'sem-mudanca'; END IF;
  INSERT INTO public.tech_ticket_records(request_id, seq, ticket_code, nature, reason, person_id, idempotency_key)
  VALUES (_request, _last.seq + 1, _last.ticket_code, _nature, _reason, _p, _key);
  RETURN _last.seq + 1;
END $$;

CREATE OR REPLACE FUNCTION public.tech_open_problem(_school text, _title text, _key text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c text;
BEGIN
  SELECT problem_code INTO _c FROM public.tech_problems WHERE idempotency_key = _key;
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.tech_can_manage(_school) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  INSERT INTO public.tech_problems(problem_code, school_id, title, person_id, idempotency_key)
  VALUES (public.tech_next_code('PRB'), _school, btrim(_title), _p, _key) RETURNING problem_code INTO _c;
  RETURN _c;
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_problem_event(_problem uuid, _expected_seq int, _action text, _request uuid, _note text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _pr public.tech_problems; _last text; _s int; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_problem_events WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _pr FROM public.tech_problems WHERE id = _problem FOR UPDATE;
  IF _pr.id IS NULL OR NOT public.tech_can_manage(_pr.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT coalesce(max(seq),0) INTO _s FROM public.tech_problem_events WHERE problem_id = _problem;
  IF _s <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT action INTO _last FROM public.tech_problem_events WHERE problem_id = _problem AND action IN ('encerrar','reabrir') ORDER BY seq DESC LIMIT 1;
  IF _last = 'encerrar' AND _action <> 'reabrir' THEN RAISE EXCEPTION 'encerrado'; END IF;
  IF _action = 'reabrir' AND _last IS DISTINCT FROM 'encerrar' THEN RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _action = 'vincular-chamado' AND NOT EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = _request AND r.sector = 'tecnologia'
       AND (_pr.school_id IS NULL OR r.school_id = _pr.school_id)) THEN RAISE EXCEPTION 'chamado-fora-do-escopo'; END IF;
  INSERT INTO public.tech_problem_events(problem_id, seq, action, request_id, note, person_id, idempotency_key)
  VALUES (_problem, _s + 1, _action, _request, _note, _p, _key);
  RETURN _s + 1;
END $$;

CREATE OR REPLACE FUNCTION public.tech_propose_change(_school text, _problem uuid, _title text, _risk text, _rollback text, _key text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c text;
BEGIN
  SELECT change_code INTO _c FROM public.tech_changes WHERE idempotency_key = _key;
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.tech_can_manage(_school) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  INSERT INTO public.tech_changes(change_code, school_id, problem_id, title, risk, rollback_plan, person_id, idempotency_key)
  VALUES (public.tech_next_code('MUD'), _school, _problem, btrim(_title), _risk, btrim(_rollback), _p, _key) RETURNING change_code INTO _c;
  RETURN _c;
END $$;

-- Mudança: avaliar → aprovar|rejeitar (≠ proponente e ≠ avaliador, capability de aprovação, ato p/ risco alto) → executar → (reverter) → revisar → encerrar.
CREATE OR REPLACE FUNCTION public.record_tech_change_event(_change uuid, _expected_seq int, _action text, _act uuid, _note text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_changes; _last text; _s int; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_change_events WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _c FROM public.tech_changes WHERE id = _change FOR UPDATE;
  IF _c.id IS NULL OR NOT public.tech_can_manage(_c.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT coalesce(max(seq),0) INTO _s FROM public.tech_change_events WHERE change_id = _change;
  IF _s <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT action INTO _last FROM public.tech_change_events WHERE change_id = _change ORDER BY seq DESC LIMIT 1;
  IF NOT ((_last IS NULL AND _action = 'avaliar') OR (_last = 'avaliar' AND _action IN ('aprovar','rejeitar'))
       OR (_last = 'aprovar' AND _action = 'executar') OR (_last = 'executar' AND _action IN ('reverter','revisar'))
       OR (_last = 'reverter' AND _action = 'revisar') OR (_last = 'revisar' AND _action = 'encerrar')) THEN
    RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _action IN ('aprovar','rejeitar') THEN
    IF NOT public.has_network_capability('aprovar-mudancas-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF _p = _c.person_id OR EXISTS (SELECT 1 FROM public.tech_change_events e WHERE e.change_id = _change AND e.person_id = _p) THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
    IF _action = 'aprovar' AND _c.risk = 'alto' AND _act IS NULL THEN RAISE EXCEPTION 'sem-ato'; END IF;
  END IF;
  INSERT INTO public.tech_change_events(change_id, seq, action, act_ref, note, person_id, idempotency_key)
  VALUES (_change, _s + 1, _action, _act, _note, _p, _key);
  RETURN _s + 1;
END $$;

REVOKE ALL ON FUNCTION public.tech_open_ticket(text,text,text,text,text), public.tech_reclassify_ticket(uuid,int,text,text,text),
  public.tech_open_problem(text,text,text), public.record_tech_problem_event(uuid,int,text,uuid,text,text),
  public.tech_propose_change(text,uuid,text,text,text,text), public.record_tech_change_event(uuid,int,text,uuid,text,text),
  public.tech_can_read(text), public.tech_can_manage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_open_ticket(text,text,text,text,text), public.tech_reclassify_ticket(uuid,int,text,text,text),
  public.tech_open_problem(text,text,text), public.record_tech_problem_event(uuid,int,text,uuid,text,text),
  public.tech_propose_change(text,uuid,text,text,text,text), public.record_tech_change_event(uuid,int,text,uuid,text,text),
  public.tech_can_read(text), public.tech_can_manage(text) TO authenticated;