-- Apenas rótulos para inscrições já visíveis da escola.
-- INEP do estudante é 'inep-pessoa' no vínculo pessoa ↔ estudante, não o UUID técnico.
-- Leitura em lotes para evitar URLs grandes. Nenhuma mutação de matrícula ou de identidade.
CREATE OR REPLACE FUNCTION public.secretariat_student_labels(
  _school text,
  _student_ids text[]
)
RETURNS TABLE(student_id text, display_name text, census_inep text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'session-required';
  END IF;
  IF _school IS NULL OR btrim(_school) = '' OR _student_ids IS NULL THEN
    RAISE EXCEPTION 'secretariat:scope-required';
  END IF;
  IF coalesce(cardinality(_student_ids), 0) > 100 THEN
    RAISE EXCEPTION 'secretariat:too-many-students';
  END IF;
  IF NOT (
    public.has_school_capability('consultar-matricula-e-movimentacao', _school)
    OR public.has_school_capability('manter-matricula-e-enturmacao', _school)
    OR public.has_school_capability('registrar-movimentacao-escolar', _school)
  ) THEN
    RAISE EXCEPTION 'capability:consultar-matricula-e-movimentacao';
  END IF;

  RETURN QUERY
  SELECT s.id, NULLIF(btrim(s.display_name), ''),
    (SELECT CASE WHEN count(DISTINCT pi.value) = 1 THEN min(pi.value) ELSE NULL END
       FROM public.institutional_student_persons sp
       JOIN public.institutional_person_identifiers pi ON pi.person_id = sp.person_id
       WHERE sp.student_id = s.id AND pi.identifier_kind = 'inep-pessoa')
  FROM public.institutional_students s
  WHERE s.id = ANY(_student_ids)
    AND EXISTS (
      SELECT 1 FROM public.school_enrollments e
      WHERE e.student_id = s.id AND e.school_id = _school
    )
  ORDER BY s.id;
END $fn$;

REVOKE ALL ON FUNCTION public.secretariat_student_labels(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_student_labels(text, text[]) TO authenticated;
