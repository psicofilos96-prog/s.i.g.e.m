-- 0266 NIMPORT.STANDARD.1: adoção auditável das cargas técnicas 2026 no pipeline padrão de importações.
-- Não cria fato de domínio: só registra proveniência (hash, arquivo, parser, lote lógico, contagens, chave) das operações técnicas já executadas.
CREATE TABLE public.import_technical_adoptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technical_operation_id uuid NOT NULL UNIQUE REFERENCES public.technical_execution_operations(id),
  adapter_id text NOT NULL CHECK (adapter_id ~ '^[a-z0-9][a-z0-9.-]{1,79}$'),
  adapter_version integer NOT NULL DEFAULT 1 CHECK (adapter_version >= 1),
  parser_ref text NOT NULL,
  source_name text NOT NULL CHECK (length(btrim(source_name)) > 0),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  logical_batch_key text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  target_counts jsonb NOT NULL CHECK (jsonb_typeof(target_counts) = 'object'),
  reported_result jsonb NOT NULL CHECK (jsonb_typeof(reported_result) = 'object'),
  executed_at timestamptz NOT NULL,
  adoption_basis text NOT NULL,
  adopted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE public.import_technical_adoptions IS 'NIMPORT.STANDARD.1: "adopted existing technical import" — proveniência de cargas técnicas já aplicadas; nunca fato novo; append-only.';
REVOKE ALL ON public.import_technical_adoptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.import_technical_adoptions TO service_role;
ALTER TABLE public.import_technical_adoptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ita_append_only BEFORE DELETE OR UPDATE ON public.import_technical_adoptions
  FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE INDEX import_technical_adoptions_sha ON public.import_technical_adoptions(source_sha256);

INSERT INTO public.import_technical_adoptions(technical_operation_id, adapter_id, parser_ref, source_name, source_sha256,
  logical_batch_key, idempotency_key, target_counts, reported_result, executed_at, adoption_basis)
SELECT o.id,
  replace(replace(o.operation_kind, 'technical_', 'tecnica-'), '_', '-'),
  o.operation_kind,
  o.source_ref,
  o.source_hash,
  'lote:' || o.source_hash,
  replace(replace(o.operation_kind, 'technical_', 'tecnica-'), '_', '-') || '@1:' || o.source_hash || ':adocao',
  coalesce((SELECT jsonb_object_agg(t.target_table, t.n) FROM (
     SELECT target_table, count(*) AS n FROM public.technical_execution_targets WHERE operation_id = o.id GROUP BY target_table) t), '{}'::jsonb),
  o.result,
  o.completed_at,
  'Carga técnica já aplicada por decisão do proprietário; adotada como proveniência, sem reaplicar nem criar fato.'
FROM public.technical_execution_operations o
WHERE o.operation_kind ~ '^technical_(import|correct|convert)_'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.import_technical_adoptions_list()
RETURNS TABLE(id uuid, adapter_id text, adapter_version integer, parser_ref text, source_name text, source_sha256 text,
  logical_batch_key text, idempotency_key text, target_counts jsonb, reported_result jsonb, executed_at timestamptz, adopted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.import_grant();
  RETURN QUERY SELECT a.id, a.adapter_id, a.adapter_version, a.parser_ref, a.source_name, a.source_sha256, a.logical_batch_key,
    a.idempotency_key, a.target_counts, a.reported_result, a.executed_at, a.adopted_at
  FROM public.import_technical_adoptions a ORDER BY a.executed_at, a.parser_ref;
END $$;
REVOKE ALL ON FUNCTION public.import_technical_adoptions_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_technical_adoptions_list() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.import_source_recognition(_source_sha256 text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.import_grant();
  RETURN jsonb_build_object(
    'adoptions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'parser_ref', a.parser_ref, 'source_name', a.source_name,
        'target_counts', a.target_counts, 'executed_at', a.executed_at, 'idempotency_key', a.idempotency_key) ORDER BY a.executed_at)
      FROM public.import_technical_adoptions a WHERE a.source_sha256 = _source_sha256), '[]'::jsonb),
    'batches', coalesce((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'adapter_id', b.adapter_id, 'row_count', b.row_count, 'received_at', b.received_at))
      FROM public.import_batches b WHERE b.source_sha256 = _source_sha256), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.import_source_recognition(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_source_recognition(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.stage_import_batch(_adapter_id text, _adapter_version integer, _source_name text, _source_sha256 text, _rows jsonb, _reprocesses_id uuid, _source_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; existing uuid; new_id uuid; r jsonb; staged text; adopted jsonb;
BEGIN
  g := public.import_grant();
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'import:rows-required'; END IF;
  IF jsonb_array_length(_rows) > 20000 THEN RAISE EXCEPTION 'import:too-many-rows'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('imp:' || _adapter_id || ':' || coalesce(_source_sha256,'')));
  SELECT jsonb_agg(a.id ORDER BY a.executed_at) INTO adopted FROM public.import_technical_adoptions a WHERE a.source_sha256 = _source_sha256;
  IF adopted IS NOT NULL THEN
    RETURN jsonb_build_object('id', NULL, 'already_staged', false, 'adopted_technical_import', true, 'adoption_ids', adopted, 'dry_run_only', true);
  END IF;
  IF _reprocesses_id IS NULL THEN
    SELECT id INTO existing FROM public.import_batches
     WHERE adapter_id = _adapter_id AND adapter_version = _adapter_version AND source_sha256 = _source_sha256 AND reprocesses_id IS NULL;
    IF existing IS NOT NULL THEN RETURN jsonb_build_object('id', existing, 'already_staged', true); END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.import_batches WHERE id = _reprocesses_id AND adapter_id = _adapter_id) THEN
    RAISE EXCEPTION 'import:batch-not-found';
  END IF;
  staged := encode(sha256(convert_to(_rows::text, 'UTF8')), 'hex');
  INSERT INTO public.import_batches(adapter_id, adapter_version, source_name, source_sha256, staged_sha256, row_count,
    reprocesses_id, source_ref, operator, operator_person, operator_engagement)
  VALUES (_adapter_id, _adapter_version, btrim(_source_name), _source_sha256, staged, jsonb_array_length(_rows),
    _reprocesses_id, nullif(btrim(_source_ref), ''), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO new_id;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.import_batch_rows(batch_id, line_ref, raw, normalized, identity_key, outcome, reasons)
    VALUES (new_id, r ->> 'line_ref', coalesce(r -> 'raw', '{}'::jsonb), r -> 'normalized', r ->> 'identity_key',
      r ->> 'outcome', coalesce(ARRAY(SELECT jsonb_array_elements_text(r -> 'reasons')), '{}'));
  END LOOP;
  RETURN jsonb_build_object('id', new_id, 'already_staged', false, 'staged_sha256', staged);
END $function$;