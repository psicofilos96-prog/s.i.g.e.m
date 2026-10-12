-- Centro de Operações L14: movimentos transacionais. Idempotência estrita (mesma chave com conteúdo diferente ⇒ recusa),
-- lock por depósito+item, saldo nunca negativo, ajuste só por solicitação + autorização de pessoa ≠ solicitante,
-- transferência entre depósitos como par atômico, e catálogo sem gêneros alimentícios (saldo oficial deles é do NAE).
ALTER TABLE public.ops_supply_item_versions ADD CONSTRAINT ops_supply_not_food CHECK (category !~* '(aliment|g[eê]nero|merenda)');
ALTER TABLE public.ops_supply_movements DROP CONSTRAINT ops_supply_movements_kind_check;
ALTER TABLE public.ops_supply_movements ADD CONSTRAINT ops_supply_movements_kind_check
  CHECK (kind IN ('entrada','saida','ajuste-entrada','ajuste-saida','descarte','estorno','transferencia-saida','transferencia-entrada'));
ALTER TABLE public.ops_supply_movements ADD COLUMN transfer_group uuid;
ALTER TABLE public.ops_supply_movements ADD COLUMN adjustment_id uuid;
ALTER TABLE public.ops_supply_movements ADD CONSTRAINT ops_supply_transfer_group CHECK ((kind LIKE 'transferencia-%') = (transfer_group IS NOT NULL));
ALTER TABLE public.ops_supply_movements ADD CONSTRAINT ops_supply_adjustment_link CHECK ((kind LIKE 'ajuste-%') = (adjustment_id IS NOT NULL));
CREATE UNIQUE INDEX ops_supply_one_per_adjustment ON public.ops_supply_movements (adjustment_id) WHERE adjustment_id IS NOT NULL;
CREATE UNIQUE INDEX ops_supply_transfer_pair ON public.ops_supply_movements (transfer_group, kind) WHERE transfer_group IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ops_supply_balance(_wh uuid, _item text, _lot text) RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(sum(CASE WHEN m.kind IN ('entrada','ajuste-entrada','transferencia-entrada') THEN m.quantity ELSE -m.quantity END), 0)
  FROM public.ops_supply_movements m
  WHERE m.warehouse_id = _wh AND m.item_key = _item AND m.kind <> 'estorno' AND (_lot IS NULL OR m.lot IS NOT DISTINCT FROM _lot)
    AND NOT EXISTS (SELECT 1 FROM public.ops_supply_movements r WHERE r.reverses_id = m.id)
$$;

CREATE TABLE public.ops_supply_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.ops_warehouses(id),
  item_key text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('entrada','saida')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  lot text,
  expires_on date,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  count_ref text,
  balance_at_request numeric NOT NULL,
  requester_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_supply_adjustment_decisions (
  adjustment_id uuid PRIMARY KEY REFERENCES public.ops_supply_adjustments(id),
  decision text NOT NULL CHECK (decision IN ('aprovado','recusado')),
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  note text,
  approver_person uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision <> 'recusado' OR length(btrim(coalesce(note,''))) >= 10)
);
ALTER TABLE public.ops_supply_movements ADD CONSTRAINT ops_supply_adjustment_fk FOREIGN KEY (adjustment_id) REFERENCES public.ops_supply_adjustments(id);
GRANT SELECT ON public.ops_supply_adjustments, public.ops_supply_adjustment_decisions TO authenticated;
GRANT ALL ON public.ops_supply_adjustments, public.ops_supply_adjustment_decisions TO service_role;
ALTER TABLE public.ops_supply_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_adjustment_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adjustments by school" ON public.ops_supply_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_warehouses w WHERE w.id = warehouse_id AND public.ops_can_read('patrimonio', w.school_id)));
CREATE POLICY "adjustment decisions by school" ON public.ops_supply_adjustment_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_supply_adjustments a JOIN public.ops_warehouses w ON w.id = a.warehouse_id WHERE a.id = adjustment_id AND public.ops_can_read('patrimonio', w.school_id)));
CREATE TRIGGER opssadj_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_adjustments FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssadd_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_adjustment_decisions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
GRANT SELECT (transfer_group, adjustment_id) ON public.ops_supply_movements TO authenticated;

