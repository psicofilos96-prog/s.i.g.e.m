-- TSEMED.1 — Tabelas SEMED continuam append-only para todos; a única exceção é a limpeza de contas
-- sintéticas BO (operação marcada, automação técnica ligada, linha de autoria de conta da operação).
CREATE OR REPLACE FUNCTION public.semed_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME <> 'semed_table_catalog' AND public.nei_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'semed:append-only';
END $$;

CREATE OR REPLACE FUNCTION public.semed_fixture_row(_old jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE op text := current_setting('sigem.bo_cleanup_op', true);
BEGIN
  IF op IS NULL OR op !~ '^bo-[0-9a-f]{12}$' OR NOT public.technical_automation_enabled() THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = op
    AND a.user_id::text IN (_old->>'actor_user_id', _old->>'created_by'));
END $$;
REVOKE ALL ON FUNCTION public.semed_fixture_row(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.semed_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME <> 'semed_table_catalog' AND public.semed_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'semed:append-only';
END $$;

-- Remove eventos e submissões criados por contas da operação (submissão só se todos os eventos forem da operação).
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_semed(_operation_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.semed_table_submission_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_submissions s WHERE public.semed_fixture_row(to_jsonb(s))
    AND NOT EXISTS (SELECT 1 FROM public.semed_table_submission_events e WHERE e.submission_id = s.id); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_semed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_semed(text) TO service_role;
