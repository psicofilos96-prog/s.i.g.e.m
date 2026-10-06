-- NAE.3 — Programação de entrega → conferência física → aceite/rejeição → estoque; não conformidade; documento fiscal.
-- Autorização ≠ entrega ≠ aceite ≠ estoque ≠ pagamento. Só a quantidade ACEITA gera UMA entrada no ledger de estoque,
-- ligada ao recebimento por chave única (source_receipt_version_id); retificação gera retificação do mesmo movimento.
-- Data do estoque = data real do aceite (no fuso declarado); a competência do pedido nunca muda.
-- Checklist de conferência é configuração homologada por item; nada é exigido por suposição.
-- Prazo de não conformidade só por regra homologada (NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE sem ela).
-- Documento fiscal = metadados + hash + vínculo; nunca atesto, liquidação ou pagamento (FINANCIAL_WORKFLOW — OUTSIDE_SCOPE).

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
    ('checklist-de-recebimento','manter-catalogo-tecnico-alimentar', ARRAY['itens'], ARRAY['item_ref:item-alimentar'])
  ) AS s(k, c, r, f) WHERE s.k = _kind
$fn$;
REVOKE ALL ON FUNCTION public.meal_master_spec(text) FROM PUBLIC, anon;

ALTER TABLE public.meal_inventory_movements ADD COLUMN source_receipt_version_id uuid;
CREATE UNIQUE INDEX meal_inventory_movements_source_receipt_uq ON public.meal_inventory_movements(source_receipt_version_id) WHERE source_receipt_version_id IS NOT NULL;
COMMENT ON COLUMN public.meal_inventory_movements.source_receipt_version_id IS 'Versão de recebimento confirmada que originou esta entrada (NAE.3); única = idempotência do aceite.';

CREATE TABLE public.meal_delivery_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_delivery_schedules(id),
  action text NOT NULL CHECK (action IN ('programacao','reprogramacao','cancelamento')),
  order_logical_id uuid NOT NULL,
  competence text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  item_ref uuid NOT NULL, unidade_ref uuid NOT NULL, apresentacao_ref uuid, contrato_ref uuid, frequencia_ref uuid,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  expected_on date NOT NULL,
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE INDEX meal_delivery_schedules_scope_idx ON public.meal_delivery_schedules(school_id, expected_on, logical_id, version DESC);

CREATE TABLE public.meal_fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_fiscal_documents(id),
  status text NOT NULL CHECK (status IN ('recebido','conferido','substituido')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  schedule_logical_id uuid,
  number text NOT NULL,
  issuer_ref uuid,
  issued_on date,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_ref text,
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);

CREATE TABLE public.meal_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_receipts(id),
  status text NOT NULL CHECK (status IN ('rascunho','confirmado','retificado')),
  schedule_logical_id uuid NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  received_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  delivered_qty numeric(14,3) NOT NULL CHECK (delivered_qty >= 0),
  accepted_qty numeric(14,3) NOT NULL CHECK (accepted_qty >= 0),
  rejected_qty numeric(14,3) NOT NULL CHECK (rejected_qty >= 0),
  lot text, expires_on date, brand_observed text, spec_observed text, condition_note text, temperature numeric(6,2),
  checklist_ref uuid, checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  fiscal_document_logical_id uuid,
  evidence_refs text[] NOT NULL DEFAULT ARRAY[]::text[],
  note text, reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (accepted_qty + rejected_qty = delivered_qty)
);
CREATE UNIQUE INDEX meal_receipts_one_per_schedule ON public.meal_receipts(schedule_logical_id) WHERE version = 1;

CREATE TABLE public.meal_nonconformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_nonconformities(id),
  status text NOT NULL CHECK (status IN ('aberta','comunicada','providencia','resolvida','encerrada')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  receipt_logical_id uuid,
  schedule_logical_id uuid,
  item_ref uuid, supplier_ref uuid,
  motive text NOT NULL,
  returned_qty numeric(14,3) CHECK (returned_qty IS NULL OR returned_qty >= 0),
  evidence_refs text[] NOT NULL DEFAULT ARRAY[]::text[],
  deadline_rule_ref uuid,
  note text, reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);

