-- NAE.0 — Núcleo de Alimentação Escolar: hardening temporal e catálogo de capabilities (sem concessão).
-- Writers de fato datado passam a autorizar pela DATA DO FATO (meal_grant_on / meal_network_grant_on), e
-- writers de 0074 passam a exigir pessoa natural. Publicação (ato presente) e readers mantêm a data de hoje,
-- pois o objeto é o acesso/ato agora. Nenhum cardápio, item, per capita, prazo, fornecedor ou regra é semeado.
-- Capabilities novas (catálogo; nenhuma regra de política):
--   rede: manter-planejamento-nutricional · manter-catalogo-tecnico-alimentar · manter-parametros-nutricionais ·
--         administrar-janela-de-pedido-alimentar · analisar-pedido-alimentar · autorizar-pedido-alimentar ·
--         consolidar-demanda-alimentar · registrar-programacao-de-entrega-alimentar · gerir-documentos-alimentacao ·
--         exportar-relatorios-alimentacao
--   escola|rede: submeter-pedido-alimentar · conferir-recebimento-alimentar · registrar-nao-conformidade-alimentar

CREATE FUNCTION public.meal_grant_on(_capability text, _school text, _on date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-cardapio-escolar','registrar-execucao-alimentacao','consultar-alimentacao-escolar','registrar-restricao-alimentar','consultar-restricao-alimentar',
                         'publicar-cardapio-escolar','registrar-estoque-alimentar',
                         'submeter-pedido-alimentar','conferir-recebimento-alimentar','registrar-nao-conformidade-alimentar')
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

