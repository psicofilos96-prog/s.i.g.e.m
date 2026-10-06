-- NAE.8 — E2E de banco revelou privilégios padrão de DML direto (INSERT/UPDATE/DELETE/TRUNCATE) para anon/authenticated
-- em tabelas meal_* criadas em 0182–0186. RLS sem policy já bloqueava linhas, mas mínimo privilégio exige ausência do GRANT:
-- só os writers SECURITY DEFINER gravam. Correção aditiva; SELECT de authenticated preservado (RLS continua decidindo).
DO $r$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'meal\_%' LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated, PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $r$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;