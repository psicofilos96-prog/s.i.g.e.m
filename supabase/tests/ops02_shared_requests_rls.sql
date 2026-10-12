-- Centro de Operações L02: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_requests','ops_request_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_request_events', 'case_event_ref', 'SELECT') THEN RAISE EXCEPTION 'anexo legível direto'; END IF;
  IF has_function_privilege('anon', 'public.open_ops_request(text,text,text,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon abre solicitação'; END IF;
  RAISE EXCEPTION 'ops02-ok';
END $$;
