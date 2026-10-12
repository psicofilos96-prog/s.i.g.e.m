-- Centro de Operações L15: prova estrutural. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_supply_requisitions','ops_supply_requisition_lines','ops_supply_requisition_events','ops_supply_requisition_line_acts','ops_supply_min_level_versions','ops_supply_min_level_approvals'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_supply_requisition_events', 'doc_ref', 'SELECT') THEN RAISE EXCEPTION 'comprovante legível'; END IF;
  IF has_function_privilege('authenticated', 'public.ops_requisition_state(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'helper exposto'; END IF;
  RAISE EXCEPTION 'ops15-ok';
END $$;
