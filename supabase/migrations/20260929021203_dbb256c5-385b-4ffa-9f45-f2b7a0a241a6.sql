CREATE TABLE public.institutional_classes (
  id text PRIMARY KEY,
  school_id text NOT NULL,
  school_label_snapshot text NOT NULL,
  academic_year_id text NOT NULL,
  academic_year_label text NOT NULL,
  stage_id text,
  offer_id text,
  code text,
  name text NOT NULL,
  curriculum_age_group_ids text[] NOT NULL DEFAULT '{}',
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.institutional_curricular_components (
  id text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.institutional_academic_periods (
  id text PRIMARY KEY,
  academic_year_id text NOT NULL,
  label text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
GRANT SELECT ON public.institutional_classes, public.institutional_curricular_components, public.institutional_academic_periods TO authenticated;
GRANT ALL ON public.institutional_classes, public.institutional_curricular_components, public.institutional_academic_periods TO service_role;
ALTER TABLE public.institutional_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_curricular_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_academic_periods ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_institutional_class(_class text, _school text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institutional_engagements e
    WHERE e.person_id = public.current_person_id()
      AND (e.class_id = _class OR (e.class_id IS NULL AND e.school_id = _school))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_institutional_class(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_institutional_class(text, text) TO authenticated;

CREATE POLICY "classes by own engagement" ON public.institutional_classes
  FOR SELECT TO authenticated USING (public.can_read_institutional_class(id, school_id));
CREATE POLICY "components readable when linked" ON public.institutional_curricular_components
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "periods readable when linked" ON public.institutional_academic_periods
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);

CREATE TRIGGER institutional_classes_immutable BEFORE UPDATE OR DELETE ON public.institutional_classes
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_components_immutable BEFORE UPDATE OR DELETE ON public.institutional_curricular_components
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_periods_immutable BEFORE UPDATE OR DELETE ON public.institutional_academic_periods
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();