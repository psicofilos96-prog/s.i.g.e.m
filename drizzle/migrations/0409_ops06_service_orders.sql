-- Centro de Operações L06: ordem de serviço (OS) = serviço efetivo, distinta da solicitação (L02) e da ordem de manutenção (L05).
-- Equipe = atuações; materiais com origem declarada; custo só com comprovante documental (juntada do SIGEM Documentos);
-- estados impostos no banco; serviço só "executado" após confirmação por profissional autorizado ≠ quem declarou.

CREATE TABLE public.ops_service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_order_id uuid NOT NULL REFERENCES public.ops_maintenance_orders(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  scope text NOT NULL CHECK (length(btrim(scope)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ops_service_orders_mo_idx ON public.ops_service_orders(maintenance_order_id);

CREATE TABLE public.ops_service_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.ops_service_orders(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('equipe-inclusao','equipe-saida','material','custo','evidencia','inicio','suspensao','retomada',
    'execucao-declarada','confirmacao','rejeicao','cancelamento')),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  material_label text CHECK (material_label IS NULL OR length(btrim(material_label)) >= 2),
  quantity numeric CHECK (quantity IS NULL OR quantity > 0),
  unit text,
  material_origin text CHECK (material_origin IS NULL OR material_origin IN ('almoxarifado','fornecedor','doacao','reaproveitamento')),
  origin_ref text,
  amount numeric CHECK (amount IS NULL OR amount >= 0),
  currency text CHECK (currency IS NULL OR currency = 'BRL'),
  doc_ref uuid REFERENCES public.admin_case_events(id),
  occurred_on date,
  note text CHECK (note IS NULL OR length(btrim(note)) >= 10),
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_order_id, seq),
  CHECK (kind NOT IN ('equipe-inclusao','equipe-saida') OR engagement_id IS NOT NULL),
  CHECK (kind <> 'material' OR (material_label IS NOT NULL AND quantity IS NOT NULL AND unit IS NOT NULL AND material_origin IS NOT NULL AND origin_ref IS NOT NULL)),
  CHECK (kind <> 'custo' OR (amount IS NOT NULL AND currency IS NOT NULL AND doc_ref IS NOT NULL)),
  CHECK (kind <> 'evidencia' OR doc_ref IS NOT NULL),
  CHECK (kind NOT IN ('inicio','execucao-declarada') OR occurred_on IS NOT NULL),
  CHECK (kind NOT IN ('suspensao','rejeicao','cancelamento') OR note IS NOT NULL)
);

GRANT SELECT ON public.ops_service_orders TO authenticated;
GRANT ALL ON public.ops_service_orders, public.ops_service_order_events TO service_role;
REVOKE SELECT ON public.ops_service_order_events FROM authenticated;
GRANT SELECT (id, service_order_id, seq, kind, engagement_id, material_label, quantity, unit, material_origin, amount, currency, occurred_on, note, actor_person, idempotency_key, created_at)
  ON public.ops_service_order_events TO authenticated;
ALTER TABLE public.ops_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_service_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service orders by school" ON public.ops_service_orders FOR SELECT TO authenticated USING (public.ops_can_read('infraestrutura', school_id));
CREATE POLICY "service order events by school" ON public.ops_service_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_service_orders s WHERE s.id = service_order_id AND public.ops_can_read('infraestrutura', s.school_id)));
CREATE TRIGGER opsso_immutable BEFORE UPDATE OR DELETE ON public.ops_service_orders FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssoe_immutable BEFORE UPDATE OR DELETE ON public.ops_service_order_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Estado da OS a partir do último evento de estado (eventos de registro não mudam o estado).
CREATE OR REPLACE FUNCTION public.ops_service_state(_so uuid) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE kind WHEN 'inicio' THEN 'em-execucao' WHEN 'retomada' THEN 'em-execucao' WHEN 'suspensao' THEN 'suspensa'
      WHEN 'execucao-declarada' THEN 'aguardando-confirmacao' WHEN 'confirmacao' THEN 'executada' WHEN 'rejeicao' THEN 'em-execucao'
      WHEN 'cancelamento' THEN 'cancelada' END
    FROM public.ops_service_order_events WHERE service_order_id = _so
      AND kind IN ('inicio','retomada','suspensao','execucao-declarada','confirmacao','rejeicao','cancelamento')
    ORDER BY seq DESC LIMIT 1), 'emitida')
$$;

