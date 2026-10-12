-- OPS L24 — prova de RBAC/RLS/LGPD do Centro de Operações (somente leitura do catálogo).
-- Termina em RAISE NOTICE 'ops24-ok' ou RAISE EXCEPTION com a lista de falhas; nada persiste.
DO $$
DECLARE
  bad text[] := '{}';
  r record;
  n_tables int;
BEGIN
  SELECT count(*) INTO n_tables FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
   WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'ops\_%';
  IF n_tables < 20 THEN bad := bad || format('apenas %s tabelas ops_', n_tables); END IF;

  -- 1. RLS ligado e nenhuma DML direta para anon/authenticated (escrita só por writer DEFINER).
  FOR r IN SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
            WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'ops\_%' LOOP
    IF NOT r.relrowsecurity THEN bad := bad || ('sem RLS: ' || r.relname); END IF;
    IF has_table_privilege('anon', 'public.' || r.relname, 'SELECT') THEN bad := bad || ('anon lê: ' || r.relname); END IF;
    IF has_table_privilege('authenticated', 'public.' || r.relname, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || r.relname, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || r.relname, 'DELETE')
       OR has_table_privilege('authenticated', 'public.' || r.relname, 'TRUNCATE') THEN
      bad := bad || ('DML direto: ' || r.relname);
    END IF;
  END LOOP;

  -- 2. Anexos/documentos: colunas de referência documental nunca legíveis por authenticated.
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name LIKE 'ops\_%'
              AND (column_name LIKE '%document_ref%' OR column_name LIKE '%attachment_ref%' OR column_name LIKE '%evidence_ref%'
                   OR column_name LIKE '%doc_ref%' OR column_name LIKE '%certificate_doc%' OR column_name LIKE '%contract_doc%') LOOP
    IF has_column_privilege('authenticated', format('public.%I', r.table_name), r.column_name, 'SELECT') THEN
      bad := bad || format('anexo legível: %s.%s', r.table_name, r.column_name);
    END IF;
  END LOOP;

  -- 3. Trajeto de menor: nenhuma tabela ops_ liga estudante a ponto/horário/rota.
  FOR r IN SELECT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name LIKE 'ops\_%' AND column_name IN ('student_id', 'institutional_student_id')
            INTERSECT
           SELECT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name LIKE 'ops\_%' AND column_name IN ('stop_id', 'route_id', 'departure_time', 'pickup_time') LOOP
    -- Exceção única: solicitação/decisão de elegibilidade (L16) — sem horário, leitura por capacidade.
    IF r.table_name NOT IN ('ops_transport_requests', 'ops_transport_decisions') THEN
      bad := bad || ('trajeto de menor exposto: ' || r.table_name);
    END IF;
  END LOOP;

  -- 4. Funções ops: nenhuma executável por anon; helpers internos (_internal/_guard/_ok) nem por authenticated.
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
            WHERE s.nspname = 'public' AND p.proname ~ '^(ops|open_ops|record_ops|approve_ops|propose_ops|request_ops|incorporate_ops|assess_ops)' LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN bad := bad || ('anon executa: ' || r.proname); END IF;
    IF r.proname ~ '(_internal|_core)$' AND has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      bad := bad || ('helper exposto: ' || r.proname);
    END IF;
  END LOOP;

  -- 5. Writers são SECURITY DEFINER com search_path fixo.
  FOR r IN SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
            WHERE s.nspname = 'public' AND p.proname ~ '^(open_ops|record_ops|approve_ops|propose_ops|request_ops|incorporate_ops)' LOOP
    IF NOT r.prosecdef THEN bad := bad || ('writer INVOKER: ' || r.proname); END IF;
    IF r.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(r.proconfig) x WHERE x LIKE 'search_path=%') THEN
      bad := bad || ('writer sem search_path: ' || r.proname);
    END IF;
  END LOOP;

  IF array_length(bad, 1) > 0 THEN RAISE EXCEPTION 'ops24-falhas (%): %', array_length(bad, 1), array_to_string(bad, ' | '); END IF;
  RAISE NOTICE 'ops24-ok: % tabelas ops_ verificadas', n_tables;
END $$;
