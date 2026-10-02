CREATE TABLE public.assessment_entry_batch_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  instrument_id text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  configuration_id text,
  configuration_version integer,
  version_ids uuid[] NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessment_entry_batch_acts TO authenticated;
GRANT ALL ON public.assessment_entry_batch_acts TO service_role;
ALTER TABLE public.assessment_entry_batch_acts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read acts within capability scope" ON public.assessment_entry_batch_acts FOR SELECT TO authenticated
  USING (public.has_capability('registrar-resultado-avaliativo', class_id, period_id)
      OR public.has_capability('consultar-resultado-avaliativo', class_id, period_id));
CREATE TRIGGER assessment_entry_batch_acts_append_only BEFORE UPDATE OR DELETE ON public.assessment_entry_batch_acts
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.assessment_entry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_entry_id text NOT NULL,
  version_number integer NOT NULL,
  supersedes_version_id uuid UNIQUE REFERENCES public.assessment_entry_versions(id),
  instrument_id text NOT NULL,
  student_id text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  placement jsonb NOT NULL DEFAULT '{}'::jsonb,
  value jsonb NOT NULL,
  value_label text,
  origin text NOT NULL DEFAULT 'diario',
  origin_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  rectification jsonb,
  batch_plan_id text NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_entry_id, version_number)
);
CREATE INDEX assessment_entry_versions_instrument_idx ON public.assessment_entry_versions (instrument_id);
GRANT SELECT ON public.assessment_entry_versions TO authenticated;
GRANT ALL ON public.assessment_entry_versions TO service_role;
ALTER TABLE public.assessment_entry_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read results within capability scope" ON public.assessment_entry_versions FOR SELECT TO authenticated
  USING (public.has_capability('registrar-resultado-avaliativo', class_id, period_id)
      OR public.has_capability('consultar-resultado-avaliativo', class_id, period_id));
CREATE TRIGGER assessment_entry_versions_append_only BEFORE UPDATE OR DELETE ON public.assessment_entry_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Validação estrutural das quatro naturezas; ausência nunca é zero.
CREATE OR REPLACE FUNCTION public.assessment_value_problem(_v jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _v IS NULL OR jsonb_typeof(_v) <> 'object' THEN 'invalid-value'
    WHEN _v->>'kind' = 'numerica' THEN CASE WHEN jsonb_typeof(_v->'value') = 'number' THEN NULL ELSE 'invalid-value' END
    WHEN _v->>'kind' = 'conceitual' THEN CASE WHEN coalesce(btrim(_v->>'optionId'),'') <> '' THEN NULL ELSE 'invalid-value' END
    WHEN _v->>'kind' = 'descritiva' THEN CASE WHEN coalesce(btrim(_v->>'text'),'') <> '' THEN NULL ELSE 'invalid-value' END
    WHEN _v->>'kind' = 'nao-registrado' THEN CASE WHEN coalesce(btrim(_v->>'reason'),'') <> '' THEN NULL ELSE 'missing-reason-required' END
    ELSE 'invalid-value' END
$$;

CREATE OR REPLACE FUNCTION public.register_assessment_results(
  _instrument text, _class text, _period text, _plan_id text,
  _configuration_id text, _configuration_version integer, _operations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cap record; _op jsonb; _current record; _logical text; _student text;
  _problem text; _new uuid; _ids uuid[] := '{}'; _act uuid; _existing uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = 'registrar-resultado-avaliativo'
     AND (c.class_id IS NULL OR c.class_id = _class)
     AND (c.period_id IS NULL OR c.period_id = _period)
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF jsonb_typeof(_operations) <> 'array' OR jsonb_array_length(_operations) = 0 THEN RAISE EXCEPTION 'empty-batch'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pauta:' || _instrument));
  SELECT id INTO _existing FROM public.assessment_entry_batch_acts WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF; -- mesma confirmação: mesmo ato

  FOR _op IN SELECT * FROM jsonb_array_elements(_operations) LOOP
    _student := _op->>'studentId';
    IF coalesce(_student,'') = '' THEN RAISE EXCEPTION 'student-required'; END IF;
    _logical := 'res-' || _instrument || '-' || _student;
    _problem := public.assessment_value_problem(_op->'value');
    IF _problem IS NOT NULL THEN RAISE EXCEPTION '%:%', _problem, _student; END IF;
    SELECT v.* INTO _current FROM public.assessment_entry_versions v
     WHERE v.logical_entry_id = _logical
       AND NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions s WHERE s.supersedes_version_id = v.id);
    IF _current.id IS DISTINCT FROM NULLIF(_op->>'expectedBaseVersionId','')::uuid THEN
      RAISE EXCEPTION 'concurrent-change:%', _student;
    END IF;
    IF _current.id IS NOT NULL THEN
      IF _op->'rectification' IS NULL OR jsonb_typeof(_op->'rectification') <> 'object' THEN
        RAISE EXCEPTION 'rectification-act-required:%', _student;
      END IF;
      IF _current.value = _op->'value' AND _current.origin = coalesce(_op->>'origin','diario') THEN
        RAISE EXCEPTION 'no-change:%', _student;
      END IF;
    END IF;
    INSERT INTO public.assessment_entry_versions (
      logical_entry_id, version_number, supersedes_version_id, instrument_id, student_id, class_id, period_id,
      placement, value, value_label, origin, origin_metadata, rectification, batch_plan_id,
      author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
    VALUES (_logical, coalesce(_current.version_number,0) + 1, _current.id, _instrument, _student, _class, _period,
      coalesce(_op->'placement','{}'::jsonb), _op->'value', NULLIF(_op->>'valueLabel',''),
      coalesce(_op->>'origin','diario'), coalesce(_op->'originMetadata','{}'::jsonb),
      CASE WHEN _current.id IS NULL THEN NULL ELSE _op->'rectification' END, _plan_id,
      auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
    RETURNING id INTO _new;
    _ids := _ids || _new;
  END LOOP;

  INSERT INTO public.assessment_entry_batch_acts (plan_id, instrument_id, class_id, period_id, configuration_id,
    configuration_version, version_ids, author_user_id, author_person_id, authorizing_engagement_id,
    capability_policy_id, capability_policy_version)
  VALUES (_plan_id, _instrument, _class, _period, _configuration_id, _configuration_version, _ids,
    auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _act;
  RETURN _act;
END $$;
REVOKE EXECUTE ON FUNCTION public.register_assessment_results(text,text,text,text,text,integer,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_assessment_results(text,text,text,text,text,integer,jsonb) TO authenticated;