-- LOTE 9: teto explicado calculado e congelado no banco + amostras de alimentos (etiquetas).
ALTER TABLE public.meal_order_versions ADD COLUMN IF NOT EXISTS ceiling_evaluation jsonb;
COMMENT ON COLUMN public.meal_order_versions.ceiling_evaluation IS 'LOTE 9: avaliação do teto por linha congelada no ato (per capita homologado, público/dias declarados, estoque do ledger).';

CREATE OR REPLACE FUNCTION public.meal_master_head(_logical uuid)
RETURNS public.meal_master_records LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT r.* FROM public.meal_master_records r WHERE r.logical_id = _logical ORDER BY r.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.meal_order_ceiling_evaluation(_school text, _lines jsonb, _on date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE l jsonb; i int := 0; res jsonb := '[]'::jsonb; missing text[]; pc_id uuid; pc_ver int; pc_q numeric; npc int; pub numeric; days numeric;
  stock numeric; unk bigint; nrows bigint; itm public.meal_master_records; unt public.meal_master_records; gross numeric; net numeric; req numeric; exc boolean;
BEGIN
  IF jsonb_typeof(_lines) <> 'array' THEN RETURN '[]'::jsonb; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    i := i + 1; missing := ARRAY[]::text[]; pc_id := NULL; pc_ver := NULL; pc_q := NULL; stock := NULL; gross := NULL; net := NULL; exc := NULL;
    req := CASE WHEN jsonb_typeof(l->'quantidade') = 'number' THEN (l->>'quantidade')::numeric END;
    SELECT count(*), min(h.logical_id::text)::uuid, min(h.version), min((h.payload->>'quantidade')::numeric) INTO npc, pc_id, pc_ver, pc_q
      FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r WHERE r.kind = 'parametro-per-capita' ORDER BY r.logical_id, r.version DESC) h
      WHERE h.status = 'homologada' AND h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on)
        AND h.payload->>'item_ref' = l->>'item_ref' AND h.payload->>'unidade_ref' = l->>'unidade_ref'
        AND h.payload->>'publico_ref' IS NOT DISTINCT FROM l->>'publico_ref';
    IF npc = 0 THEN missing := missing || 'per capita homologado ausente para item/unidade/público'::text; pc_id := NULL;
    ELSIF npc > 1 THEN missing := missing || 'per capita ambíguo (mais de um homologado)'::text; pc_id := NULL; pc_q := NULL;
    END IF;
    pub := CASE WHEN jsonb_typeof(l->'publico_atendido') = 'number' AND (l->>'publico_atendido')::numeric >= 0 THEN (l->>'publico_atendido')::numeric END;
    IF pub IS NULL THEN missing := missing || 'público atendido não declarado'::text; END IF;
    days := CASE WHEN jsonb_typeof(l->'dias_letivos') = 'number' AND (l->>'dias_letivos')::numeric >= 0 THEN (l->>'dias_letivos')::numeric END;
    IF days IS NULL THEN missing := missing || 'dias letivos da competência não declarados'::text; END IF;
    itm := public.meal_master_head(nullif(l->>'item_ref','')::uuid);
    unt := public.meal_master_head(nullif(l->>'unidade_ref','')::uuid);
    IF itm.payload->>'item_estoque_value_id' IS NULL OR unt.payload->>'unidade_estoque_value_id' IS NULL THEN
      missing := missing || 'item/unidade sem vínculo com o estoque'::text;
    ELSE
      BEGIN
        SELECT sum(s.balance), coalesce(sum(s.unknown_sign),0), count(*) INTO stock, unk, nrows FROM public.meal_stock_lines(_school, _on, now()) s
          WHERE s.item_value_id = itm.payload->>'item_estoque_value_id' AND s.unit_value_id = unt.payload->>'unidade_estoque_value_id';
        IF nrows = 0 THEN stock := NULL; missing := missing || 'estoque sem registro no livro (desconhecido, não zero)'::text;
        ELSIF unk > 0 OR stock IS NULL THEN stock := NULL; missing := missing || 'estoque com movimento de sinal desconhecido'::text;
        END IF;
      EXCEPTION WHEN others THEN
        stock := NULL; missing := missing || 'estoque não legível com a permissão atual'::text;
      END;
    END IF;
    IF coalesce(array_length(missing,1),0) = 0 THEN
      gross := pc_q * pub * days; net := greatest(0, gross - stock);
      IF req IS NOT NULL THEN exc := req > net; END IF;
    END IF;
    res := res || jsonb_build_array(jsonb_build_object(
      'linha', i, 'item_ref', l->>'item_ref', 'unidade_ref', l->>'unidade_ref', 'publico_ref', l->>'publico_ref', 'solicitado', req,
      'estado', CASE WHEN coalesce(array_length(missing,1),0) = 0 THEN 'calculado' ELSE 'pendente' END, 'faltas', to_jsonb(missing),
      'per_capita_registro', pc_id, 'per_capita_versao', pc_ver, 'per_capita', pc_q,
      'publico_atendido', pub, 'publico_base', l->>'publico_base', 'dias_letivos', days, 'dias_base', l->>'dias_base', 'estoque', stock,
      'bruto', gross, 'teto', net, 'excede', exc, 'justificativa_excesso', nullif(btrim(coalesce(l->>'justificativa_excesso','')),''),
      'formula', 'per capita × público atendido × dias letivos − estoque do livro'));
  END LOOP;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.meal_order_ceiling_evaluation(text, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_order_ceiling_evaluation(text, jsonb, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.meal_order_ceiling_ack_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE ack text; ev jsonb := '[]'::jsonb; on_d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NEW.status IN ('submetido','autorizado-total','autorizado-parcial','retificado') THEN
    ev := public.meal_order_ceiling_evaluation(NEW.school_id, NEW.lines, on_d);
    NEW.ceiling_evaluation := jsonb_build_object('avaliado_em', now(), 'data_referencia', on_d, 'linhas', ev);
  ELSE
    NEW.ceiling_evaluation := NULL;
  END IF;
  IF NEW.status IN ('autorizado-total','autorizado-parcial','retificado') THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(ev) x WHERE (x->>'excede')::boolean IS TRUE AND length(coalesce(x->>'justificativa_excesso','')) < 10) THEN
      RAISE EXCEPTION 'meal:ceiling-exceeded';
    END IF;
    ack := nullif(btrim(coalesce(current_setting('sigem.meal_ceiling_ack', true),'')), '');
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(ev) x WHERE x->>'estado' = 'pendente') AND (ack IS NULL OR length(ack) < 10) THEN
      RAISE EXCEPTION 'meal:ceiling-ack-required';
    END IF;
    NEW.ceiling_ack := ack;
  ELSE
    NEW.ceiling_ack := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.meal_food_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  supersedes_id uuid UNIQUE REFERENCES public.meal_food_samples(id),
  event text NOT NULL CHECK (event IN ('coleta','descarte','retificacao')),
  school_id text NOT NULL,
  collected_on date NOT NULL,
  meal_slot text NOT NULL CHECK (btrim(meal_slot) <> ''),
  preparation text NOT NULL CHECK (btrim(preparation) <> ''),
  sample_code text NOT NULL,
  retention_hours integer CHECK (retention_hours IS NULL OR retention_hours > 0),
  storage_temp numeric,
  note text,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
