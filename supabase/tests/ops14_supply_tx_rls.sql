-- Centro de Operações L14: prova estrutural. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_supply_adjustments','ops_supply_adjustment_decisions','ops_supply_movements'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_function_privilege('authenticated', 'public.ops_supply_insert(uuid,text,text,numeric,text,date,date,uuid,text,text,uuid,uuid,uuid,text)', 'EXECUTE') THEN RAISE EXCEPTION 'núcleo exposto'; END IF;
  IF has_column_privilege('authenticated', 'public.ops_supply_movements', 'source_doc_ref', 'SELECT') THEN RAISE EXCEPTION 'documento legível'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ops_supply_not_food') THEN RAISE EXCEPTION 'sem guarda de alimentação'; END IF;
  RAISE EXCEPTION 'ops14-ok';
END $$;
