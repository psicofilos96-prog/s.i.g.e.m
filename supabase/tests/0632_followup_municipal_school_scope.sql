-- Read-only real database regression: preserves records and exercises each designated seat.
BEGIN;
DO $$
DECLARE account record; school record; permitted boolean; municipal_count integer;
BEGIN
  FOR account IN SELECT DISTINCT auth_user_id,seat_code FROM public.followup_seat_assignments a
    WHERE NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r WHERE r.assignment_id=a.id)
  LOOP
    PERFORM set_config('request.jwt.claim.sub',account.auth_user_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account.auth_user_id,'role','authenticated')::text,true);
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
END $$;
ROLLBACK;