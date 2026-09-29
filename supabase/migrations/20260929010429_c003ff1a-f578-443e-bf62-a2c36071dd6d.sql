CREATE TABLE public.curriculum_objectives (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  official_text text NOT NULL,
  age_group_id text NOT NULL,
  experience_field_id text NOT NULL,
  source_edition text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curriculum_objectives TO authenticated;
GRANT ALL ON public.curriculum_objectives TO service_role;
ALTER TABLE public.curriculum_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read catalog" ON public.curriculum_objectives FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_capability(_capability text, _class text, _period text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id = _capability
      AND (c.class_id IS NULL OR c.class_id = _class)
      AND (_period IS NULL OR c.period_id IS NULL OR c.period_id = _period)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_capability(text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_capability(text, text, text) TO authenticated;

CREATE TABLE public.descriptive_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_report_id text NOT NULL,
  version_number integer NOT NULL,
  supersedes_version_id uuid REFERENCES public.descriptive_report_versions(id),
  student_id text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  report_text text NOT NULL,
  objective_ids text[] NOT NULL DEFAULT '{}',
  correction_reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  officialized_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_report_id, version_number),
  UNIQUE (supersedes_version_id)
);
GRANT SELECT ON public.descriptive_report_versions TO authenticated;
GRANT ALL ON public.descriptive_report_versions TO service_role;
ALTER TABLE public.descriptive_report_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read reports within capability scope" ON public.descriptive_report_versions FOR SELECT TO authenticated
  USING (public.has_capability('oficializar-parecer-descritivo', class_id, period_id)
      OR public.has_capability('consultar-parecer-descritivo', class_id, period_id));

CREATE OR REPLACE FUNCTION public.forbid_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Fato oficial é imutável; correção gera nova versão'; END $$;
CREATE TRIGGER descriptive_report_versions_append_only BEFORE UPDATE OR DELETE ON public.descriptive_report_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.officialize_descriptive_report(
  _student text, _class text, _period text, _base_version_id uuid,
  _text text, _objective_ids text[], _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _logical text := 'parecer:' || _student || '|' || _class || '|' || _period;
  _current record;
  _cap record;
  _new uuid;
  _bad text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = 'oficializar-parecer-descritivo'
     AND (c.class_id IS NULL OR c.class_id = _class)
     AND (c.period_id IS NULL OR c.period_id = _period)
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF coalesce(btrim(_text), '') = '' THEN RAISE EXCEPTION 'empty-text'; END IF;
  SELECT o INTO _bad FROM unnest(coalesce(_objective_ids, '{}')) o
    WHERE NOT EXISTS (SELECT 1 FROM public.curriculum_objectives co WHERE co.id = o) LIMIT 1;
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'objective-not-in-matrix:%', _bad; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_logical));
  SELECT v.* INTO _current FROM public.descriptive_report_versions v
   WHERE v.logical_report_id = _logical
     AND NOT EXISTS (SELECT 1 FROM public.descriptive_report_versions s WHERE s.supersedes_version_id = v.id);
  IF (_current.id IS DISTINCT FROM _base_version_id) THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  IF _current.id IS NOT NULL THEN
    IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
    IF _current.report_text = _text AND
       (SELECT array_agg(x ORDER BY x) FROM unnest(_current.objective_ids) x) IS NOT DISTINCT FROM
       (SELECT array_agg(x ORDER BY x) FROM unnest(coalesce(_objective_ids,'{}')) x)
    THEN RAISE EXCEPTION 'no-change'; END IF;
  END IF;

  INSERT INTO public.descriptive_report_versions (
    logical_report_id, version_number, supersedes_version_id, student_id, class_id, period_id,
    report_text, objective_ids, correction_reason, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_logical, coalesce(_current.version_number, 0) + 1, _current.id, _student, _class, _period,
    _text, coalesce(_objective_ids, '{}'), CASE WHEN _current.id IS NULL THEN NULL ELSE _reason END,
    auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE EXECUTE ON FUNCTION public.officialize_descriptive_report(text, text, text, uuid, text, text[], text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.officialize_descriptive_report(text, text, text, uuid, text, text[], text) TO authenticated;