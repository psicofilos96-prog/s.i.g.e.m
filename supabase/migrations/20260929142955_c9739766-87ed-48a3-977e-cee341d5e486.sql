CREATE TABLE public.attendance_occurrence_types (
  id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  code text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  requires_document boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'homologada' CHECK (status IN ('homologada','arquivada')),
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  valid_from date NOT NULL,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
GRANT SELECT ON public.attendance_occurrence_types TO authenticated;
GRANT ALL ON public.attendance_occurrence_types TO service_role;
ALTER TABLE public.attendance_occurrence_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Homologated occurrence types are readable" ON public.attendance_occurrence_types
  FOR SELECT TO authenticated USING (status = 'homologada');
CREATE TRIGGER attendance_occurrence_types_immutable BEFORE UPDATE OR DELETE ON public.attendance_occurrence_types
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.student_attendance_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.student_attendance_occurrences(id),
  student_id text NOT NULL,
  class_id text NOT NULL,
  occurrence_type_id text NOT NULL,
  occurrence_type_version integer NOT NULL,
  from_date date NOT NULL,
  until_date date NOT NULL,
  document_ref text,
  note text,
  annulled boolean NOT NULL DEFAULT false,
  justification text,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid,
  authorizing_engagement_id uuid NOT NULL,
  capability_policy_id uuid NOT NULL,
  capability_policy_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  FOREIGN KEY (occurrence_type_id, occurrence_type_version) REFERENCES public.attendance_occurrence_types(id, version),
  CHECK (until_date >= from_date)
);
GRANT SELECT ON public.student_attendance_occurrences TO authenticated;
GRANT ALL ON public.student_attendance_occurrences TO service_role;
ALTER TABLE public.student_attendance_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read occurrences within attendance capability scope" ON public.student_attendance_occurrences
  FOR SELECT TO authenticated USING (
    public.has_capability('registrar-ocorrencia-no-prontuario', class_id, NULL)
    OR public.has_capability('consultar-frequencia', class_id, NULL)
    OR public.has_capability('registrar-frequencia', class_id, NULL)
    OR public.has_capability('realizar-conferencia-de-frequencia', class_id, NULL));
CREATE TRIGGER student_attendance_occurrences_immutable BEFORE UPDATE OR DELETE ON public.student_attendance_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.record_attendance_occurrence(
  _class text, _student text, _type_id text, _type_version integer, _from date, _until date,
  _document_ref text, _note text, _expected_version_id uuid, _annul boolean, _justification text, _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _cap record; _type record; _prev record; _existing uuid; _new uuid; _logical uuid; _ver int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  SELECT * INTO _cap FROM public.capability_grant('registrar-ocorrencia-no-prontuario', _class);
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_attendance_occurrences WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.student_attendance_occurrences WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.class_id = _class AND e.student_id = _student) THEN RAISE EXCEPTION 'student-not-in-class'; END IF;
  SELECT * INTO _type FROM public.attendance_occurrence_types WHERE id = _type_id AND version = _type_version AND status = 'homologada'
    AND valid_from <= _from AND (valid_until IS NULL OR valid_until >= _until);
  IF NOT FOUND THEN RAISE EXCEPTION 'occurrence-type-not-homologated'; END IF;
  IF _until < _from THEN RAISE EXCEPTION 'invalid-interval'; END IF;
  IF _type.requires_document AND NOT coalesce(_annul,false) AND coalesce(btrim(_document_ref),'') = '' THEN RAISE EXCEPTION 'document-required'; END IF;
  IF _expected_version_id IS NULL THEN
    IF coalesce(_annul,false) THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
    _logical := gen_random_uuid(); _ver := 1;
  ELSE
    SELECT * INTO _prev FROM public.student_attendance_occurrences WHERE id = _expected_version_id FOR UPDATE;
    IF NOT FOUND OR _prev.class_id <> _class OR _prev.student_id <> _student THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('attendance-occurrence:' || _prev.logical_id));
    IF EXISTS (SELECT 1 FROM public.student_attendance_occurrences WHERE supersedes_id = _prev.id) THEN RAISE EXCEPTION 'concurrent-change'; END IF;
    IF _prev.annulled THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
    IF coalesce(btrim(_justification),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    _logical := _prev.logical_id; _ver := _prev.version + 1;
  END IF;
  INSERT INTO public.student_attendance_occurrences (logical_id, version, supersedes_id, student_id, class_id, occurrence_type_id,
    occurrence_type_version, from_date, until_date, document_ref, note, annulled, justification, plan_id, author_user_id,
    author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_logical, _ver, _expected_version_id, _student, _class, _type_id, _type_version, _from, _until,
    NULLIF(btrim(coalesce(_document_ref,'')),''), NULLIF(btrim(coalesce(_note,'')),''), coalesce(_annul,false),
    NULLIF(btrim(coalesce(_justification,'')),''), _plan_id, auth.uid(), public.current_person_id(),
    _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.record_attendance_occurrence(text,text,text,integer,date,date,text,text,uuid,boolean,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_attendance_occurrence(text,text,text,integer,date,date,text,text,uuid,boolean,text,text) TO authenticated;