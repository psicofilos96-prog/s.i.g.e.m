CREATE TABLE public.ei_followup_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version int NOT NULL, supersedes_id uuid REFERENCES public.ei_followup_versions(id),
  school_id text NOT NULL, class_id text NOT NULL, student_id text NOT NULL,
  modality text NOT NULL CHECK (modality IN ('regular','aee','tec','outra')),
  field_key text NOT NULL CHECK (field_key IN ('eu-outro-nos','corpo-gestos','tracos-sons','escuta-fala','espacos-tempos')),
  objective_code text, observed_on date NOT NULL,
  observation text NOT NULL CHECK (length(btrim(observation)) >= 10),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  adaptation_note text, family_visible boolean NOT NULL DEFAULT false,
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE TABLE public.ei_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL, class_id text NOT NULL, student_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('devolutiva-familia','devolutiva-equipe','encaminhamento-sipe')),
  text_body text NOT NULL CHECK (length(btrim(text_body)) >= 10), sipe_ref text,
  family_visible boolean NOT NULL DEFAULT false,
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ei_followup_versions, public.ei_feedback_events TO authenticated;
GRANT ALL ON public.ei_followup_versions, public.ei_feedback_events TO service_role;
ALTER TABLE public.ei_followup_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ei_feedback_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ei_fu_read ON public.ei_followup_versions FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-educacao-infantil') OR public.has_school_capability('acompanhar-educacao-infantil', school_id)
  OR public.has_school_capability('registrar-acompanhamento-ei', school_id));
CREATE POLICY ei_fb_read ON public.ei_feedback_events FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-educacao-infantil') OR public.has_school_capability('acompanhar-educacao-infantil', school_id)
  OR public.has_school_capability('registrar-acompanhamento-ei', school_id));
CREATE FUNCTION public.ei_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'educacao-infantil:append-only'; END $$;
CREATE TRIGGER ei_fu_ro BEFORE UPDATE OR DELETE ON public.ei_followup_versions FOR EACH ROW EXECUTE FUNCTION public.ei_append_only();
CREATE TRIGGER ei_fb_ro BEFORE UPDATE OR DELETE ON public.ei_feedback_events FOR EACH ROW EXECUTE FUNCTION public.ei_append_only();

CREATE FUNCTION public.ei_text_forbidden(_t text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(_t,'') ~* '(reprova|retid|retenç|retenc|promovid|promoç|promoc|\mnota\M|\mcid\M|laudo|diagnóstic)' $$;

CREATE FUNCTION public.ei_record_followup(_logical uuid, _expected_version int, _school text, _class text, _student text, _modality text,
  _field text, _objective text, _observed date, _observation text, _evidence jsonb, _adaptation text, _family_visible boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lid uuid := coalesce(_logical, gen_random_uuid()); b public.ei_followup_versions; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacao-infantil:unauthenticated'; END IF;
  IF NOT public.has_school_capability('registrar-acompanhamento-ei', _school) THEN RAISE EXCEPTION 'educacao-infantil:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.school_id = _school AND e.class_id = _class AND e.student_id = _student) THEN RAISE EXCEPTION 'educacao-infantil:enrollment-not-found'; END IF;
  IF public.ei_text_forbidden(_observation) OR public.ei_text_forbidden(_adaptation) THEN RAISE EXCEPTION 'educacao-infantil:forbidden-content'; END IF;
  IF _modality <> 'aee' AND nullif(btrim(coalesce(_adaptation,'')),'') IS NOT NULL AND _modality = 'regular' AND false THEN NULL; END IF;
  SELECT * INTO b FROM public.ei_followup_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'educacao-infantil:stale-base'; END IF;
  IF b.id IS NOT NULL AND length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'educacao-infantil:reason-required'; END IF;
  IF b.id IS NOT NULL AND (b.student_id <> _student OR b.school_id <> _school) THEN RAISE EXCEPTION 'educacao-infantil:subject-change'; END IF;
  INSERT INTO public.ei_followup_versions(logical_id, version, supersedes_id, school_id, class_id, student_id, modality, field_key, objective_code, observed_on,
    observation, evidence, adaptation_note, family_visible, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, _school, _class, _student, _modality, _field, nullif(btrim(coalesce(_objective,'')),''), _observed,
    btrim(_observation), coalesce(_evidence,'[]'::jsonb), nullif(btrim(coalesce(_adaptation,'')),''), coalesce(_family_visible,false), nullif(btrim(coalesce(_reason,'')),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.ei_record_feedback(_school text, _class text, _student text, _kind text, _text text, _sipe text, _family_visible boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacao-infantil:unauthenticated'; END IF;
  IF NOT public.has_school_capability('registrar-acompanhamento-ei', _school) THEN RAISE EXCEPTION 'educacao-infantil:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.school_id = _school AND e.class_id = _class AND e.student_id = _student) THEN RAISE EXCEPTION 'educacao-infantil:enrollment-not-found'; END IF;
  IF public.ei_text_forbidden(_text) THEN RAISE EXCEPTION 'educacao-infantil:forbidden-content'; END IF;
  IF _kind = 'encaminhamento-sipe' AND length(btrim(coalesce(_sipe,''))) = 0 THEN RAISE EXCEPTION 'educacao-infantil:sipe-ref-required'; END IF;
  IF _kind = 'devolutiva-familia' AND NOT coalesce(_family_visible,false) THEN RAISE EXCEPTION 'educacao-infantil:family-feedback-must-be-visible'; END IF;
  INSERT INTO public.ei_feedback_events(school_id, class_id, student_id, kind, text_body, sipe_ref, family_visible, author_user_id)
  VALUES (_school, _class, _student, _kind, btrim(_text), nullif(btrim(coalesce(_sipe,'')),''), coalesce(_family_visible,false), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

-- Família: só o que foi marcado como visível, com autorização vigente que inclua a seção 'avaliacao'; sem adaptação nem evidências.
CREATE FUNCTION public.ei_family_view(_student text)
RETURNS TABLE(kind text, field_key text, observed_on date, text_body text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.guardian_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  a := public.family_authorization(_student);
  IF a.id IS NULL OR NOT ('avaliacao' = ANY (a.sections)) THEN RETURN; END IF;
  RETURN QUERY
    SELECT 'observacao'::text, v.field_key, v.observed_on, v.observation, v.recorded_at
    FROM (SELECT DISTINCT ON (logical_id) * FROM public.ei_followup_versions WHERE student_id = _student ORDER BY logical_id, version DESC) v
    WHERE v.family_visible
    UNION ALL
    SELECT f.kind, NULL::text, f.recorded_at::date, f.text_body, f.recorded_at FROM public.ei_feedback_events f WHERE f.student_id = _student AND f.family_visible;
END $$;
REVOKE ALL ON FUNCTION public.ei_record_followup(uuid,int,text,text,text,text,text,text,date,text,jsonb,text,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ei_record_feedback(text,text,text,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ei_family_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ei_record_followup(uuid,int,text,text,text,text,text,text,date,text,jsonb,text,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ei_record_feedback(text,text,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ei_family_view(text) TO authenticated;