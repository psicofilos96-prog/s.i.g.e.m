-- Prova estrutural da 0618 (anexos de imagem das visitas) para rodar somente em
-- banco descartável de CI ou homologação com 0613–0618 aplicadas.
-- Execução sugerida: psql -v ON_ERROR_STOP=1 -f supabase/tests/0618_followup_attachments.sql
BEGIN;

DO $verify$
BEGIN
  -- A tabela de anexos não expõe DML direto a nenhum papel do Data API.
  IF has_table_privilege('authenticated', 'public.school_institutional_followup_attachments', 'SELECT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_attachments', 'INSERT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_attachments', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_attachments', 'DELETE')
    OR has_table_privilege('anon', 'public.school_institutional_followup_attachments', 'SELECT')
    OR has_table_privilege('service_role', 'public.school_institutional_followup_attachments', 'SELECT')
    OR has_table_privilege('service_role', 'public.school_institutional_followup_attachments', 'INSERT')
    THEN RAISE EXCEPTION 'followup-test:attachment-table-grants-leak'; END IF;

  -- RLS obrigatória mesmo sem políticas: leitura e escrita passam só pelas RPCs.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'school_institutional_followup_attachments'
      AND c.relrowsecurity)
    THEN RAISE EXCEPTION 'followup-test:attachment-rls-missing'; END IF;

  -- Append-only: o gatilho de imutabilidade precisa existir e estar ativo.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'school_institutional_followup_attachments'
      AND t.tgname = 'followup_attachment_immutable' AND NOT t.tgisinternal AND t.tgenabled <> 'D')
    THEN RAISE EXCEPTION 'followup-test:attachment-immutable-trigger-missing'; END IF;

  -- Chave idempotente única: a mesma chave nunca grava dois anexos.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'school_institutional_followup_attachments'
      AND i.indisunique AND i.indkey::text = (
        SELECT i2.indkey::text FROM pg_catalog.pg_index i2
        WHERE i2.indrelid = c.oid AND i2.indisunique
          AND 'request_key' = (SELECT a.attname FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = c.oid AND a.attnum = i2.indkey[0])
        LIMIT 1))
    THEN RAISE EXCEPTION 'followup-test:attachment-request-key-not-unique'; END IF;

  -- Somente authenticated executa as RPCs; anon e service_role, nunca.
  IF has_function_privilege('anon', 'public.record_school_institutional_followup_attachment(uuid,text,text,text,integer,uuid)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.record_school_institutional_followup_attachment(uuid,text,text,text,integer,uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.school_institutional_followup_attachments(text)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.school_institutional_followup_attachments(text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.record_school_institutional_followup_attachment(uuid,text,text,text,integer,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.school_institutional_followup_attachments(text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'followup-test:attachment-function-grants'; END IF;

  -- A leitura nega quem não tem autorização no módulo (sessão anônima do CI).
  BEGIN
    PERFORM public.school_institutional_followup_attachments('escola-inexistente');
    RAISE EXCEPTION 'followup-test:attachment-read-not-denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'followup:read-denied' THEN RAISE; END IF;
  END;

  -- A escrita nega visita inexistente antes de qualquer gravação.
  BEGIN
    PERFORM public.record_school_institutional_followup_attachment(
      pg_catalog.gen_random_uuid(), 'escola/' || pg_catalog.gen_random_uuid()::text,
      null, 'image/png', 100, pg_catalog.gen_random_uuid());
    RAISE EXCEPTION 'followup-test:attachment-write-not-denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('followup:visit-invalid', 'followup:session-required') THEN RAISE; END IF;
  END;
END $verify$;

ROLLBACK;
