-- Centro de Operações L13: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_supply_item_versions','ops_supply_item_approvals','ops_warehouses','ops_supply_movements'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_supply_movements', 'source_doc_ref', 'SELECT') THEN RAISE EXCEPTION 'documento legível direto'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE proname = 'ops_supply_balance') THEN RAISE EXCEPTION 'saldo deveria ser INVOKER (RLS)'; END IF;
  RAISE EXCEPTION 'ops13-ok';
END $$;
