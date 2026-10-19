-- Remanejamento entre escolas com aceite do destino: a rede propõe; só o aceite da escola de destino gera saída+entrada (par único).
CREATE TABLE public.meal_stock_transfer_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_school text NOT NULL REFERENCES public.institutional_schools(id),
  to_school text NOT NULL REFERENCES public.institutional_schools(id),
  item_value_id text NOT NULL, unit_value_id text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  lot text NULL, expires_on date NULL, note text NULL,
  proposed_by uuid NOT NULL, proposed_person uuid NOT NULL, proposed_engagement uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_school <> to_school)
);
CREATE TABLE public.meal_stock_transfer_answers (
  proposal_id uuid PRIMARY KEY REFERENCES public.meal_stock_transfer_proposals(id),
  outcome text NOT NULL CHECK (outcome IN ('aceita','recusada','cancelada')),
  reason text NULL, pair_id uuid NULL,
  answered_by uuid NOT NULL, answered_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome = 'aceita' OR length(btrim(coalesce(reason,''))) >= 3)
);
REVOKE ALL ON public.meal_stock_transfer_proposals, public.meal_stock_transfer_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_stock_transfer_proposals, public.meal_stock_transfer_answers TO service_role;
ALTER TABLE public.meal_stock_transfer_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_stock_transfer_answers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER mstp_append_only BEFORE UPDATE OR DELETE ON public.meal_stock_transfer_proposals FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER msta_append_only BEFORE UPDATE OR DELETE ON public.meal_stock_transfer_answers FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE OR REPLACE FUNCTION public.propose_meal_stock_transfer(_from_school text, _to_school text, _item text, _unit text, _quantity numeric, _lot text, _expires date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; pol jsonb; r uuid; bal numeric;
BEGIN
  me := public.institutional_actor_person();
  IF _from_school IS NULL OR _to_school IS NULL OR _from_school = _to_school THEN RAISE EXCEPTION 'meal:transfer-schools-invalid'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
  pol := public.meal_policy_on('politica-transferencia-estoque', CURRENT_DATE);
  IF pol IS NULL OR coalesce((pol->>'permitida')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'meal:transfer-policy-pending'; END IF;
  g := public.meal_network_grant_on('transferir-estoque-alimentar', CURRENT_DATE);
  IF public.meal_catalog_version('item-de-estoque-alimentar', _item) IS NULL OR public.meal_catalog_version('unidade-de-medida-alimentar', _unit) IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
  SELECT sum(l.balance) INTO bal FROM public.meal_stock_lines(_from_school, 'infinity'::date, now()) l WHERE l.item_value_id = _item AND l.unit_value_id = _unit;
  IF bal IS NULL OR bal < _quantity THEN RAISE EXCEPTION 'meal:transfer-exceeds-balance'; END IF;
  INSERT INTO public.meal_stock_transfer_proposals(from_school, to_school, item_value_id, unit_value_id, quantity, lot, expires_on, note, proposed_by, proposed_person, proposed_engagement)
  VALUES (_from_school, _to_school, _item, _unit, _quantity, nullif(btrim(_lot),''), _expires, nullif(btrim(_note),''), auth.uid(), me, g) RETURNING id INTO r;
  RETURN r;
END $fn$;

CREATE OR REPLACE FUNCTION public.answer_meal_stock_transfer(_proposal uuid, _outcome text, _reason text, _tz text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; p public.meal_stock_transfer_proposals; pair uuid; iv int; uv int; d date; bal numeric;
BEGIN
  me := public.institutional_actor_person();
  SELECT * INTO p FROM public.meal_stock_transfer_proposals WHERE id = _proposal FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_stock_transfer_answers a WHERE a.proposal_id = p.id) THEN RAISE EXCEPTION 'meal:transfer-already-answered'; END IF;
  IF _outcome = 'cancelada' THEN
    IF p.proposed_by <> auth.uid() THEN RAISE EXCEPTION 'meal:transfer-cancel-own-only'; END IF;
    INSERT INTO public.meal_stock_transfer_answers(proposal_id, outcome, reason, answered_by) VALUES (p.id, 'cancelada', btrim(_reason), auth.uid());
    RETURN NULL;
  END IF;
  IF _outcome NOT IN ('aceita','recusada') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = _tz) THEN RAISE EXCEPTION 'meal:time-zone-required'; END IF;
  d := (now() AT TIME ZONE _tz)::date;
  g := public.meal_grant_on('conferir-recebimento-alimentar', p.to_school, d);
  IF _outcome = 'recusada' THEN
    INSERT INTO public.meal_stock_transfer_answers(proposal_id, outcome, reason, answered_by) VALUES (p.id, 'recusada', btrim(_reason), auth.uid());
    RETURN NULL;
  END IF;
  iv := public.meal_catalog_version('item-de-estoque-alimentar', p.item_value_id);
  uv := public.meal_catalog_version('unidade-de-medida-alimentar', p.unit_value_id);
  IF iv IS NULL OR uv IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
  pair := gen_random_uuid();
  INSERT INTO public.meal_inventory_movements(logical_id, version, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version, movement_kind, quantity, moved_on,
    note, reason, author_user_id, author_person_id, author_engagement, movement_class, lot, expires_on, transfer_pair_id, transfer_peer_school)
  VALUES (gen_random_uuid(), 1, 'registro', p.from_school, p.item_value_id, iv, p.unit_value_id, uv, 'saida', p.quantity, d, p.note, 'remanejamento aceito pelo destino', p.proposed_by, p.proposed_person, p.proposed_engagement, 'transferencia-saida', p.lot, p.expires_on, pair, p.to_school),
         (gen_random_uuid(), 1, 'registro', p.to_school, p.item_value_id, iv, p.unit_value_id, uv, 'entrada', p.quantity, d, p.note, 'remanejamento aceito pelo destino', auth.uid(), me, g, 'transferencia-entrada', p.lot, p.expires_on, pair, p.from_school);
  SELECT sum(l.balance) INTO bal FROM public.meal_stock_lines(p.from_school, 'infinity'::date, now()) l WHERE l.item_value_id = p.item_value_id AND l.unit_value_id = p.unit_value_id;
  IF bal < 0 THEN RAISE EXCEPTION 'meal:transfer-exceeds-balance'; END IF;
  INSERT INTO public.meal_stock_transfer_answers(proposal_id, outcome, reason, pair_id, answered_by) VALUES (p.id, 'aceita', nullif(btrim(_reason),''), pair, auth.uid());
  RETURN pair;
END $fn$;

CREATE OR REPLACE FUNCTION public.meal_stock_transfers_at(_school text)
RETURNS TABLE(id uuid, from_school text, to_school text, item_value_id text, unit_value_id text, quantity numeric, note text, proposed_at timestamptz, outcome text, reason text, answered_at timestamptz, mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF _school IS NULL THEN PERFORM public.meal_network_grant_on('transferir-estoque-alimentar', CURRENT_DATE);
  ELSE PERFORM public.meal_grant('consultar-alimentacao-escolar', _school); END IF;
  RETURN QUERY SELECT p.id, p.from_school, p.to_school, p.item_value_id, p.unit_value_id, p.quantity, p.note, p.proposed_at, a.outcome, a.reason, a.answered_at, p.proposed_by = auth.uid()
  FROM public.meal_stock_transfer_proposals p LEFT JOIN public.meal_stock_transfer_answers a ON a.proposal_id = p.id
  WHERE _school IS NULL OR p.from_school = _school OR p.to_school = _school ORDER BY p.proposed_at DESC LIMIT 500;
END $fn$;

REVOKE ALL ON FUNCTION public.propose_meal_stock_transfer(text,text,text,text,numeric,text,date,text), public.answer_meal_stock_transfer(uuid,text,text,text), public.meal_stock_transfers_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_meal_stock_transfer(text,text,text,text,numeric,text,date,text), public.answer_meal_stock_transfer(uuid,text,text,text), public.meal_stock_transfers_at(text) TO authenticated;