-- Núcleo interno (sem EXECUTE para ninguém): valida item aprovado/lote/validade/saldo sob lock e insere.
CREATE OR REPLACE FUNCTION public.ops_supply_insert(_wh uuid, _item_key text, _kind text, _qty numeric, _lot text, _expires date, _on date,
  _doc uuid, _destination text, _reason text, _transfer uuid, _adjustment uuid, _actor uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _iv public.ops_supply_item_versions; _l text := nullif(btrim(_lot),''); _e date := _expires; _id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ops-supply|' || _wh::text || '|' || _item_key));
  SELECT v.* INTO _iv FROM public.ops_supply_item_versions v JOIN public.ops_supply_item_approvals a ON a.item_version_id = v.id
    WHERE v.item_key = _item_key AND v.version = (SELECT max(version) FROM public.ops_supply_item_versions x WHERE x.item_key = _item_key);
  IF _iv.id IS NULL OR NOT _iv.active THEN RAISE EXCEPTION 'opssm:item-not-approved'; END IF;
  IF _iv.tracks_lot AND _l IS NULL THEN RAISE EXCEPTION 'opssm:lot-required'; END IF;
  IF NOT _iv.tracks_lot AND _l IS NOT NULL THEN RAISE EXCEPTION 'opssm:lot-not-tracked'; END IF;
  IF _kind IN ('entrada','ajuste-entrada','transferencia-entrada') THEN
    IF _iv.tracks_expiry AND _e IS NULL THEN RAISE EXCEPTION 'opssm:expiry-required'; END IF;
    IF _l IS NOT NULL AND EXISTS (SELECT 1 FROM public.ops_supply_movements m WHERE m.warehouse_id = _wh AND m.item_key = _item_key AND m.lot = _l AND m.expires_on IS DISTINCT FROM _e) THEN RAISE EXCEPTION 'opssm:lot-expiry-mismatch'; END IF;
  ELSE
    IF _l IS NOT NULL THEN SELECT expires_on INTO _e FROM public.ops_supply_movements WHERE warehouse_id = _wh AND item_key = _item_key AND lot = _l AND expires_on IS NOT NULL LIMIT 1; END IF;
    IF _kind IN ('saida','transferencia-saida') AND _e IS NOT NULL AND _e < _on THEN RAISE EXCEPTION 'opssm:expired-lot'; END IF;
    IF public.ops_supply_balance(_wh, _item_key, _l) - _qty < 0 THEN RAISE EXCEPTION 'opssm:negative-balance'; END IF;
  END IF;
  INSERT INTO public.ops_supply_movements(warehouse_id, item_version_id, item_key, kind, quantity, lot, expires_on, occurred_on, source_doc_ref, destination, reason, transfer_group, adjustment_id, actor_person, idempotency_key)
  VALUES (_wh, _iv.id, _item_key, _kind, _qty, _l, _e, _on, _doc, nullif(btrim(_destination),''), nullif(btrim(_reason),''), _transfer, _adjustment, _actor, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.ops_supply_insert(uuid,text,text,numeric,text,date,date,uuid,text,text,uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;

-- Writer de movimento simples: entrada/saída/descarte/estorno. Ajuste e transferência têm writers próprios.
CREATE OR REPLACE FUNCTION public.record_ops_supply_movement(_wh uuid, _item_key text, _kind text, _qty numeric, _lot text, _expires date, _on date,
  _doc uuid, _destination text, _reason text, _reverses uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _w public.ops_warehouses; _prev public.ops_supply_movements; _orig public.ops_supply_movements; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssm:no-person'; END IF;
  SELECT * INTO _prev FROM public.ops_supply_movements WHERE idempotency_key = _key;
  IF _prev.id IS NOT NULL THEN
    IF _prev.warehouse_id <> _wh OR _prev.item_key <> _item_key OR _prev.kind <> _kind OR (_kind <> 'estorno' AND _prev.quantity <> _qty) OR _prev.actor_person <> _p
      THEN RAISE EXCEPTION 'opssm:idempotency-mismatch'; END IF;
    RETURN _prev.id;
  END IF;
  IF _kind NOT IN ('entrada','saida','descarte','estorno') THEN RAISE EXCEPTION 'opssm:kind-requires-own-flow'; END IF;
  SELECT * INTO _w FROM public.ops_warehouses WHERE id = _wh;
  IF _w.id IS NULL OR NOT public.has_school_capability('movimentar-almoxarifado', _w.school_id) THEN RAISE EXCEPTION 'opssm:forbidden'; END IF;
  IF _on > current_date THEN RAISE EXCEPTION 'opssm:future-date'; END IF;
  IF _kind = 'estorno' THEN
    PERFORM pg_advisory_xact_lock(hashtext('ops-supply|' || _wh::text || '|' || _item_key));
    SELECT * INTO _orig FROM public.ops_supply_movements WHERE id = _reverses AND warehouse_id = _wh AND item_key = _item_key AND kind IN ('entrada','saida','descarte');
    IF _orig.id IS NULL THEN RAISE EXCEPTION 'opssm:nothing-to-reverse'; END IF;
    IF length(btrim(coalesce(_reason,''))) < 10 THEN RAISE EXCEPTION 'opssm:invalid'; END IF;
    IF _orig.kind = 'entrada' AND public.ops_supply_balance(_wh, _item_key, _orig.lot) - _orig.quantity < 0 THEN RAISE EXCEPTION 'opssm:negative-balance'; END IF;
    INSERT INTO public.ops_supply_movements(warehouse_id, item_version_id, item_key, kind, quantity, lot, expires_on, occurred_on, reason, reverses_id, actor_person, idempotency_key)
    VALUES (_wh, _orig.item_version_id, _item_key, 'estorno', _orig.quantity, _orig.lot, _orig.expires_on, _on, btrim(_reason), _orig.id, _p, _key) RETURNING id INTO _id;
    RETURN _id;
  END IF;
  RETURN public.ops_supply_insert(_wh, _item_key, _kind, _qty, _lot, _expires, _on, _doc, _destination, _reason, NULL, NULL, _p, _key);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opssm:already-reversed';
  WHEN check_violation THEN RAISE EXCEPTION 'opssm:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.request_ops_supply_adjustment(_wh uuid, _item_key text, _direction text, _qty numeric, _lot text, _expires date, _reason text, _count_ref text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _w public.ops_warehouses; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssadj:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_supply_adjustments WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _w FROM public.ops_warehouses WHERE id = _wh;
  IF _w.id IS NULL OR NOT public.has_school_capability('movimentar-almoxarifado', _w.school_id) THEN RAISE EXCEPTION 'opssadj:forbidden'; END IF;
  INSERT INTO public.ops_supply_adjustments(warehouse_id, item_key, direction, quantity, lot, expires_on, reason, count_ref, balance_at_request, requester_person, idempotency_key)
  VALUES (_wh, _item_key, _direction, _qty, nullif(btrim(_lot),''), _expires, btrim(_reason), nullif(btrim(_count_ref),''), public.ops_supply_balance(_wh, _item_key, nullif(btrim(_lot),'')), _p, _key)
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opssadj:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.decide_ops_supply_adjustment(_adj uuid, _decision text, _decision_ref text, _note text, _on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a public.ops_supply_adjustments; _w public.ops_warehouses; _mv uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssadj:no-person'; END IF;
  SELECT * INTO _a FROM public.ops_supply_adjustments WHERE id = _adj FOR UPDATE;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'opssadj:unavailable'; END IF;
  SELECT * INTO _w FROM public.ops_warehouses WHERE id = _a.warehouse_id;
  IF NOT public.has_school_capability('autorizar-ajustes-de-almoxarifado', _w.school_id) THEN RAISE EXCEPTION 'opssadj:authorize-forbidden'; END IF;
  IF _a.requester_person = _p THEN RAISE EXCEPTION 'opssadj:self-authorization'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_supply_adjustment_decisions WHERE adjustment_id = _adj) THEN RAISE EXCEPTION 'opssadj:already-decided'; END IF;
  -- Saldo mudou desde a solicitação ⇒ decisão sobre base obsoleta é recusada (nova contagem/solicitação).
  IF _decision = 'aprovado' AND public.ops_supply_balance(_a.warehouse_id, _a.item_key, _a.lot) <> _a.balance_at_request THEN RAISE EXCEPTION 'opssadj:stale-balance'; END IF;
  INSERT INTO public.ops_supply_adjustment_decisions(adjustment_id, decision, decision_ref, note, approver_person) VALUES (_adj, _decision, btrim(_decision_ref), nullif(btrim(_note),''), _p);
  IF _decision = 'aprovado' THEN
    IF _on > current_date OR _on < _a.created_at::date THEN RAISE EXCEPTION 'opssadj:invalid-date'; END IF;
    _mv := public.ops_supply_insert(_a.warehouse_id, _a.item_key, 'ajuste-' || _a.direction, _a.quantity, _a.lot, _a.expires_on, _on, NULL, NULL, _a.reason, NULL, _a.id, _p, 'adj|' || _a.id::text);
  END IF;
  RETURN _mv;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opssadj:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.transfer_ops_supply(_from uuid, _to uuid, _item_key text, _qty numeric, _lot text, _on date, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _wf public.ops_warehouses; _wt public.ops_warehouses; _g uuid; _exp date; _out uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsstr:no-person'; END IF;
  SELECT transfer_group INTO _g FROM public.ops_supply_movements WHERE idempotency_key = _key || '#out';
  IF _g IS NOT NULL THEN RETURN _g; END IF;
  IF _from = _to THEN RAISE EXCEPTION 'opsstr:same-warehouse'; END IF;
  SELECT * INTO _wf FROM public.ops_warehouses WHERE id = _from;
  SELECT * INTO _wt FROM public.ops_warehouses WHERE id = _to;
  IF _wf.id IS NULL OR _wt.id IS NULL OR NOT public.has_school_capability('movimentar-almoxarifado', _wf.school_id)
     OR NOT public.has_school_capability('movimentar-almoxarifado', _wt.school_id) THEN RAISE EXCEPTION 'opsstr:forbidden'; END IF;
  IF _on > current_date OR length(btrim(coalesce(_reason,''))) < 10 THEN RAISE EXCEPTION 'opsstr:invalid'; END IF;
  _g := gen_random_uuid();
  -- Ordem fixa dos locks (menor id primeiro) evita deadlock entre transferências cruzadas.
  PERFORM pg_advisory_xact_lock(hashtext('ops-supply|' || least(_from,_to)::text || '|' || _item_key));
  PERFORM pg_advisory_xact_lock(hashtext('ops-supply|' || greatest(_from,_to)::text || '|' || _item_key));
  _out := public.ops_supply_insert(_from, _item_key, 'transferencia-saida', _qty, _lot, NULL, _on, NULL, NULL, _reason, _g, NULL, _p, _key || '#out');
  SELECT expires_on INTO _exp FROM public.ops_supply_movements WHERE id = _out;
  PERFORM public.ops_supply_insert(_to, _item_key, 'transferencia-entrada', _qty, _lot, _exp, _on, NULL, NULL, _reason, _g, NULL, _p, _key || '#in');
  RETURN _g;
END $$;

REVOKE ALL ON FUNCTION public.request_ops_supply_adjustment(uuid,text,text,numeric,text,date,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_ops_supply_adjustment(uuid,text,text,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_ops_supply(uuid,uuid,text,numeric,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_ops_supply_adjustment(uuid,text,text,numeric,text,date,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ops_supply_adjustment(uuid,text,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_ops_supply(uuid,uuid,text,numeric,text,date,text,text) TO authenticated;