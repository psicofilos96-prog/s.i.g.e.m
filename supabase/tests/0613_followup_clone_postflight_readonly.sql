-- 0613 / pós-checagem de segurança, somente leitura, depois de aplicar a migration no CLONE.
-- Executável sem criar contas de teste, sem simular JWT e sem alterar registros.
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

DO $postflight$
DECLARE
  relation_name text;
  function_signature text;
  function_oid oid;
  role_name text;
  p record;
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'followup-postflight:transaction-must-be-read-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sigem_capability_catalog
    WHERE capability_id = 'consultar-acompanhamento-institucional')
    OR NOT EXISTS (SELECT 1 FROM public.sigem_capability_catalog
    WHERE capability_id = 'registrar-acompanhamento-institucional')
  THEN RAISE EXCEPTION 'followup-postflight:missing-capability-catalog-entries'; END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'school_institutional_followup_visits',
    'school_institutional_followup_actions',
    'school_institutional_followup_updates',
    'school_institutional_followup_bundles'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = relation_name
        AND c.relkind IN ('r', 'p') AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'followup-postflight:missing-table-or-rls:%', relation_name;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_table_privilege(role_name, 'public.' || relation_name, 'SELECT')
        OR pg_catalog.has_table_privilege(role_name, 'public.' || relation_name, 'INSERT')
        OR pg_catalog.has_table_privilege(role_name, 'public.' || relation_name, 'UPDATE')
        OR pg_catalog.has_table_privilege(role_name, 'public.' || relation_name, 'DELETE')
      THEN
        RAISE EXCEPTION 'followup-postflight:direct-table-privilege:%:%', relation_name, role_name;
      END IF;
    END LOOP;
  END LOOP;

  -- As funções privadas não são APIs públicas e não devem ser invocáveis pelo cliente.
  FOREACH function_signature IN ARRAY ARRAY[
    'public.school_institutional_followup_grant(text,text)',
    'public.school_institutional_followup_can_read(text)',
    'public.school_institutional_followup_person(text)',
    'public.school_institutional_followup_immutable()'
  ] LOOP
    function_oid := pg_catalog.to_regprocedure(function_signature);
    IF function_oid IS NULL THEN
      RAISE EXCEPTION 'followup-postflight:missing-private-function:%', function_signature;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_function_privilege(role_name, function_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'followup-postflight:private-function-exposed:%:%',
          function_signature, role_name;
      END IF;
    END LOOP;
  END LOOP;

  -- RPCs públicas do módulo: somente authenticated, ainda verificadas por capability no SQL.
  FOREACH function_signature IN ARRAY ARRAY[
    'public.school_institutional_followup_school(text)',
    'public.school_institutional_followup_network(date,date)',
    'public.school_institutional_followup_monthly(date,date)',
    'public.school_institutional_followup_statuses()',
    'public.school_institutional_followup_pending()',
    'public.record_school_institutional_followup_visit(text,date,text,text,text,text,uuid,text,uuid,text,text)',
    'public.record_school_institutional_followup_action(uuid,text,text,date,uuid)',
    'public.record_school_institutional_followup_update(uuid,uuid,date,text,text,text,text,text,uuid)',
    'public.record_school_institutional_followup_bundle(text,date,text,text,text,text,uuid,jsonb,text,text)'
  ] LOOP
    function_oid := pg_catalog.to_regprocedure(function_signature);
    IF function_oid IS NULL THEN
      RAISE EXCEPTION 'followup-postflight:missing-rpc:%', function_signature;
    END IF;
    IF NOT pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      OR pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'followup-postflight:invalid-rpc-permissions:%', function_signature;
    END IF;
  END LOOP;

  -- Todas as funções do módulo usam SECURITY DEFINER e um search_path declarado.
  FOR p IN
    SELECT proc.proname, proc.prosecdef, proc.proconfig
    FROM pg_catalog.pg_proc proc
    JOIN pg_catalog.pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public'
      AND (proc.proname LIKE 'school_institutional_followup_%'
        OR proc.proname LIKE 'record_school_institutional_followup_%')
  LOOP
    IF NOT p.prosecdef AND p.proname <> 'school_institutional_followup_immutable' THEN
      RAISE EXCEPTION 'followup-postflight:security-definer-missing:%', p.proname;
    END IF;
    IF p.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p.proconfig) AS config(value)
      WHERE config.value LIKE 'search_path=%'
    ) THEN
      RAISE EXCEPTION 'followup-postflight:search-path-not-fixed:%', p.proname;
    END IF;
  END LOOP;

  RAISE NOTICE 'FOLLOWUP_0613_POSTFLIGHT_READONLY_OK — estrutura e privilégios essenciais conferidos; teste com perfis reais ainda obrigatório.';
END $postflight$;

ROLLBACK;
