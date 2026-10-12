-- Centro de Operações L13: almoxarifado de consumo (separado dos bens permanentes L09 e do estoque de alimentação do NAE).
-- Catálogo versionado aprovado por pessoa ≠ autor; depósito por escola; movimentos append-only; saldo é projeção dos
-- movimentos válidos (estorno anula, nunca apaga) e nunca negativo, calculado sob lock por depósito+item(+lote).
CREATE TABLE public.ops_supply_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL CHECK (item_key ~ '^[a-z0-9-]{2,80}$'),
  version int NOT NULL CHECK (version >= 1),
  label text NOT NULL CHECK (length(btrim(label)) >= 2),
  unit text NOT NULL CHECK (length(btrim(unit)) BETWEEN 1 AND 20),
  category text NOT NULL CHECK (length(btrim(category)) >= 2),
  tracks_lot boolean NOT NULL DEFAULT false,
  tracks_expiry boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_key, version), CHECK (version = 1 OR reason IS NOT NULL), CHECK (NOT tracks_expiry OR tracks_lot)
);
CREATE TABLE public.ops_supply_item_approvals (
  item_version_id uuid PRIMARY KEY REFERENCES public.ops_supply_item_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  space_id uuid REFERENCES public.ops_spaces(id),
  name text NOT NULL CHECK (length(btrim(name)) >= 3),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE TABLE public.ops_supply_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.ops_warehouses(id),
  item_version_id uuid NOT NULL REFERENCES public.ops_supply_item_versions(id),
  item_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('entrada','saida','ajuste-entrada','ajuste-saida','descarte','estorno')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  lot text,
  expires_on date,
  occurred_on date NOT NULL,
  source_doc_ref uuid REFERENCES public.admin_case_events(id),
  destination text,
  reason text,
  reverses_id uuid REFERENCES public.ops_supply_movements(id),
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'entrada' OR source_doc_ref IS NOT NULL),
  CHECK (kind <> 'saida' OR length(btrim(coalesce(destination,''))) >= 3),
  CHECK (kind NOT IN ('ajuste-entrada','ajuste-saida','descarte','estorno') OR length(btrim(coalesce(reason,''))) >= 10),
  CHECK ((kind = 'estorno') = (reverses_id IS NOT NULL))
);
CREATE UNIQUE INDEX ops_supply_one_reversal ON public.ops_supply_movements (reverses_id) WHERE reverses_id IS NOT NULL;
CREATE INDEX ops_supply_mov_wh_item ON public.ops_supply_movements (warehouse_id, item_key);

-- Saldo derivado (movimentos válidos = não estornados; estorno não conta). Sinal por tipo.
CREATE OR REPLACE FUNCTION public.ops_supply_balance(_wh uuid, _item text, _lot text) RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(sum(CASE WHEN m.kind IN ('entrada','ajuste-entrada') THEN m.quantity ELSE -m.quantity END), 0)
  FROM public.ops_supply_movements m
  WHERE m.warehouse_id = _wh AND m.item_key = _item AND m.kind <> 'estorno' AND (_lot IS NULL OR m.lot IS NOT DISTINCT FROM _lot)
    AND NOT EXISTS (SELECT 1 FROM public.ops_supply_movements r WHERE r.reverses_id = m.id)
$$;

