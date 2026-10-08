-- NFAM.1: a família vê só a carteirinha EMITIDA do educando autorizado (seção 'matricula'); allowlist de campos, sem ids técnicos de escola/ator.
CREATE OR REPLACE FUNCTION public.family_student_cards(_student text)
RETURNS TABLE(public_id text, version integer, status text, academic_year text, valid_until date, student_name text, school_name text, class_label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.guardian_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  a := public.family_authorization(_student);
  IF a.id IS NULL OR NOT ('matricula' = ANY (a.sections)) THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN QUERY
  SELECT h.public_id, h.version,
         CASE WHEN h.valid_until < CURRENT_DATE THEN 'expirada' ELSE 'valida' END,
         h.academic_year, h.valid_until, h.student_name, h.school_name, h.class_label
    FROM (SELECT DISTINCT ON (c.public_id) c.* FROM public.student_card_issuances c
           WHERE c.student_id = _student ORDER BY c.public_id, c.version DESC) h
   WHERE h.kind <> 'cancelamento'
   ORDER BY h.academic_year DESC, h.recorded_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.family_student_cards(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.family_student_cards(text) TO authenticated;