-- Centro de Operações L10: transferência de bem entre escolas = solicitação → autorização (pessoa ≠ solicitante, escola de
-- origem) → envio → recebimento (escola de destino, comprovante juntado) que grava a nova localização na MESMA cadeia do bem.
-- Uma cadeia por bem (seq único) ⇒ uma localização vigente; datas não retroagem; em trânsito nada muda de lugar.
CREATE TABLE public.ops_asset_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  from_school text NOT NULL REFERENCES public.institutional_schools(id),
  to_school text NOT NULL REFERENCES public.institutional_schools(id),
  to_space uuid REFERENCES public.ops_spaces(id),
  base_asset_seq int NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  requester_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_school <> to_school)
);
CREATE TABLE public.ops_asset_transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.ops_asset_transfers(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('autorizacao','recusa','envio','recebimento','cancelamento')),
  doc_ref uuid REFERENCES public.admin_case_events(id),
  effective_on date NOT NULL,
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, seq),
  CHECK (kind <> 'recebimento' OR doc_ref IS NOT NULL),
  CHECK (kind NOT IN ('recusa','cancelamento') OR length(btrim(coalesce(note,''))) >= 10)
);
-- No máximo uma transferência aberta por bem (aberta = sem evento terminal).
CREATE UNIQUE INDEX ops_asset_transfer_terminal ON public.ops_asset_transfer_events (transfer_id) WHERE kind IN ('recusa','recebimento','cancelamento');

CREATE OR REPLACE FUNCTION public.ops_asset_transfer_state(_t uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE kind WHEN 'autorizacao' THEN 'autorizada' WHEN 'envio' THEN 'em-transito' WHEN 'recebimento' THEN 'recebida'
    WHEN 'recusa' THEN 'recusada' WHEN 'cancelamento' THEN 'cancelada' END FROM public.ops_asset_transfer_events WHERE transfer_id = _t ORDER BY seq DESC LIMIT 1), 'solicitada')