CREATE FUNCTION public.meal_network_grant_on(_capability text, _on date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-unidades-de-alimentacao','acompanhar-alimentacao-rede',
      'manter-planejamento-nutricional','manter-catalogo-tecnico-alimentar','manter-parametros-nutricionais',
      'administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'consolidar-demanda-alimentar','registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao',
      'exportar-relatorios-alimentacao') THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_grant_on(text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_meal_menu(_base_id uuid, _kind text, _school text, _group text, _starts date, _ends date, _entries jsonb, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; base public.meal_menu_versions; e jsonb; p text; r uuid;
BEGIN
  PERFORM public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_menu_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_menu_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id;
    IF _kind = 'revogacao' THEN _group := base.service_group_value_id; _starts := base.starts_on; _ends := base.ends_on; _entries := base.entries; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
  g := public.meal_grant_on('manter-cardapio-escolar', _school, _starts);
  IF _group IS NOT NULL AND NOT public.meal_value_ok('grupo-de-atendimento-alimentar', _group) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  IF jsonb_typeof(_entries) <> 'array' OR jsonb_array_length(_entries) = 0 THEN RAISE EXCEPTION 'meal:entries-required'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(_entries) LOOP
    IF (e->>'date') IS NULL OR (e->>'date')::date < _starts OR (e->>'date')::date > _ends THEN RAISE EXCEPTION 'meal:entry-date-outside-period'; END IF;
    IF NOT public.meal_value_ok('refeicao-escolar', e->>'slot') THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
    IF jsonb_typeof(e->'preparations') <> 'array' OR jsonb_array_length(e->'preparations') = 0 THEN RAISE EXCEPTION 'meal:preparations-required'; END IF;
    FOR p IN SELECT jsonb_array_elements_text(e->'preparations') LOOP
      IF NOT public.meal_value_ok('preparacao-alimentar', p) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
    END LOOP;
  END LOOP;
  INSERT INTO public.meal_menu_versions(logical_id, version, supersedes_id, event_kind, school_id, service_group_value_id, starts_on, ends_on, entries, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _group, _starts, _ends, _entries, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.record_meal_forecast(_base_id uuid, _kind text, _school text, _on date, _slot text, _count integer, _basis text, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; base public.meal_forecasts; r uuid;
BEGIN
  PERFORM public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_forecasts WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_forecasts WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id; _on := base.served_on; _slot := base.meal_slot_value_id;
    IF _kind = 'revogacao' THEN _count := base.forecast_count; _basis := base.basis; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  ELSIF EXISTS (SELECT 1 FROM public.meal_forecasts f WHERE f.school_id = _school AND f.served_on = _on AND f.meal_slot_value_id = _slot AND f.event_kind <> 'revogacao'
                AND NOT EXISTS (SELECT 1 FROM public.meal_forecasts s WHERE s.supersedes_id = f.id)) THEN RAISE EXCEPTION 'meal:duplicate-use-rectification';
  END IF;
  g := public.meal_grant_on('manter-cardapio-escolar', _school, _on);
  IF NOT public.meal_value_ok('refeicao-escolar', _slot) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  INSERT INTO public.meal_forecasts(logical_id, version, supersedes_id, event_kind, school_id, served_on, meal_slot_value_id, forecast_count, basis, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _on, _slot, _count, _basis, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.record_meal_service(_base_id uuid, _kind text, _school text, _on date, _slot text, _offered integer, _served integer, _source text, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; base public.meal_service_records; r uuid;
BEGIN
  PERFORM public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_service_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_service_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id; _on := base.served_on; _slot := base.meal_slot_value_id;
    IF _kind = 'revogacao' THEN _offered := base.offered_count; _served := base.served_count; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  ELSIF EXISTS (SELECT 1 FROM public.meal_service_records f WHERE f.school_id = _school AND f.served_on = _on AND f.meal_slot_value_id = _slot AND f.event_kind <> 'revogacao'
                AND NOT EXISTS (SELECT 1 FROM public.meal_service_records s WHERE s.supersedes_id = f.id)) THEN RAISE EXCEPTION 'meal:duplicate-use-rectification';
  END IF;
  g := public.meal_grant_on('registrar-execucao-alimentacao', _school, _on);
  IF _on > CURRENT_DATE THEN RAISE EXCEPTION 'meal:service-in-future'; END IF;
  IF NOT public.meal_value_ok('refeicao-escolar', _slot) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  INSERT INTO public.meal_service_records(logical_id, version, supersedes_id, event_kind, school_id, served_on, meal_slot_value_id, offered_count, served_count, source_note, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _on, _slot, _offered, _served, nullif(btrim(_source),''), nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.record_dietary_restriction(_base_id uuid, _kind text, _school text, _student text, _restriction text, _note text, _from date, _to date, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; base public.dietary_restrictions; r uuid;
BEGIN
  PERFORM public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.dietary_restrictions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.dietary_restrictions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id; _student := base.student_id;
    IF _kind = 'revogacao' THEN _restriction := base.restriction_value_id; _note := base.handling_note; _from := base.valid_from; _to := coalesce(_to, base.valid_to); END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
  g := public.meal_grant_on('registrar-restricao-alimentar', _school, _from);
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'meal:student-not-in-school'; END IF;
  IF NOT public.meal_value_ok('restricao-alimentar', _restriction) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  INSERT INTO public.dietary_restrictions(logical_id, version, supersedes_id, event_kind, school_id, student_id, restriction_value_id, handling_note, valid_from, valid_to, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _student, _restriction, nullif(btrim(_note),''), _from, _to, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.record_meal_kitchen(_kitchen uuid, _expected_version integer, _name text, _host_school text, _from date, _to date, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; me uuid; head public.meal_kitchen_versions; k uuid := _kitchen;
BEGIN
  me := public.af_natural_person();
  g := public.meal_network_grant_on('manter-unidades-de-alimentacao', coalesce(_from, _to));
  IF _from IS NULL THEN RAISE EXCEPTION 'meal:valid-from-required'; END IF;
  IF _host_school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _host_school) THEN RAISE EXCEPTION 'meal:school-unknown'; END IF;
  IF k IS NULL THEN
    IF _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:stale'; END IF;
    INSERT INTO public.meal_kitchens DEFAULT VALUES RETURNING id INTO k;
  ELSE
    PERFORM 1 FROM public.meal_kitchens WHERE id = k FOR UPDATE;
    SELECT * INTO head FROM public.meal_kitchen_versions WHERE kitchen_id = k ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:kitchen-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
  END IF;
  INSERT INTO public.meal_kitchen_versions(kitchen_id, version, supersedes_id, name, host_school_id, valid_from, valid_to, reason, author_user_id, author_person_id, author_engagement)
  VALUES (k, coalesce(head.version,0)+1, head.id, btrim(_name), _host_school, _from, _to, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN k;
END $function$;

CREATE OR REPLACE FUNCTION public.record_meal_kitchen_link(_base_id uuid, _kind text, _kitchen uuid, _school text, _from date, _to date, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; me uuid; base public.meal_kitchen_school_links; r uuid;
BEGIN
  me := public.af_natural_person();
  g := public.meal_network_grant_on('manter-unidades-de-alimentacao', coalesce(_from, _to));
  IF _kind NOT IN ('registro','retificacao','encerramento') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_kitchen_school_links WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_kitchen_school_links WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'encerramento' THEN RAISE EXCEPTION 'meal:already-closed'; END IF;
    _kitchen := base.kitchen_id; _school := base.school_id;
    IF _kind = 'encerramento' THEN _from := base.valid_from; IF _to IS NULL THEN RAISE EXCEPTION 'meal:valid-to-required'; END IF; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.meal_kitchens WHERE id = _kitchen) THEN RAISE EXCEPTION 'meal:kitchen-unknown'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'meal:school-unknown'; END IF;
  IF _from IS NULL THEN RAISE EXCEPTION 'meal:valid-from-required'; END IF;
  -- uma escola é atendida por uma unidade de cada vez
  IF _kind <> 'encerramento' AND EXISTS (SELECT 1 FROM public.meal_kitchen_school_links l WHERE l.school_id = _school
       AND l.logical_id <> coalesce(base.logical_id, '00000000-0000-0000-0000-000000000000'::uuid) AND l.event_kind <> 'encerramento'
       AND NOT EXISTS (SELECT 1 FROM public.meal_kitchen_school_links x WHERE x.supersedes_id = l.id)
       AND daterange(l.valid_from, l.valid_to, '[]') && daterange(_from, _to, '[]'))
  THEN RAISE EXCEPTION 'meal:school-already-served'; END IF;
  INSERT INTO public.meal_kitchen_school_links(logical_id, version, supersedes_id, event_kind, kitchen_id, school_id, valid_from, valid_to, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _kitchen, _school, _from, _to, nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.record_meal_inventory_movement(_base_id uuid, _kind text, _school text, _item text, _unit text, _movement text, _quantity numeric, _on date, _note text, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; me uuid; base public.meal_inventory_movements; iv integer; uv integer; r uuid;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_inventory_movements WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_inventory_movements WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id;
    IF _kind = 'anulacao' THEN _item := base.item_value_id; _unit := base.unit_value_id; _movement := base.movement_kind; _quantity := base.quantity; _on := base.moved_on; _note := base.note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  END IF;
  g := public.meal_grant_on('registrar-estoque-alimentar', _school, _on);
  iv := public.meal_catalog_version('item-de-estoque-alimentar', _item);
  uv := public.meal_catalog_version('unidade-de-medida-alimentar', _unit);
  IF iv IS NULL OR uv IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
  IF _on IS NULL OR _on > CURRENT_DATE THEN RAISE EXCEPTION 'meal:movement-date-invalid'; END IF;
  IF _quantity IS NULL OR _quantity < 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
  INSERT INTO public.meal_inventory_movements(logical_id, version, supersedes_id, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version,
    movement_kind, quantity, moved_on, note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _item, iv, _unit, uv, _movement, _quantity, _on,
    nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $function$;
