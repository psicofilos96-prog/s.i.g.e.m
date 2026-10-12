-- Centro de Operações L10: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_asset_transfers','ops_asset_transfer_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_asset_transfer_events', 'doc_ref', 'SELECT') THEN RAISE EXCEPTION 'comprovante legível direto'; END IF;
  IF has_function_privilege('authenticated', 'public.ops_asset_open_transfer(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'helper exposto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ops_asset_transfer_terminal') THEN RAISE EXCEPTION 'sem índice terminal'; END IF;
  RAISE EXCEPTION 'ops10-ok';
END $$;
