// NEI.3 — espelho puro das regras do banco (0336): situação da oferta AEE e planos PAEE/PEI.
export const OFFER_STATUS = ["planejada", "iniciada", "interrompida", "retomada", "encerrada"] as const;
export type OfferStatus = (typeof OFFER_STATUS)[number];
export const OFFER_LABEL: Record<OfferStatus | "sem-registro", string> = {
  planejada: "Planejada", iniciada: "Iniciada", interrompida: "Interrompida", retomada: "Retomada", encerrada: "Encerrada", "sem-registro": "Sem situação registrada",
};
const NEXT: Record<OfferStatus, OfferStatus[]> = {
  planejada: ["iniciada", "encerrada"], iniciada: ["interrompida", "encerrada"], interrompida: ["retomada", "encerrada"], retomada: ["interrompida", "encerrada"], encerrada: [],
};
export function offerNext(from: OfferStatus | "sem-registro"): OfferStatus[] { return from === "sem-registro" ? ["planejada", "iniciada"] : NEXT[from]; }
export function offerProblem(from: OfferStatus | "sem-registro", to: OfferStatus, cause: string): string | null {
  if (!offerNext(from).includes(to)) return "Essa situação não segue a atual.";
  if ((to === "interrompida" || to === "encerrada") && cause.trim().length < 5) return "Informe a causa (mínimo 5 caracteres).";
  return null;
}

export type Slot = { service_logical_id: string; weekday: number; starts_at: string; ends_at: string; conflict_professional: boolean; conflict_room: boolean };
export const WEEKDAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function conflictLabel(s: Slot): string | null {
  const p = [s.conflict_professional ? "mesmo profissional" : null, s.conflict_room ? "mesma sala" : null].filter(Boolean);
  return p.length ? `Conflito: ${p.join(" e ")} no mesmo horário` : null;
}

export type PlanKind = "paee" | "pei";
export const PLAN_LABEL: Record<PlanKind, string> = { paee: "Plano de AEE (PAEE)", pei: "Plano Pedagógico Individualizado (PEI)" };
export type Meta = { texto: string; prazo?: string | null };
export type PlanContent = { objetivos: string; metas: Meta[]; estrategias: string; recursos: string; avaliacao: string };
export const EMPTY_PLAN: PlanContent = { objetivos: "", metas: [], estrategias: "", recursos: "", avaliacao: "" };
export const PLAN_FIELDS: { key: Exclude<keyof PlanContent, "metas">; label: string }[] = [
  { key: "objetivos", label: "Objetivos" }, { key: "estrategias", label: "Estratégias e atividades" }, { key: "recursos", label: "Recursos e acessibilidade" }, { key: "avaliacao", label: "Acompanhamento e avaliação" },
];
export function canWritePlan(role: "gestao" | "aee", kind: PlanKind) { return role === "gestao" || kind === "paee"; }
/** Mesmo critério de `nei_plan_content_problem`: meta com texto ≥ 3 e prazo AAAA-MM-DD opcional. Prazo só se informado. */
export function planProblem(c: PlanContent): string | null {
  for (const m of c.metas) {
    if (m.texto.trim().length < 3) return "Toda meta precisa de descrição.";
    if (m.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(m.prazo)) return "Prazo inválido.";
  }
  return null;
}
export type PlanStatus = "rascunho" | "em-revisao" | "concluido";
export const STATUS_LABEL: Record<PlanStatus, string> = { rascunho: "Rascunho", "em-revisao": "Em revisão", concluido: "Concluído pela equipe" };
