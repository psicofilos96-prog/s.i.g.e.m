-- Centro de Operações L05: prova estrutural de RLS/privilégios e do fluxo. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_maintenance_catalog_versions','ops_maintenance_catalog_approvals','ops_maintenance_orders','ops_maintenance_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_maintenance_events', 'evidence_refs', 'SELECT') THEN RAISE EXCEPTION 'evidência legível direto'; END IF;
  IF NOT public.ops_maintenance_next_ok(NULL, 'triagem', NULL) OR public.ops_maintenance_next_ok(NULL, 'execucao', NULL)
     OR public.ops_maintenance_next_ok('conferencia', 'conclusao', 'reprovada') OR NOT public.ops_maintenance_next_ok('conferencia', 'conclusao', 'aprovada')
     OR public.ops_maintenance_next_ok('conclusao', 'cancelamento', NULL) THEN RAISE EXCEPTION 'transição incorreta'; END IF;
  RAISE EXCEPTION 'ops05-ok';
END $$;
