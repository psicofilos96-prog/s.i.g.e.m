CREATE TABLE public.student_registration_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  source_file text NOT NULL, source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_sheet text NOT NULL, source_row int NOT NULL,
  matched_by text NOT NULL CHECK (matched_by = 'inep-pessoa-exato'),
  executor_label text NOT NULL,
  civil_name text, birth_date date, sex_literal text, race_literal text, nee_literal text,
  father_name text, mother_name text, birthplace text, birthplace_uf text, nationality text,
  guardian_name text, guardian_occupation text, phones text[] NOT NULL DEFAULT '{}',
  enrollment_status_literal text, class_literal text, grade_literal text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_sha256, source_sheet, source_row));
COMMENT ON TABLE public.student_registration_observations IS 'Observação cadastral importada (fonte: planilha da escola). Não é a identidade canônica; leitura só por student_registration_observations_for.';
CREATE INDEX sro_student ON public.student_registration_observations(student_id);

GRANT ALL ON public.student_registration_observations TO service_role;
ALTER TABLE public.student_registration_observations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sro_append_only BEFORE UPDATE OR DELETE ON public.student_registration_observations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE FUNCTION public.student_registration_observations_for(_student text)
RETURNS TABLE (source_file text, source_sheet text, source_row int, recorded_at timestamptz, civil_name text, birth_date date, sex_literal text,
  race_literal text, nee_literal text, father_name text, mother_name text, birthplace text, birthplace_uf text, nationality text,
  guardian_name text, guardian_occupation text, phones text[], enrollment_status_literal text, class_literal text, grade_literal text, sensitive_visible boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE ok boolean; sens boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT public.has_network_capability('consultar-identidade-cadastral-do-estudante') OR EXISTS (
    SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND public.has_school_capability('consultar-identidade-cadastral-do-estudante', e.school_id::text)) INTO ok;
  IF NOT ok THEN RETURN; END IF;
  SELECT public.has_network_capability('consultar-dado-sensivel-do-estudante') OR EXISTS (
    SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND public.has_school_capability('consultar-dado-sensivel-do-estudante', e.school_id::text)) INTO sens;
  RETURN QUERY SELECT o.source_file, o.source_sheet, o.source_row, o.recorded_at, o.civil_name, o.birth_date, o.sex_literal,
    CASE WHEN sens THEN o.race_literal END, CASE WHEN sens THEN o.nee_literal END,
    o.father_name, o.mother_name, o.birthplace, o.birthplace_uf, o.nationality, o.guardian_name, o.guardian_occupation, o.phones,
    o.enrollment_status_literal, o.class_literal, o.grade_literal, sens
  FROM public.student_registration_observations o WHERE o.student_id = _student ORDER BY o.recorded_at DESC, o.source_file;
END $$;
REVOKE ALL ON FUNCTION public.student_registration_observations_for(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_registration_observations_for(text) TO authenticated;