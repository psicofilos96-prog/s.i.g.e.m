-- Centro de Operações L03: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_space_type_versions','ops_space_type_approvals','ops_spaces','ops_space_versions'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.register_ops_space(text,uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon cria espaço'; END IF;
  RAISE EXCEPTION 'ops03-ok';
END $$;
