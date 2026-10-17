CREATE OR REPLACE FUNCTION public.secretariat_student_documents_report(_school text)
RETURNS TABLE(student_id text, student_name text, birth_date date, has_cpf boolean, has_certificate boolean, cpf_required boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ids text[]; cut date := public.secretariat_cpf_required_from();
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao',_school) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
 SELECT a.active_ids INTO ids FROM public.active_enrollments_at(_school, current_date) a;
 RETURN QUERY
 WITH st AS (SELECT DISTINCT e.student_id sid FROM public.school_enrollments e WHERE e.id::text = ANY(coalesce(ids,'{}'::text[])) AND e.school_id=_school),
 idv AS (SELECT DISTINCT ON (v.student_id) v.student_id sid, coalesce(nullif(btrim(v.social_name),''), v.civil_name) nm, v.birth_date bd FROM public.student_identity_versions v JOIN st ON st.sid=v.student_id ORDER BY v.student_id, v.version DESC)
 SELECT st.sid, idv.nm, idv.bd,
  EXISTS(SELECT 1 FROM public.institutional_student_persons sp JOIN public.institutional_person_identifiers i ON i.person_id=sp.person_id WHERE sp.student_id=st.sid AND i.identifier_kind='cpf-hmac'),
  EXISTS(SELECT 1 FROM public.institutional_student_persons sp JOIN public.institutional_person_identifiers i ON i.person_id=sp.person_id WHERE sp.student_id=st.sid AND i.identifier_kind='certidao-hmac'),
  CASE WHEN idv.bd IS NULL THEN NULL ELSE idv.bd >= cut END
 FROM st LEFT JOIN idv ON idv.sid=st.sid ORDER BY idv.nm;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_student_documents_report(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_student_documents_report(text) TO authenticated;