-- Matrículas L21: atendimento presencial assistido. O atendente (pessoa natural, current_person_id) é registrado como ASSISTENTE,
-- nunca como autor: o requerente continua sendo a família/estudante adulto presente, que declara ciência. Reusa enr_submit_application
-- (mesmas validações da campanha) e enr_protocol_application (register_protocol canônico). Evidências só por hash SHA-256 + tipo de catálogo.
CREATE TABLE public.enr_assisted_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.enr_applications(id),
  attendant_person_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('presencial-secretaria-escolar','presencial-central-de-matriculas','presencial-itinerante')),
  attended_at timestamptz NOT NULL DEFAULT now(),
  attending_school_id text,
  requester_present boolean NOT NULL CHECK (requester_present),
  requester_acknowledged boolean NOT NULL CHECK (requester_acknowledged),
  protocol_number text NOT NULL,
  evidences jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidences) = 'array' AND jsonb_array_length(evidences) <= 20),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.enr_assisted_attendances IS 'Atendimento assistido: atendente é assistente identificado, nunca autor nem representante da família.';
GRANT SELECT ON public.enr_assisted_attendances TO authenticated;
GRANT ALL ON public.enr_assisted_attendances TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_assisted_attendances FROM authenticated, anon, service_role;
ALTER TABLE public.enr_assisted_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr assisted read" ON public.enr_assisted_attendances FOR SELECT TO authenticated
  USING (attendant_person_id = public.current_person_id() OR public.has_network_capability('registrar-identificacao-de-ingresso'));
CREATE TRIGGER enr_assisted_append_only BEFORE UPDATE OR DELETE ON public.enr_assisted_attendances FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_assisted_submit(_channel text, _attending_school text, _requester_present boolean, _requester_ack boolean,
  _evidences jsonb, _campaign uuid, _requester_kind text, _requester_name text, _requester_cpf text, _email text, _phone text, _kinship text,
  _student_name text, _student_birth date, _student_cpf text, _stage text, _modality text, _schools text[], _documents_ack boolean, _truth boolean, _key text)
RETURNS TABLE(result text, application_code text, check_code text, protocol_number text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _prev public.enr_assisted_attendances; _r record; _app uuid; _prot record;
BEGIN
  SELECT * INTO _prev FROM public.enr_assisted_attendances a WHERE a.idempotency_key = _key;
  IF _prev.id IS NOT NULL THEN
    RETURN QUERY SELECT 'ja-recebido'::text, (SELECT x.application_code FROM public.enr_applications x WHERE x.id = _prev.application_id), NULL::text, _prev.protocol_number; RETURN; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('atender-inscricao-presencial')
     AND NOT EXISTS (SELECT 1 FROM public.school_capability_schools('atender-inscricao-presencial') s WHERE s::text = _attending_school) THEN
    RAISE EXCEPTION 'sem-competencia'; END IF;
  IF NOT coalesce(_requester_present,false) OR NOT coalesce(_requester_ack,false) THEN RAISE EXCEPTION 'requerente-ausente'; END IF;
  IF _evidences IS NULL OR jsonb_typeof(_evidences) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(_evidences) e
       WHERE NOT (e ? 'kind' AND e ? 'sha256') OR (e->>'sha256') !~ '^[0-9a-f]{64}$'
          OR (e->>'kind') NOT IN ('documento-identificacao-conferido','comprovante-residencia-conferido','termo-ciencia-assinado','outro-documento-conferido')) THEN
    RAISE EXCEPTION 'evidencia-invalida'; END IF;
  SELECT * INTO _r FROM public.enr_submit_application(_campaign, _requester_kind, _requester_name, _requester_cpf, _email, _phone, _kinship,
    _student_name, _student_birth, _student_cpf, _stage, _modality, _schools, _documents_ack, _truth, _key);
  IF _r.result <> 'recebido' THEN RETURN QUERY SELECT _r.result, NULL::text, NULL::text, NULL::text; RETURN; END IF;
  SELECT a.id INTO _app FROM public.enr_applications a WHERE a.idempotency_key = _key;
  SELECT * INTO _prot FROM public.enr_protocol_application(_app);
  INSERT INTO public.enr_assisted_attendances(application_id, attendant_person_id, channel, attending_school_id, requester_present, requester_acknowledged,
    protocol_number, evidences, idempotency_key)
  VALUES (_app, _p, _channel, nullif(btrim(coalesce(_attending_school,'')),''), true, true, _prot.protocol_number, _evidences, _key);
  RETURN QUERY SELECT 'recebido'::text, _r.application_code, _r.check_code, _prot.protocol_number;
END $$;
REVOKE ALL ON FUNCTION public.enr_assisted_submit(text,text,boolean,boolean,jsonb,uuid,text,text,text,text,text,text,text,date,text,text,text,text[],boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_assisted_submit(text,text,boolean,boolean,jsonb,uuid,text,text,text,text,text,text,text,date,text,text,text,text[],boolean,boolean,text) TO authenticated;