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
  "/revisao-de-anomalias",
  "/tarefas",
  "/transporte-escolar",
] as const;

export function requiresSessionBeforeRead(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return SESSION_READ_ROUTES.some((r) => p === r || p.startsWith(`${r}/`));
}
