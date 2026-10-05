-- Interoperabilidade: staging isolado de importações. Dado recebido ≠ dado reconciliado ≠ fato canônico.
-- Nada aqui escreve domínio: aplicação só pelos writers canônicos, com a capability própria de cada um.
-- Capability 'gerir-importacao-de-dados' sem regra de política: falha fechada até decisão do proprietário.

CREATE FUNCTION public.import_grant() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'gerir-importacao-de-dados' AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:gerir-importacao-de-dados'; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.import_grant() FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id text NOT NULL CHECK (adapter_id ~ '^[a-z0-9][a-z0-9.-]{1,79}$'),
  adapter_version integer NOT NULL CHECK (adapter_version >= 1),
  source_name text NOT NULL CHECK (length(btrim(source_name)) > 0),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  staged_sha256 text NOT NULL,
  row_count integer NOT NULL,
  reprocesses_id uuid REFERENCES public.import_batches(id),
  source_ref text,
  operator uuid NOT NULL,
  operator_person text,
  operator_engagement uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
-- Mesmo arquivo + mesmo adaptador = mesmo lote (reprocessamento cria lote novo explícito).
CREATE UNIQUE INDEX import_batches_same_source ON public.import_batches (adapter_id, adapter_version, source_sha256) WHERE reprocesses_id IS NULL;

CREATE TABLE public.import_batch_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id),
  line_ref text NOT NULL,
  raw jsonb NOT NULL,
  normalized jsonb,
  identity_key text,
  outcome text NOT NULL CHECK (outcome IN ('valida','rejeitada','duplicada-na-fonte','conflito','ja-reconciliada')),
  reasons text[] NOT NULL DEFAULT '{}',
  UNIQUE (batch_id, line_ref),
  CHECK (outcome = 'valida' OR outcome = 'ja-reconciliada' OR cardinality(reasons) > 0)
);

CREATE TABLE public.import_batch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id),
  row_id uuid REFERENCES public.import_batch_rows(id),
  kind text NOT NULL CHECK (kind IN ('confirmacao','aplicada','falhou','compensacao','descartado')),
  canonical_ref text,
  detail text,
  actor uuid NOT NULL,
  actor_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'aplicada' OR canonical_ref IS NOT NULL),
  CHECK (kind NOT IN ('falhou','compensacao','descartado') OR length(btrim(coalesce(detail,''))) > 0)
);
-- Idempotência de aplicação: uma linha nunca é aplicada duas vezes.
CREATE UNIQUE INDEX import_row_applied_once ON public.import_batch_events (row_id) WHERE kind = 'aplicada';
CREATE UNIQUE INDEX import_row_compensated_once ON public.import_batch_events (row_id) WHERE kind = 'compensacao';

REVOKE ALL ON public.import_batches, public.import_batch_rows, public.import_batch_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.import_batches, public.import_batch_rows, public.import_batch_events TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batch_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batch_events ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.import_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'import:append-only'; END $$;
CREATE TRIGGER ib_append_only BEFORE UPDATE OR DELETE ON public.import_batches FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER ibr_append_only BEFORE UPDATE OR DELETE ON public.import_batch_rows FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER ibe_append_only BEFORE UPDATE OR DELETE ON public.import_batch_events FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- Staging: grava o lote e as linhas já classificadas pelo adaptador, numa transação. Não toca domínio.
CREATE FUNCTION public.stage_import_batch(_adapter_id text, _adapter_version int, _source_name text, _source_sha256 text,
  _rows jsonb, _reprocesses_id uuid, _source_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; existing uuid; new_id uuid; r jsonb; staged text;
BEGIN
  g := public.import_grant();
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'import:rows-required'; END IF;
  IF jsonb_array_length(_rows) > 20000 THEN RAISE EXCEPTION 'import:too-many-rows'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('imp:' || _adapter_id || ':' || coalesce(_source_sha256,'')));
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
END $fn$;
REVOKE ALL ON FUNCTION public.stage_import_batch(text, int, text, text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_import_batch(text, int, text, text, jsonb, uuid, text) TO authenticated;

-- Evento do lote. 'aplicada' exige linha válida, confirmação prévia e referência canônica devolvida pelo writer.
CREATE FUNCTION public.record_import_event(_batch_id uuid, _row_id uuid, _kind text, _canonical_ref text, _detail text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; rw record; new_id uuid;
BEGIN
  g := public.import_grant();
  IF NOT EXISTS (SELECT 1 FROM public.import_batches WHERE id = _batch_id) THEN RAISE EXCEPTION 'import:batch-not-found'; END IF;
  IF _kind NOT IN ('confirmacao','aplicada','falhou','compensacao','descartado') THEN RAISE EXCEPTION 'import:kind-invalid'; END IF;
  IF _kind IN ('aplicada','falhou','compensacao') THEN
    SELECT * INTO rw FROM public.import_batch_rows WHERE id = _row_id AND batch_id = _batch_id;
    IF rw.id IS NULL THEN RAISE EXCEPTION 'import:row-not-found'; END IF;
    IF rw.outcome <> 'valida' THEN RAISE EXCEPTION 'import:row-not-applicable'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.import_batch_events WHERE batch_id = _batch_id AND kind = 'confirmacao') THEN
      RAISE EXCEPTION 'import:confirmation-required'; END IF;
    IF _kind = 'compensacao' AND NOT EXISTS (SELECT 1 FROM public.import_batch_events WHERE row_id = _row_id AND kind = 'aplicada') THEN
      RAISE EXCEPTION 'import:nothing-to-compensate'; END IF;
    IF _kind = 'aplicada' AND EXISTS (SELECT 1 FROM public.import_batch_events WHERE row_id = _row_id AND kind = 'aplicada') THEN
      RAISE EXCEPTION 'import:row-already-applied'; END IF;
  ELSIF _row_id IS NOT NULL THEN RAISE EXCEPTION 'import:row-not-allowed';
  END IF;
  INSERT INTO public.import_batch_events(batch_id, row_id, kind, canonical_ref, detail, actor, actor_engagement)
  VALUES (_batch_id, _row_id, _kind, nullif(btrim(_canonical_ref), ''), nullif(btrim(_detail), ''), auth.uid(), g)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id);
END $fn$;
REVOKE ALL ON FUNCTION public.record_import_event(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_import_event(uuid, uuid, text, text, text) TO authenticated;

CREATE FUNCTION public.import_batches_list()
RETURNS TABLE(id uuid, adapter_id text, adapter_version int, source_name text, source_sha256 text, staged_sha256 text,
  row_count int, reprocesses_id uuid, source_ref text, operator_person text, received_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.import_grant();
  RETURN QUERY SELECT b.id, b.adapter_id, b.adapter_version, b.source_name, b.source_sha256, b.staged_sha256, b.row_count,
    b.reprocesses_id, b.source_ref, b.operator_person, b.received_at FROM public.import_batches b ORDER BY b.received_at DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.import_batches_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_batches_list() TO authenticated;

CREATE FUNCTION public.import_batch_detail(_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.import_grant();
  RETURN jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.line_ref) FROM public.import_batch_rows r WHERE r.batch_id = _batch_id), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'row_id', e.row_id, 'kind', e.kind, 'canonical_ref', e.canonical_ref,
       'detail', e.detail, 'recorded_at', e.recorded_at) ORDER BY e.recorded_at) FROM public.import_batch_events e WHERE e.batch_id = _batch_id), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.import_batch_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_batch_detail(uuid) TO authenticated;