-- NSEC.4: visitantes sem login não têm política em nenhuma tabela (RLS já bloqueava);
-- retira também o privilégio de tabela que voltou por privilégio padrão. Só reduz acesso.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
             AND (has_table_privilege('anon', c.oid, 'select') OR has_table_privilege('anon', c.oid, 'insert')
                  OR has_table_privilege('anon', c.oid, 'update') OR has_table_privilege('anon', c.oid, 'delete'))
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;