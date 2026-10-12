// L18 — formações externas (migration 0448). Validar ≠ reconhecer para progressão (ato do DP, fora deste módulo).
export type ExtStage = "conferencia" | "analise" | "decisao";
export type ExtOutcome = "conforme" | "divergente" | "favoravel" | "desfavoravel" | "devolvido" | "validado" | "indeferido";
export interface ExtReview { seq: number; stage: ExtStage; outcome: ExtOutcome; reviewer: string }

export const PROGRESSION_NOTE = "Registro e validação não equivalem a reconhecimento para progressão funcional.";

const ALLOWED: Record<ExtStage, ExtOutcome[]> = {
  conferencia: ["conforme", "divergente", "devolvido"],
  analise: ["favoravel", "desfavoravel", "devolvido"],
  decisao: ["validado", "indeferido", "devolvido"],
};
const NEXT: Record<string, ExtStage | null> = { none: "conferencia", conferencia: "analise", analise: "decisao", decisao: null };

export function versionState(reviews: ExtReview[]): string {
  const last = [...reviews].sort((a, b) => b.seq - a.seq)[0];
  if (!last) return "submetida";
  if (["validado", "indeferido", "devolvido"].includes(last.outcome)) return last.outcome;
  return last.stage === "conferencia" ? "conferida" : "analisada";
}

export function reviewProblems(reviews: ExtReview[], x: { stage: ExtStage; outcome: ExtOutcome; reviewer: string; owner: string; grounds: string }): string[] {
  const p: string[] = [];
  const state = versionState(reviews);
  if (["validado", "indeferido", "devolvido"].includes(state)) p.push("Versão encerrada");
  const last = [...reviews].sort((a, b) => b.seq - a.seq)[0];
  if (NEXT[last?.stage ?? "none"] !== x.stage) p.push("Etapa fora de ordem");
  if (!ALLOWED[x.stage].includes(x.outcome)) p.push("Resultado incompatível com a etapa");
  if (x.reviewer === x.owner) p.push("Titular não revisa a própria formação");
  if (reviews.some((r) => r.reviewer === x.reviewer)) p.push("Cada etapa por pessoa distinta");
  if (x.grounds.trim().length < 20) p.push("Fundamentação obrigatória");
  if (x.outcome === "validado" && reviews.some((r) => r.outcome === "divergente" || r.outcome === "desfavoravel")) p.push("Validação contradiz etapa anterior");
  return p;
}

export function canResubmit(state: string): boolean { return state === "devolvido" || state === "indeferido"; }
