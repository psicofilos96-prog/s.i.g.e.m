-- Matrículas L24: prova SQL de RBAC/RLS do ingresso. Só leitura do catálogo; falha com RAISE se qualquer invariante quebrar.
DO $$
DECLARE _bad text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO _bad FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'enr\_%'
    AND (NOT c.relrowsecurity OR has_table_privilege('anon', c.oid, 'SELECT')
         OR has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'INSERT')
         OR has_table_privilege('authenticated', c.oid, 'UPDATE') OR has_table_privilege('authenticated', c.oid, 'DELETE'));
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'tabelas do ingresso sem RLS ou com DML direta: %', _bad; END IF;

  SELECT string_agg(p.proname, ', ') INTO _bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'enr\_%' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN ('enr_document_slot_open','enr_public_accept_seat','enr_public_application_documents','enr_public_application_receipt',
      'enr_public_application_result','enr_public_application_status','enr_public_campaigns','enr_public_preference_policy',
      'enr_public_protocol_status','enr_public_request_document_slot','enr_public_waitlist_position','enr_submit_application',
      'enr_support_destination_allowed');
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'funções do ingresso executáveis por anon fora da allowlist: %', _bad; END IF;
END $$;
