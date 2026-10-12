/**
 * Lote 20 — integrações funcionais do Desenvolvimento (espelho puro do banco; nada é gravado aqui).
 * frequência registrada → conclusão; resultado da rubrica do critério → conclusão; conclusão confirmada → certificado;
 * formação externa validada → histórico (carga à parte); programa → impacto sem causalidade.
 */
import { attendanceSummary, type AttendanceRecord } from "./formation-attendance";
import { computeCompletion, type CompletionAssessment, type CompletionCriteria, type Outcome } from "./completion-engine";
import { versionState, type ExtReview } from "./external-trainings";
import { CAUSALITY_NOTE, observedChange, readingProblems, type Observation } from "./evaluation-impact";

export interface RubricResult { rubricVersionId: string; outcome: Outcome; reviewPending: boolean }

/**
 * Entradas da apuração montadas só de evidências: frequência pelos registros vigentes por unidade prevista
 * (não lançado/ambíguo ⇒ null, nunca falta) e aproveitamento só se o resultado é da rubrica do critério.
 */
export function completionFromEvidence(
  criteria: CompletionCriteria,
  evidence: { expectedUnits: readonly string[]; attendance: readonly AttendanceRecord[]; activitiesDelivered: number; results: readonly RubricResult[] },
): CompletionAssessment & { resultIgnored: number } {
  const s = attendanceSummary(evidence.expectedUnits, evidence.attendance);
  const current = new Map<string, AttendanceRecord>();
  for (const r of evidence.attendance) { const c = current.get(r.unitId); if (!c || r.version > c.version) current.set(r.unitId, r); }
  const units = evidence.expectedUnits.map((u) => ({
    unit: u, status: s.notRecorded.includes(u) || s.ambiguous.includes(u) ? null : current.get(u)?.status ?? null,
  }));
  const matching = criteria.rubricVersionId == null ? [] : evidence.results.filter((r) => r.rubricVersionId === criteria.rubricVersionId);
  const result = matching.at(-1) ?? null;
  const a = computeCompletion(criteria, {
    units, activitiesDelivered: evidence.activitiesDelivered,
    learningResult: result ? { outcome: result.outcome, reviewPending: result.reviewPending } : null,
  });
  return { ...a, resultIgnored: evidence.results.length - matching.length };
}

/** Certificado só nasce de conclusão confirmada por pessoa ≠ participante (banco: `dev:not-concluded`). */
export function certificateFromCompletion(x: { confirmation: { decision: "conclusao" | "nao-conclusao"; confirmer: string } | null; participant: string }): string[] {
  if (!x.confirmation) return ["Sem conclusão confirmada: certificado não pode ser preparado"];
  if (x.confirmation.decision !== "conclusao") return ["Não conclusão confirmada: não há certificado"];
  if (x.confirmation.confirmer === x.participant) return ["Confirmação pelo próprio participante não vale"];
  return [];
}

export interface ExternalVersionRow { id: string; training_id: string; version: number; title: string; provider: string; hours_minutes: number; period_start: string; period_end: string }
export interface ExternalHistoryItem extends ExternalVersionRow { state: string }

/** Só a última versão de cada formação da própria pessoa; carga validada fica separada da carga interna concluída. */
export function externalHistory(ownTrainingIds: ReadonlySet<string>, versions: readonly ExternalVersionRow[], reviews: readonly { version_id: string; seq: number; stage: string; outcome: string }[]) {
  const latest = new Map<string, ExternalVersionRow>();
  for (const v of versions) {
    if (!ownTrainingIds.has(v.training_id)) continue;
    const c = latest.get(v.training_id); if (!c || v.version > c.version) latest.set(v.training_id, v);
  }
  const items: ExternalHistoryItem[] = [...latest.values()].map((v) => ({ ...v, state: versionState(reviews.filter((r) => r.version_id === v.id) as unknown as ExtReview[]) }));
  const validatedMinutes = items.filter((i) => i.state === "validado").reduce((s, i) => s + i.hours_minutes, 0);
  return { items, validatedMinutes };
}

const CAUSAL_CLAIM = /\b(caus(ou|aram|a)|gra[cç]as [àa]|devido [àa] forma[cç][aã]o|em raz[aã]o da forma[cç][aã]o|resultado direto|comprova(m)? (o )?impacto)\b/i;

/** Impacto do programa: comparação descritiva com leitura humana; afirmação causal na interpretação é recusada. */
export function programImpact(obs: Observation[], schoolId: string | null, reading: { interpretation: string; limitations: string } | null) {
  const change = observedChange(obs, schoolId);
  const problems = reading ? [...readingProblems(reading), ...(CAUSAL_CLAIM.test(reading.interpretation) ? ["Interpretação não pode afirmar causalidade"] : [])] : ["Sem leitura humana registrada"];
  return { change, causal: false as const, note: CAUSALITY_NOTE, problems };
}
