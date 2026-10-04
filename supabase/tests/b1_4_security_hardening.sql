-- Read-only checks after migration 0057. Safe on the activated Cloud.
DO $test$
DECLARE _table text; _role text; _fn record;
BEGIN
  IF (SELECT count(DISTINCT p.proname)
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
        'register_person', 'record_engagement', 'end_engagement',
        'link_institutional_account', 'register_capability_policy_draft',
        'homologate_capability_policy', 'register_school_record_version',
        'record_school_link', 'register_academic_year_version',
        'register_academic_period_version', 'register_period_organization_version',
        'register_curricular_component_version', 'register_student',
        'record_student_identity_version', 'locate_student_for_enrollment',
        'class_record_context', 'class_period_link_context',
        'class_period_link_boundary', 'guard_class_record_current_overlap',
        'guard_class_period_link_overlap'
      ])) <> 20 THEN RAISE EXCEPTION 'b1.4:expected-functions-missing'; END IF;
  FOREACH _table IN ARRAY ARRAY[
    'capability_policy_rules', 'institutional_classes',
    'institutional_class_record_versions',
    'institutional_class_period_organization_versions',
    'sigem_installer_designation'
  ] LOOP
    FOREACH _role IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'sandbox_exec'] LOOP
      IF _role = 'sandbox_exec' AND NOT EXISTS
        (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = _role) THEN CONTINUE; END IF;
      IF has_table_privilege(_role, 'public.' || _table, 'INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES') THEN
        RAISE EXCEPTION 'b1.4:destructive-grant:%:%', _role, _table; END IF;
      IF current_setting('server_version_num')::integer >= 170000
         AND has_table_privilege(_role, 'public.' || _table, 'MAINTAIN') THEN
        RAISE EXCEPTION 'b1.4:maintain-grant:%:%', _role, _table; END IF;
    END LOOP;
    IF has_table_privilege('anon', 'public.' || _table, 'SELECT') THEN
      RAISE EXCEPTION 'b1.4:anon-table-read:%', _table; END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.sigem_installer_designation', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.institutional_classes', 'SELECT') THEN
    RAISE EXCEPTION 'b1.4:read-grant-divergent'; END IF;

  FOR _fn IN
    SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'register_person', 'record_engagement', 'end_engagement',
      'link_institutional_account', 'register_capability_policy_draft',
      'homologate_capability_policy', 'register_school_record_version',
      'record_school_link', 'register_academic_year_version',
      'register_academic_period_version', 'register_period_organization_version',
      'register_curricular_component_version', 'register_student',
      'record_student_identity_version', 'locate_student_for_enrollment',
      'class_record_context', 'class_period_link_context',
      'class_period_link_boundary', 'guard_class_record_current_overlap',
      'guard_class_period_link_overlap'
    ])
  LOOP
    IF has_function_privilege('anon', _fn.signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'b1.4:anon-execute:%', _fn.signature; END IF;
    IF _fn.proname IN (
      'class_record_context', 'class_period_link_context',
      'class_period_link_boundary', 'guard_class_record_current_overlap',
      'guard_class_period_link_overlap'
    ) THEN
      IF has_function_privilege('authenticated', _fn.signature, 'EXECUTE') THEN
        RAISE EXCEPTION 'b1.4:private-helper-execute:%', _fn.signature; END IF;
    ELSIF NOT has_function_privilege('authenticated', _fn.signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'b1.4:writer-unavailable:%', _fn.signature;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id = r.policy_id
      WHERE p.version = 3 AND p.status = 'homologated') <> 199 THEN
    RAISE EXCEPTION 'b1.4:v3-changed'; END IF;
END $test$;
