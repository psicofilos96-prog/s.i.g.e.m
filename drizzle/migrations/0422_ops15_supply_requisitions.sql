-- Centro de Operações L15: requisição de materiais. solicitada → em análise → autorizada (por linha, ≤ solicitado,
-- pessoa ≠ solicitante) → ciclos separação → expedição (saída real do depósito) → recebimento (entrada no depósito de
-- destino, com comprovante) → encerramento (parcial exige justificativa). Estoque mínimo versionado/aprovado.
-- Nenhuma compra é gerada: previsão e alerta são projeções.
CREATE TABLE public.ops_supply_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_warehouse uuid NOT NULL REFERENCES public.ops_warehouses(id),
  requesting_school text NOT NULL REFERENCES public.institutional_schools(id),
  destination_warehouse uuid REFERENCES public.ops_warehouses(id),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 10),
  requester_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (destination_warehouse IS DISTINCT FROM supplier_warehouse)
);
CREATE TABLE public.ops_supply_requisition_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.ops_supply_requisitions(id),
  item_key text NOT NULL,
  requested numeric NOT NULL CHECK (requested > 0),
  UNIQUE (requisition_id, item_key)
);
CREATE TABLE public.ops_supply_requisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.ops_supply_requisitions(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('analise','autorizacao','recusa','separacao','expedicao','recebimento','encerramento','cancelamento')),
  doc_ref uuid REFERENCES public.admin_case_events(id),
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisition_id, seq),
  CHECK (kind NOT IN ('recusa','cancelamento') OR length(btrim(coalesce(note,''))) >= 10)
);
CREATE TABLE public.ops_supply_requisition_line_acts (
  event_id uuid NOT NULL REFERENCES public.ops_supply_requisition_events(id),
  line_id uuid NOT NULL REFERENCES public.ops_supply_requisition_lines(id),
  quantity numeric NOT NULL CHECK (quantity >= 0),
  lot text,
  movement_id uuid REFERENCES public.ops_supply_movements(id),
  PRIMARY KEY (event_id, line_id, lot)
);
CREATE UNIQUE INDEX ops_req_terminal ON public.ops_supply_requisition_events (requisition_id) WHERE kind IN ('recusa','encerramento','cancelamento');
CREATE UNIQUE INDEX ops_req_one_authorization ON public.ops_supply_requisition_events (requisition_id) WHERE kind = 'autorizacao';
ALTER TABLE public.ops_supply_requisition_line_acts ALTER COLUMN lot SET DEFAULT '';