$$;
CREATE OR REPLACE FUNCTION public.ops_asset_open_transfer(_a uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.id FROM public.ops_asset_transfers t WHERE t.asset_id = _a
    AND public.ops_asset_transfer_state(t.id) IN ('solicitada','autorizada','em-transito') LIMIT 1
$$;

GRANT SELECT ON public.ops_asset_transfers TO authenticated;
GRANT SELECT (id, transfer_id, seq, kind, effective_on, note, actor_person, idempotency_key, created_at) ON public.ops_asset_transfer_events TO authenticated;
GRANT ALL ON public.ops_asset_transfers, public.ops_asset_transfer_events TO service_role;
ALTER TABLE public.ops_asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_transfer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers by origin or destination" ON public.ops_asset_transfers FOR SELECT TO authenticated
  USING (public.ops_can_read('patrimonio', from_school) OR public.ops_can_read('patrimonio', to_school));
CREATE POLICY "transfer events by origin or destination" ON public.ops_asset_transfer_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_asset_transfers t WHERE t.id = transfer_id AND (public.ops_can_read('patrimonio', t.from_school) OR public.ops_can_read('patrimonio', t.to_school))));
CREATE TRIGGER opsat_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_transfers FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsate_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_transfer_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.request_ops_asset_transfer(_a uuid, _expected_seq int, _to_school text, _to_space uuid, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _cur text; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsat:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_asset_transfers WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  PERFORM 1 FROM public.ops_assets WHERE id = _a FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'opsat:unavailable'; END IF;
  _cur := public.ops_asset_school(_a);
  IF NOT public.has_school_capability('solicitar-transferencia-de-bens', _cur) THEN RAISE EXCEPTION 'opsat:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'baixa') THEN RAISE EXCEPTION 'opsat:written-off'; END IF;
  IF public.ops_asset_open_transfer(_a) IS NOT NULL THEN RAISE EXCEPTION 'opsat:transfer-open'; END IF;
  SELECT max(seq) INTO _last FROM public.ops_asset_events WHERE asset_id = _a;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsat:conflict'; END IF;
  IF _to_space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _to_space AND s.school_id = _to_school) THEN RAISE EXCEPTION 'opsat:invalid-space'; END IF;
  INSERT INTO public.ops_asset_transfers(asset_id, from_school, to_school, to_space, base_asset_seq, reason, requester_person, idempotency_key)
  VALUES (_a, _cur, _to_school, _to_space, _last, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsat:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_asset_transfer_event(_t uuid, _expected_seq int, _kind text, _doc uuid, _on date, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _tr public.ops_asset_transfers; _st text; _last int; _seq int; _aseq int; _lastloc date;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsat:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_asset_transfer_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _tr FROM public.ops_asset_transfers WHERE id = _t;
  IF _tr.id IS NULL THEN RAISE EXCEPTION 'opsat:unavailable'; END IF;
  PERFORM 1 FROM public.ops_assets WHERE id = _tr.asset_id FOR UPDATE;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_asset_transfer_events WHERE transfer_id = _t;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsat:conflict'; END IF;
  _st := public.ops_asset_transfer_state(_t);
  IF NOT ((_kind IN ('autorizacao','recusa') AND _st = 'solicitada') OR (_kind = 'envio' AND _st = 'autorizada')
       OR (_kind = 'recebimento' AND _st = 'em-transito') OR (_kind = 'cancelamento' AND _st IN ('solicitada','autorizada'))) THEN
    RAISE EXCEPTION 'opsat:invalid-transition'; END IF;
  IF _on > current_date OR _on < _tr.created_at::date THEN RAISE EXCEPTION 'opsat:invalid-date'; END IF;
  IF _kind IN ('autorizacao','recusa') THEN
    IF NOT public.has_school_capability('autorizar-transferencia-de-bens', _tr.from_school) THEN RAISE EXCEPTION 'opsat:authorize-forbidden'; END IF;
    IF _p = _tr.requester_person THEN RAISE EXCEPTION 'opsat:self-authorization'; END IF;
  ELSIF _kind IN ('envio','cancelamento') THEN
    IF NOT public.has_school_capability('solicitar-transferencia-de-bens', _tr.from_school) THEN RAISE EXCEPTION 'opsat:forbidden'; END IF;
  ELSIF _kind = 'recebimento' THEN
    IF NOT public.has_school_capability('receber-bens', _tr.to_school) THEN RAISE EXCEPTION 'opsat:receive-forbidden'; END IF;
    IF _p = _tr.requester_person THEN RAISE EXCEPTION 'opsat:self-receipt'; END IF;
    SELECT max(seq) INTO _aseq FROM public.ops_asset_events WHERE asset_id = _tr.asset_id;
    IF _aseq <> _tr.base_asset_seq THEN RAISE EXCEPTION 'opsat:asset-changed'; END IF;
    SELECT max(effective_on) INTO _lastloc FROM public.ops_asset_events WHERE asset_id = _tr.asset_id AND kind = 'localizacao';
    IF _on < _lastloc THEN RAISE EXCEPTION 'opsat:backdated'; END IF;
    INSERT INTO public.ops_asset_events(asset_id, seq, kind, school_id, space_id, effective_on, note, actor_person, idempotency_key)
    VALUES (_tr.asset_id, _aseq + 1, 'localizacao', _tr.to_school, _tr.to_space, _on, 'Transferência ' || _tr.id::text, _p, _key || '#loc');
  END IF;
  INSERT INTO public.ops_asset_transfer_events(transfer_id, seq, kind, doc_ref, effective_on, note, actor_person, idempotency_key)
  VALUES (_t, _last + 1, _kind, _doc, _on, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsat:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'opsat:already-closed';
END $$;

-- Writer de eventos do bem: troca de ESCOLA só pela transferência; nada muda em trânsito; localização/responsável não retroagem.
CREATE OR REPLACE FUNCTION public.record_ops_asset_event(_a uuid, _expected_seq int, _kind text, _school text, _space uuid, _engagement uuid,
  _condition text, _tag text, _source text, _doc uuid, _on date, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _asset public.ops_assets; _cur text; _last int; _seq int; _conds text[]; _prev date;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsa:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_asset_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _asset FROM public.ops_assets WHERE id = _a FOR UPDATE;
  IF _asset.id IS NULL THEN RAISE EXCEPTION 'opsa:unavailable'; END IF;
  _cur := public.ops_asset_school(_a);
  IF NOT public.has_school_capability('manter-bens', _cur) THEN RAISE EXCEPTION 'opsa:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'baixa') THEN RAISE EXCEPTION 'opsa:written-off'; END IF;
  IF _kind IN ('localizacao','responsavel','baixa') AND public.ops_asset_open_transfer(_a) IS NOT NULL THEN RAISE EXCEPTION 'opsa:transfer-open'; END IF;
  SELECT max(seq) INTO _last FROM public.ops_asset_events WHERE asset_id = _a;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsa:conflict'; END IF;
  IF _on > current_date OR _on < _asset.incorporated_on THEN RAISE EXCEPTION 'opsa:invalid-date'; END IF;
  IF _kind = 'localizacao' AND _school IS DISTINCT FROM _cur THEN RAISE EXCEPTION 'opsa:school-change-requires-transfer'; END IF;
  IF _kind IN ('localizacao','responsavel') THEN
    SELECT max(effective_on) INTO _prev FROM public.ops_asset_events WHERE asset_id = _a AND kind = _kind;
    IF _prev IS NOT NULL AND _on < _prev THEN RAISE EXCEPTION 'opsa:backdated'; END IF;
  END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _cur) THEN RAISE EXCEPTION 'opsa:invalid-space'; END IF;
  IF _kind = 'responsavel' AND NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement AND e.school_id = _cur
     AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)) THEN RAISE EXCEPTION 'opsa:responsible-not-active'; END IF;
  IF _kind = 'estado' THEN
    SELECT allowed_conditions INTO _conds FROM public.ops_asset_category_versions WHERE id = _asset.category_version_id;
    IF NOT (_condition = ANY(_conds)) THEN RAISE EXCEPTION 'opsa:condition-not-in-category'; END IF;
  END IF;
  IF _kind = 'tombamento-oficial' AND NOT public.has_school_capability('registrar-tombamento-oficial', _cur) THEN RAISE EXCEPTION 'opsa:tag-forbidden'; END IF;
  IF _kind = 'tombamento-oficial' AND EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'tombamento-oficial') THEN RAISE EXCEPTION 'opsa:already-tagged'; END IF;
  IF _kind = 'baixa' AND NOT public.has_school_capability('baixar-bens', _cur) THEN RAISE EXCEPTION 'opsa:writeoff-forbidden'; END IF;
  INSERT INTO public.ops_asset_events(asset_id, seq, kind, school_id, space_id, engagement_id, condition, official_tag, official_source, doc_ref, effective_on, note, actor_person, idempotency_key)
  VALUES (_a, _last + 1, _kind, CASE WHEN _kind = 'localizacao' THEN _cur END, CASE WHEN _kind = 'localizacao' THEN _space END,
    _engagement, _condition, nullif(btrim(_tag),''), nullif(btrim(_source),''), _doc, _on, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsa:tag-in-use';
  WHEN check_violation THEN RAISE EXCEPTION 'opsa:invalid';
END $$;

REVOKE ALL ON FUNCTION public.ops_asset_transfer_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_asset_open_transfer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_ops_asset_transfer(uuid,int,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_asset_transfer_event(uuid,int,text,uuid,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_ops_asset_transfer(uuid,int,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_asset_transfer_event(uuid,int,text,uuid,date,text,text) TO authenticated;
REVOKE SELECT ON public.ops_asset_transfer_events FROM authenticated;
GRANT SELECT (id, transfer_id, seq, kind, effective_on, note, actor_person, idempotency_key, created_at) ON public.ops_asset_transfer_events TO authenticated;