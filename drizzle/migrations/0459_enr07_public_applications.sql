-- Matrículas L07: pedido de inscrição enviado pelo portal público. Só pela função DEFINER; anon nunca lê tabela.
-- CPF só HMAC (technical_cpf_hmac); escola/etapa/modalidade só da versão publicada; parentesco é declaração; pedido não cria matrícula, pessoa nem vínculo.
CREATE TABLE public.enr_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_code text NOT NULL UNIQUE,
  check_hash text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  campaign_version int NOT NULL,
  requester_kind text NOT NULL CHECK (requester_kind IN ('responsavel','estudante-adulto')),
  requester_name text NOT NULL CHECK (length(btrim(requester_name)) BETWEEN 5 AND 200),
  requester_cpf_hmac text NOT NULL,
  requester_email text CHECK (requester_email IS NULL OR requester_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  requester_phone text CHECK (requester_phone IS NULL OR requester_phone ~ '^[0-9]{10,11}$'),
  declared_kinship text CHECK (declared_kinship IS NULL OR declared_kinship ~* '^[a-zà-ú ]{3,40}$'),
  student_name text NOT NULL CHECK (length(btrim(student_name)) BETWEEN 5 AND 200),
  student_birth_date date NOT NULL,
  student_cpf_hmac text,
  stage_id text NOT NULL,
  modality_id text NOT NULL,
  school_preferences text[] NOT NULL CHECK (cardinality(school_preferences) BETWEEN 1 AND 10),
  documents_acknowledged boolean NOT NULL CHECK (documents_acknowledged),
  truth_declaration boolean NOT NULL CHECK (truth_declaration),
  idempotency_key text NOT NULL UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_email IS NOT NULL OR requester_phone IS NOT NULL),
  CHECK ((requester_kind = 'responsavel') = (declared_kinship IS NOT NULL))
);
COMMENT ON TABLE public.enr_applications IS 'Pedido do portal: não é matrícula, não cria pessoa nem vínculo de responsável; parentesco é só declarado.';
GRANT SELECT ON public.enr_applications TO authenticated;
GRANT ALL ON public.enr_applications TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_applications FROM authenticated, anon;
ALTER TABLE public.enr_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr applications read" ON public.enr_applications FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-identificacao-de-ingresso') OR public.has_network_capability('reconciliar-estudante-de-ingresso'));
CREATE TRIGGER enr_applications_append_only BEFORE UPDATE OR DELETE ON public.enr_applications FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE INDEX enr_applications_requester_idx ON public.enr_applications(campaign_id, requester_cpf_hmac);

-- Retorno: ok + código + conferência (uma única vez) OU motivo de lista fechada, sem revelar dado existente.
CREATE OR REPLACE FUNCTION public.enr_submit_application(_campaign uuid, _requester_kind text, _requester_name text, _requester_cpf text,
  _email text, _phone text, _kinship text, _student_name text, _student_birth date, _student_cpf text, _stage text, _modality text,
  _schools text[], _documents_ack boolean, _truth boolean, _key text)
