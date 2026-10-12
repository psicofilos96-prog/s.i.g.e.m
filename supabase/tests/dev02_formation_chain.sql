-- DEV L02 — prova de catálogo: RLS, sem DML direta, documento oculto, writers DEFINER e fora do alcance de anon.
DO $$
DECLARE bad text[] := '{}'; r record; n int;
BEGIN
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'dev\_%';
  IF n < 16 THEN bad := bad || format('esperadas ≥16 tabelas dev_, há %s', n); END IF;
  FOR r IN SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'dev\_%' LOOP
    IF NOT r.relrowsecurity THEN bad := bad || ('sem RLS: ' || r.relname); END IF;
    IF has_table_privilege('anon', 'public.' || r.relname, 'SELECT') THEN bad := bad || ('anon lê: ' || r.relname); END IF;
    IF has_table_privilege('authenticated', 'public.' || r.relname, 'INSERT,UPDATE,DELETE,TRUNCATE') THEN bad := bad || ('DML direta: ' || r.relname); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = ('public.' || r.relname)::regclass AND NOT t.tgisinternal) THEN bad := bad || ('sem trigger append-only: ' || r.relname); END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.dev_certifications', 'document_version_ref', 'SELECT') THEN bad := bad || 'documento do certificado legível'::text; END IF;
  IF has_column_privilege('authenticated', 'public.dev_need_evidence', 'document_version_ref', 'SELECT') OR has_column_privilege('authenticated', 'public.dev_need_evidence', 'record_ref', 'SELECT') THEN bad := bad || 'referência de evidência legível'::text; END IF;
  IF has_function_privilege('authenticated', 'public.dev_current_threshold()', 'EXECUTE') THEN bad := bad || 'helper de limiar exposto'::text; END IF;
  FOR r IN SELECT p.oid, p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
            WHERE s.nspname = 'public' AND p.proname ~ '^(record_dev|decide_dev|enroll_dev|issue_dev|submit_dev|consolidate_dev|approve_dev)' LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN bad := bad || ('anon executa: ' || r.proname); END IF;
    IF NOT r.prosecdef THEN bad := bad || ('writer INVOKER: ' || r.proname); END IF;
  END LOOP;
  IF array_length(bad, 1) > 0 THEN RAISE EXCEPTION 'dev02-falhas: %', array_to_string(bad, ' | '); END IF;
  RAISE NOTICE 'dev02-ok';
END $$;
