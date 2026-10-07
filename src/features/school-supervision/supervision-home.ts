/**
 * NSUP.1 — "O que depende da Supervisão". Projeção pura: cada ferramenta declara
 * a página dona e as capacidades que a habilitariam. O estado vem SÓ das
 * capacidades efetivas da sessão; nada é concedido aqui. Sem capacidade
 * atribuída, a ferramenta segue visível em consulta e marcada ASSIGNMENT_PENDING.
 */
export type ToolState = "pode-agir" | "so-consulta" | "assignment-pending";

export type SupervisionTool = {
  id: string;
  title: string;
  what: string;
  to: string;
  /** Capacidades que permitem agir (qualquer uma basta). */
  act: readonly string[];
  /** Consulta existe para qualquer sessão autenticada (o banco filtra). */
  readable: boolean;
};

export const SUPERVISION_TOOLS: readonly SupervisionTool[] = [
  { id: "calendario", title: "Calendários da rede", what: "Montar, revisar e publicar o calendário escolar.", to: "/calendario-escolar", act: ["construir-calendario-da-rede", "homologar-calendario-da-rede"], readable: true },
  { id: "matrizes", title: "Matrizes curriculares", what: "Consultar matrizes e suas versões homologadas.", to: "/matrizes-curriculares", act: ["manter-matrizes-curriculares", "homologar-matrizes-curriculares"], readable: true },
  { id: "catalogos", title: "Catálogos institucionais", what: "Consultar as listas oficiais usadas nas telas.", to: "/administracao", act: ["manter-catalogos-institucionais"], readable: true },
  { id: "ano-letivo", title: "Preparação do ano letivo", what: "Ver o que falta para o próximo ano, sem abri-lo.", to: "/preparacao-ano", act: ["manter-anos-e-periodos-letivos"], readable: true },
  { id: "escolas", title: "Escolas e pendências", what: "Escolher uma escola e ver o que falta configurar.", to: "/supervisao-escolar", act: ["registrar-acompanhamento-da-supervisao"], readable: true },
  { id: "relatorios", title: "Relatórios", what: "Relatórios de acompanhamento que sua atuação alcança.", to: "/relatorios", act: [], readable: true },
  { id: "historico", title: "Histórico de atos", what: "Quem registrou, homologou ou retificou, e quando.", to: "/auditoria", act: ["exportar-auditoria"], readable: true },
];

export function toolState(tool: SupervisionTool, held: ReadonlySet<string>): ToolState {
  if (tool.act.some((c) => held.has(c))) return "pode-agir";
  if (tool.act.length > 0 && !tool.readable) return "assignment-pending";
  return tool.act.length === 0 ? "so-consulta" : "assignment-pending";
}

export const TOOL_STATE_LABEL: Record<ToolState, string> = {
  "pode-agir": "Você pode agir",
  "so-consulta": "Só consulta",
  "assignment-pending": "Consulta — quem age ainda não foi definido",
};

export function supervisionHome(held: ReadonlySet<string>) {
  return SUPERVISION_TOOLS.map((t) => ({ ...t, state: toolState(t, held) }));
}
