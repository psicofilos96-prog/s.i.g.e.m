CREATE TABLE public.permanence_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  returned_on date NOT NULL,
  episode_id text NOT NULL,           -- enturmação oficial vigente (class_enrollment_episodes), só referência
  enrollment_id text NOT NULL,        -- matrícula do episódio, congelada
  class_id text NOT NULL,
  welcome_note text CHECK (welcome_note IS NULL OR length(btrim(welcome_note)) >= 10),
  welcome_by uuid,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((welcome_note IS NULL) = (welcome_by IS NULL))
);
CREATE INDEX permanence_returns_case_idx ON public.permanence_returns(case_id, returned_on);
GRANT SELECT ON public.permanence_returns TO authenticated;
GRANT ALL ON public.permanence_returns TO service_role;
ALTER TABLE public.permanence_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns by school" ON public.permanence_returns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('acompanhar-permanencia', c.school_id)));
CREATE TRIGGER pret_immutable BEFORE UPDATE OR DELETE ON public.permanence_returns FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Só registra o fato do retorno/acolhimento; NÃO grava presença, matrícula, enturmação nem resultado.
CREATE OR REPLACE FUNCTION public.record_permanence_return(_case uuid, _returned_on date, _episode text, _welcome_note text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _e public.class_enrollment_episodes; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permreturn:no-person'; END IF;
  SELECT id INTO _id FROM public.permanence_returns WHERE idempotency_key = _key AND case_id = _case;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('registrar-retorno-escolar', _c.school_id) THEN RAISE EXCEPTION 'permreturn:unavailable'; END IF;
  IF _returned_on > current_date OR _returned_on < _c.opened_at::date THEN RAISE EXCEPTION 'permreturn:invalid-date'; END IF;
  SELECT * INTO _e FROM public.class_enrollment_episodes WHERE id = _episode;
  IF _e.id IS NULL OR _e.student_id <> _c.student_id OR _e.school_id <> _c.school_id OR _e.valid_from > _returned_on
     OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = _e.id)
     OR EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings en WHERE en.episode_id = _e.id AND en.ended_on < _returned_on) THEN
    RAISE EXCEPTION 'permreturn:no-official-allocation'; END IF;
  INSERT INTO public.permanence_returns(case_id, returned_on, episode_id, enrollment_id, class_id, welcome_note, welcome_by, author_person, idempotency_key)
  VALUES (_case, _returned_on, _e.id, _e.enrollment_id, _e.class_id, nullif(btrim(_welcome_note),''), CASE WHEN nullif(btrim(_welcome_note),'') IS NULL THEN NULL ELSE _p END, _p, _key)
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permreturn:invalid';
END $$;
REVOKE ALL ON FUNCTION public.record_permanence_return(uuid,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_permanence_return(uuid,date,text,text,text) TO authenticated;