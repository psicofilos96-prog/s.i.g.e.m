-- NDB.3: emit_school_document_v2 foi substituída por emit_school_document_v3 (NIDEM.1, chave idempotente).
-- Nenhuma tela, script ou teste de app a chama; v3 (SECURITY DEFINER) a usa internamente como dono.
-- Somente o EXECUTE de contas autenticadas é retirado; função e dados permanecem.
REVOKE EXECUTE ON FUNCTION public.emit_school_document_v2(uuid, text, text, date, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.emit_school_document_v2(uuid, text, text, date, uuid, uuid, text) IS 'DEPRECATED (NDB.3): use emit_school_document_v3; mantida só como etapa interna da v3.';