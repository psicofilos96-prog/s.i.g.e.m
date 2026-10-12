// L15 — motor de conclusão por oferta (turma). Espelho puro de `dev_completion_compute` (migration 0444).
// Inscrição ≠ participação ≠ conclusão: apuração calcula, só a confirmação por competente conclui.
export type AttendanceStatus = "presente" | "ausente" | "ausencia-justificada";
export type Outcome = "atingiu" | "atingiu-parcialmente" | "nao-atingiu" | "nao-avaliavel";
export interface CompletionCriteria {
  minAttendancePct: number;
  minActivitiesDelivered: number | null;
  rubricVersionId: string | null;
  acceptedOutcomes: Outcome[];
  approved: boolean;
}
export interface CompletionInputs {
  units: { unit: string; status: AttendanceStatus | null }[]; // null = não lançado
  activitiesDelivered: number;
  learningResult: { outcome: Outcome; reviewPending: boolean } | null;
}
export type Verdict = "apto" | "nao-apto" | "indeterminado";
export interface CompletionAssessment { verdict: Verdict; attendancePct: number | null; reasons: string[]; indeterminate: string[] }

export function criteriaProblems(c: CompletionCriteria): string[] {
  const p: string[] = [];
  if (!(c.minAttendancePct >= 0 && c.minAttendancePct <= 100)) p.push("Frequência mínima fora de 0–100");
  if (c.minActivitiesDelivered !== null && c.minActivitiesDelivered < 0) p.push("Mínimo de atividades negativo");
  if ((c.rubricVersionId === null) !== (c.acceptedOutcomes.length === 0)) p.push("Aproveitamento exige rubrica e desfechos aceitos juntos");
  if (c.acceptedOutcomes.some((o) => o === "nao-atingiu" || o === "nao-avaliavel")) p.push("Desfecho não aceitável para conclusão");
  return p;
}

export function computeCompletion(c: CompletionCriteria, i: CompletionInputs): CompletionAssessment {
  if (!c.approved) throw new Error("dev:criteria-not-approved");
  const reasons: string[] = [], indet: string[] = [];
  const missing = i.units.filter((u) => u.status === null).length;
  const present = i.units.filter((u) => u.status === "presente").length;
  const absent = i.units.filter((u) => u.status === "ausente").length;
  if (missing > 0) indet.push(`${missing} unidade(s) sem frequência lançada`);
  const pct = missing === 0 && present + absent > 0 ? Math.round((present * 10000) / (present + absent)) / 100 : null;
  if (missing === 0 && present + absent === 0) indet.push("nenhuma unidade com presença ou falta");
  if (pct !== null && pct < c.minAttendancePct) reasons.push(`frequência ${pct}% < ${c.minAttendancePct}%`);
  if (c.minActivitiesDelivered !== null && i.activitiesDelivered < c.minActivitiesDelivered)
    reasons.push(`${i.activitiesDelivered} de ${c.minActivitiesDelivered} atividades entregues exigidas`);
  if (c.rubricVersionId !== null) {
    const r = i.learningResult;
    if (!r) indet.push("sem resultado de aproveitamento registrado");
    else if (r.reviewPending) indet.push("revisão de resultado pendente");
    else if (r.outcome === "nao-avaliavel") indet.push("aproveitamento não avaliável");
    else if (!c.acceptedOutcomes.includes(r.outcome)) reasons.push(`aproveitamento "${r.outcome}" não aceito`);
  }
  const verdict: Verdict = reasons.length ? "nao-apto" : indet.length ? "indeterminado" : "apto";
  return { verdict, attendancePct: pct, reasons, indeterminate: indet };
}

export function confirmationProblems(a: { verdict: Verdict; participant: string; storedSha: string },
  x: { decision: "conclusao" | "nao-conclusao"; confirmer: string; recomputedSha: string }): string[] {
  const p: string[] = [];
  if (x.confirmer === a.participant) p.push("Participante não confirma a própria conclusão");
  if (x.recomputedSha !== a.storedSha) p.push("Apuração desatualizada: refaça a apuração");
  if (!((x.decision === "conclusao" && a.verdict === "apto") || (x.decision === "nao-conclusao" && a.verdict === "nao-apto")))
    p.push("Decisão incompatível com a apuração");
  return p;
}
