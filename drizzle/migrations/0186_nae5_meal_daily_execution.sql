-- NAE.5 — Execução diária: cardápio executado × planejado, refeições servidas (unidade própria), consumo observado
-- ligado uma única vez ao ledger NAE.4, controles operacionais por modelo homologado. Nada semeado.
-- Adesão e baixa teórica não existem sem definição homologada.

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
    ('categoria-de-refeicao','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('modelo-operacional','gerir-documentos-alimentacao', ARRAY['titulo','natureza','campos'], ARRAY[]::text[]),
    ('definicao-metrica-adesao','manter-planejamento-nutricional', ARRAY['formula','numerador','denominador'], ARRAY[]::text[])
  ) AS s(k, c, r, f) WHERE s.k = _kind
$fn$;

CREATE TABLE public.meal_daily_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_daily_executions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  executed_on date NOT NULL,
  meal_slot_value_id text NOT NULL,
  planned_menu_ref uuid,
  followed boolean,
  executed_preparation text,
  deviation text,
  deviation_reason text,
  deviation_authorization_ref uuid,
  meals_total integer CHECK (meals_total IS NULL OR meals_total >= 0),
  count_basis text,
  meals_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  students_present integer CHECK (students_present IS NULL OR students_present >= 0),
  students_present_source text,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (followed IS DISTINCT FROM false OR deviation IS NOT NULL),
  CHECK (students_present IS NULL OR students_present_source IS NOT NULL)
);
CREATE INDEX meal_daily_executions_school_idx ON public.meal_daily_executions(school_id, executed_on);
GRANT SELECT ON public.meal_daily_executions TO service_role;
ALTER TABLE public.meal_daily_executions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_daily_executions_append_only BEFORE UPDATE OR DELETE ON public.meal_daily_executions
  FOR EACH ROW EXECUTE FUNCTION public.aa_ledger_append_only();