GRANT SELECT ON public.meal_delivery_schedules, public.meal_fiscal_documents, public.meal_receipts, public.meal_nonconformities TO service_role;
ALTER TABLE public.meal_delivery_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nonconformities ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_delivery_schedules_append_only BEFORE UPDATE OR DELETE ON public.meal_delivery_schedules FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_fiscal_documents_append_only BEFORE UPDATE OR DELETE ON public.meal_fiscal_documents FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_receipts_append_only BEFORE UPDATE OR DELETE ON public.meal_receipts FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_nonconformities_append_only BEFORE UPDATE OR DELETE ON public.meal_nonconformities FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE FUNCTION public.record_meal_delivery_schedule(_logical uuid, _expected_version integer, _action text, _order uuid,
  _item uuid, _unit uuid, _presentation uuid, _contract uuid, _frequency uuid, _quantity numeric, _expected_on date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_delivery_schedules; o public.meal_order_versions; lid uuid; authorized numeric; scheduled numeric;
BEGIN
  me := public.af_natural_person();
  IF _action NOT IN ('programacao','reprogramacao','cancelamento') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _action <> 'programacao' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_delivery_schedules WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_delivery_schedules WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF head.action = 'cancelamento' THEN RAISE EXCEPTION 'meal:schedule-cancelled'; END IF;
    IF _action = 'programacao' THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_receipts r WHERE r.schedule_logical_id = lid AND r.status <> 'rascunho') THEN RAISE EXCEPTION 'meal:schedule-already-received'; END IF;
    _order := head.order_logical_id; _item := head.item_ref; _unit := head.unidade_ref; _presentation := head.apresentacao_ref; _contract := head.contrato_ref;
    IF _action = 'cancelamento' THEN _quantity := head.quantity; _expected_on := head.expected_on; _frequency := head.frequencia_ref; END IF;
  END IF;
  IF _expected_on IS NULL THEN RAISE EXCEPTION 'meal:expected-date-required'; END IF;
  g := public.meal_network_grant_on('registrar-programacao-de-entrega-alimentar', _expected_on);
  SELECT * INTO o FROM public.meal_order_versions v WHERE v.logical_id = _order ORDER BY v.version DESC LIMIT 1;
  IF o.id IS NULL OR o.status NOT IN ('autorizado-total','autorizado-parcial','retificado') THEN RAISE EXCEPTION 'meal:order-not-authorized'; END IF;
  IF _frequency IS NOT NULL AND NOT public.meal_master_homologated(_frequency, 'programacao-de-entrega', _expected_on) THEN RAISE EXCEPTION 'meal:frequency-not-homologated'; END IF;
  SELECT coalesce(sum((x->>'quantidade')::numeric), 0) INTO authorized FROM jsonb_array_elements(o.lines) x
   WHERE x->>'item_ref' = _item::text AND x->>'unidade_ref' = _unit::text
     AND coalesce(x->>'apresentacao_ref','') = coalesce(_presentation::text,'') AND coalesce(x->>'contrato_ref','') = coalesce(_contract::text,'');
  IF authorized <= 0 THEN RAISE EXCEPTION 'meal:line-not-authorized'; END IF;
  IF _action <> 'cancelamento' THEN
    IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('meal-schedule:' || _order::text || ':' || _item::text || ':' || _unit::text));
    SELECT coalesce(sum(h.quantity), 0) INTO scheduled FROM (SELECT DISTINCT ON (s.logical_id) s.* FROM public.meal_delivery_schedules s
       WHERE s.order_logical_id = _order AND s.item_ref = _item AND s.unidade_ref = _unit
         AND coalesce(s.apresentacao_ref::text,'') = coalesce(_presentation::text,'') AND coalesce(s.contrato_ref::text,'') = coalesce(_contract::text,'')
       ORDER BY s.logical_id, s.version DESC) h
     WHERE h.action <> 'cancelamento' AND h.logical_id <> lid;
    IF scheduled + _quantity > authorized THEN RAISE EXCEPTION 'meal:schedule-exceeds-authorized'; END IF;
  END IF;
  INSERT INTO public.meal_delivery_schedules(logical_id, version, supersedes_id, action, order_logical_id, competence, school_id, item_ref, unidade_ref, apresentacao_ref, contrato_ref, frequencia_ref, quantity, expected_on, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, _action, _order, o.competence, o.school_id, _item, _unit, _presentation, _contract, _frequency, _quantity, _expected_on, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_delivery_schedule(uuid, integer, text, uuid, uuid, uuid, uuid, uuid, uuid, numeric, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_delivery_schedule(uuid, integer, text, uuid, uuid, uuid, uuid, uuid, uuid, numeric, date, text) TO authenticated;

CREATE FUNCTION public.record_meal_fiscal_document(_logical uuid, _expected_version integer, _status text, _school text, _schedule uuid,
  _number text, _issuer uuid, _issued_on date, _sha256 text, _storage_ref text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_fiscal_documents; lid uuid;
BEGIN
  me := public.af_natural_person();
  IF _status NOT IN ('recebido','conferido','substituido') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _status <> 'recebido' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    IF _schedule IS NOT NULL THEN
      SELECT s.school_id INTO _school FROM public.meal_delivery_schedules s WHERE s.logical_id = _schedule ORDER BY s.version DESC LIMIT 1;
      IF _school IS NULL THEN RAISE EXCEPTION 'meal:schedule-unknown'; END IF;
    END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_fiscal_documents WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_fiscal_documents WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF head.status = 'substituido' THEN RAISE EXCEPTION 'meal:document-replaced'; END IF;
    IF _status = 'recebido' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    IF _status = 'substituido' AND nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    _school := head.school_id; _schedule := head.schedule_logical_id; _number := head.number; _issuer := head.issuer_ref;
    _issued_on := head.issued_on; _sha256 := head.sha256; _storage_ref := head.storage_ref;
  END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  IF nullif(btrim(_number),'') IS NULL THEN RAISE EXCEPTION 'meal:document-number-required'; END IF;
  IF _sha256 IS NULL OR _sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'meal:hash-required'; END IF;
  IF _issuer IS NOT NULL AND NOT public.meal_master_homologated(_issuer, 'fornecedor', coalesce(_issued_on, (now() AT TIME ZONE 'UTC')::date)) THEN RAISE EXCEPTION 'meal:supplier-not-homologated'; END IF;
  g := public.meal_grant_on('conferir-recebimento-alimentar', _school, coalesce(_issued_on, (now() AT TIME ZONE 'UTC')::date));
  INSERT INTO public.meal_fiscal_documents(logical_id, version, supersedes_id, status, school_id, schedule_logical_id, number, issuer_ref, issued_on, sha256, storage_ref, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, _status, _school, _schedule, btrim(_number), _issuer, _issued_on, _sha256, nullif(btrim(_storage_ref),''), nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_fiscal_document(uuid, integer, text, text, uuid, text, uuid, date, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_fiscal_document(uuid, integer, text, text, uuid, text, uuid, date, text, text, text) TO authenticated;

CREATE FUNCTION public.record_meal_receipt(_logical uuid, _expected_version integer, _action text, _schedule uuid,
  _received_at timestamptz, _tz text, _delivered numeric, _accepted numeric, _rejected numeric,
  _lot text, _expires date, _brand text, _spec text, _condition text, _temperature numeric,
  _checklist jsonb, _fiscal uuid, _evidence text[], _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_receipts; sch public.meal_delivery_schedules; lid uuid; st text; d date; rid uuid;
        cl public.meal_master_records; q jsonb; itemv text; unitv text; iv integer; uv integer; prev public.meal_inventory_movements;
BEGIN
  me := public.af_natural_person();
  IF _action NOT IN ('rascunho','confirmacao','retificacao') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _action NOT IN ('rascunho','confirmacao') OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_receipts WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_receipts WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    _schedule := head.schedule_logical_id;
    IF _action IN ('rascunho','confirmacao') AND head.status <> 'rascunho' THEN RAISE EXCEPTION 'meal:receipt-confirmed-use-rectification'; END IF;
    IF _action = 'retificacao' AND head.status = 'rascunho' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
  END IF;
  SELECT * INTO sch FROM public.meal_delivery_schedules s WHERE s.logical_id = _schedule ORDER BY s.version DESC LIMIT 1;
  IF sch.id IS NULL THEN RAISE EXCEPTION 'meal:schedule-unknown'; END IF;
  IF sch.action = 'cancelamento' THEN RAISE EXCEPTION 'meal:schedule-cancelled'; END IF;
  IF _logical IS NULL AND EXISTS (SELECT 1 FROM public.meal_receipts r WHERE r.schedule_logical_id = _schedule) THEN RAISE EXCEPTION 'meal:receipt-exists-use-base'; END IF;
  IF _received_at IS NULL OR _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = _tz) THEN RAISE EXCEPTION 'meal:received-at-required'; END IF;
  IF _received_at > now() THEN RAISE EXCEPTION 'meal:received-in-future'; END IF;
  d := (_received_at AT TIME ZONE _tz)::date;
  g := public.meal_grant_on('conferir-recebimento-alimentar', sch.school_id, d);
  IF _delivered IS NULL OR _accepted IS NULL OR _rejected IS NULL OR _accepted + _rejected <> _delivered THEN RAISE EXCEPTION 'meal:quantities-inconsistent'; END IF;
  IF _fiscal IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.meal_fiscal_documents f WHERE f.logical_id = _fiscal AND f.school_id = sch.school_id) THEN RAISE EXCEPTION 'meal:fiscal-document-unknown'; END IF;
  _checklist := coalesce(_checklist, '{}'::jsonb);

  IF _action = 'rascunho' THEN st := 'rascunho';
  ELSE
    st := CASE _action WHEN 'confirmacao' THEN 'confirmado' ELSE 'retificado' END;
    IF _action = 'retificacao' AND nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    SELECT h.* INTO cl FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r WHERE r.kind = 'checklist-de-recebimento' ORDER BY r.logical_id, r.version DESC) h
     WHERE h.status = 'homologada' AND h.payload->>'item_ref' = sch.item_ref::text AND h.valid_from <= d AND (h.valid_to IS NULL OR h.valid_to >= d)
     ORDER BY h.valid_from DESC LIMIT 1;
    IF cl.id IS NOT NULL THEN
      FOR q IN SELECT * FROM jsonb_array_elements(cl.payload->'itens') LOOP
        IF coalesce((q->>'obrigatorio')::boolean, false) AND (_checklist->(q->>'id') IS NULL OR jsonb_typeof(_checklist->(q->>'id')) = 'null') THEN
          RAISE EXCEPTION 'meal:checklist-answer-required:%', q->>'id'; END IF;
        IF q->>'id' = 'temperatura' AND coalesce((q->>'obrigatorio')::boolean, false) AND _temperature IS NULL THEN RAISE EXCEPTION 'meal:temperature-required'; END IF;
      END LOOP;
    END IF;
  END IF;

  INSERT INTO public.meal_receipts(logical_id, version, supersedes_id, status, schedule_logical_id, school_id, received_at, time_zone, delivered_qty, accepted_qty, rejected_qty,
    lot, expires_on, brand_observed, spec_observed, condition_note, temperature, checklist_ref, checklist, fiscal_document_logical_id, evidence_refs, note, reason,
    author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, st, _schedule, sch.school_id, _received_at, _tz, _delivered, _accepted, _rejected,
    nullif(btrim(_lot),''), _expires, nullif(btrim(_brand),''), nullif(btrim(_spec),''), nullif(btrim(_condition),''), _temperature, cl.logical_id, _checklist, _fiscal,
    coalesce(_evidence, ARRAY[]::text[]), nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO rid;

  IF st IN ('confirmado','retificado') THEN
    SELECT r.payload->>'item_estoque_value_id' INTO itemv FROM public.meal_master_records r WHERE r.logical_id = sch.item_ref ORDER BY r.version DESC LIMIT 1;
    SELECT r.payload->>'unidade_estoque_value_id' INTO unitv FROM public.meal_master_records r WHERE r.logical_id = sch.unidade_ref ORDER BY r.version DESC LIMIT 1;
    iv := public.meal_catalog_version('item-de-estoque-alimentar', itemv);
    uv := public.meal_catalog_version('unidade-de-medida-alimentar', unitv);
    IF iv IS NULL OR uv IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
    SELECT m.* INTO prev FROM public.meal_inventory_movements m
     WHERE m.source_receipt_version_id IN (SELECT x.id FROM public.meal_receipts x WHERE x.logical_id = lid)
     ORDER BY m.version DESC LIMIT 1;
    IF prev.id IS NULL THEN
      IF _accepted > 0 THEN
        INSERT INTO public.meal_inventory_movements(logical_id, version, supersedes_id, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version,
          movement_kind, quantity, moved_on, note, reason, author_user_id, author_person_id, author_engagement, source_receipt_version_id)
        VALUES (gen_random_uuid(), 1, NULL, 'registro', sch.school_id, itemv, iv, unitv, uv, 'entrada', _accepted, d, 'aceite de recebimento', NULL, auth.uid(), me, g, rid);
      END IF;
    ELSIF prev.quantity IS DISTINCT FROM _accepted OR prev.moved_on IS DISTINCT FROM d THEN
      INSERT INTO public.meal_inventory_movements(logical_id, version, supersedes_id, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version,
        movement_kind, quantity, moved_on, note, reason, author_user_id, author_person_id, author_engagement, source_receipt_version_id)
      VALUES (prev.logical_id, prev.version + 1, prev.id, CASE WHEN _accepted = 0 THEN 'anulacao' ELSE 'retificacao' END, sch.school_id, itemv, iv, unitv, uv, 'entrada',
        CASE WHEN _accepted = 0 THEN prev.quantity ELSE _accepted END, d, 'retificação de recebimento', coalesce(nullif(btrim(_reason),''), 'retificação de recebimento'), auth.uid(), me, g, rid);
    END IF;
  END IF;
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_receipt(uuid, integer, text, uuid, timestamptz, text, numeric, numeric, numeric, text, date, text, text, text, numeric, jsonb, uuid, text[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_receipt(uuid, integer, text, uuid, timestamptz, text, numeric, numeric, numeric, text, date, text, text, text, numeric, jsonb, uuid, text[], text, text) TO authenticated;

CREATE FUNCTION public.record_meal_nonconformity(_logical uuid, _expected_version integer, _status text, _receipt uuid,
  _motive text, _returned numeric, _evidence text[], _deadline_rule uuid, _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_nonconformities; r public.meal_receipts; s public.meal_delivery_schedules; lid uuid; sup uuid; d date;
BEGIN
  me := public.af_natural_person();
  IF _status NOT IN ('aberta','comunicada','providencia','resolvida','encerrada') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _status <> 'aberta' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_nonconformities WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_nonconformities WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF head.status = 'encerrada' THEN RAISE EXCEPTION 'meal:nonconformity-closed'; END IF;
    IF _status = 'aberta' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    _receipt := head.receipt_logical_id; _motive := head.motive; _deadline_rule := coalesce(_deadline_rule, head.deadline_rule_ref);
    _evidence := head.evidence_refs || coalesce(_evidence, ARRAY[]::text[]);
    _returned := coalesce(_returned, head.returned_qty);
  END IF;
  SELECT * INTO r FROM public.meal_receipts x WHERE x.logical_id = _receipt ORDER BY x.version DESC LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'meal:receipt-unknown'; END IF;
  SELECT * INTO s FROM public.meal_delivery_schedules x WHERE x.logical_id = r.schedule_logical_id ORDER BY x.version DESC LIMIT 1;
  SELECT (c.payload->>'fornecedor_ref')::uuid INTO sup FROM public.meal_master_records c WHERE c.logical_id = s.contrato_ref ORDER BY c.version DESC LIMIT 1;
  IF nullif(btrim(_motive),'') IS NULL THEN RAISE EXCEPTION 'meal:motive-required'; END IF;
  IF _returned IS NOT NULL AND _returned > r.rejected_qty THEN RAISE EXCEPTION 'meal:returned-exceeds-rejected'; END IF;
  IF _deadline_rule IS NOT NULL AND NOT public.meal_master_homologated(_deadline_rule, 'documento-tecnico', (r.received_at AT TIME ZONE r.time_zone)::date) THEN RAISE EXCEPTION 'meal:deadline-rule-not-homologated'; END IF;
  IF _status IN ('resolvida','encerrada') AND nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
  d := (now() AT TIME ZONE r.time_zone)::date;
  BEGIN
    g := public.meal_grant_on('registrar-nao-conformidade-alimentar', r.school_id, d);
  EXCEPTION WHEN others THEN
    g := public.meal_network_grant_on('registrar-nao-conformidade-alimentar', d);
  END;
  INSERT INTO public.meal_nonconformities(logical_id, version, supersedes_id, status, school_id, receipt_logical_id, schedule_logical_id, item_ref, supplier_ref, motive, returned_qty, evidence_refs, deadline_rule_ref, note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, _status, r.school_id, _receipt, r.schedule_logical_id, s.item_ref, sup, btrim(_motive), _returned, coalesce(_evidence, ARRAY[]::text[]), _deadline_rule, nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_nonconformity(uuid, integer, text, uuid, text, numeric, text[], uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_nonconformity(uuid, integer, text, uuid, text, numeric, text[], uuid, text, text) TO authenticated;

CREATE FUNCTION public.meal_can_read_receiving(_school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    public.meal_has_network(ARRAY['registrar-programacao-de-entrega-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar','registrar-nao-conformidade-alimentar','conferir-recebimento-alimentar'])
    OR (_school IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
          AND c.capability_id IN ('conferir-recebimento-alimentar','registrar-nao-conformidade-alimentar','consultar-alimentacao-escolar','registrar-estoque-alimentar'))))
$fn$;
REVOKE ALL ON FUNCTION public.meal_can_read_receiving(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_deliveries_at(_school text, _from date, _to date, _as_of date, _known_at timestamptz)
RETURNS TABLE(schedule_logical_id uuid, schedule_version integer, action text, school_id text, competence text, order_logical_id uuid,
  item_ref uuid, unidade_ref uuid, apresentacao_ref uuid, contrato_ref uuid, quantity numeric, expected_on date,
  receipt_logical_id uuid, receipt_version integer, receipt_status text, received_at timestamptz, delivered_qty numeric, accepted_qty numeric, rejected_qty numeric,
  pending_qty numeric, late boolean, open_nonconformities integer, expected_brand text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _as_of IS NULL THEN RAISE EXCEPTION 'meal:as-of-required'; END IF;
  IF NOT public.meal_can_read_receiving(_school) THEN RAISE EXCEPTION 'capability:conferir-recebimento-alimentar'; END IF;
  IF _school IS NULL AND NOT public.meal_has_network(ARRAY['registrar-programacao-de-entrega-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar','registrar-nao-conformidade-alimentar','conferir-recebimento-alimentar'])
    THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  RETURN QUERY
  WITH s AS (SELECT DISTINCT ON (x.logical_id) x.* FROM public.meal_delivery_schedules x
              WHERE x.recorded_at <= k AND (_school IS NULL OR x.school_id = _school) AND x.expected_on BETWEEN _from AND _to
              ORDER BY x.logical_id, x.version DESC),
       r AS (SELECT DISTINCT ON (y.logical_id) y.* FROM public.meal_receipts y WHERE y.recorded_at <= k ORDER BY y.logical_id, y.version DESC)
  SELECT s.logical_id, s.version, s.action, s.school_id, s.competence, s.order_logical_id, s.item_ref, s.unidade_ref, s.apresentacao_ref, s.contrato_ref, s.quantity, s.expected_on,
         r.logical_id, r.version, r.status, r.received_at, r.delivered_qty, r.accepted_qty, r.rejected_qty,
         CASE WHEN s.action = 'cancelamento' THEN 0::numeric WHEN r.status IN ('confirmado','retificado') THEN greatest(s.quantity - r.accepted_qty, 0) ELSE s.quantity END,
         s.action <> 'cancelamento' AND (r.status IS NULL OR r.status = 'rascunho') AND s.expected_on < _as_of,
         (SELECT count(*)::integer FROM (SELECT DISTINCT ON (n.logical_id) n.status FROM public.meal_nonconformities n WHERE n.schedule_logical_id = s.logical_id AND n.recorded_at <= k ORDER BY n.logical_id, n.version DESC) z
           WHERE z.status NOT IN ('resolvida','encerrada')),
         (SELECT b.payload->>'marca' FROM (SELECT DISTINCT ON (m.logical_id) m.* FROM public.meal_master_records m WHERE m.kind = 'marca-aprovada' ORDER BY m.logical_id, m.version DESC) b
           WHERE b.status = 'homologada' AND b.payload->>'item_ref' = s.item_ref::text AND b.payload->>'contrato_ref' = s.contrato_ref::text LIMIT 1)
  FROM s LEFT JOIN r ON r.schedule_logical_id = s.logical_id
  ORDER BY s.expected_on, s.school_id LIMIT 5000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_deliveries_at(text, date, date, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_deliveries_at(text, date, date, date, timestamptz) TO authenticated;

CREATE FUNCTION public.meal_nonconformities_at(_school text, _known_at timestamptz)
RETURNS TABLE(logical_id uuid, version integer, status text, school_id text, receipt_logical_id uuid, schedule_logical_id uuid, item_ref uuid, supplier_ref uuid,
  motive text, returned_qty numeric, evidence_refs text[], deadline_state text, recorded_at timestamptz, opened_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF NOT public.meal_can_read_receiving(_school) THEN RAISE EXCEPTION 'capability:registrar-nao-conformidade-alimentar'; END IF;
  IF _school IS NULL AND NOT public.meal_has_network(ARRAY['registrar-programacao-de-entrega-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar','registrar-nao-conformidade-alimentar','conferir-recebimento-alimentar'])
    THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  RETURN QUERY SELECT h.logical_id, h.version, h.status, h.school_id, h.receipt_logical_id, h.schedule_logical_id, h.item_ref, h.supplier_ref, h.motive, h.returned_qty, h.evidence_refs,
      CASE WHEN h.deadline_rule_ref IS NULL THEN 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE' ELSE 'regra homologada referenciada' END,
      h.recorded_at, (SELECT min(x.recorded_at) FROM public.meal_nonconformities x WHERE x.logical_id = h.logical_id)
    FROM (SELECT DISTINCT ON (n.logical_id) n.* FROM public.meal_nonconformities n WHERE n.recorded_at <= k AND (_school IS NULL OR n.school_id = _school) ORDER BY n.logical_id, n.version DESC) h
    ORDER BY h.recorded_at DESC LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_nonconformities_at(text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_nonconformities_at(text, timestamptz) TO authenticated;

CREATE FUNCTION public.meal_fiscal_documents_at(_school text)
RETURNS TABLE(logical_id uuid, version integer, status text, school_id text, schedule_logical_id uuid, number text, issuer_ref uuid, issued_on date, sha256 text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NOT public.meal_can_read_receiving(_school) THEN RAISE EXCEPTION 'capability:conferir-recebimento-alimentar'; END IF;
  IF _school IS NULL AND NOT public.meal_has_network(ARRAY['registrar-programacao-de-entrega-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar','registrar-nao-conformidade-alimentar','conferir-recebimento-alimentar'])
    THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  RETURN QUERY SELECT h.logical_id, h.version, h.status, h.school_id, h.schedule_logical_id, h.number, h.issuer_ref, h.issued_on, h.sha256, h.recorded_at
    FROM (SELECT DISTINCT ON (f.logical_id) f.* FROM public.meal_fiscal_documents f WHERE (_school IS NULL OR f.school_id = _school) ORDER BY f.logical_id, f.version DESC) h
    ORDER BY h.recorded_at DESC LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_fiscal_documents_at(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_fiscal_documents_at(text) TO authenticated;