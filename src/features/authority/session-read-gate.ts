/**
 * PERF.LOADING.1 — rotas cujo conteúdo lê dados de domínio logo ao montar.
 * Sem sessão, o portão da área não as monta: nenhuma leitura sai antes da sessão.
 */
export const SESSION_READ_ROUTES = [
  "/administracao",
  "/central-de-integracoes",
  "/estacao-administrativa",
  "/infraestrutura",
  "/integracoes",
  "/matriculas/operacao",
  "/matriculas/parametros",
  "/tecnologia/operacao",
  "/tecnologia/cadastros",
  "/tecnologia/decisoes",
  "/sigem-permanencia/operacao",
  "/centro-de-operacoes/operacao",
  "/revisao-de-anomalias",
  "/tarefas",
  "/transporte-escolar",
] as const;

/** Medição reproduzível: `scripts/perf-loading-gate-bench.py` (0 leituras de domínio sem sessão). */
export function requiresSessionBeforeRead(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return SESSION_READ_ROUTES.some((r) => p === r || p.startsWith(`${r}/`));
}
