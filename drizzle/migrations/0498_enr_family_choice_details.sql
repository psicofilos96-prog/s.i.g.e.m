-- Matrículas L07.2: preferência por escola × turno × oferta (só valores declarados na política aprovada), gravada junto ao pedido.
CREATE TABLE IF NOT EXISTS public.enr_application_choices (
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  rank int NOT NULL CHECK (rank BETWEEN 1 AND 10),
  school_key text NOT NULL,
  shift_id text,
  offer_id text,
  policy_version int NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, rank),
  UNIQUE (application_id, school_key)
);
GRANT SELECT ON public.enr_application_choices TO authenticated;
GRANT ALL ON public.enr_application_choices TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_application_choices FROM authenticated, anon;
ALTER TABLE public.enr_application_choices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enr application choices read" ON public.enr_application_choices;
CREATE POLICY "enr application choices read" ON public.enr_application_choices FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-identificacao-de-ingresso') OR public.has_network_capability('reconciliar-estudante-de-ingresso'));
DROP TRIGGER IF EXISTS enr_application_choices_append_only ON public.enr_application_choices;
CREATE TRIGGER enr_application_choices_append_only BEFORE UPDATE OR DELETE ON public.enr_application_choices FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Envio com escolhas detalhadas: valida turno/oferta contra a política vigente e delega ao writer v1 (mesmas regras, mesma idempotência).
CREATE OR REPLACE FUNCTION public.enr_submit_application_v2(_campaign uuid, _requester_kind text, _requester_name text, _requester_cpf text,
  _email text, _phone text, _kinship text, _student_name text, _student_birth date, _student_cpf text, _stage text, _modality text,
  _choices jsonb, _documents_ack boolean, _truth boolean, _key text)
RETURNS TABLE(result text, application_code text, check_code text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _pol public.enr_preference_policies; _schools text[]; _r record; _app uuid; _c jsonb; _i int := 0;
BEGIN
  IF _choices IS NULL OR jsonb_typeof(_choices) <> 'array' OR jsonb_array_length(_choices) < 1 OR jsonb_array_length(_choices) > 10 THEN
    RETURN QUERY SELECT 'fora-da-campanha'::text, NULL::text, NULL::text; RETURN; END IF;
  _pol := public.enr_preference_policy_current(_campaign);
  IF _pol.id IS NULL THEN RETURN QUERY SELECT 'campanha-fechada'::text, NULL::text, NULL::text; RETURN; END IF;
  FOR _c IN SELECT value FROM jsonb_array_elements(_choices) LOOP
    IF jsonb_typeof(_c) <> 'object' OR coalesce(_c->>'school','') = ''
       OR (_c ? 'shift' AND jsonb_typeof(_c->'shift') <> 'null' AND NOT ((_c->>'shift') = ANY(_pol.shift_ids)))
       OR (_c ? 'offer' AND jsonb_typeof(_c->'offer') <> 'null' AND NOT ((_c->>'offer') = ANY(_pol.offer_ids))) THEN
      RETURN QUERY SELECT 'fora-da-campanha'::text, NULL::text, NULL::text; RETURN; END IF;
    _schools := coalesce(_schools, '{}') || (_c->>'school');
  END LOOP;
  SELECT * INTO _r FROM public.enr_submit_application(_campaign, _requester_kind, _requester_name, _requester_cpf, _email, _phone, _kinship,
    _student_name, _student_birth, _student_cpf, _stage, _modality, _schools, _documents_ack, _truth, _key);
  IF _r.result = 'recebido' THEN
    SELECT a.id INTO _app FROM public.enr_applications a WHERE a.idempotency_key = _key;
    FOR _c IN SELECT value FROM jsonb_array_elements(_choices) LOOP
      _i := _i + 1;
      INSERT INTO public.enr_application_choices(application_id, rank, school_key, shift_id, offer_id, policy_version)
      VALUES (_app, _i, _c->>'school', nullif(_c->>'shift',''), nullif(_c->>'offer',''), _pol.version);
    END LOOP;
  END IF;
  RETURN QUERY SELECT _r.result, _r.application_code, _r.check_code;
END $$;
REVOKE EXECUTE ON FUNCTION public.enr_submit_application_v2(uuid,text,text,text,text,text,text,text,date,text,text,text,jsonb,boolean,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enr_submit_application_v2(uuid,text,text,text,text,text,text,text,date,text,text,text,jsonb,boolean,boolean,text) TO anon, authenticated;