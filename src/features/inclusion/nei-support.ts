// NEI.4 — espelho puro das regras do banco (0338): pedidos de apoio, cobertura e barreiras.
export type SupportStage = "solicitada" | "em-analise" | "encaminhada" | "designada" | "indeferida" | "cancelada" | "encerrada";
export const SUPPORT_LABEL: Record<SupportStage, string> = {
  solicitada: "Solicitada", "em-analise": "Em análise", encaminhada: "Encaminhada para decisão", designada: "Designação vinculada",
  indeferida: "Indeferida", cancelada: "Cancelada", encerrada: "Encerrada",
};
const NEXT: Record<SupportStage, SupportStage[]> = {
  solicitada: ["em-analise", "cancelada"], "em-analise": ["encaminhada", "indeferida", "cancelada"], encaminhada: ["designada", "indeferida", "em-analise"],
  designada: ["encerrada", "em-analise"], indeferida: [], cancelada: [], encerrada: [],
};
export const supportNext = (s: SupportStage) => NEXT[s];
export const SUPPORT_KIND: Record<string, string> = { mediador: "Mediador", "profissional-de-apoio": "Profissional de apoio", "professor-aee": "Professor de AEE", outro: "Outro apoio" };

export function supportProblem(from: SupportStage, to: SupportStage, note: string, forwardedTo: string, link: string): string | null {
  if (!NEXT[from].includes(to)) return "Essa etapa não segue a atual.";
  if (note.trim().length < 3) return "Descreva o andamento.";
  if (["indeferida", "cancelada", "encerrada"].includes(to) && note.trim().length < 10) return "Justifique (mínimo 10 caracteres).";
  if (to === "encaminhada" && forwardedTo.trim().length < 3) return "Informe para quem foi encaminhado.";
  if (to === "designada" && !link) return "Escolha a designação já registrada pela escola ou a atuação existente.";
  return null;
}

/** Situação de cobertura de uma mediação vigente; nunca presume cobertura sem fato registrado. */
export function coverageState(m: { mediator_active: boolean; on_leave: boolean; substituted: boolean }): "coberta" | "substituida" | "descoberta" {
  if (!m.mediator_active) return "descoberta";
  if (m.on_leave) return m.substituted ? "substituida" : "descoberta";
  return "coberta";
}

export const BARRIER_CATEGORY: Record<string, string> = {
  arquitetonica: "Arquitetônica", comunicacional: "Comunicacional", pedagogica: "Pedagógica", tecnologica: "Tecnológica", atitudinal: "Atitudinal", transporte: "Transporte", outra: "Outra",
};
export type BarrierStatus = "identificada" | "em-andamento" | "resolvida" | "sem-solucao";
export const BARRIER_LABEL: Record<BarrierStatus, string> = { identificada: "Identificada", "em-andamento": "Em andamento", resolvida: "Resolvida", "sem-solucao": "Sem solução possível" };
export const barrierClosed = (s: BarrierStatus) => s === "resolvida" || s === "sem-solucao";
