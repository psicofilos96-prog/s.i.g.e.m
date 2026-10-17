CREATE OR REPLACE FUNCTION public.secretariat_own_student_documents_report()
RETURNS TABLE(school_id text, student_id text, student_name text, birth_date date, has_cpf boolean, has_certificate boolean, cpf_required boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text;
BEGIN
 SELECT p.school_id INTO s FROM public.institutional_sector_principals p WHERE p.auth_user_id=auth.uid() AND p.scope_kind='school' AND p.school_id IS NOT NULL ORDER BY p.created_at DESC LIMIT 1;
 IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
 RETURN QUERY SELECT s, r.* FROM public.secretariat_student_documents_report(s) r;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_own_student_documents_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_own_student_documents_report() TO authenticated;