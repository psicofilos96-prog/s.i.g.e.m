// NEI.2 — espelho puro das regras do banco (0334): etapas do caso e seções da ficha.
export const NEI_STAGES = ["solicitacao", "triagem", "analise", "providencias", "designacao", "execucao", "monitoramento", "reavaliacao", "encerramento"] as const;
export type NeiStage = (typeof NEI_STAGES)[number];
export const STAGE_LABEL: Record<NeiStage, string> = {
  solicitacao: "Solicitação", triagem: "Triagem", analise: "Análise", providencias: "Providências", designacao: "Designação",
  execucao: "Execução", monitoramento: "Monitoramento", reavaliacao: "Reavaliação", encerramento: "Encerramento",
};
const NEXT: Record<NeiStage, NeiStage[]> = {
  solicitacao: ["triagem"], triagem: ["analise", "encerramento"], analise: ["providencias", "encerramento"], providencias: ["designacao"],
  designacao: ["execucao"], execucao: ["monitoramento"], monitoramento: ["reavaliacao", "encerramento"],
  reavaliacao: ["execucao", "providencias", "encerramento"], encerramento: [],
};
/** Etapas admitidas a partir da vigente (a própria = andamento sem mudar de etapa). Encerrado é terminal. */
export function allowedNext(from: NeiStage): NeiStage[] { return from === "encerramento" ? [] : [from, ...NEXT[from]]; }

export const NEI_SECTIONS = ["necessidades", "acessibilidade", "aee", "planos", "apoios", "avaliacoes", "encaminhamentos"] as const;
export type NeiSection = (typeof NEI_SECTIONS)[number];
export const SECTION_LABEL: Record<NeiSection, string> = {
  necessidades: "Necessidades educacionais", acessibilidade: "Acessibilidade", aee: "AEE", planos: "Planos (PEI/PAEE)",
  apoios: "Apoios", avaliacoes: "Avaliações pedagógicas", encaminhamentos: "Encaminhamentos",
};
export function canWriteSection(role: "gestao" | "aee", s: NeiSection) { return role === "gestao" || s === "aee"; }

/** Problema local antes de enviar um andamento (o banco revalida tudo). */
export function eventProblem(from: NeiStage, to: NeiStage, note: string): string | null {
  if (!allowedNext(from).includes(to)) return "Essa etapa não segue a etapa atual.";
  if (note.trim().length < 3) return "Descreva o andamento.";
  if (to === "encerramento" && note.trim().length < 10) return "O encerramento exige justificativa (mínimo 10 caracteres).";
  return null;
}

export type CaseEvent = { seq: number; stage: NeiStage; note: string; priority: string | null; due_date: string | null; assigned: boolean; assigned_to_me: boolean; recorded_at: string; mine: boolean };
export type NeiCase = { id: string; request_summary: string; requested_by_label: string | null; opened_at: string; events: CaseEvent[] };
export function currentEvent(c: NeiCase): CaseEvent { return c.events[c.events.length - 1]!; }
/** Prazo só existe se declarado; vencido só compara com a data informada. */
export function isOverdue(e: CaseEvent, today: string): boolean { return e.stage !== "encerramento" && !!e.due_date && e.due_date < today; }

export type Entry = { id: string; section: NeiSection; content: string; supersedes_id: string | null; correction_reason: string | null; recorded_at: string; mine: boolean; current: boolean };
export type TimelineItem = { at: string; kind: "ficha" | "caso"; text: string };
export function timeline(entries: Entry[], cases: NeiCase[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...entries.map((e) => ({ at: e.recorded_at, kind: "ficha" as const, text: `${SECTION_LABEL[e.section]}: ${e.supersedes_id ? "correção" : "registro"}` })),
    ...cases.flatMap((c) => c.events.map((ev) => ({ at: ev.recorded_at, kind: "caso" as const, text: `Caso — ${STAGE_LABEL[ev.stage]}` }))),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
