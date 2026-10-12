-- Centro de Operações L08: obras/intervenções de acessibilidade e segurança com responsável técnico (atuação vigente +
-- registro profissional declarado), contrato só como referência a documento juntado (oculta), cronograma com marcos,
-- eventos append-only e restrições de uso por espaço com período e motivo. Capacidade apta = projeção (TS), nunca gravada.

CREATE TABLE public.ops_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  kind text NOT NULL CHECK (kind IN ('obra','acessibilidade','seguranca')),
  title text NOT NULL CHECK (length(btrim(title)) >= 5),
  scope text NOT NULL CHECK (length(btrim(scope)) >= 10),
  space_ids uuid[] NOT NULL DEFAULT '{}',
  request_id uuid REFERENCES public.ops_requests(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_work_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.ops_works(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('responsavel-tecnico','contrato','marco-previsto','marco-realizado','inicio','suspensao','retomada','conclusao-declarada','recebimento','cancelamento')),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  professional_registry text,
  doc_ref uuid REFERENCES public.admin_case_events(id),
  milestone_key text,
  milestone_label text,
  on_date date,
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, seq),
  CHECK (kind <> 'responsavel-tecnico' OR (engagement_id IS NOT NULL AND length(btrim(coalesce(professional_registry,''))) >= 3)),
  CHECK (kind NOT IN ('contrato','recebimento') OR doc_ref IS NOT NULL),
  CHECK (kind NOT IN ('marco-previsto','marco-realizado') OR (milestone_key IS NOT NULL AND on_date IS NOT NULL)),
  CHECK (kind NOT IN ('suspensao','cancelamento') OR length(btrim(coalesce(note,''))) >= 10)
);
CREATE TABLE public.ops_space_use_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.ops_spaces(id),
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('impor','levantar')),
  restriction_key text NOT NULL CHECK (restriction_key ~ '^[a-z0-9-]{2,80}$'),
  severity text CHECK (severity IN ('interdicao','uso-restrito')),
  capacity_limit numeric CHECK (capacity_limit IS NULL OR capacity_limit >= 0),
  shift_ids text[] NOT NULL DEFAULT '{}',
  effective_from date NOT NULL,
  effective_to date,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  work_id uuid REFERENCES public.ops_works(id),
  basis_doc_ref uuid REFERENCES public.admin_case_events(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, seq),
  CHECK (action = 'levantar' OR severity IS NOT NULL),
  CHECK (severity IS DISTINCT FROM 'interdicao' OR capacity_limit IS NULL),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

GRANT SELECT ON public.ops_works TO authenticated;
GRANT SELECT (id, work_id, seq, kind, engagement_id, professional_registry, milestone_key, milestone_label, on_date, note, actor_person, idempotency_key, created_at) ON public.ops_work_events TO authenticated;
GRANT SELECT (id, space_id, seq, action, restriction_key, severity, capacity_limit, shift_ids, effective_from, effective_to, reason, work_id, author_person, idempotency_key, created_at) ON public.ops_space_use_restrictions TO authenticated;
GRANT ALL ON public.ops_works, public.ops_work_events, public.ops_space_use_restrictions TO service_role;
ALTER TABLE public.ops_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_work_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_space_use_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "works by school" ON public.ops_works FOR SELECT TO authenticated USING (public.ops_can_read('infraestrutura', school_id));
CREATE POLICY "work events by school" ON public.ops_work_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_works w WHERE w.id = work_id AND public.ops_can_read('infraestrutura', w.school_id)));
CREATE POLICY "restrictions by school" ON public.ops_space_use_restrictions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = space_id AND public.ops_can_read('infraestrutura', s.school_id)));
CREATE TRIGGER opsw_immutable BEFORE UPDATE OR DELETE ON public.ops_works FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opswe_immutable BEFORE UPDATE OR DELETE ON public.ops_work_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsur_immutable BEFORE UPDATE OR DELETE ON public.ops_space_use_restrictions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.open_ops_work(_school text, _kind text, _title text, _scope text, _spaces uuid[], _request uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsw:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_works WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('gerir-obras-escolares', _school) THEN RAISE EXCEPTION 'opsw:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_spaces,'{}')) s WHERE NOT EXISTS (SELECT 1 FROM public.ops_spaces x WHERE x.id = s AND x.school_id = _school)) THEN RAISE EXCEPTION 'opsw:invalid-space'; END IF;
  IF _request IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = _request AND r.school_id = _school AND r.sector = 'infraestrutura') THEN RAISE EXCEPTION 'opsw:invalid-request'; END IF;
  INSERT INTO public.ops_works(school_id, kind, title, scope, space_ids, request_id, author_person, idempotency_key)
  VALUES (_school, _kind, btrim(_title), btrim(_scope), coalesce(_spaces,'{}'), _request, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsw:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.ops_work_state(_w uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE e.kind WHEN 'inicio' THEN 'em-execucao' WHEN 'retomada' THEN 'em-execucao' WHEN 'suspensao' THEN 'suspensa'
    WHEN 'conclusao-declarada' THEN 'conclusao-declarada' WHEN 'recebimento' THEN 'recebida' WHEN 'cancelamento' THEN 'cancelada' END
    FROM public.ops_work_events e WHERE e.work_id = _w AND e.kind IN ('inicio','retomada','suspensao','conclusao-declarada','recebimento','cancelamento')
    ORDER BY e.seq DESC LIMIT 1), 'planejada')
