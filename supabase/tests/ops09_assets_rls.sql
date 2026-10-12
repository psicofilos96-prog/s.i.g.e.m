-- Centro de Operações L09: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_asset_category_versions','ops_asset_category_approvals','ops_assets','ops_asset_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_asset_events', 'doc_ref', 'SELECT') THEN RAISE EXCEPTION 'documento legível direto'; END IF;
  IF has_sequence_privilege('authenticated', 'public.ops_asset_internal_seq', 'USAGE') THEN RAISE EXCEPTION 'sequência usável direto'; END IF;
  IF has_function_privilege('anon', 'public.record_ops_asset_event(uuid,int,text,text,uuid,uuid,text,text,text,uuid,date,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon executa'; END IF;
  RAISE EXCEPTION 'ops09-ok';
END $$;
