-- Tecnologia L07: fila de suporte = grupo por escola com membros (atuações vigentes) em eventos append-only;
-- encaminhamento do chamado a grupo é ato append-only com motivo; atribuição individual continua sendo o evento
-- 'atribuicao' de ops_request_events (atuação vigente da escola). Fila e carga são projeção.
CREATE TABLE public.tech_support_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  group_key text NOT NULL CHECK (group_key ~ '^[a-z0-9-]{2,60}$'),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 3 AND 120),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, group_key)
);
CREATE TABLE public.tech_support_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.tech_support_groups(id),
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('incluir','retirar')),
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, seq)
);
CREATE TABLE public.tech_ticket_routings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  group_id uuid NOT NULL REFERENCES public.tech_support_groups(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq)
);
GRANT SELECT ON public.tech_support_groups, public.tech_support_group_members, public.tech_ticket_routings TO authenticated;
GRANT ALL ON public.tech_support_groups, public.tech_support_group_members, public.tech_ticket_routings TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_support_groups, public.tech_support_group_members, public.tech_ticket_routings FROM anon, authenticated, service_role;
ALTER TABLE public.tech_support_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_support_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_ticket_routings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech group read" ON public.tech_support_groups FOR SELECT TO authenticated USING (public.tech_can_read(school_id));
CREATE POLICY "tech member read" ON public.tech_support_group_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_support_groups g WHERE g.id = group_id AND public.tech_can_read(g.school_id)));
CREATE POLICY "tech routing read" ON public.tech_ticket_routings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
  AND (r.requester_person = public.current_person_id() OR public.tech_can_read(r.school_id))));
CREATE TRIGGER tech_group_immutable BEFORE UPDATE OR DELETE ON public.tech_support_groups FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_member_immutable BEFORE UPDATE OR DELETE ON public.tech_support_group_members FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_routing_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_routings FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.tech_create_support_group(_school text, _group_key text, _label text, _key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _g uuid;
BEGIN
  SELECT id INTO _g FROM public.tech_support_groups WHERE idempotency_key = _key;
  IF _g IS NOT NULL THEN RETURN _g; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT (public.has_network_capability('gerir-filas-de-tecnologia') OR public.has_school_capability('gerir-filas-de-tecnologia', _school)) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  INSERT INTO public.tech_support_groups(school_id, group_key, label, person_id, idempotency_key) VALUES (_school, _group_key, btrim(_label), _p, _key) RETURNING id INTO _g;
  RETURN _g;
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_group_member(_group uuid, _expected_seq int, _action text, _engagement uuid, _reason text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _g public.tech_support_groups; _e public.institutional_engagements; _last int; _cur text; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_support_group_members WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _g FROM public.tech_support_groups WHERE id = _group FOR UPDATE;
  IF _g.id IS NULL OR NOT (public.has_network_capability('gerir-filas-de-tecnologia') OR public.has_school_capability('gerir-filas-de-tecnologia', _g.school_id)) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_support_group_members WHERE group_id = _group;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT action INTO _cur FROM public.tech_support_group_members WHERE group_id = _group AND engagement_id = _engagement ORDER BY seq DESC LIMIT 1;
  IF _action = 'incluir' THEN
    IF _cur = 'incluir' THEN RAISE EXCEPTION 'ja-membro'; END IF;
    SELECT * INTO _e FROM public.institutional_engagements WHERE id = _engagement;
    IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _g.school_id OR _e.valid_from > current_date
       OR (_e.valid_until IS NOT NULL AND _e.valid_until < current_date) THEN RAISE EXCEPTION 'atuacao-nao-vigente'; END IF;
  ELSIF _action = 'retirar' THEN
    IF _cur IS DISTINCT FROM 'incluir' THEN RAISE EXCEPTION 'nao-membro'; END IF;
  ELSE RAISE EXCEPTION 'acao-invalida'; END IF;
  INSERT INTO public.tech_support_group_members(group_id, seq, action, engagement_id, reason, person_id, idempotency_key)
  VALUES (_group, _last + 1, _action, _engagement, btrim(_reason), _p, _key);
  RETURN _last + 1;
END $$;

CREATE OR REPLACE FUNCTION public.tech_route_ticket(_request uuid, _expected_seq int, _group uuid, _reason text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _g public.tech_support_groups; _last int; _cur uuid; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_ticket_routings WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request AND sector = 'tecnologia' FOR UPDATE;
  IF _r.id IS NULL OR NOT public.tech_can_manage(_r.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _g FROM public.tech_support_groups WHERE id = _group;
  IF _g.id IS NULL OR _g.school_id IS DISTINCT FROM _r.school_id THEN RAISE EXCEPTION 'grupo-de-outra-escola'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_ticket_routings WHERE request_id = _request;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT group_id INTO _cur FROM public.tech_ticket_routings WHERE request_id = _request ORDER BY seq DESC LIMIT 1;
  IF _cur = _group THEN RAISE EXCEPTION 'sem-mudanca'; END IF;
  INSERT INTO public.tech_ticket_routings(request_id, seq, group_id, reason, person_id, idempotency_key)
  VALUES (_request, _last + 1, _group, btrim(_reason), _p, _key);
  RETURN _last + 1;
END $$;

REVOKE ALL ON FUNCTION public.tech_create_support_group(text, text, text, text), public.record_tech_group_member(uuid, int, text, uuid, text, text),
  public.tech_route_ticket(uuid, int, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_create_support_group(text, text, text, text), public.record_tech_group_member(uuid, int, text, uuid, text, text),
  public.tech_route_ticket(uuid, int, uuid, text, text) TO authenticated;
