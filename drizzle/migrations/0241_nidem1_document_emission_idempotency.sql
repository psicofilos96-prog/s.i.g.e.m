-- NIDEM.1: emissão de documento escolar com chave idempotente. Mesma chave + mesmo pedido + mesma conta devolve a
-- MESMA emissão (clique duplo/retry de rede não cria segundo original); mesma chave com pedido diferente é recusada.
CREATE TABLE public.school_document_emission_requests (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 200),
  requested_by uuid NOT NULL,
  request_digest text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.school_document_emission_requests TO service_role;
REVOKE ALL ON public.school_document_emission_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.school_document_emission_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_school_document_emission_requests BEFORE UPDATE OR DELETE ON public.school_document_emission_requests
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.emit_school_document_v3(_idempotency_key text, _template_version_id uuid, _school_id text, _student_id text,
  _valid_on date, _reproduces_id uuid, _retifies_id uuid, _retification_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE d text; r public.school_document_emission_requests%ROWTYPE; res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) NOT BETWEEN 16 AND 200 THEN RAISE EXCEPTION 'idempotency:key-required'; END IF;
  d := encode(sha256(convert_to(concat_ws('|', _template_version_id::text, _school_id, _student_id, _valid_on::text,
    _reproduces_id::text, _retifies_id::text, coalesce(btrim(_retification_reason), '')), 'UTF8')), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sde-idem:' || _idempotency_key, 0));
  SELECT * INTO r FROM public.school_document_emission_requests x WHERE x.idempotency_key = _idempotency_key;
  IF r.idempotency_key IS NOT NULL THEN
    IF r.requested_by <> auth.uid() OR r.request_digest <> d THEN RAISE EXCEPTION 'idempotency:key-reused'; END IF;
    RETURN r.result || jsonb_build_object('replayed', true);
  END IF;
  res := public.emit_school_document_v2(_template_version_id, _school_id, _student_id, _valid_on, _reproduces_id, _retifies_id, _retification_reason);
  INSERT INTO public.school_document_emission_requests(idempotency_key, requested_by, request_digest, result) VALUES (_idempotency_key, auth.uid(), d, res);
  RETURN res || jsonb_build_object('replayed', false);
END $fn$;
REVOKE ALL ON FUNCTION public.emit_school_document_v3(text, uuid, text, text, date, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_school_document_v3(text, uuid, text, text, date, uuid, uuid, text) TO authenticated;