CREATE OR REPLACE FUNCTION public.cpf_integrity_audit()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.general_admin_session()) THEN
    RAISE EXCEPTION 'cpf-audit:not-authorized' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'generated_at', now(),
    'stored_form', 'hmac',
    'cpf_records', (SELECT count(*) FROM institutional_person_identifiers WHERE identifier_kind = 'cpf-hmac'),
    'malformed_fingerprints', (SELECT count(*) FROM institutional_person_identifiers WHERE identifier_kind = 'cpf-hmac' AND value !~ '^[0-9a-f]{64}$'),
    'duplicate_groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('people', g.people, 'count', g.n)) FROM (
        SELECT array_agg(DISTINCT person_id::text) people, count(DISTINCT person_id) n
        FROM institutional_person_identifiers WHERE identifier_kind = 'cpf-hmac'
        GROUP BY value HAVING count(DISTINCT person_id) > 1) g), '[]'::jsonb),
    'applications_same_cpf_requester_student', (SELECT count(*) FROM enr_applications WHERE requester_cpf_hmac IS NOT NULL AND requester_cpf_hmac = student_cpf_hmac),
    'applications_cpf_of_other_person', (SELECT count(*) FROM enr_applications a JOIN institutional_person_identifiers i
        ON i.identifier_kind = 'cpf-hmac' AND i.value = a.student_cpf_hmac
        JOIN institutional_person_identifiers r2 ON r2.identifier_kind = 'cpf-hmac' AND r2.value = a.requester_cpf_hmac AND r2.person_id = i.person_id)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.cpf_integrity_audit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cpf_integrity_audit() TO authenticated;
COMMENT ON FUNCTION public.cpf_integrity_audit() IS 'Relatório de inconsistências de CPF para revisão administrativa; só lê, nunca corrige. CPF é guardado só como impressão HMAC: invalidez matemática é barrada na entrada (technical_cpf_valid) e não é reverificável depois.';