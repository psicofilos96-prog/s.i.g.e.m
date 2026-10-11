-- TSEMED.1 — carga inicial do catálogo 2026 concluída; acesso técnico de escrita encerrado.
-- Nova estrutura entra só como nova versão (year, table_code, version+1) por migration.
DROP POLICY IF EXISTS "Carga técnica do catálogo" ON public.semed_table_catalog;
REVOKE INSERT ON public.semed_table_catalog FROM sandbox_exec;
