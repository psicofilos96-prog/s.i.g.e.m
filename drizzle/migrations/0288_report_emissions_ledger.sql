CREATE TABLE public.report_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code text NOT NULL UNIQUE CHECK (verification_code ~ '^[0-9A-F]{20}$'),
  report_id text NOT NULL CHECK (length(report_id) BETWEEN 1 AND 120),
  report_version integer NOT NULL CHECK (report_version > 0),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  format text NOT NULL CHECK (format IN ('pdf','xlsx','csv')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL CHECK (row_count >= 0),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  reissue_of uuid REFERENCES public.report_emissions(id),
  actor_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  issued_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.report_emissions IS 'Trilha append-only de emissões de relatório; dados relidos com a sessão de quem gera; sem conteúdo nem PII armazenados.';
GRANT SELECT ON public.report_emissions TO authenticated;
GRANT ALL ON public.report_emissions TO service_role;
ALTER TABLE public.report_emissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emissoes: so as proprias" ON public.report_emissions FOR SELECT TO authenticated USING (actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.report_emissions_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'REPORT_EMISSION_IMMUTABLE'; END $$;
CREATE TRIGGER report_emissions_no_update BEFORE UPDATE OR DELETE ON public.report_emissions
  FOR EACH ROW EXECUTE FUNCTION public.report_emissions_immutable();

CREATE OR REPLACE FUNCTION public.record_report_emission(
  _report_id text, _report_version integer, _title text, _format text, _params jsonb,
  _row_count integer, _content_sha256 text, _reissue_of uuid, _idempotency_key text)
RETURNS TABLE(emission_id uuid, verification_code text, issued_at timestamptz, original_sha256 text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _orig public.report_emissions; _ex public.report_emissions; _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT * INTO _ex FROM public.report_emissions e WHERE e.idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _ex.actor_id <> _uid THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    SELECT o.content_sha256 INTO original_sha256 FROM public.report_emissions o WHERE o.id = _ex.reissue_of;
    emission_id := _ex.id; verification_code := _ex.verification_code; issued_at := _ex.issued_at; RETURN NEXT; RETURN;
  END IF;
  IF _reissue_of IS NOT NULL THEN
    SELECT * INTO _orig FROM public.report_emissions o WHERE o.id = _reissue_of;
    IF NOT FOUND OR _orig.actor_id <> _uid OR _orig.report_id <> _report_id THEN RAISE EXCEPTION 'REISSUE_NOT_ALLOWED'; END IF;
    original_sha256 := _orig.content_sha256;
  END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  INSERT INTO public.report_emissions(verification_code, report_id, report_version, title, format, params, row_count, content_sha256, reissue_of, actor_id, idempotency_key)
  VALUES (_code, _report_id, _report_version, _title, _format, coalesce(_params, '{}'::jsonb), _row_count, _content_sha256, _reissue_of, _uid, _idempotency_key)
  RETURNING id, report_emissions.verification_code, report_emissions.issued_at INTO emission_id, verification_code, issued_at;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.record_report_emission(text,integer,text,text,jsonb,integer,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_report_emission(text,integer,text,text,jsonb,integer,text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_report_emission(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.report_emissions;
BEGIN
  IF _code IS NULL OR upper(_code) !~ '^[0-9A-F]{20}$' THEN RETURN jsonb_build_object('status','nao-encontrado'); END IF;
  SELECT * INTO r FROM public.report_emissions e WHERE e.verification_code = upper(_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('status','nao-encontrado'); END IF;
  RETURN jsonb_build_object('status','emitido','title',r.title,'issued_at',r.issued_at,'format',r.format,
    'row_count',r.row_count,'content_sha256',r.content_sha256,'reissue',r.reissue_of IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.verify_report_emission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_report_emission(text) TO anon, authenticated;