CREATE OR REPLACE FUNCTION public.ops_service_next_ok(_state text, _kind text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN _state IN ('executada','cancelada') THEN false
    WHEN _kind IN ('equipe-inclusao','equipe-saida','material','custo','evidencia') THEN true
    WHEN _kind = 'cancelamento' THEN _state <> 'aguardando-confirmacao'
    WHEN _kind = 'inicio' THEN _state = 'emitida'
    WHEN _kind = 'suspensao' THEN _state = 'em-execucao'
    WHEN _kind = 'retomada' THEN _state = 'suspensa'
    WHEN _kind = 'execucao-declarada' THEN _state = 'em-execucao'
    WHEN _kind IN ('confirmacao','rejeicao') THEN _state = 'aguardando-confirmacao'
    ELSE false END
$$;

-- Emissão: só para ordem de manutenção já programada (o serviço nasce do planejamento, não da solicitação).
CREATE OR REPLACE FUNCTION public.issue_ops_service_order(_mo uuid, _scope text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _school text; _id uuid; _stage text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsso:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_service_orders WHERE idempotency_key = _key AND maintenance_order_id = _mo;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT r.school_id INTO _school FROM public.ops_maintenance_orders o JOIN public.ops_requests r ON r.id = o.request_id WHERE o.id = _mo;
  IF _school IS NULL OR NOT public.has_school_capability('emitir-ordens-de-servico', _school) THEN RAISE EXCEPTION 'opsso:unavailable'; END IF;
  SELECT stage INTO _stage FROM public.ops_maintenance_events WHERE order_id = _mo ORDER BY seq DESC LIMIT 1;
  IF _stage IS DISTINCT FROM 'programacao' THEN RAISE EXCEPTION 'opsso:maintenance-not-scheduled'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_service_orders s WHERE s.maintenance_order_id = _mo AND public.ops_service_state(s.id) NOT IN ('executada','cancelada')) THEN
    RAISE EXCEPTION 'opsso:already-open'; END IF;
  INSERT INTO public.ops_service_orders(maintenance_order_id, school_id, scope, author_person, idempotency_key)
  VALUES (_mo, _school, btrim(_scope), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsso:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_service_event(_so uuid, _expected_seq int, _kind text, _engagement uuid, _label text, _qty numeric, _unit text,
  _origin text, _origin_ref text, _amount numeric, _doc uuid, _on date, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s public.ops_service_orders; _last int; _seq int; _state text; _cap text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsso:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_service_order_events WHERE idempotency_key = _key AND service_order_id = _so;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _s FROM public.ops_service_orders WHERE id = _so FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'opsso:unavailable'; END IF;
  _cap := CASE WHEN _kind IN ('confirmacao','rejeicao') THEN 'confirmar-servicos-executados'
               WHEN _kind = 'custo' THEN 'registrar-custos-de-servico'
               WHEN _kind IN ('equipe-inclusao','equipe-saida','cancelamento') THEN 'emitir-ordens-de-servico'
               ELSE 'executar-manutencao' END;
  IF NOT public.has_school_capability(_cap, _s.school_id) THEN RAISE EXCEPTION 'opsso:unavailable'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_service_order_events WHERE service_order_id = _so;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsso:conflict'; END IF;
  _state := public.ops_service_state(_so);
  IF NOT public.ops_service_next_ok(_state, _kind) THEN RAISE EXCEPTION 'opsso:invalid-transition'; END IF;
  IF _kind = 'equipe-inclusao' AND NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement AND e.school_id = _s.school_id
     AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)) THEN RAISE EXCEPTION 'opsso:member-not-active'; END IF;
  -- Execução (início, suspensão, retomada, declaração, material, evidência) só por membro da equipe vigente na OS.
  IF _kind IN ('inicio','suspensao','retomada','execucao-declarada','material','evidencia') AND NOT EXISTS (
       SELECT 1 FROM public.ops_service_order_events m JOIN public.institutional_engagements e ON e.id = m.engagement_id
       WHERE m.service_order_id = _so AND m.kind = 'equipe-inclusao' AND e.person_id = _p
         AND NOT EXISTS (SELECT 1 FROM public.ops_service_order_events x WHERE x.service_order_id = _so AND x.kind = 'equipe-saida'
           AND x.engagement_id = m.engagement_id AND x.seq > m.seq)) THEN RAISE EXCEPTION 'opsso:not-team-member'; END IF;
  -- Confirmação por profissional autorizado que não declarou a execução nem integra a equipe.
  IF _kind IN ('confirmacao','rejeicao') AND (
       EXISTS (SELECT 1 FROM public.ops_service_order_events d WHERE d.service_order_id = _so AND d.kind = 'execucao-declarada' AND d.actor_person = _p)
       OR EXISTS (SELECT 1 FROM public.ops_service_order_events m JOIN public.institutional_engagements e ON e.id = m.engagement_id
                  WHERE m.service_order_id = _so AND m.kind = 'equipe-inclusao' AND e.person_id = _p)) THEN RAISE EXCEPTION 'opsso:self-confirmation'; END IF;
  IF _kind = 'execucao-declarada' AND NOT EXISTS (SELECT 1 FROM public.ops_service_order_events v WHERE v.service_order_id = _so AND v.kind = 'evidencia') THEN
    RAISE EXCEPTION 'opsso:evidence-required'; END IF;
  IF _on IS NOT NULL AND _on > current_date THEN RAISE EXCEPTION 'opsso:invalid-date'; END IF;
  INSERT INTO public.ops_service_order_events(service_order_id, seq, kind, engagement_id, material_label, quantity, unit, material_origin, origin_ref,
    amount, currency, doc_ref, occurred_on, note, actor_person, idempotency_key)
  VALUES (_so, _last + 1, _kind,
    CASE WHEN _kind IN ('equipe-inclusao','equipe-saida') THEN _engagement END,
    CASE WHEN _kind = 'material' THEN btrim(_label) END, CASE WHEN _kind = 'material' THEN _qty END, CASE WHEN _kind = 'material' THEN nullif(btrim(_unit),'') END,
    CASE WHEN _kind = 'material' THEN _origin END, CASE WHEN _kind = 'material' THEN nullif(btrim(_origin_ref),'') END,
    CASE WHEN _kind = 'custo' THEN _amount END, CASE WHEN _kind = 'custo' THEN 'BRL' END,
    CASE WHEN _kind IN ('custo','evidencia') THEN _doc END,
    CASE WHEN _kind IN ('inicio','execucao-declarada') THEN _on END, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'opsso:invalid';
END $$;

REVOKE ALL ON FUNCTION public.issue_ops_service_order(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_service_event(uuid,int,text,uuid,text,numeric,text,text,text,numeric,uuid,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_ops_service_order(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_service_event(uuid,int,text,uuid,text,numeric,text,text,text,numeric,uuid,date,text,text) TO authenticated;
