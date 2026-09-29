CREATE TABLE public.assessment_norm_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_kind text NOT NULL CHECK (norm_kind IN ('regra-avaliativa','configuracao-avaliativa')),
  logical_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.assessment_norm_versions(id),
  academic_year_id text NOT NULL,
  stage_ids text[] NOT NULL DEFAULT '{}',
  class_ids text[] NOT NULL DEFAULT '{}',
  valid_from date,
  valid_until date,
  definition jsonb NOT NULL,
  homologation_act_ref text NOT NULL CHECK (length(btrim(homologation_act_ref)) > 0),
  recorded_by_person_id uuid NOT NULL,
  recorded_by_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (norm_kind, logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  CHECK ((version = 1) = (supersedes_id IS NULL))
);
GRANT SELECT ON public.assessment_norm_versions TO authenticated;
GRANT ALL ON public.assessment_norm_versions TO service_role;
ALTER TABLE public.assessment_norm_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pessoas institucionais leem normas homologadas"
  ON public.assessment_norm_versions FOR SELECT TO authenticated
  USING (public.current_person_id() IS NOT NULL);
CREATE TRIGGER assessment_norm_versions_append_only
  BEFORE UPDATE OR DELETE ON public.assessment_norm_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.register_assessment_norm_version(
  _norm_kind text, _logical_id text, _expected_supersedes_id uuid,
  _academic_year_id text, _stage_ids text[], _class_ids text[],
  _valid_from date, _valid_until date, _definition jsonb, _homologation_act_ref text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _person uuid := public.current_person_id(); _last record; _id uuid;
BEGIN
  IF auth.uid() IS NULL OR _person IS NULL OR NOT public.has_network_capability('registrar-norma-homologada') THEN
    RAISE EXCEPTION 'norm-unauthorized';
  END IF;
  IF _definition IS NULL OR jsonb_typeof(_definition) <> 'object' THEN RAISE EXCEPTION 'norm-invalid-definition'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_norm_kind || ':' || _logical_id));
  SELECT id, version INTO _last FROM public.assessment_norm_versions
    WHERE norm_kind = _norm_kind AND logical_id = _logical_id ORDER BY version DESC LIMIT 1;
  IF (_last.id IS DISTINCT FROM _expected_supersedes_id) THEN RAISE EXCEPTION 'norm-stale-base'; END IF;
  INSERT INTO public.assessment_norm_versions(norm_kind, logical_id, version, supersedes_id, academic_year_id,
    stage_ids, class_ids, valid_from, valid_until, definition, homologation_act_ref, recorded_by_person_id, recorded_by_user_id)
  VALUES (_norm_kind, _logical_id, COALESCE(_last.version, 0) + 1, _last.id, _academic_year_id,
    COALESCE(_stage_ids,'{}'), COALESCE(_class_ids,'{}'), _valid_from, _valid_until, _definition,
    _homologation_act_ref, _person, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.register_assessment_norm_version(text,text,uuid,text,text[],text[],date,date,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_assessment_norm_version(text,text,uuid,text,text[],text[],date,date,jsonb,text) TO authenticated;