-- NAE.4 — Estoque operacional sobre o MESMO ledger (meal_inventory_movements): classes de movimento, lote/validade/origem,
-- inventário físico, fechamento mensal com manifesto, base de estoque para pedido e alertas factuais.
-- Saldo é sempre soma governada de movimentos vigentes; nunca coluna. Sinal desconhecido ⇒ saldo UNKNOWN (nunca zero).
-- Consumo teórico não é movimento. Nenhum estoque mínimo, base de pedido, conversão ou limite é semeado.
-- Também corrige NAE.3: 'registrar-nao-conformidade-alimentar' passa a ser admitida no escopo de rede.

CREATE OR REPLACE FUNCTION public.meal_grant_on(_capability text, _school text, _on date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-cardapio-escolar','registrar-execucao-alimentacao','consultar-alimentacao-escolar','registrar-restricao-alimentar','consultar-restricao-alimentar',
                         'publicar-cardapio-escolar','registrar-estoque-alimentar',
                         'submeter-pedido-alimentar','conferir-recebimento-alimentar','registrar-nao-conformidade-alimentar',
                         'ajustar-estoque-alimentar','aprovar-inventario-alimentar')
    THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_grant_on(text, text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meal_network_grant_on(_capability text, _on date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-unidades-de-alimentacao','acompanhar-alimentacao-rede',
      'manter-planejamento-nutricional','manter-catalogo-tecnico-alimentar','manter-parametros-nutricionais',
      'administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'consolidar-demanda-alimentar','registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao',
      'exportar-relatorios-alimentacao','registrar-nao-conformidade-alimentar','transferir-estoque-alimentar','fechar-estoque-alimentar')
    THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_grant_on(text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meal_master_spec(_kind text, OUT capability text, OUT required text[], OUT refs text[])
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT s.c, s.r, s.f FROM (VALUES
    ('item-alimentar','manter-catalogo-tecnico-alimentar', ARRAY['nome'], ARRAY[]::text[]),
    ('unidade-de-medida','manter-catalogo-tecnico-alimentar', ARRAY['nome','simbolo'], ARRAY[]::text[]),
    ('apresentacao-embalagem','manter-catalogo-tecnico-alimentar', ARRAY['descricao','quantidade'], ARRAY['item_ref:item-alimentar','unidade_ref:unidade-de-medida']),
    ('especificacao-tecnica','manter-catalogo-tecnico-alimentar', ARRAY['texto'], ARRAY['item_ref:item-alimentar']),
    ('fator-de-conversao','manter-parametros-nutricionais', ARRAY['fator'], ARRAY['de_unidade_ref:unidade-de-medida','para_unidade_ref:unidade-de-medida']),
    ('publico-de-atendimento','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('parametro-per-capita','manter-parametros-nutricionais', ARRAY['quantidade'], ARRAY['item_ref:item-alimentar','publico_ref:publico-de-atendimento','unidade_ref:unidade-de-medida']),
    ('regra-de-elegibilidade-item','manter-parametros-nutricionais', ARRAY['efeito'], ARRAY['item_ref:item-alimentar','publico_ref:publico-de-atendimento']),
    ('necessidade-alimentar-especial','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('receita-ficha-tecnica','manter-planejamento-nutricional', ARRAY['nome','ingredientes'], ARRAY[]::text[]),
    ('cardapio-planejado','manter-planejamento-nutricional', ARRAY['competencia','tipo','entradas'], ARRAY['publico_ref:publico-de-atendimento']),
    ('fornecedor','manter-referencias-contratuais-alimentacao', ARRAY['nome'], ARRAY[]::text[]),
    ('referencia-contratual','manter-referencias-contratuais-alimentacao', ARRAY['natureza','numero'], ARRAY['fornecedor_ref:fornecedor']),
    ('marca-aprovada','manter-referencias-contratuais-alimentacao', ARRAY['marca'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('programacao-de-entrega','manter-referencias-contratuais-alimentacao', ARRAY['frequencia'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('designacao-inspetor','designar-inspetor-alimentacao', ARRAY['pessoa_id'], ARRAY[]::text[]),
    ('treinamento-inspetor','designar-inspetor-alimentacao', ARRAY['realizado_em'], ARRAY['designacao_ref:designacao-inspetor']),
    ('documento-tecnico','gerir-documentos-alimentacao', ARRAY['titulo','categoria','natureza','sha256'], ARRAY[]::text[]),
    ('checklist-de-recebimento','manter-catalogo-tecnico-alimentar', ARRAY['itens'], ARRAY['item_ref:item-alimentar']),
    ('politica-base-de-estoque','manter-parametros-nutricionais', ARRAY['opcao'], ARRAY[]::text[]),
    ('politica-saldo-negativo','manter-parametros-nutricionais', ARRAY['efeito'], ARRAY[]::text[]),
    ('politica-inventario-fisico','manter-parametros-nutricionais', ARRAY['exige_aprovacao'], ARRAY[]::text[]),
    ('politica-transferencia-estoque','manter-parametros-nutricionais', ARRAY['permitida'], ARRAY[]::text[]),
    ('exigencia-de-lote','manter-catalogo-tecnico-alimentar', ARRAY['item_estoque_value_id'], ARRAY[]::text[])
  ) AS s(k, c, r, f) WHERE s.k = _kind
$fn$;
REVOKE ALL ON FUNCTION public.meal_master_spec(text) FROM PUBLIC, anon;

CREATE FUNCTION public.meal_policy_on(_kind text, _on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE n integer; p jsonb;
BEGIN
  SELECT count(*), max(h.payload::text)::jsonb INTO n, p FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r WHERE r.kind = _kind ORDER BY r.logical_id, r.version DESC) h
   WHERE h.status = 'homologada' AND h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on);
  IF n > 1 THEN RAISE EXCEPTION 'meal:policy-ambiguous:%', _kind; END IF;
  RETURN p;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_policy_on(text, date) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.meal_inventory_movements
  ADD COLUMN movement_class text CHECK (movement_class IS NULL OR movement_class IN ('entrada-aceite','consumo-observado','perda','devolucao','transferencia-saida','transferencia-entrada','ajuste-inventario')),
  ADD COLUMN direction smallint CHECK (direction IS NULL OR direction IN (-1, 1)),
  ADD COLUMN lot text,
  ADD COLUMN expires_on date,
  ADD COLUMN contract_ref uuid,
  ADD COLUMN delivery_schedule_ref uuid,
  ADD COLUMN source_document_ref uuid,
  ADD COLUMN stock_count_ref uuid,
  ADD COLUMN transfer_pair_id uuid,
  ADD COLUMN transfer_peer_school text,
  ADD COLUMN source_literal text CHECK (source_literal IS NULL OR length(source_literal) <= 300);
COMMENT ON COLUMN public.meal_inventory_movements.movement_kind IS 'Legado (entrada/saida/ajuste). Classe operacional em movement_class; ajuste legado sem direction tem sinal desconhecido.';

CREATE FUNCTION public.meal_movement_class(m public.meal_inventory_movements) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT coalesce(m.movement_class, CASE WHEN m.source_receipt_version_id IS NOT NULL THEN 'entrada-aceite' ELSE m.movement_kind || '-legado' END)
$fn$;
CREATE FUNCTION public.meal_movement_sign(m public.meal_inventory_movements) RETURNS smallint
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT CASE
    WHEN m.event_kind = 'anulacao' THEN 0::smallint
    WHEN m.direction IS NOT NULL THEN m.direction
    WHEN m.source_receipt_version_id IS NOT NULL OR m.movement_class IN ('entrada-aceite','transferencia-entrada') THEN 1::smallint
    WHEN m.movement_class IN ('consumo-observado','perda','devolucao','transferencia-saida') THEN -1::smallint
    WHEN m.movement_class IS NULL AND m.movement_kind = 'entrada' THEN 1::smallint
    WHEN m.movement_class IS NULL AND m.movement_kind = 'saida' THEN -1::smallint
    ELSE NULL END
$fn$;
REVOKE ALL ON FUNCTION public.meal_movement_class(public.meal_inventory_movements) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.meal_movement_sign(public.meal_inventory_movements) FROM PUBLIC, anon;

CREATE FUNCTION public.meal_stock_lines(_school text, _on date, _known timestamptz)
RETURNS TABLE(item_value_id text, unit_value_id text, lot text, expires_on date, balance numeric, movements integer, unknown_sign integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  WITH h AS (SELECT m.* FROM public.meal_inventory_movements m
              WHERE m.school_id = _school AND m.recorded_at <= _known AND m.moved_on <= _on
                AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id AND s.recorded_at <= _known))
  SELECT h.item_value_id, h.unit_value_id, h.lot, min(h.expires_on),
         CASE WHEN bool_or(public.meal_movement_sign(h) IS NULL) THEN NULL ELSE sum(public.meal_movement_sign(h) * h.quantity) END,
         count(*)::integer, count(*) FILTER (WHERE public.meal_movement_sign(h) IS NULL)::integer
  FROM h GROUP BY h.item_value_id, h.unit_value_id, h.lot
$fn$;
REVOKE ALL ON FUNCTION public.meal_stock_lines(text, date, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.meal_stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_stock_counts(id),
  status text NOT NULL CHECK (status IN ('rascunho','conferida','aprovada','anulada')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  counted_on date NOT NULL,
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE TABLE public.meal_stock_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  competence text NOT NULL CHECK (competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_stock_closings(id),
  closing_on date NOT NULL,
  known_at timestamptz NOT NULL,
  movement_ids uuid[] NOT NULL,
  balances jsonb NOT NULL,
  manifest_sha256 text NOT NULL,
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, competence, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
GRANT SELECT ON public.meal_stock_counts, public.meal_stock_closings TO service_role;
ALTER TABLE public.meal_stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_stock_closings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_stock_counts_append_only BEFORE UPDATE OR DELETE ON public.meal_stock_counts FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_stock_closings_append_only BEFORE UPDATE OR DELETE ON public.meal_stock_closings FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE FUNCTION public.record_meal_stock_movement(_base_id uuid, _kind text, _school text, _class text, _item text, _unit text,
  _quantity numeric, _direction smallint, _on date, _tz text, _lot text, _expires date, _contract uuid, _schedule uuid, _source_doc uuid,
  _count uuid, _literal text, _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; base public.meal_inventory_movements; iv integer; uv integer; r uuid; cnt public.meal_stock_counts; pol jsonb; inv jsonb; bal numeric; other text;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_inventory_movements WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_inventory_movements WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    IF base.source_receipt_version_id IS NOT NULL THEN RAISE EXCEPTION 'meal:use-receipt-rectification'; END IF;
    IF base.transfer_pair_id IS NOT NULL THEN RAISE EXCEPTION 'meal:use-transfer-rectification'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    _school := base.school_id; _class := public.meal_movement_class(base);
    IF _class NOT IN ('consumo-observado','perda','devolucao','ajuste-inventario') THEN RAISE EXCEPTION 'meal:legacy-use-legacy-writer'; END IF;
    IF _kind = 'anulacao' THEN _item := base.item_value_id; _unit := base.unit_value_id; _quantity := base.quantity; _direction := base.direction; _on := base.moved_on;
      _lot := base.lot; _expires := base.expires_on; _contract := base.contract_ref; _schedule := base.delivery_schedule_ref; _source_doc := base.source_document_ref; _count := base.stock_count_ref; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  END IF;
  IF _class NOT IN ('consumo-observado','perda','devolucao','ajuste-inventario') THEN RAISE EXCEPTION 'meal:class-not-allowed'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = _tz) THEN RAISE EXCEPTION 'meal:time-zone-required'; END IF;
  IF _on IS NULL OR _on > (now() AT TIME ZONE _tz)::date THEN RAISE EXCEPTION 'meal:movement-date-invalid'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
  g := public.meal_grant_on(CASE WHEN _class = 'ajuste-inventario' THEN 'ajustar-estoque-alimentar' ELSE 'registrar-estoque-alimentar' END, _school, _on);
  iv := public.meal_catalog_version('item-de-estoque-alimentar', _item);
  uv := public.meal_catalog_version('unidade-de-medida-alimentar', _unit);
  IF iv IS NULL OR uv IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
  SELECT l.unit_value_id INTO other FROM public.meal_stock_lines(_school, 'infinity'::date, now()) l
   WHERE l.item_value_id = _item AND l.unit_value_id <> _unit LIMIT 1;
  IF other IS NOT NULL THEN RAISE EXCEPTION 'meal:unit-incompatible'; END IF;
  IF _class = 'ajuste-inventario' THEN
    IF _direction IS NULL THEN RAISE EXCEPTION 'meal:direction-required'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    SELECT * INTO cnt FROM public.meal_stock_counts c WHERE c.logical_id = _count ORDER BY c.version DESC LIMIT 1;
    IF cnt.id IS NULL OR cnt.school_id <> _school THEN RAISE EXCEPTION 'meal:count-required'; END IF;
    inv := public.meal_policy_on('politica-inventario-fisico', cnt.counted_on);
    IF cnt.status NOT IN ('conferida','aprovada') OR (coalesce((inv->>'exige_aprovacao')::boolean, false) AND cnt.status <> 'aprovada') THEN RAISE EXCEPTION 'meal:count-not-approved'; END IF;
    IF _on <> cnt.counted_on THEN RAISE EXCEPTION 'meal:adjustment-date-must-match-count'; END IF;
  ELSE
    _direction := NULL; _count := NULL;
  END IF;
  INSERT INTO public.meal_inventory_movements(logical_id, version, supersedes_id, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version,
    movement_kind, quantity, moved_on, note, reason, author_user_id, author_person_id, author_engagement,
    movement_class, direction, lot, expires_on, contract_ref, delivery_schedule_ref, source_document_ref, stock_count_ref, source_literal)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _item, iv, _unit, uv,
    CASE WHEN _class = 'ajuste-inventario' THEN 'ajuste' ELSE 'saida' END, _quantity, _on, nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g,
    _class, _direction, nullif(btrim(_lot),''), _expires, _contract, _schedule, _source_doc, _count, nullif(btrim(_literal),''))
  RETURNING id INTO r;
  IF _kind <> 'anulacao' THEN
    SELECT sum(l.balance) INTO bal FROM public.meal_stock_lines(_school, 'infinity'::date, now()) l WHERE l.item_value_id = _item AND l.unit_value_id = _unit AND l.lot IS NOT DISTINCT FROM nullif(btrim(_lot),'');
    IF bal < 0 THEN
      pol := public.meal_policy_on('politica-saldo-negativo', _on);
      IF pol->>'efeito' = 'bloqueio' THEN RAISE EXCEPTION 'meal:negative-balance-blocked'; END IF;
      IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:negative-balance-requires-reason'; END IF;
    END IF;
  END IF;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_stock_movement(uuid, text, text, text, text, text, numeric, smallint, date, text, text, date, uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_stock_movement(uuid, text, text, text, text, text, numeric, smallint, date, text, text, date, uuid, uuid, uuid, uuid, text, text, text) TO authenticated;

CREATE FUNCTION public.record_meal_stock_transfer(_from_school text, _to_school text, _item text, _unit text, _quantity numeric, _on date, _tz text,
  _lot text, _expires date, _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; iv integer; uv integer; pair uuid := gen_random_uuid(); pol jsonb; bal numeric;
BEGIN
  me := public.af_natural_person();
  IF _from_school IS NULL OR _to_school IS NULL OR _from_school = _to_school THEN RAISE EXCEPTION 'meal:transfer-schools-invalid'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = _tz) THEN RAISE EXCEPTION 'meal:time-zone-required'; END IF;
  IF _on IS NULL OR _on > (now() AT TIME ZONE _tz)::date THEN RAISE EXCEPTION 'meal:movement-date-invalid'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
  pol := public.meal_policy_on('politica-transferencia-estoque', _on);
  IF pol IS NULL OR coalesce((pol->>'permitida')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'meal:transfer-policy-pending'; END IF;
  g := public.meal_network_grant_on('transferir-estoque-alimentar', _on);
  IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _to_school) THEN RAISE EXCEPTION 'meal:school-unknown'; END IF;
  iv := public.meal_catalog_version('item-de-estoque-alimentar', _item);
  uv := public.meal_catalog_version('unidade-de-medida-alimentar', _unit);
  IF iv IS NULL OR uv IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY[_from_school, _to_school]) s(sc), LATERAL public.meal_stock_lines(s.sc, 'infinity'::date, now()) l WHERE l.item_value_id = _item AND l.unit_value_id <> _unit) THEN RAISE EXCEPTION 'meal:unit-incompatible'; END IF;
  INSERT INTO public.meal_inventory_movements(logical_id, version, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version, movement_kind, quantity, moved_on,
    note, reason, author_user_id, author_person_id, author_engagement, movement_class, lot, expires_on, transfer_pair_id, transfer_peer_school)
  VALUES (gen_random_uuid(), 1, 'registro', _from_school, _item, iv, _unit, uv, 'saida', _quantity, _on, nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g, 'transferencia-saida', nullif(btrim(_lot),''), _expires, pair, _to_school),
         (gen_random_uuid(), 1, 'registro', _to_school, _item, iv, _unit, uv, 'entrada', _quantity, _on, nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g, 'transferencia-entrada', nullif(btrim(_lot),''), _expires, pair, _from_school);
  SELECT sum(l.balance) INTO bal FROM public.meal_stock_lines(_from_school, 'infinity'::date, now()) l WHERE l.item_value_id = _item AND l.unit_value_id = _unit AND l.lot IS NOT DISTINCT FROM nullif(btrim(_lot),'');
  IF bal < 0 THEN RAISE EXCEPTION 'meal:transfer-exceeds-balance'; END IF;
  RETURN pair;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_stock_transfer(text, text, text, text, numeric, date, text, text, date, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_stock_transfer(text, text, text, text, numeric, date, text, text, date, text, text) TO authenticated;

CREATE FUNCTION public.record_meal_stock_count(_logical uuid, _expected_version integer, _status text, _school text, _counted_on date, _lines jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_stock_counts; lid uuid; l jsonb; res jsonb := '[]'::jsonb; calc numeric; known integer; phys numeric;
BEGIN
  me := public.af_natural_person();
  IF _status NOT IN ('rascunho','conferida','aprovada','anulada') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _status NOT IN ('rascunho','conferida') OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_stock_counts WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_stock_counts WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF head.status IN ('aprovada','anulada') THEN RAISE EXCEPTION 'meal:count-final'; END IF;
    _school := head.school_id; _counted_on := head.counted_on;
    IF _status IN ('aprovada','anulada') THEN _lines := head.lines; END IF;
    IF _status = 'aprovada' AND head.author_person_id = me THEN RAISE EXCEPTION 'meal:approver-must-differ'; END IF;
    IF _status = 'anulada' AND nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
  END IF;
  IF _counted_on IS NULL OR _counted_on > (now() AT TIME ZONE 'UTC')::date + 1 THEN RAISE EXCEPTION 'meal:count-date-invalid'; END IF;
  g := public.meal_grant_on(CASE WHEN _status = 'aprovada' THEN 'aprovar-inventario-alimentar' ELSE 'registrar-estoque-alimentar' END, _school, _counted_on);
  IF _status IN ('aprovada','anulada') THEN res := _lines;
  ELSE
    IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'meal:lines-required'; END IF;
    FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
      IF public.meal_catalog_version('item-de-estoque-alimentar', l->>'item_value_id') IS NULL OR public.meal_catalog_version('unidade-de-medida-alimentar', l->>'unit_value_id') IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
      IF jsonb_typeof(l->'fisica') IS DISTINCT FROM 'number' OR (l->>'fisica')::numeric < 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
      phys := (l->>'fisica')::numeric;
      SELECT sum(x.balance), sum(x.unknown_sign) INTO calc, known FROM public.meal_stock_lines(_school, _counted_on, now()) x
       WHERE x.item_value_id = l->>'item_value_id' AND x.unit_value_id = l->>'unit_value_id' AND x.lot IS NOT DISTINCT FROM nullif(btrim(l->>'lote'),'');
      IF coalesce(known,0) > 0 THEN calc := NULL; END IF;
      IF calc IS NULL AND known IS NULL THEN calc := 0; END IF;
      IF calc IS NOT NULL AND calc <> phys AND nullif(btrim(l->>'justificativa'),'') IS NULL AND _status <> 'rascunho' THEN RAISE EXCEPTION 'meal:divergence-requires-justification'; END IF;
      res := res || jsonb_build_object('item_value_id', l->>'item_value_id', 'unit_value_id', l->>'unit_value_id', 'lote', nullif(btrim(l->>'lote'),''),
        'fisica', phys, 'calculada', calc, 'diferenca', CASE WHEN calc IS NULL THEN NULL ELSE phys - calc END, 'justificativa', nullif(btrim(l->>'justificativa'),''));
    END LOOP;
  END IF;
  INSERT INTO public.meal_stock_counts(logical_id, version, supersedes_id, status, school_id, counted_on, lines, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, _status, _school, _counted_on, res, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_stock_count(uuid, integer, text, text, date, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_stock_count(uuid, integer, text, text, date, jsonb, text) TO authenticated;

CREATE FUNCTION public.record_meal_stock_closing(_school text, _competence text, _expected_version integer, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_stock_closings; last_day date; k timestamptz := now(); ids uuid[]; bals jsonb; r uuid;
BEGIN
  me := public.af_natural_person();
  IF _competence IS NULL OR _competence !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  last_day := (to_date(_competence || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  IF last_day > (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'meal:competence-not-ended'; END IF;
  g := public.meal_network_grant_on('fechar-estoque-alimentar', last_day);
  PERFORM pg_advisory_xact_lock(hashtext('meal-closing:' || _school || ':' || _competence));
  SELECT * INTO head FROM public.meal_stock_closings c WHERE c.school_id = _school AND c.competence = _competence ORDER BY c.version DESC LIMIT 1;
  IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
  IF head.id IS NOT NULL AND nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
  SELECT coalesce(array_agg(m.id ORDER BY m.id), ARRAY[]::uuid[]) INTO ids FROM public.meal_inventory_movements m
   WHERE m.school_id = _school AND m.recorded_at <= k AND m.moved_on <= last_day
     AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id AND s.recorded_at <= k);
  SELECT coalesce(jsonb_agg(jsonb_build_object('item_value_id', l.item_value_id, 'unit_value_id', l.unit_value_id, 'lote', l.lot, 'saldo', l.balance, 'movimentos', l.movements)
           ORDER BY l.item_value_id, l.unit_value_id, l.lot), '[]'::jsonb) INTO bals FROM public.meal_stock_lines(_school, last_day, k) l;
  INSERT INTO public.meal_stock_closings(school_id, competence, version, supersedes_id, closing_on, known_at, movement_ids, balances, manifest_sha256, reason, author_user_id, author_person_id, author_engagement)
  VALUES (_school, _competence, coalesce(head.version,0)+1, head.id, last_day, k, ids, bals,
    encode(sha256(convert_to(_school || '|' || _competence || '|' || array_to_string(ids, ',') || '|' || bals::text, 'UTF8')), 'hex'),
    nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_stock_closing(text, text, integer, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_stock_closing(text, text, integer, text) TO authenticated;

CREATE FUNCTION public.meal_stock_read_guard(_school text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  IF NOT public.meal_can_read_receiving(_school) THEN RAISE EXCEPTION 'capability:registrar-estoque-alimentar'; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_read_guard(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_stock_balance_at(_school text, _on date, _known_at timestamptz)
RETURNS TABLE(item_value_id text, unit_value_id text, lot text, expires_on date, balance numeric, movements integer, unknown_sign integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:as-of-required'; END IF;
  RETURN QUERY SELECT * FROM public.meal_stock_lines(_school, _on, coalesce(_known_at, now())) ORDER BY 1, 2, 3;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_balance_at(text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_stock_balance_at(text, date, timestamptz) TO authenticated;

CREATE FUNCTION public.meal_stock_ledger_at(_school text, _from date, _to date, _known_at timestamptz)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, movement_class text, sign smallint, item_value_id text, unit_value_id text, quantity numeric,
  moved_on date, lot text, expires_on date, contract_ref uuid, delivery_schedule_ref uuid, source_receipt_version_id uuid, source_document_ref uuid, stock_count_ref uuid,
  transfer_pair_id uuid, transfer_peer_school text, source_literal text, note text, reason text, recorded_at timestamptz, superseded boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  RETURN QUERY SELECT m.id, m.logical_id, m.version, m.event_kind, public.meal_movement_class(m), public.meal_movement_sign(m), m.item_value_id, m.unit_value_id, m.quantity,
      m.moved_on, m.lot, m.expires_on, m.contract_ref, m.delivery_schedule_ref, m.source_receipt_version_id, m.source_document_ref, m.stock_count_ref,
      m.transfer_pair_id, m.transfer_peer_school, m.source_literal, m.note, m.reason, m.recorded_at,
      EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id AND s.recorded_at <= k)
    FROM public.meal_inventory_movements m
   WHERE m.school_id = _school AND m.recorded_at <= k AND m.moved_on <= _to AND (_from IS NULL OR m.moved_on >= _from)
   ORDER BY m.moved_on, m.recorded_at LIMIT 5000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_ledger_at(text, date, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_stock_ledger_at(text, date, date, timestamptz) TO authenticated;

CREATE FUNCTION public.meal_stock_counts_at(_school text)
RETURNS SETOF public.meal_stock_counts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  RETURN QUERY SELECT DISTINCT ON (c.logical_id) c.* FROM public.meal_stock_counts c WHERE c.school_id = _school ORDER BY c.logical_id, c.version DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_counts_at(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_stock_counts_at(text) TO authenticated;

CREATE FUNCTION public.meal_stock_closings_at(_school text)
RETURNS SETOF public.meal_stock_closings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  RETURN QUERY SELECT c.* FROM public.meal_stock_closings c WHERE c.school_id = _school ORDER BY c.competence DESC, c.version DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_closings_at(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_stock_closings_at(text) TO authenticated;

CREATE FUNCTION public.meal_stock_basis_at(_school text, _competence text)
RETURNS TABLE(state text, policy jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p jsonb; d date;
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  IF _competence IS NULL OR _competence !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  d := to_date(_competence || '-01', 'YYYY-MM-DD');
  p := public.meal_policy_on('politica-base-de-estoque', d);
  RETURN QUERY SELECT CASE WHEN p IS NULL THEN 'STOCK_BASIS_POLICY_PENDING' ELSE 'homologada' END, p;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_basis_at(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_stock_basis_at(text, text) TO authenticated;

CREATE FUNCTION public.meal_stock_alerts_at(_school text, _on date, _expiry_window_days integer)
RETURNS TABLE(kind text, item_value_id text, unit_value_id text, lot text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:as-of-required'; END IF;
  RETURN QUERY
    SELECT 'saldo-negativo'::text, l.item_value_id, l.unit_value_id, l.lot, l.balance::text FROM public.meal_stock_lines(_school, _on, now()) l WHERE l.balance < 0
    UNION ALL
    SELECT 'sinal-desconhecido', l.item_value_id, l.unit_value_id, l.lot, l.unknown_sign::text || ' movimento(s) legado(s) de ajuste sem direção' FROM public.meal_stock_lines(_school, _on, now()) l WHERE l.unknown_sign > 0
    UNION ALL
    SELECT 'validade-proxima', l.item_value_id, l.unit_value_id, l.lot, l.expires_on::text FROM public.meal_stock_lines(_school, _on, now()) l
     WHERE _expiry_window_days IS NOT NULL AND l.expires_on IS NOT NULL AND l.balance > 0 AND l.expires_on <= _on + _expiry_window_days
    UNION ALL
    SELECT 'aceite-sem-lote', m.item_value_id, m.unit_value_id, NULL, m.moved_on::text FROM public.meal_inventory_movements m
     WHERE m.school_id = _school AND m.source_receipt_version_id IS NOT NULL AND m.lot IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.meal_receipts r WHERE r.id = m.source_receipt_version_id AND r.lot IS NOT NULL)
       AND EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (x.logical_id) x.* FROM public.meal_master_records x WHERE x.kind = 'exigencia-de-lote' ORDER BY x.logical_id, x.version DESC) e
                    WHERE e.status = 'homologada' AND e.payload->>'item_estoque_value_id' = m.item_value_id)
    UNION ALL
    SELECT 'inventario-divergente', x->>'item_value_id', x->>'unit_value_id', x->>'lote', x->>'diferenca'
      FROM (SELECT DISTINCT ON (c.logical_id) c.* FROM public.meal_stock_counts c WHERE c.school_id = _school ORDER BY c.logical_id, c.version DESC) c, jsonb_array_elements(c.lines) x
     WHERE c.status IN ('conferida','aprovada') AND (x->>'diferenca')::numeric <> 0
       AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements m WHERE m.stock_count_ref = c.logical_id AND m.item_value_id = x->>'item_value_id' AND m.event_kind <> 'anulacao')
    UNION ALL
    SELECT 'movimento-possivelmente-duplicado', m.item_value_id, m.unit_value_id, m.lot, m.moved_on::text || ' × ' || count(*)::text
      FROM public.meal_inventory_movements m
     WHERE m.school_id = _school AND m.event_kind = 'registro' AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id)
     GROUP BY m.item_value_id, m.unit_value_id, m.lot, m.moved_on, m.quantity, public.meal_movement_class(m), date_trunc('minute', m.recorded_at) HAVING count(*) > 1;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_stock_alerts_at(text, date, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_stock_alerts_at(text, date, integer) TO authenticated;