CREATE TABLE public.meal_execution_consumptions (
  execution_logical_id uuid NOT NULL,
  line_key text NOT NULL,
  movement_id uuid NOT NULL UNIQUE REFERENCES public.meal_inventory_movements(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (execution_logical_id, line_key)
);
GRANT SELECT ON public.meal_execution_consumptions TO service_role;
ALTER TABLE public.meal_execution_consumptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_execution_consumptions_append_only BEFORE UPDATE OR DELETE ON public.meal_execution_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.aa_ledger_append_only();

CREATE FUNCTION public.record_meal_execution(_base_id uuid, _kind text, _school text, _on date, _slot text,
  _planned_menu uuid, _followed boolean, _preparation text, _deviation text, _deviation_reason text, _authorization uuid,
  _meals_total integer, _count_basis text, _breakdown jsonb, _students_present integer, _students_source text,
  _consumption jsonb, _tz text, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.meal_daily_executions; r uuid; lid uuid; l jsonb; mv uuid; bsum integer := 0;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_daily_executions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_daily_executions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    IF _consumption IS NOT NULL AND jsonb_array_length(_consumption) > 0 THEN RAISE EXCEPTION 'meal:consumption-correct-in-stock-ledger'; END IF;
    _school := base.school_id; _on := base.executed_on; _slot := base.meal_slot_value_id;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  ELSIF EXISTS (SELECT 1 FROM public.meal_daily_executions f WHERE f.school_id = _school AND f.executed_on = _on
      AND f.meal_slot_value_id = _slot AND f.event_kind <> 'revogacao'
      AND NOT EXISTS (SELECT 1 FROM public.meal_daily_executions s WHERE s.supersedes_id = f.id)) THEN
    RAISE EXCEPTION 'meal:duplicate-use-rectification';
  END IF;
  g := public.meal_grant_on('registrar-execucao-alimentacao', _school, _on);
  IF _on > CURRENT_DATE THEN RAISE EXCEPTION 'meal:execution-in-future'; END IF;
  IF NOT public.meal_value_ok('refeicao-escolar', _slot) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  IF _kind = 'revogacao' THEN
    _planned_menu := base.planned_menu_ref; _followed := base.followed; _preparation := base.executed_preparation;
    _deviation := base.deviation; _deviation_reason := base.deviation_reason; _authorization := base.deviation_authorization_ref;
    _meals_total := base.meals_total; _count_basis := base.count_basis; _breakdown := base.meals_breakdown;
    _students_present := base.students_present; _students_source := base.students_present_source;
  END IF;
  IF _followed IS FALSE AND nullif(btrim(_deviation),'') IS NULL THEN RAISE EXCEPTION 'meal:deviation-required'; END IF;
  IF _students_present IS NOT NULL AND nullif(btrim(_students_source),'') IS NULL THEN RAISE EXCEPTION 'meal:students-source-required'; END IF;
  IF _breakdown IS NOT NULL AND jsonb_typeof(_breakdown) <> 'array' THEN RAISE EXCEPTION 'meal:breakdown-invalid'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(coalesce(_breakdown,'[]'::jsonb)) LOOP
    IF NOT public.meal_master_homologated((l->>'categoria_ref')::uuid, 'categoria-de-refeicao', _on) THEN RAISE EXCEPTION 'meal:category-not-homologated'; END IF;
    IF (l->>'quantidade')::integer < 0 THEN RAISE EXCEPTION 'meal:breakdown-negative'; END IF;
    bsum := bsum + (l->>'quantidade')::integer;
  END LOOP;
  IF jsonb_array_length(coalesce(_breakdown,'[]'::jsonb)) > 0 AND (_meals_total IS NULL OR bsum <> _meals_total) THEN
    RAISE EXCEPTION 'meal:breakdown-total-mismatch';
  END IF;
  lid := coalesce(base.logical_id, gen_random_uuid());
  INSERT INTO public.meal_daily_executions(logical_id, version, supersedes_id, event_kind, school_id, executed_on, meal_slot_value_id,
    planned_menu_ref, followed, executed_preparation, deviation, deviation_reason, deviation_authorization_ref, meals_total, count_basis,
    meals_breakdown, students_present, students_present_source, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(base.version,0)+1, base.id, _kind, _school, _on, _slot, _planned_menu, _followed,
    nullif(btrim(_preparation),''), nullif(btrim(_deviation),''), nullif(btrim(_deviation_reason),''), _authorization,
    _meals_total, nullif(btrim(_count_basis),''), coalesce(_breakdown,'[]'::jsonb), _students_present, nullif(btrim(_students_source),''),
    nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r;
  FOR l IN SELECT * FROM jsonb_array_elements(coalesce(_consumption,'[]'::jsonb)) LOOP
    IF nullif(l->>'line_key','') IS NULL THEN RAISE EXCEPTION 'meal:consumption-line-key-required'; END IF;
    mv := public.record_meal_stock_movement(NULL, 'registro', _school, 'consumo-observado', l->>'item', l->>'unit',
      (l->>'quantity')::numeric, NULL, _on, _tz, l->>'lot', NULL, NULL, NULL, NULL, NULL, NULL,
      'execucao:' || lid::text, NULL);
    INSERT INTO public.meal_execution_consumptions(execution_logical_id, line_key, movement_id) VALUES (lid, l->>'line_key', mv);
  END LOOP;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_execution(uuid,text,text,date,text,uuid,boolean,text,text,text,uuid,integer,text,jsonb,integer,text,jsonb,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_execution(uuid,text,text,date,text,uuid,boolean,text,text,text,uuid,integer,text,jsonb,integer,text,jsonb,text,text) TO authenticated;

CREATE FUNCTION public.meal_executions_at(_school text, _from date, _to date, _known_at timestamptz)
RETURNS SETOF public.meal_daily_executions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT e.* FROM public.meal_daily_executions e
   WHERE e.school_id = _school AND e.recorded_at <= k AND e.executed_on BETWEEN _from AND _to
     AND NOT EXISTS (SELECT 1 FROM public.meal_daily_executions s WHERE s.supersedes_id = e.id AND s.recorded_at <= k)
   ORDER BY e.executed_on, e.meal_slot_value_id LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_executions_at(text,date,date,timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_executions_at(text,date,date,timestamptz) TO authenticated;

CREATE TABLE public.meal_operational_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_operational_records(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  model_ref uuid NOT NULL,
  recorded_on date NOT NULL,
  meal_slot_value_id text,
  field_values jsonb NOT NULL,
  signed_by_person_id uuid NOT NULL,
  reason text,
  author_user_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
GRANT SELECT ON public.meal_operational_records TO service_role;
ALTER TABLE public.meal_operational_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_operational_records_append_only BEFORE UPDATE OR DELETE ON public.meal_operational_records
  FOR EACH ROW EXECUTE FUNCTION public.aa_ledger_append_only();

CREATE FUNCTION public.record_meal_operational_record(_base_id uuid, _kind text, _school text, _model uuid, _on date,
  _slot text, _values jsonb, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.meal_operational_records; r uuid;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_operational_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_operational_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    _school := base.school_id; _model := base.model_ref; _on := base.recorded_on; _slot := base.meal_slot_value_id;
    IF _kind = 'revogacao' THEN _values := base.field_values; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  END IF;
  g := public.meal_grant_on('registrar-execucao-alimentacao', _school, _on);
  IF NOT public.meal_master_homologated(_model, 'modelo-operacional', _on) THEN RAISE EXCEPTION 'meal:model-not-homologated'; END IF;
  IF _values IS NULL OR jsonb_typeof(_values) <> 'object' THEN RAISE EXCEPTION 'meal:values-invalid'; END IF;
  INSERT INTO public.meal_operational_records(logical_id, version, supersedes_id, event_kind, school_id, model_ref, recorded_on,
    meal_slot_value_id, field_values, signed_by_person_id, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _model, _on,
    nullif(btrim(_slot),''), _values, me, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_operational_record(uuid,text,text,uuid,date,text,jsonb,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_operational_record(uuid,text,text,uuid,date,text,jsonb,text) TO authenticated;

CREATE FUNCTION public.meal_operational_records_at(_school text, _from date, _to date, _known_at timestamptz)
RETURNS SETOF public.meal_operational_records
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT o.* FROM public.meal_operational_records o
   WHERE o.school_id = _school AND o.recorded_at <= k AND o.recorded_on BETWEEN _from AND _to
     AND NOT EXISTS (SELECT 1 FROM public.meal_operational_records s WHERE s.supersedes_id = o.id AND s.recorded_at <= k)
   ORDER BY o.recorded_on LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_operational_records_at(text,date,date,timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_operational_records_at(text,date,date,timestamptz) TO authenticated;