GRANT SELECT ON public.ops_supply_item_versions, public.ops_supply_item_approvals, public.ops_warehouses TO authenticated;
GRANT SELECT (id, warehouse_id, item_version_id, item_key, kind, quantity, lot, expires_on, occurred_on, destination, reason, reverses_id, actor_person, idempotency_key, created_at) ON public.ops_supply_movements TO authenticated;
GRANT ALL ON public.ops_supply_item_versions, public.ops_supply_item_approvals, public.ops_warehouses, public.ops_supply_movements TO service_role;
ALTER TABLE public.ops_supply_item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_item_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_supply_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supply catalog readable" ON public.ops_supply_item_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "supply approvals readable" ON public.ops_supply_item_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses by school" ON public.ops_warehouses FOR SELECT TO authenticated USING (public.ops_can_read('patrimonio', school_id));
CREATE POLICY "movements by school" ON public.ops_supply_movements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_warehouses w WHERE w.id = warehouse_id AND public.ops_can_read('patrimonio', w.school_id)));
CREATE TRIGGER opssiv_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_item_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssia_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_item_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opswh_immutable BEFORE UPDATE OR DELETE ON public.ops_warehouses FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssm_immutable BEFORE UPDATE OR DELETE ON public.ops_supply_movements FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssm_no_truncate BEFORE TRUNCATE ON public.ops_supply_movements FOR EACH STATEMENT EXECUTE FUNCTION public.ops_no_truncate();

