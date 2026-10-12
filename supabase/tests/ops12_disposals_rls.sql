-- Centro de Operações L12: prova estrutural + comportamento da guarda de baixa. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_asset_maintenance_links','ops_asset_disposals','ops_asset_disposal_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_asset_disposals', 'assessment_ref', 'SELECT') THEN RAISE EXCEPTION 'laudo legível direto'; END IF;
  IF has_column_privilege('authenticated', 'public.ops_asset_disposal_events', 'doc_ref', 'SELECT') THEN RAISE EXCEPTION 'comprovante legível direto'; END IF;
  IF has_function_privilege('authenticated', 'public.ops_disposal_state(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'helper exposto'; END IF;
  IF has_table_privilege('authenticated', 'public.ops_assets', 'DELETE') OR has_table_privilege('authenticated', 'public.ops_assets', 'TRUNCATE') THEN RAISE EXCEPTION 'cadastro apagável'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'opsae_writeoff_guard') THEN RAISE EXCEPTION 'sem guarda de baixa'; END IF;
  RAISE EXCEPTION 'ops12-ok';
END $$;
