DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
            WHERE s.nspname = 'public' AND p.proname IN ('ops_space_parent_level','ops_checklist_usable','ops_can_read','ops_service_state','ops_service_next_ok','ops_space_type_usable','ops_maintenance_next_ok') LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;