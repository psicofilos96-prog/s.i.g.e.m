-- Hardening: visitante sem login só executa a verificação pública de documento.
-- Remove EXECUTE de PUBLIC/anon das demais funções do schema public, preservando o acesso que
-- `authenticated` já tinha (regrava explicitamente para authenticated onde existia). Triggers não precisam de EXECUTE.
DO $$
DECLARE f record; had_auth boolean;
BEGIN
  FOR f IN
    SELECT p.oid, p.oid::regprocedure::text AS sig
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.prokind = 'f'
       AND p.proname <> 'verify_school_document'
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    had_auth := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF had_auth THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig); END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;