CREATE OR REPLACE FUNCTION public.register_ops_supply_item(_key text, _expected_version int, _label text, _unit text, _category text, _lot boolean, _expiry boolean, _active boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssi:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-materiais-de-consumo') THEN RAISE EXCEPTION 'opssi:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_supply_item_versions WHERE item_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opssi:conflict'; END IF;
  IF _last > 0 AND EXISTS (SELECT 1 FROM public.ops_supply_item_versions WHERE item_key = _key AND version = _last AND unit <> btrim(_unit)) THEN RAISE EXCEPTION 'opssi:unit-change'; END IF;
  INSERT INTO public.ops_supply_item_versions(item_key, version, label, unit, category, tracks_lot, tracks_expiry, active, author_person, reason)
  VALUES (_key, _last + 1, btrim(_label), btrim(_unit), btrim(_category), coalesce(_lot,false), coalesce(_expiry,false), coalesce(_active,true), _p, nullif(btrim(_reason),'')) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opssi:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_supply_item(_iv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_supply_item_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssi:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-materiais-de-consumo') THEN RAISE EXCEPTION 'opssi:approve-forbidden'; END IF;
  SELECT * INTO _v FROM public.ops_supply_item_versions WHERE id = _iv;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'opssi:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opssi:self-approval'; END IF;
  INSERT INTO public.ops_supply_item_approvals(item_version_id, approver_person, decision_ref) VALUES (_iv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opssi:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opssi:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.register_ops_warehouse(_school text, _space uuid, _name text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opswh:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_warehouses WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('manter-almoxarifado', _school) THEN RAISE EXCEPTION 'opswh:forbidden'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _school) THEN RAISE EXCEPTION 'opswh:invalid-space'; END IF;
  INSERT INTO public.ops_warehouses(school_id, space_id, name, author_person, idempotency_key) VALUES (_school, _space, btrim(_name), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opswh:duplicate-name';
  WHEN check_violation THEN RAISE EXCEPTION 'opswh:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_supply_movement(_wh uuid, _item_key text, _kind text, _qty numeric, _lot text, _expires date, _on date,
  _doc uuid, _destination text, _reason text, _reverses uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _w public.ops_warehouses; _iv public.ops_supply_item_versions; _id uuid; _orig public.ops_supply_movements;
  _k text := _kind; _q numeric := _qty; _l text := nullif(btrim(_lot),''); _e date := _expires; _bal numeric;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssm:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_supply_movements WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _w FROM public.ops_warehouses WHERE id = _wh;
  IF _w.id IS NULL OR NOT public.has_school_capability('movimentar-almoxarifado', _w.school_id) THEN RAISE EXCEPTION 'opssm:forbidden'; END IF;
  IF _on > current_date THEN RAISE EXCEPTION 'opssm:future-date'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ops-supply|' || _wh::text || '|' || _item_key));
  IF _kind = 'estorno' THEN
    SELECT * INTO _orig FROM public.ops_supply_movements WHERE id = _reverses AND warehouse_id = _wh AND item_key = _item_key AND kind <> 'estorno';
    IF _orig.id IS NULL THEN RAISE EXCEPTION 'opssm:nothing-to-reverse'; END IF;
    _q := _orig.quantity; _l := _orig.lot; _e := _orig.expires_on;
    SELECT * INTO _iv FROM public.ops_supply_item_versions WHERE id = _orig.item_version_id;
    -- Estornar entrada não pode deixar saldo negativo.
    IF _orig.kind IN ('entrada','ajuste-entrada') AND public.ops_supply_balance(_wh, _item_key, _l) - _q < 0 THEN RAISE EXCEPTION 'opssm:negative-balance'; END IF;
  ELSE
    SELECT v.* INTO _iv FROM public.ops_supply_item_versions v JOIN public.ops_supply_item_approvals a ON a.item_version_id = v.id
      WHERE v.item_key = _item_key AND v.version = (SELECT max(version) FROM public.ops_supply_item_versions x WHERE x.item_key = _item_key);
    IF _iv.id IS NULL OR NOT _iv.active THEN RAISE EXCEPTION 'opssm:item-not-approved'; END IF;
    IF _iv.tracks_lot AND _l IS NULL THEN RAISE EXCEPTION 'opssm:lot-required'; END IF;
    IF NOT _iv.tracks_lot AND _l IS NOT NULL THEN RAISE EXCEPTION 'opssm:lot-not-tracked'; END IF;
    IF _kind IN ('entrada','ajuste-entrada') THEN
      IF _iv.tracks_expiry AND _e IS NULL THEN RAISE EXCEPTION 'opssm:expiry-required'; END IF;
      IF _l IS NOT NULL AND EXISTS (SELECT 1 FROM public.ops_supply_movements m WHERE m.warehouse_id = _wh AND m.item_key = _item_key AND m.lot = _l AND m.expires_on IS DISTINCT FROM _e) THEN RAISE EXCEPTION 'opssm:lot-expiry-mismatch'; END IF;
    ELSE
      IF _l IS NOT NULL THEN SELECT expires_on INTO _e FROM public.ops_supply_movements WHERE warehouse_id = _wh AND item_key = _item_key AND lot = _l AND expires_on IS NOT NULL LIMIT 1; END IF;
      IF _kind = 'saida' AND _e IS NOT NULL AND _e < _on THEN RAISE EXCEPTION 'opssm:expired-lot'; END IF;
      IF public.ops_supply_balance(_wh, _item_key, _l) - _q < 0 THEN RAISE EXCEPTION 'opssm:negative-balance'; END IF;
    END IF;
  END IF;
  INSERT INTO public.ops_supply_movements(warehouse_id, item_version_id, item_key, kind, quantity, lot, expires_on, occurred_on, source_doc_ref, destination, reason, reverses_id, actor_person, idempotency_key)
  VALUES (_wh, _iv.id, _item_key, _k, _q, _l, _e, _on, _doc, nullif(btrim(_destination),''), nullif(btrim(_reason),''), CASE WHEN _kind = 'estorno' THEN _reverses END, _p, _key)
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opssm:already-reversed';
  WHEN check_violation THEN RAISE EXCEPTION 'opssm:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_ops_supply_item(text,int,text,text,text,boolean,boolean,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_supply_item(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_warehouse(text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_supply_movement(uuid,text,text,numeric,text,date,date,uuid,text,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_supply_balance(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_supply_item(text,int,text,text,text,boolean,boolean,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_supply_item(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_warehouse(text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_supply_movement(uuid,text,text,numeric,text,date,date,uuid,text,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_supply_balance(uuid,text,text) TO authenticated;
REVOKE SELECT ON public.ops_supply_movements FROM authenticated;
GRANT SELECT (id, warehouse_id, item_version_id, item_key, kind, quantity, lot, expires_on, occurred_on, destination, reason, reverses_id, actor_person, idempotency_key, created_at) ON public.ops_supply_movements TO authenticated;