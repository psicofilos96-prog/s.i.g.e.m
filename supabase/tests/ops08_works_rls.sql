-- Centro de Operações L08: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_works','ops_work_events','ops_space_use_restrictions'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_work_events', 'doc_ref', 'SELECT') THEN RAISE EXCEPTION 'contrato legível direto'; END IF;
  IF has_column_privilege('authenticated', 'public.ops_space_use_restrictions', 'basis_doc_ref', 'SELECT') THEN RAISE EXCEPTION 'fundamento legível direto'; END IF;
  IF has_function_privilege('anon', 'public.record_ops_work_event(uuid,int,text,uuid,text,uuid,text,text,date,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon executa'; END IF;
  RAISE EXCEPTION 'ops08-ok';
END $$;
