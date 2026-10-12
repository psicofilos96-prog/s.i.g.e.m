-- L38: vínculos funcionais da folha (matrícula = chave do VÍNCULO, nunca da pessoa).
-- Staging append-only gravado só pela camada técnica (service_role); ligação a pessoa é ledger separado e humano.
CREATE OR REPLACE FUNCTION public.normalize_functional_registration(_r text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(regexp_replace(coalesce(_r,''), '[^0-9]', '', 'g'), '')
$$;

CREATE TABLE IF NOT EXISTS public.payroll_functional_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file text NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  sheet text NOT NULL,
  row_no integer NOT NULL CHECK (row_no > 0),
  reference_period text NOT NULL,
  registration_raw text NOT NULL,
  registration_norm text NOT NULL,
  full_name text NOT NULL,
  birth_date date,
  admission_date date,
  monthly_hours integer,
  weekly_workload_text text,
  cargo_code text,
  cargo_label text,
  qpmec_number text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by text NOT NULL DEFAULT 'execucao-tecnica-lote38',
  CONSTRAINT pfr_norm_matches CHECK (registration_norm = public.normalize_functional_registration(registration_raw)),
  CONSTRAINT pfr_qpmec_not_registration CHECK (qpmec_number IS NULL OR public.normalize_functional_registration(qpmec_number) IS DISTINCT FROM registration_norm),
  UNIQUE (source_sha256, sheet, row_no),
  UNIQUE (source_sha256, registration_norm)
);
COMMENT ON TABLE public.payroll_functional_registrations IS 'L38: vínculo funcional da folha com proveniência; matrícula identifica o vínculo, não a pessoa; não concede acesso.';

GRANT SELECT ON public.payroll_functional_registrations TO authenticated;
GRANT ALL ON public.payroll_functional_registrations TO service_role;
ALTER TABLE public.payroll_functional_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pfr leitura funcional da rede" ON public.payroll_functional_registrations;
CREATE POLICY "pfr leitura funcional da rede" ON public.payroll_functional_registrations FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('consultar-registro-funcional'))
      OR (SELECT public.has_network_capability('consultar-quadro-profissional-da-rede')));
CREATE INDEX IF NOT EXISTS pfr_norm_idx ON public.payroll_functional_registrations (registration_norm);

CREATE OR REPLACE FUNCTION public.pfr_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'payroll_functional_registrations é append-only'; END $$;
DROP TRIGGER IF EXISTS pfr_no_update ON public.payroll_functional_registrations;
CREATE TRIGGER pfr_no_update BEFORE UPDATE OR DELETE ON public.payroll_functional_registrations
  FOR EACH ROW EXECUTE FUNCTION public.pfr_append_only();
DROP TRIGGER IF EXISTS pfr_no_truncate ON public.payroll_functional_registrations;
CREATE TRIGGER pfr_no_truncate BEFORE TRUNCATE ON public.payroll_functional_registrations
  FOR EACH STATEMENT EXECUTE FUNCTION public.pfr_append_only();

-- Ligação vínculo→pessoa: decisão humana, append-only, revogável por novo evento.
CREATE TABLE IF NOT EXISTS public.payroll_registration_person_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_norm text NOT NULL,
  seq integer NOT NULL CHECK (seq > 0),
  action text NOT NULL CHECK (action IN ('vincular','revogar')),
  person_id uuid REFERENCES public.institutional_persons(id),
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10),
  decided_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  decided_by_user_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_norm, seq),
  CHECK ((action = 'vincular') = (person_id IS NOT NULL))
);
GRANT SELECT ON public.payroll_registration_person_links TO authenticated;
GRANT ALL ON public.payroll_registration_person_links TO service_role;
ALTER TABLE public.payroll_registration_person_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prpl leitura funcional da rede" ON public.payroll_registration_person_links;
CREATE POLICY "prpl leitura funcional da rede" ON public.payroll_registration_person_links FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('consultar-registro-funcional')));
DROP TRIGGER IF EXISTS prpl_no_update ON public.payroll_registration_person_links;
CREATE TRIGGER prpl_no_update BEFORE UPDATE OR DELETE ON public.payroll_registration_person_links
  FOR EACH ROW EXECUTE FUNCTION public.pfr_append_only();

CREATE OR REPLACE FUNCTION public.record_payroll_person_link(
  _registration_norm text, _expected_seq integer, _action text, _person_id uuid, _evidence text, _idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _actor uuid := public.current_person_id(); _last public.payroll_registration_person_links; _prev uuid;
BEGIN
  IF auth.uid() IS NULL OR _actor IS NULL THEN RAISE EXCEPTION 'sem-sessao'; END IF;
  IF NOT public.has_network_capability('manter-registro-funcional') THEN RAISE EXCEPTION 'capability:manter-registro-funcional'; END IF;
  IF EXISTS (SELECT 1 FROM public.payroll_registration_person_links WHERE idempotency_key = _idempotency_key) THEN
    RETURN jsonb_build_object('status','ja-registrado'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll_functional_registrations WHERE registration_norm = _registration_norm) THEN
    RAISE EXCEPTION 'vinculo-inexistente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('prpl:' || _registration_norm));
  SELECT * INTO _last FROM public.payroll_registration_person_links WHERE registration_norm = _registration_norm ORDER BY seq DESC LIMIT 1;
  IF coalesce(_last.seq, 0) <> _expected_seq THEN RAISE EXCEPTION 'base-desatualizada'; END IF;
  IF _action = 'vincular' THEN
    IF _last.action = 'vincular' THEN RAISE EXCEPTION 'ja-vinculado: revogue antes'; END IF;
    IF _person_id = _actor THEN RAISE EXCEPTION 'autovinculacao-recusada'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons WHERE id = _person_id) THEN RAISE EXCEPTION 'pessoa-inexistente'; END IF;
  ELSIF _action = 'revogar' THEN
    IF _last.action IS DISTINCT FROM 'vincular' THEN RAISE EXCEPTION 'nada-a-revogar'; END IF;
    _person_id := NULL;
  ELSE RAISE EXCEPTION 'acao-invalida'; END IF;
  INSERT INTO public.payroll_registration_person_links(registration_norm, seq, action, person_id, evidence, decided_by_person_id, decided_by_user_id, idempotency_key)
  VALUES (_registration_norm, coalesce(_last.seq,0)+1, _action, _person_id, _evidence, _actor, auth.uid(), _idempotency_key);
  RETURN jsonb_build_object('status','registrado','seq',coalesce(_last.seq,0)+1);
END $$;
REVOKE ALL ON FUNCTION public.record_payroll_person_link(text,integer,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payroll_person_link(text,integer,text,uuid,text,text) TO authenticated;

-- Reconciliação determinística por matrícula (INVOKER: só o que a sessão já lê).
CREATE OR REPLACE VIEW public.payroll_staff_registration_matches WITH (security_invoker = true) AS
SELECT s.id AS staff_record_id, s.source_kind, p.id AS payroll_registration_id, p.registration_norm,
       (p.id IS NOT NULL) AS registration_found
FROM public.staff_administrative_records s
LEFT JOIN public.payroll_functional_registrations p
  ON p.registration_norm = public.normalize_functional_registration(s.registration)
WHERE s.registration IS NOT NULL;
GRANT SELECT ON public.payroll_staff_registration_matches TO authenticated;