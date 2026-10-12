// L15 — Acompanhamento pós-retorno. Projeção pura sobre fontes já canônicas:
// retorno L14, frequência oficial (L02, só a partir do retorno), barreiras L09,
// plano L12. Encerramento e reabertura são eventos do motor de Tramitação (L07)
// com justificativa; reincidência reabre o MESMO caso e preserva o histórico.
import { monitorAttendance, type MonitoringInput, type Monitoring } from "./attendance-monitoring";
import type { BarrierView } from "./barrier-catalog";
import type { PlanView } from "./individual-plan";

export interface PostReturnInput {
  returnedOn: string | null; // retorno L14 registrado; null = sem retorno
  attendance: Omit<MonitoringInput, "lessons"> & { lessons: MonitoringInput["lessons"] };
  barriers: readonly BarrierView[] | null; // null = fonte não lida
  plan: PlanView | null | undefined;      // undefined = fonte não lida; null = sem plano
}
export interface PostReturnView {
  status: "sem-retorno" | "acompanhando";
  attendanceAfterReturn: Monitoring | null;
  remainingBarriers: BarrierView[] | null;
  openActions: number | null;
  needsReassessment: boolean | null;
  closureBlockers: string[];
}

export function projectPostReturn(i: PostReturnInput): PostReturnView {
  if (!i.returnedOn) return { status: "sem-retorno", attendanceAfterReturn: null, remainingBarriers: null, openActions: null, needsReassessment: null, closureBlockers: ["sem-retorno-registrado"] };
  const from = i.returnedOn;
  const att = monitorAttendance({ ...i.attendance, lessons: i.attendance.lessons.filter((l) => l.date >= from) });
  const remaining = i.barriers ? i.barriers.filter((b) => b.status === "relatada" || b.status === "confirmada") : null;
  const openActions = i.plan === undefined ? null : i.plan === null ? 0 : i.plan.actions.filter((a) => a.state !== "realizada").length;
  const needs = i.plan === undefined ? null : i.plan === null ? false : i.plan.needsReassessment;
  const blockers: string[] = [];
  if (att.status !== "ok" || att.marked === 0) blockers.push("frequencia-pos-retorno-indeterminada");
  if (remaining === null) blockers.push("barreiras-nao-lidas"); else if (remaining.length) blockers.push("barreiras-remanescentes");
  if (openActions === null) blockers.push("plano-nao-lido"); else if (openActions > 0) blockers.push("acoes-em-aberto");
  if (needs) blockers.push("reavaliacao-pendente");
  return { status: "acompanhando", attendanceAfterReturn: att, remainingBarriers: remaining, openActions, needsReassessment: needs, closureBlockers: blockers };
}

/** Encerramento: sempre por pessoa, com fundamento; bloqueios só podem ser
 *  superados declarando-os um a um na justificativa (nunca silenciosamente). */
export function closureIssues(v: PostReturnView, d: { justification: string; acknowledged: readonly string[]; person: string | null }): string[] {
  const out: string[] = [];
  if (!d.person) out.push("sem-pessoa");
  if (d.justification.trim().length < 20) out.push("sem-fundamento");
  if (v.status === "sem-retorno" && !d.acknowledged.includes("sem-retorno-registrado")) out.push("sem-retorno-registrado");
  for (const b of v.closureBlockers) if (!d.acknowledged.includes(b) && !out.includes(b)) out.push(b);
  return out;
}

/** Reincidência reabre o caso canônico encerrado (L07 'reabertura'); nunca abre caso novo nem apaga o encerramento. */
export function reopenIssues(c: { closed: boolean }, d: { justification: string; evidenceRef: string | null; person: string | null }): string[] {
  const out: string[] = [];
  if (!c.closed) out.push("caso-nao-encerrado");
  if (!d.person) out.push("sem-pessoa");
  if (d.justification.trim().length < 20) out.push("sem-fundamento");
  if (!d.evidenceRef) out.push("sem-evidencia-de-reincidencia");
  return out;
}
export const reopenKey = (caseId: string, evidenceRef: string) => `perm-reopen|${caseId}|${evidenceRef}`;