GRANT ALL ON public.meal_food_samples TO service_role;
ALTER TABLE public.meal_food_samples ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_meal_food_sample(_logical uuid, _expected_version integer, _event text, _school text, _on date,
  _slot text, _preparation text, _retention_hours integer, _temp numeric, _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid; g uuid; head public.meal_food_samples; lid uuid; code text;
BEGIN
  me := public.institutional_actor_person();
  IF _event NOT IN ('coleta','descarte','retificacao') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _event <> 'coleta' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    IF _school IS NULL OR _on IS NULL OR nullif(btrim(coalesce(_slot,'')),'') IS NULL OR nullif(btrim(coalesce(_preparation,'')),'') IS NULL THEN RAISE EXCEPTION 'meal:sample-fields-required'; END IF;
    lid := gen_random_uuid(); code := 'AM-' || upper(substr(replace(lid::text,'-',''), 1, 10));
  ELSE
    lid := _logical;
    PERFORM pg_advisory_xact_lock(hashtext('meal-sample:' || lid::text));
    SELECT * INTO head FROM public.meal_food_samples WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF head.event = 'descarte' THEN RAISE EXCEPTION 'meal:sample-discarded'; END IF;
    IF _event = 'coleta' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    IF _event = 'retificacao' AND nullif(btrim(coalesce(_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    code := head.sample_code; _school := head.school_id;
    IF _event = 'descarte' THEN _on := head.collected_on; _slot := head.meal_slot; _preparation := head.preparation; _retention_hours := head.retention_hours; _temp := head.storage_temp; END IF;
  END IF;
  g := public.meal_grant_on('registrar-execucao-alimentacao', _school, coalesce(_on, head.collected_on));
  INSERT INTO public.meal_food_samples(logical_id, version, supersedes_id, event, school_id, collected_on, meal_slot, preparation, sample_code, retention_hours, storage_temp, note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, _event, _school, coalesce(_on, head.collected_on), btrim(coalesce(_slot, head.meal_slot)), btrim(coalesce(_preparation, head.preparation)), code,
    coalesce(_retention_hours, head.retention_hours), coalesce(_temp, head.storage_temp), nullif(btrim(coalesce(_note,'')),''), nullif(btrim(coalesce(_reason,'')),''), auth.uid(), me, g);
  RETURN lid;
END $$;
REVOKE ALL ON FUNCTION public.record_meal_food_sample(uuid,integer,text,text,date,text,text,integer,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_meal_food_sample(uuid,integer,text,text,date,text,text,integer,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.meal_food_samples_at(_school text, _from date, _to date)
RETURNS TABLE(logical_id uuid, version integer, event text, collected_on date, meal_slot text, preparation text, sample_code text, retention_hours integer, storage_temp numeric, note text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.meal_grant_on('registrar-execucao-alimentacao', _school, _to);
  RETURN QUERY SELECT DISTINCT ON (s.logical_id) s.logical_id, s.version, s.event, s.collected_on, s.meal_slot, s.preparation, s.sample_code, s.retention_hours, s.storage_temp, s.note, s.recorded_at
    FROM public.meal_food_samples s WHERE s.school_id = _school AND s.collected_on BETWEEN _from AND _to ORDER BY s.logical_id, s.version DESC;
END $$;
REVOKE ALL ON FUNCTION public.meal_food_samples_at(text,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_food_samples_at(text,date,date) TO authenticated;