CREATE TABLE public.ops_supply_min_level_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.ops_warehouses(id),
  item_key text NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  min_quantity numeric NOT NULL CHECK (min_quantity >= 0),
  basis text NOT NULL CHECK (length(btrim(basis)) >= 10),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, item_key, version)
);
CREATE TABLE public.ops_supply_min_level_approvals (
  min_level_version_id uuid PRIMARY KEY REFERENCES public.ops_supply_min_level_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ops_supply_requisitions, public.ops_supply_requisition_lines, public.ops_supply_requisition_line_acts, public.ops_supply_min_level_versions, public.ops_supply_min_level_approvals TO authenticated;
GRANT SELECT (id, requisition_id, seq, kind, note, actor_person, idempotency_key, created_at) ON public.ops_supply_requisition_events TO authenticated;
GRANT ALL ON public.ops_supply_requisitions, public.ops_supply_requisition_lines, public.ops_supply_requisition_events, public.ops_supply_requisition_line_acts, public.ops_supply_min_level_versions, public.ops_supply_min_level_approvals TO service_role;
ALTER TABLE public.ops_supply_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_requisition_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_requisition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_requisition_line_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_min_level_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_min_level_approvals ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.ops_requisition_readable(_r uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.ops_supply_requisitions r JOIN public.ops_warehouses w ON w.id = r.supplier_warehouse
    WHERE r.id = _r AND (r.requester_person = public.current_person_id() OR public.ops_can_read('patrimonio', w.school_id) OR public.ops_can_read('patrimonio', r.requesting_school)))
$$;
REVOKE ALL ON FUNCTION public.ops_requisition_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_requisition_readable(uuid) TO authenticated;
CREATE POLICY "requisitions readable" ON public.ops_supply_requisitions FOR SELECT TO authenticated USING (public.ops_requisition_readable(id));
CREATE POLICY "requisition lines readable" ON public.ops_supply_requisition_lines FOR SELECT TO authenticated USING (public.ops_requisition_readable(requisition_id));
CREATE POLICY "requisition events readable" ON public.ops_supply_requisition_events FOR SELECT TO authenticated USING (public.ops_requisition_readable(requisition_id));
CREATE POLICY "requisition acts readable" ON public.ops_supply_requisition_line_acts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_supply_requisition_events e WHERE e.id = event_id AND public.ops_requisition_readable(e.requisition_id)));
CREATE POLICY "min levels by school" ON public.ops_supply_min_level_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_warehouses w WHERE w.id = warehouse_id AND public.ops_can_read('patrimonio', w.school_id)));
CREATE POLICY "min level approvals by school" ON public.ops_supply_min_level_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_supply_min_level_versions v JOIN public.ops_warehouses w ON w.id = v.warehouse_id WHERE v.id = min_level_version_id AND public.ops_can_read('patrimonio', w.school_id)));
CREATE TRIGGER opsreq_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_requisitions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsreql_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_requisition_lines FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsreqe_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_requisition_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsreqa_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_requisition_line_acts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsmin_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_min_level_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsmina_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_min_level_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.open_ops_supply_requisition(_supplier uuid, _school text, _dest uuid, _justification text, _lines jsonb, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _l jsonb;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsreq:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_supply_requisitions WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('requisitar-materiais', _school) THEN RAISE EXCEPTION 'opsreq:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_warehouses WHERE id = _supplier) THEN RAISE EXCEPTION 'opsreq:invalid-supplier'; END IF;
  IF _dest IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_warehouses WHERE id = _dest AND school_id = _school) THEN RAISE EXCEPTION 'opsreq:invalid-destination'; END IF;
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'opsreq:no-lines'; END IF;
  INSERT INTO public.ops_supply_requisitions(supplier_warehouse, requesting_school, destination_warehouse, justification, requester_person, idempotency_key)
  VALUES (_supplier, _school, _dest, btrim(_justification), _p, _key) RETURNING id INTO _id;
  FOR _l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.ops_supply_item_versions v JOIN public.ops_supply_item_approvals a ON a.item_version_id = v.id WHERE v.item_key = _l->>'item_key' AND v.active
       AND v.version = (SELECT max(version) FROM public.ops_supply_item_versions x WHERE x.item_key = v.item_key)) THEN RAISE EXCEPTION 'opsreq:item-not-approved'; END IF;
    INSERT INTO public.ops_supply_requisition_lines(requisition_id, item_key, requested) VALUES (_id, _l->>'item_key', (_l->>'quantity')::numeric);
  END LOOP;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsreq:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'opsreq:duplicate-item';
END $$;

CREATE OR REPLACE FUNCTION public.ops_requisition_state(_r uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE kind WHEN 'analise' THEN 'em-analise' WHEN 'autorizacao' THEN 'autorizada' WHEN 'recusa' THEN 'recusada'
    WHEN 'separacao' THEN 'separada' WHEN 'expedicao' THEN 'expedida' WHEN 'recebimento' THEN 'autorizada' WHEN 'encerramento' THEN 'encerrada' WHEN 'cancelamento' THEN 'cancelada' END
    FROM public.ops_supply_requisition_events WHERE requisition_id = _r ORDER BY seq DESC LIMIT 1), 'solicitada')
$$;
REVOKE ALL ON FUNCTION public.ops_requisition_state(uuid) FROM PUBLIC, anon, authenticated;

