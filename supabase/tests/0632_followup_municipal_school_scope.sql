-- Read-only real database regression: preserves records and exercises each designated seat.
BEGIN READ ONLY;
DO $$
DECLARE account record; school record; permitted boolean; municipal_count integer; session_id uuid; tested integer := 0;
BEGIN
  FOR account IN SELECT DISTINCT auth_user_id,seat_code,designated_at FROM public.followup_seat_assignments a
    WHERE NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r WHERE r.assignment_id=a.id)
  LOOP
    SELECT id INTO session_id FROM auth.sessions WHERE user_id=account.auth_user_id
      AND created_at >= account.designated_at AND (not_after IS NULL OR not_after > now()) ORDER BY created_at DESC LIMIT 1;
    IF session_id IS NULL THEN RAISE EXCEPTION 'followup-test:valid-session-required'; END IF;
    tested := tested + 1;
    PERFORM set_config('request.jwt.claim.sub' ,account.auth_user_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account.auth_user_id,'role','authenticated','session_id',session_id)::text,true);
    municipal_count := 0;
    FOR school IN SELECT DISTINCT ON (school_id) * FROM public.institutional_school_record_versions
      WHERE valid_from <= (now() AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY school_id,version_number DESC
    LOOP
      permitted := public.school_institutional_followup_grant('consultar-acompanhamento-institucional',school.school_id)
        OR public.school_institutional_followup_grant('registrar-acompanhamento-institucional',school.school_id);
      IF school.administrative_dependency='privada' AND school.partnership_public_authority IS NOT NULL AND permitted THEN
        RAISE EXCEPTION 'followup-test:partnership-visible';
      END IF;
      IF school.administrative_dependency='municipal' AND school.location_kind IN ('urbana','rural') THEN
        IF NOT permitted THEN RAISE EXCEPTION 'followup-test:municipal-denied'; END IF;
        municipal_count := municipal_count + 1;
      END IF;
    END LOOP;
    IF municipal_count=0 THEN RAISE EXCEPTION 'followup-test:empty-scope'; END IF;
  END LOOP;
  IF tested <> 3 THEN RAISE EXCEPTION 'followup-test:three-seats-required'; END IF;
END $$;
ROLLBACK;