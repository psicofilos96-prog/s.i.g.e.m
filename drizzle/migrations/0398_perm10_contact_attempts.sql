CREATE TABLE public.permanence_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  authorization_logical_id uuid NOT NULL,
  authorization_version int NOT NULL,
  channel text NOT NULL CHECK (channel IN ('presencial','telefone','mensagem','carta','visita','outro-autorizado')),
  attempted_on date NOT NULL,
  professional_person uuid NOT NULL,
  result text NOT NULL CHECK (result IN ('contato-realizado','sem-resposta','canal-indisponivel','recusa-de-contato','retorno-agendado')),
  providence text,
  next_follow_up date,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_follow_up IS NULL OR next_follow_up >= attempted_on),
  CHECK (providence IS NULL OR length(btrim(providence)) >= 3)
);
CREATE INDEX permanence_contact_attempts_case_idx ON public.permanence_contact_attempts(case_id, attempted_on);
GRANT SELECT ON public.permanence_contact_attempts TO authenticated;
GRANT ALL ON public.permanence_contact_attempts TO service_role;
ALTER TABLE public.permanence_contact_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact attempts by school" ON public.permanence_contact_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('ler-contatos-do-caso', c.school_id)));
CREATE TRIGGER pca_immutable BEFORE UPDATE OR DELETE ON public.permanence_contact_attempts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_permanence_contact_attempt(_case uuid, _authorization uuid, _channel text, _attempted_on date, _result text, _providence text, _next date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _head public.guardian_authorizations; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permcontact:no-person'; END IF;
  SELECT id INTO _id FROM public.permanence_contact_attempts WHERE idempotency_key = _key AND case_id = _case;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('registrar-contatos-do-caso', _c.school_id) THEN RAISE EXCEPTION 'permcontact:unavailable'; END IF;
  IF _attempted_on > current_date THEN RAISE EXCEPTION 'permcontact:future-attempt'; END IF;
  -- vínculo canônico: cabeça da autorização do responsável, vigente na data, do mesmo estudante, sem revogação nem vedação de contato
  SELECT * INTO _head FROM public.guardian_authorizations WHERE logical_id = _authorization ORDER BY version DESC LIMIT 1;
  IF _head.id IS NULL OR _head.student_id <> _c.student_id OR _head.event_kind = 'revogacao'
     OR _head.valid_from > _attempted_on OR (_head.valid_until IS NOT NULL AND _head.valid_until < _attempted_on)
     OR NOT ('comunicados' = ANY(_head.sections))
     OR EXISTS (SELECT 1 FROM public.guardian_link_qualifications q WHERE q.authorization_id = _head.id AND 'contato-vedado' = ANY(q.restrictions)) THEN
    RAISE EXCEPTION 'permcontact:link-not-authorized'; END IF;
  INSERT INTO public.permanence_contact_attempts(case_id, authorization_logical_id, authorization_version, channel, attempted_on, professional_person, result, providence, next_follow_up, idempotency_key)
  VALUES (_case, _authorization, _head.version, _channel, _attempted_on, _p, _result, nullif(btrim(_providence),''), _next, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permcontact:invalid';
          WHEN unique_violation THEN RAISE EXCEPTION 'permcontact:key-conflict';
END $$;
REVOKE ALL ON FUNCTION public.record_permanence_contact_attempt(uuid,uuid,text,date,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_permanence_contact_attempt(uuid,uuid,text,date,text,text,date,text) TO authenticated;