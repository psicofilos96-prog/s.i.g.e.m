-- B1.4: RLS and row triggers do not protect TRUNCATE. Keep direct reads where
-- required; all institutional mutations continue through governed functions.
DO $hardening$
DECLARE _table text; _fn record;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'capability_policy_rules',
    'institutional_classes',
    'institutional_class_record_versions',
    'institutional_class_period_organization_versions',
    'sigem_installer_designation'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', _table);
    EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM PUBLIC, anon', _table);
    IF _table = 'sigem_installer_designation' THEN
      EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM authenticated', _table);
    END IF;
    IF current_setting('server_version_num')::integer >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', _table);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sandbox_exec') THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM sandbox_exec', _table);
      EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM sandbox_exec', _table);
      IF current_setting('server_version_num')::integer >= 170000 THEN
        EXECUTE format('REVOKE MAINTAIN ON TABLE public.%I FROM sandbox_exec', _table);
      END IF;
    END IF;
  END LOOP;

  -- RPCs reached by signed-in staff only. Keep their internal capability and
  -- scope checks; this removes unnecessary entry points for anonymous users.
  FOR _fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'register_person', 'record_engagement', 'end_engagement',
      'link_institutional_account', 'register_capability_policy_draft',
      'homologate_capability_policy', 'register_school_record_version',
      'record_school_link', 'register_academic_year_version',
      'register_academic_period_version', 'register_period_organization_version',
      'register_curricular_component_version', 'register_student',
      'record_student_identity_version', 'locate_student_for_enrollment'
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', _fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn.signature);
  END LOOP;

  -- Class writers are authenticated application entry points only. Keep
  -- service_role from becoming an alternate institutional write path.
  REVOKE EXECUTE ON FUNCTION public.register_institutional_class(text,text,text,text,text,date,date,text) FROM PUBLIC, anon, service_role;
  REVOKE EXECUTE ON FUNCTION public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text) FROM PUBLIC, anon, service_role;
  GRANT EXECUTE ON FUNCTION public.register_institutional_class(text,text,text,text,text,date,date,text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text) TO authenticated;

  -- Private context helpers are called by owner-owned writers; trigger
  -- functions are never API entry points.
  FOR _fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'class_record_context', 'class_period_link_context',
      'class_period_link_boundary', 'guard_class_record_current_overlap',
      'guard_class_period_link_overlap'
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', _fn.signature);
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sandbox_exec') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM sandbox_exec', _fn.signature);
    END IF;
  END LOOP;
END $hardening$;