$$;

CREATE OR REPLACE FUNCTION public.record_ops_work_event(_w uuid, _expected_seq int, _kind text, _engagement uuid, _registry text, _doc uuid,
  _mkey text, _mlabel text, _on date, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _wk public.ops_works; _last int; _st text; _seq int; _resp_person uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsw:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_work_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _wk FROM public.ops_works WHERE id = _w FOR UPDATE;
  IF _wk.id IS NULL OR NOT public.has_school_capability('gerir-obras-escolares', _wk.school_id) THEN RAISE EXCEPTION 'opsw:forbidden'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_work_events WHERE work_id = _w;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsw:conflict'; END IF;
  _st := public.ops_work_state(_w);
  IF _st IN ('recebida','cancelada') THEN RAISE EXCEPTION 'opsw:closed'; END IF;
  IF (_kind = 'inicio' AND _st <> 'planejada') OR (_kind = 'suspensao' AND _st <> 'em-execucao') OR (_kind = 'retomada' AND _st <> 'suspensa')
     OR (_kind = 'conclusao-declarada' AND _st <> 'em-execucao') OR (_kind = 'recebimento' AND _st <> 'conclusao-declarada') THEN RAISE EXCEPTION 'opsw:invalid-transition'; END IF;
  IF _kind = 'responsavel-tecnico' AND NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement
     AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)) THEN RAISE EXCEPTION 'opsw:responsible-not-active'; END IF;
  IF _kind = 'inicio' AND NOT EXISTS (SELECT 1 FROM public.ops_work_events e WHERE e.work_id = _w AND e.kind = 'responsavel-tecnico') THEN RAISE EXCEPTION 'opsw:no-technical-responsible'; END IF;
  -- Recebimento: pessoa distinta do responsável técnico vigente e de quem declarou a conclusão.
  IF _kind = 'recebimento' THEN
    IF NOT public.has_school_capability('receber-obras-escolares', _wk.school_id) THEN RAISE EXCEPTION 'opsw:receive-forbidden'; END IF;
    SELECT e2.person_id INTO _resp_person FROM public.ops_work_events e JOIN public.institutional_engagements e2 ON e2.id = e.engagement_id
      WHERE e.work_id = _w AND e.kind = 'responsavel-tecnico' ORDER BY e.seq DESC LIMIT 1;
    IF _resp_person = _p OR EXISTS (SELECT 1 FROM public.ops_work_events e WHERE e.work_id = _w AND e.kind = 'conclusao-declarada' AND e.actor_person = _p) THEN
      RAISE EXCEPTION 'opsw:self-receipt'; END IF;
  END IF;
  INSERT INTO public.ops_work_events(work_id, seq, kind, engagement_id, professional_registry, doc_ref, milestone_key, milestone_label, on_date, note, actor_person, idempotency_key)
  VALUES (_w, _last + 1, _kind, _engagement, nullif(btrim(_registry),''), _doc, nullif(btrim(_mkey),''), nullif(btrim(_mlabel),''), _on, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsw:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_space_use_restriction(_space uuid, _expected_seq int, _action text, _rkey text, _severity text,
  _limit numeric, _shifts text[], _from date, _to date, _reason text, _work uuid, _doc uuid, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s public.ops_spaces; _last int; _seq int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsur:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_space_use_restrictions WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _s FROM public.ops_spaces WHERE id = _space FOR UPDATE;
  IF _s.id IS NULL OR NOT public.has_school_capability('restringir-uso-de-espacos', _s.school_id) THEN RAISE EXCEPTION 'opsur:forbidden'; END IF;
  IF _work IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_works w WHERE w.id = _work AND w.school_id = _s.school_id) THEN RAISE EXCEPTION 'opsur:invalid-work'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_space_use_restrictions WHERE space_id = _space;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsur:conflict'; END IF;
  IF _action = 'levantar' AND NOT EXISTS (SELECT 1 FROM public.ops_space_use_restrictions r WHERE r.space_id = _space AND r.restriction_key = _rkey AND r.action = 'impor') THEN
    RAISE EXCEPTION 'opsur:nothing-to-lift'; END IF;
  INSERT INTO public.ops_space_use_restrictions(space_id, seq, action, restriction_key, severity, capacity_limit, shift_ids, effective_from, effective_to, reason, work_id, basis_doc_ref, author_person, idempotency_key)
  VALUES (_space, _last + 1, _action, _rkey, _severity, _limit, coalesce(_shifts,'{}'), _from, _to, btrim(_reason), _work, _doc, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsur:invalid';
END $$;

REVOKE ALL ON FUNCTION public.open_ops_work(text,text,text,text,uuid[],uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_work_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_work_event(uuid,int,text,uuid,text,uuid,text,text,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_space_use_restriction(uuid,int,text,text,text,numeric,text[],date,date,text,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_ops_work(text,text,text,text,uuid[],uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_work_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_work_event(uuid,int,text,uuid,text,uuid,text,text,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_space_use_restriction(uuid,int,text,text,text,numeric,text[],date,date,text,uuid,uuid,text) TO authenticated;