RETURNS TABLE(result text, application_code text, check_code text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _st text; _v public.enr_campaign_versions; _ver int; _code text; _check text; _rc text; _sc text; _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _key IS NULL OR _key !~ '^[0-9a-f-]{36}$' THEN RETURN QUERY SELECT 'invalido'::text, NULL::text, NULL::text; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_applications a WHERE a.idempotency_key = _key) THEN
    RETURN QUERY SELECT 'ja-recebido'::text, NULL::text, NULL::text; RETURN; END IF;
  _st := public.enr_campaign_state(_campaign);
  SELECT e.on_version INTO _ver FROM public.enr_campaign_events e WHERE e.campaign_id = _campaign AND e.action = 'publicar' ORDER BY e.seq DESC LIMIT 1;
  SELECT * INTO _v FROM public.enr_campaign_versions WHERE campaign_id = _campaign AND version = _ver;
  IF _st <> 'publicada' OR _v.id IS NULL OR _today < _v.period_from OR _today > _v.period_to THEN
    RETURN QUERY SELECT 'campanha-fechada'::text, NULL::text, NULL::text; RETURN; END IF;
  IF NOT (_stage = ANY(_v.stage_ids)) OR NOT (_modality = ANY(_v.modality_ids)) OR _schools IS NULL OR cardinality(_schools) < 1
     OR EXISTS (SELECT 1 FROM unnest(_schools) s WHERE NOT (s = ANY(_v.school_keys)))
     OR (SELECT count(DISTINCT s) FROM unnest(_schools) s) <> cardinality(_schools) THEN
    RETURN QUERY SELECT 'fora-da-campanha'::text, NULL::text, NULL::text; RETURN; END IF;
  IF NOT public.technical_cpf_valid(public.only_digits_or_null(_requester_cpf)) OR (_student_cpf IS NOT NULL AND btrim(_student_cpf) <> '' AND NOT public.technical_cpf_valid(public.only_digits_or_null(_student_cpf)))
     OR _student_birth > _today THEN
    RETURN QUERY SELECT 'invalido'::text, NULL::text, NULL::text; RETURN; END IF;
  _rc := public.technical_cpf_hmac(public.only_digits_or_null(_requester_cpf));
  _sc := CASE WHEN coalesce(btrim(_student_cpf),'') = '' THEN NULL ELSE public.technical_cpf_hmac(public.only_digits_or_null(_student_cpf)) END;
  IF _rc IS NULL THEN RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::text; RETURN; END IF;
  IF (SELECT count(*) FROM public.enr_applications a WHERE a.campaign_id = _campaign AND a.requester_cpf_hmac = _rc) >= 5 THEN
    RETURN QUERY SELECT 'limite'::text, NULL::text, NULL::text; RETURN; END IF;
  _code := 'INS-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  _check := encode(extensions.gen_random_bytes(6), 'hex');
  INSERT INTO public.enr_applications(application_code, check_hash, campaign_id, campaign_version, requester_kind, requester_name, requester_cpf_hmac,
    requester_email, requester_phone, declared_kinship, student_name, student_birth_date, student_cpf_hmac, stage_id, modality_id, school_preferences,
    documents_acknowledged, truth_declaration, idempotency_key)
  VALUES (_code, encode(extensions.digest(_check, 'sha256'), 'hex'), _campaign, _ver, _requester_kind, regexp_replace(btrim(_requester_name), '\s+', ' ', 'g'), _rc,
    nullif(lower(btrim(coalesce(_email,''))),''), nullif(regexp_replace(coalesce(_phone,''), '\D', '', 'g'),''),
    CASE WHEN _requester_kind = 'responsavel' THEN lower(btrim(_kinship)) END,
    regexp_replace(btrim(_student_name), '\s+', ' ', 'g'), _student_birth, _sc, _stage, _modality, _schools, coalesce(_documents_ack,false), coalesce(_truth,false), _key);
  RETURN QUERY SELECT 'recebido'::text, _code, _check;
EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation THEN
  RETURN QUERY SELECT 'invalido'::text, NULL::text, NULL::text;
END $$;

CREATE OR REPLACE FUNCTION public.only_digits_or_null(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(regexp_replace(coalesce(_t,''), '\D', '', 'g'), '')
$$;

-- Consulta do pedido: código + conferência; inexistente e conferência errada respondem igual.
CREATE OR REPLACE FUNCTION public.enr_public_application_status(_code text, _check text)
RETURNS TABLE(status text, submitted_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _r record;
BEGIN
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::date; RETURN; END IF;
  SELECT a.submitted_at, a.check_hash INTO _r FROM public.enr_applications a WHERE a.application_code = btrim(_code);
  IF _r.check_hash IS NULL OR _r.check_hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::date; RETURN; END IF;
  RETURN QUERY SELECT 'recebido'::text, (_r.submitted_at AT TIME ZONE 'America/Sao_Paulo')::date;
END $$;

REVOKE EXECUTE ON FUNCTION public.only_digits_or_null(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enr_submit_application(uuid,text,text,text,text,text,text,text,date,text,text,text,text[],boolean,boolean,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enr_public_application_status(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enr_submit_application(uuid,text,text,text,text,text,text,text,date,text,text,text,text[],boolean,boolean,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_application_status(text,text) TO anon, authenticated;