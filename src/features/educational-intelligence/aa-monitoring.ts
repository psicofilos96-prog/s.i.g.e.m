// SIGEM 2.0 A&A Lote 14 — Monitoramento e reavaliação. Núcleo puro sobre eventos do plano
// (cadeia 0369 / fluxo do Lote 13). Estado é projeção do último evento; nada é gravado aqui.

export type PlanState = "planejada" | "em-execucao" | "aguardando-avaliacao" | "concluida" | "replanejada" | "encerrada-justificada";
export type StateEvent = { seq: number; state: PlanState; at: string; by: string; reason: string | null };

const NEXT: Record<PlanState, PlanState[]> = {
  "planejada": ["em-execucao", "encerrada-justificada"],
  "em-execucao": ["aguardando-avaliacao", "replanejada", "encerrada-justificada"],
  "aguardando-avaliacao": ["concluida", "replanejada", "encerrada-justificada"],
  "replanejada": ["em-execucao", "encerrada-justificada"],
  "concluida": [], "encerrada-justificada": [],
};

export function transition(events: StateEvent[], expectedSeq: number, to: PlanState, by: string, at: string, reason: string | null): { ok: true; event: StateEvent } | { ok: false; reason: string } {
  const last = events.at(-1);
  if ((last?.seq ?? 0) !== expectedSeq) return { ok: false, reason: "base desatualizada" };
  if (!last) return to === "planejada" ? { ok: true, event: { seq: 1, state: to, at, by, reason } } : { ok: false, reason: "plano nasce planejado" };
  if (!NEXT[last.state].includes(to)) return { ok: false, reason: `${last.state} → ${to} não permitido` };
  if ((to === "replanejada" || to === "encerrada-justificada") && !reason?.trim()) return { ok: false, reason: "replanejar ou encerrar exige justificativa" };
  return { ok: true, event: { seq: expectedSeq + 1, state: to, at, by, reason } };
}

export const stateOf = (e: StateEvent[]) => e.at(-1)?.state ?? null;

export type Action = { id: string; planned: string; due: string | null; doneAt: string | null; evidenceRefs: string[] };

export function actionsReport(actions: Action[], today: string) {
  const done = actions.filter(a => a.doneAt);
  return {
    planned: actions.length, done: done.length,
    doneWithoutEvidence: done.filter(a => !a.evidenceRefs.length).map(a => a.id),
    late: actions.filter(a => !a.doneAt && a.due && today > a.due).map(a => a.id),
    withoutDue: actions.filter(a => !a.due).map(a => a.id),
  };
}

export function alerts(p: { state: PlanState | null; actions: Action[]; today: string; reassessmentDue: string | null; reassessments: number }) {
  const r = actionsReport(p.actions, p.today);
  const out: { kind: string; detail: string }[] = [];
  if (r.late.length) out.push({ kind: "acao-atrasada", detail: `${r.late.length} ação(ões) após o prazo` });
  if (r.doneWithoutEvidence.length) out.push({ kind: "sem-evidencia", detail: `${r.doneWithoutEvidence.length} ação(ões) realizadas sem evidência` });
  if (p.state === "aguardando-avaliacao" && p.reassessmentDue && p.today > p.reassessmentDue && p.reassessments === 0) out.push({ kind: "reavaliacao-pendente", detail: "prazo de reavaliação vencido" });
  return out;
}

export type Measure = { id: string; planId: string | null; date: string; instrumentVersion: string; scaleKey: string; skill: string; populationKey: string; n: number; rate: number | null };

/** Evolução: cada ponto declara a comparabilidade com a linha de base; nunca atribui causa. */
export function evolution(planId: string, baseline: Measure, measures: Measure[]) {
  const linked = measures.filter(m => m.planId === planId).sort((a, b) => a.date.localeCompare(b.date));
  const unlinked = measures.filter(m => m.planId !== planId).length;
  const points = linked.map(m => {
    const diff: string[] = [];
    if (m.instrumentVersion !== baseline.instrumentVersion) diff.push("instrumento");
    if (m.scaleKey !== baseline.scaleKey) diff.push("escala");
    if (m.skill !== baseline.skill) diff.push("habilidade");
    if (m.populationKey !== baseline.populationKey) diff.push("população");
    const comparable = !diff.includes("escala") && !diff.includes("habilidade");
    return { id: m.id, date: m.date, n: m.n, rate: m.rate, comparable, differences: diff, delta: comparable && m.rate !== null && baseline.rate !== null ? m.rate - baseline.rate : null };
  });
  return { points, notes: ["evolução descreve medidas; não prova que a intervenção causou a mudança", ...(unlinked ? [`${unlinked} medida(s) sem vínculo ao plano fora da série`] : [])] };
}
