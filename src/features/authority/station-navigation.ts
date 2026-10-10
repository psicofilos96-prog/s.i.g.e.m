/**
 * BQ.1 Lote 2 — isolamento de navegação por estação setorial (conta de setor ≠ pessoa).
 * Só organiza a TELA: o banco (effective_capabilities + RLS + writers) continua a única garantia.
 * Contas humanas não passam por aqui (caminho humano inalterado).
 */
export type SectorStation =
  | "ciece"
  | "supervisao"
  | "alimentacao"
  | "avaliacao"
  | "secretaria_escolar"
  | "direcao_escolar"
  | "orientacao_pedagogica"
  | "inclusao_nei";

export type SectorPrincipal = {
  id: string;
  station: SectorStation;
  scope: "network" | "school";
  schoolId: string | null;
};

/** Rotas comuns de leitura pessoal/ajuda, sem dado institucional de outra estação. */
const COMMON = ["/", "/ajuda", "/avisos", "/tarefas", "/calendario-escolar"] as const;

export const STATION_LABEL: Record<SectorStation, string> = {
  ciece: "CIECE — Informação e Estatística",
  supervisao: "Supervisão Escolar",
  alimentacao: "Alimentação Escolar",
  avaliacao: "Avaliação Educacional",
  secretaria_escolar: "Secretaria Escolar",
  direcao_escolar: "Direção Escolar",
  orientacao_pedagogica: "Orientação Pedagógica",
  inclusao_nei: "Inclusão — NEI (central)",
};

export const STATION_HOME: Record<SectorStation, string> = {
  ciece: "/ciece",
  supervisao: "/supervisao-escolar",
  alimentacao: "/alimentacao-escolar",
  avaliacao: "/avaliacao-desempenho",
  secretaria_escolar: "/secretaria",
  direcao_escolar: "/direcao",
  orientacao_pedagogica: "/orientacao",
  inclusao_nei: "/inclusao",
};

const STATION_ROUTES: Record<SectorStation, readonly string[]> = {
  ciece: ["/ciece", "/mapa-censo-2026", "/consolidado-2026", "/mapa-estatistico", "/mapa-estatistico-rede", "/qualidade-dos-dados", "/revisao-de-anomalias", "/paineis", "/relatorios", "/integracoes", "/central-de-integracoes", "/unidades", "/base-de-conhecimento", "/censo-escolar", "/alunos", "/turmas"],
  supervisao: ["/supervisao-escolar", "/unidades", "/mapa-censo-2026", "/consolidado-2026"],
  alimentacao: ["/alimentacao-escolar", "/unidades", "/relatorios"],
  avaliacao: ["/avaliacao-desempenho", "/acompanhamento-avaliacao", "/paineis", "/relatorios", "/alunos", "/turmas"],
  secretaria_escolar: ["/secretaria", "/alunos", "/turmas", "/enturmacoes", "/mapa-censo-2026", "/mapa-estatistico", "/documentos-escolares", "/horarios"],
  direcao_escolar: ["/direcao", "/gestao-escolar", "/alunos", "/turmas", "/profissionais", "/mapa-censo-2026", "/mapa-estatistico", "/horarios", "/paineis", "/alimentacao-escolar"],
  orientacao_pedagogica: ["/orientacao", "/planejamento", "/alunos", "/turmas", "/horarios"],
  inclusao_nei: ["/inclusao", "/unidades", "/relatorios", "/alunos"],
};

const matches = (path: string, route: string) =>
  route === "/" ? path === "/" : path === route || path.startsWith(`${route}/`);

/** Rota permitida à estação; desconhecida ⇒ recusa (fail closed). */
export function stationAllowsPath(station: string, path: string): boolean {
  const routes = (STATION_ROUTES as Record<string, readonly string[] | undefined>)[station];
  if (!routes) return false;
  return [...COMMON, ...routes].some((r) => matches(path, r));
}
