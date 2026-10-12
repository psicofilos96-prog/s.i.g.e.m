-- Centro de Operações L06: prova estrutural de RLS/privilégios e das transições. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_service_orders','ops_service_order_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.ops_service_order_events', 'doc_ref', 'SELECT') THEN RAISE EXCEPTION 'comprovante legível direto'; END IF;
  IF NOT public.ops_service_next_ok('emitida','inicio') OR public.ops_service_next_ok('em-execucao','confirmacao')
     OR public.ops_service_next_ok('executada','material') OR public.ops_service_next_ok('aguardando-confirmacao','cancelamento')
     OR NOT public.ops_service_next_ok('aguardando-confirmacao','rejeicao') THEN RAISE EXCEPTION 'transição incorreta'; END IF;
  RAISE EXCEPTION 'ops06-ok';
END $$;