-- _lines: [{"line_id":..., "quantity":..., "lot":...}] para autorizacao/separacao/recebimento.
CREATE OR REPLACE FUNCTION public.record_ops_supply_requisition_event(_r uuid, _expected_seq int, _kind text, _lines jsonb, _doc uuid, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _q public.ops_supply_requisitions; _sup public.ops_warehouses; _st text; _last int; _seq int; _ev uuid;
  _l jsonb; _ln public.ops_supply_requisition_lines; _qty numeric; _auth numeric; _done numeric; _a record; _mv uuid; _sep uuid; _exp uuid; _shipped numeric;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsreq:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_supply_requisition_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _q FROM public.ops_supply_requisitions WHERE id = _r FOR UPDATE;
  IF _q.id IS NULL THEN RAISE EXCEPTION 'opsreq:unavailable'; END IF;
  SELECT * INTO _sup FROM public.ops_warehouses WHERE id = _q.supplier_warehouse;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_supply_requisition_events WHERE requisition_id = _r;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsreq:conflict'; END IF;
  _st := public.ops_requisition_state(_r);
  IF NOT ((_kind = 'analise' AND _st = 'solicitada') OR (_kind IN ('autorizacao','recusa') AND _st IN ('solicitada','em-analise'))
       OR (_kind = 'separacao' AND _st = 'autorizada') OR (_kind = 'expedicao' AND _st = 'separada') OR (_kind = 'recebimento' AND _st = 'expedida')
       OR (_kind = 'encerramento' AND _st = 'autorizada') OR (_kind = 'cancelamento' AND _st IN ('solicitada','em-analise'))) THEN RAISE EXCEPTION 'opsreq:invalid-transition'; END IF;
  IF _kind IN ('analise','separacao','expedicao') AND NOT public.has_school_capability('atender-requisicoes', _sup.school_id) THEN RAISE EXCEPTION 'opsreq:forbidden'; END IF;
  IF _kind IN ('autorizacao','recusa','encerramento') THEN
    IF NOT public.has_school_capability('autorizar-requisicoes', _sup.school_id) THEN RAISE EXCEPTION 'opsreq:authorize-forbidden'; END IF;
    IF _p = _q.requester_person THEN RAISE EXCEPTION 'opsreq:self-authorization'; END IF;
  END IF;
  IF _kind = 'cancelamento' AND _p <> _q.requester_person THEN RAISE EXCEPTION 'opsreq:only-requester-cancels'; END IF;
  IF _kind = 'recebimento' THEN
    IF NOT public.has_school_capability('requisitar-materiais', _q.requesting_school) THEN RAISE EXCEPTION 'opsreq:receive-forbidden'; END IF;
    IF _doc IS NULL THEN RAISE EXCEPTION 'opsreq:receipt-doc-required'; END IF;
    IF EXISTS (SELECT 1 FROM public.ops_supply_requisition_events e WHERE e.requisition_id = _r AND e.kind = 'expedicao' AND e.actor_person = _p
       AND e.seq = (SELECT max(seq) FROM public.ops_supply_requisition_events x WHERE x.requisition_id = _r AND x.kind = 'expedicao')) THEN RAISE EXCEPTION 'opsreq:self-receipt'; END IF;
  END IF;
  IF _kind = 'encerramento' AND EXISTS (
       SELECT 1 FROM public.ops_supply_requisition_lines l
       WHERE l.requisition_id = _r AND coalesce((SELECT sum(a.quantity) FROM public.ops_supply_requisition_line_acts a JOIN public.ops_supply_requisition_events e ON e.id = a.event_id WHERE a.line_id = l.id AND e.kind = 'expedicao'),0)
          < coalesce((SELECT sum(a.quantity) FROM public.ops_supply_requisition_line_acts a JOIN public.ops_supply_requisition_events e ON e.id = a.event_id WHERE a.line_id = l.id AND e.kind = 'autorizacao'),0))
     AND length(btrim(coalesce(_note,''))) < 10 THEN RAISE EXCEPTION 'opsreq:partial-requires-justification'; END IF;

  INSERT INTO public.ops_supply_requisition_events(requisition_id, seq, kind, doc_ref, note, actor_person, idempotency_key)
  VALUES (_r, _last + 1, _kind, _doc, nullif(btrim(_note),''), _p, _key) RETURNING id INTO _ev;

  IF _kind IN ('autorizacao','separacao','recebimento') THEN
    IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'opsreq:no-lines'; END IF;
    FOR _l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
      SELECT * INTO _ln FROM public.ops_supply_requisition_lines WHERE id = (_l->>'line_id')::uuid AND requisition_id = _r;
      IF _ln.id IS NULL THEN RAISE EXCEPTION 'opsreq:invalid-line'; END IF;
      _qty := (_l->>'quantity')::numeric;
      SELECT coalesce(sum(a.quantity),0) INTO _auth FROM public.ops_supply_requisition_line_acts a JOIN public.ops_supply_requisition_events e ON e.id = a.event_id WHERE a.line_id = _ln.id AND e.kind = 'autorizacao';
      IF _kind = 'autorizacao' AND _qty > _ln.requested THEN RAISE EXCEPTION 'opsreq:above-requested'; END IF;
      IF _kind = 'separacao' THEN
        SELECT coalesce(sum(a.quantity),0) INTO _done FROM public.ops_supply_requisition_line_acts a JOIN public.ops_supply_requisition_events e ON e.id = a.event_id WHERE a.line_id = _ln.id AND e.kind = 'separacao';
        IF _done + _qty > _auth THEN RAISE EXCEPTION 'opsreq:above-authorized'; END IF;
      END IF;
      IF _kind = 'recebimento' THEN
        SELECT max(e.id::text)::uuid INTO _exp FROM public.ops_supply_requisition_events e WHERE e.requisition_id = _r AND e.kind = 'expedicao'
          AND e.seq = (SELECT max(seq) FROM public.ops_supply_requisition_events x WHERE x.requisition_id = _r AND x.kind = 'expedicao');
        SELECT coalesce(sum(quantity),0) INTO _shipped FROM public.ops_supply_requisition_line_acts WHERE event_id = _exp AND line_id = _ln.id AND lot = coalesce(_l->>'lot','');
        IF _qty > _shipped THEN RAISE EXCEPTION 'opsreq:above-shipped'; END IF;
        IF _q.destination_warehouse IS NOT NULL AND _qty > 0 THEN
          _mv := public.ops_supply_insert(_q.destination_warehouse, _ln.item_key, 'entrada', _qty, nullif(_l->>'lot',''),
            (SELECT expires_on FROM public.ops_supply_movements m WHERE m.warehouse_id = _q.supplier_warehouse AND m.item_key = _ln.item_key AND m.lot = nullif(_l->>'lot','') LIMIT 1),
            current_date, _doc, NULL, NULL, NULL, NULL, _p, _key || '#' || _ln.id::text || '#' || coalesce(_l->>'lot',''));
        END IF;
      END IF;
      INSERT INTO public.ops_supply_requisition_line_acts(event_id, line_id, quantity, lot, movement_id) VALUES (_ev, _ln.id, _qty, coalesce(_l->>'lot',''), _mv);
      _mv := NULL;
    END LOOP;
  ELSIF _kind = 'expedicao' THEN
    -- Expede exatamente a última separação: saída real do depósito fornecedor (saldo nunca negativo).
    SELECT e.id INTO _sep FROM public.ops_supply_requisition_events e WHERE e.requisition_id = _r AND e.kind = 'separacao' ORDER BY e.seq DESC LIMIT 1;
    FOR _a IN SELECT a.line_id, a.quantity, a.lot, l.item_key FROM public.ops_supply_requisition_line_acts a JOIN public.ops_supply_requisition_lines l ON l.id = a.line_id WHERE a.event_id = _sep AND a.quantity > 0 LOOP
      _mv := public.ops_supply_insert(_q.supplier_warehouse, _a.item_key, 'saida', _a.quantity, nullif(_a.lot,''), NULL, current_date, NULL,
        'Requisição ' || _r::text, NULL, NULL, NULL, _p, _key || '#' || _a.line_id::text || '#' || _a.lot);
      INSERT INTO public.ops_supply_requisition_line_acts(event_id, line_id, quantity, lot, movement_id) VALUES (_ev, _a.line_id, _a.quantity, _a.lot, _mv);
    END LOOP;
  END IF;
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsreq:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'opsreq:duplicate';
END $$;

CREATE OR REPLACE FUNCTION public.register_ops_supply_min_level(_wh uuid, _item text, _expected_version int, _min numeric, _basis text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _w public.ops_warehouses; _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmin:no-person'; END IF;
  SELECT * INTO _w FROM public.ops_warehouses WHERE id = _wh;
  IF _w.id IS NULL OR NOT public.has_school_capability('manter-almoxarifado', _w.school_id) THEN RAISE EXCEPTION 'opsmin:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_supply_min_level_versions WHERE warehouse_id = _wh AND item_key = _item;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opsmin:conflict'; END IF;
  INSERT INTO public.ops_supply_min_level_versions(warehouse_id, item_key, version, min_quantity, basis, author_person) VALUES (_wh, _item, _last + 1, _min, btrim(_basis), _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsmin:invalid';
END $$;
CREATE OR REPLACE FUNCTION public.approve_ops_supply_min_level(_v uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _m public.ops_supply_min_level_versions; _w public.ops_warehouses;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmin:no-person'; END IF;
  SELECT * INTO _m FROM public.ops_supply_min_level_versions WHERE id = _v;
  SELECT * INTO _w FROM public.ops_warehouses WHERE id = _m.warehouse_id;
  IF _m.id IS NULL OR NOT public.has_school_capability('autorizar-ajustes-de-almoxarifado', _w.school_id) THEN RAISE EXCEPTION 'opsmin:approve-forbidden'; END IF;
  IF _m.author_person = _p THEN RAISE EXCEPTION 'opsmin:self-approval'; END IF;
  INSERT INTO public.ops_supply_min_level_approvals(min_level_version_id, approver_person, decision_ref) VALUES (_v, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsmin:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opsmin:invalid';
END $$;

REVOKE ALL ON FUNCTION public.open_ops_supply_requisition(uuid,text,uuid,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_supply_requisition_event(uuid,int,text,jsonb,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_supply_min_level(uuid,text,int,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_supply_min_level(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_ops_supply_requisition(uuid,text,uuid,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_supply_requisition_event(uuid,int,text,jsonb,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_supply_min_level(uuid,text,int,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_supply_min_level(uuid,text) TO authenticated;
REVOKE SELECT ON public.ops_supply_requisition_events FROM authenticated;
GRANT SELECT (id, requisition_id, seq, kind, note, actor_person, idempotency_key, created_at) ON public.ops_supply_requisition_events TO authenticated;