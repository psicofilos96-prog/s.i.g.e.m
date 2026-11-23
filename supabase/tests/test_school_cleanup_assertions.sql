CREATE TEMP TABLE request AS SELECT payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex') hash FROM (SELECT substring(pg_get_functiondef('public.technical_cleanup_test_school_99999901(text,jsonb)'::regprocedure) FROM 'expected constant jsonb := ''([^'']+)''::jsonb')::jsonb payload) p;
CREATE FUNCTION pg_temp.expect_refusal(message text, p jsonb DEFAULT NULL, h text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE before_count integer; request_payload jsonb; request_hash text; refused boolean := false;
BEGIN
  SELECT coalesce(p,payload),coalesce(h,hash) INTO request_payload,request_hash FROM request;
  SELECT count(*) INTO before_count FROM public.school_enrollments;
  BEGIN
    INSERT INTO public.technical_test_school_cleanup_commands(request_hash,payload) VALUES(request_hash,request_payload);
  EXCEPTION WHEN OTHERS THEN
    IF position(message IN SQLERRM)=0 THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'request unexpectedly accepted: %',message; END IF;
  IF (SELECT count(*) FROM public.school_enrollments)<>before_count
    OR EXISTS(SELECT 1 FROM public.technical_test_school_cleanup_commands)
    OR (SELECT count(*) FROM public.technical_execution_operations)<>2
    OR EXISTS(SELECT 1 FROM public.technical_execution_targets) THEN RAISE EXCEPTION 'partial mutation persisted'; END IF;
END $$;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(role_name,'public.technical_cleanup_test_school_99999901(text,jsonb)','EXECUTE')
      OR has_table_privilege(role_name,'public.technical_test_school_cleanup_commands','INSERT') THEN RAISE EXCEPTION 'app role acquired execution: %',role_name; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid='public.technical_cleanup_test_school_99999901(text,jsonb)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'PUBLIC acquired execution'; END IF;
END $$;
SELECT 'PASS owner-only-access';
SELECT pg_temp.expect_refusal('cleanup-payload-not-allowlisted',(SELECT jsonb_set(payload,'{school_id}','"real-school"') FROM request));
SELECT 'PASS exact-school-only';
SELECT pg_temp.expect_refusal('cleanup-hash-mismatch',NULL,repeat('0',64));
SELECT 'PASS fingerprint-mismatch';
DO $$ DECLARE p jsonb; h text; op uuid := '00000000-0000-4000-8000-000000000633'; actual uuid; BEGIN
  SELECT payload,hash INTO p,h FROM request;
  INSERT INTO public.technical_execution_operations(id,operation_kind,source_hash,payload_fingerprint)
    VALUES(op,'technical-cleanup-test-school-99999901',h,h);
  actual := public.technical_cleanup_test_school_99999901(h,p);
  IF actual<>op OR (SELECT count(*) FROM public.school_enrollments)<>192
    OR (SELECT count(*) FROM public.technical_execution_operations)<>3 THEN RAISE EXCEPTION 'retry mutated state'; END IF;
  DELETE FROM public.technical_execution_operations WHERE id=op;
END $$;
SELECT 'PASS idempotent-kind-and-hash';
DO $$ DECLARE p jsonb; h text; refused boolean := false; BEGIN
  SELECT payload,hash INTO p,h FROM request;
  INSERT INTO public.technical_execution_operations(id,operation_kind,source_hash,payload_fingerprint)
    VALUES('00000000-0000-4000-8000-000000000633','technical-cleanup-test-school-99999901',h,repeat('0',64));
  BEGIN
    PERFORM public.technical_cleanup_test_school_99999901(h,p);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'technical:cleanup-retry-differs' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'changed fingerprint accepted'; END IF;
  DELETE FROM public.technical_execution_operations WHERE id='00000000-0000-4000-8000-000000000633';
END $$;
SELECT 'PASS retry-fingerprint-refusal';
UPDATE public.technical_automation_settings SET enabled=false;
SELECT pg_temp.expect_refusal('automation-disabled');
UPDATE public.technical_automation_settings SET enabled=true;
SELECT 'PASS automation-switch';
INSERT INTO public.school_enrollments VALUES(193,'real-school','student-1',NULL);
SELECT pg_temp.expect_refusal('cleanup-mixed-student-person-scope');
DELETE FROM public.school_enrollments WHERE id=193;
SELECT 'PASS null-operation-student-real-school';
INSERT INTO public.institutional_students VALUES('real-student');
INSERT INTO public.institutional_student_persons VALUES('real-student',md5('student-person-1')::uuid);
SELECT pg_temp.expect_refusal('cleanup-mixed-student-person-scope');
DELETE FROM public.institutional_student_persons WHERE student_id='real-student';
DELETE FROM public.institutional_students WHERE id='real-student';
SELECT 'PASS shared-person-preserved';
UPDATE public.professional_functional_links SET originating_act_ref='real-source' WHERE id=1;
SELECT pg_temp.expect_refusal('cleanup-staff-provenance-mismatch');
UPDATE public.professional_functional_links SET originating_act_ref='teste-99999901' WHERE id=1;
SELECT 'PASS functional-source-provenance';
SELECT pg_temp.expect_refusal('cleanup-retained-audit-reference:institutional_sector_provisioning_events');
SELECT 'PASS retained-audit-fk-rolls-back';
DELETE FROM public.institutional_sector_provisioning_events WHERE id=1;
CREATE TRIGGER test_immutable BEFORE DELETE ON public.institutional_school_record_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
SELECT pg_temp.expect_refusal('cleanup-existing-delete-guards-require-supported-fixture-path');
SELECT 'PASS immutable-guards-preserved';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='test_immutable' AND tgenabled='O') THEN RAISE EXCEPTION 'guard altered'; END IF; END $$;
SELECT 'PASS no-partial-operation-or-command';
