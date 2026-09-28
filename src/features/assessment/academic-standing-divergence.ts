/**
 * 6D.4.3 — Divergência pós-situação / pós-Conselho.
 *
 * Projeção pura: compara a situação oficial registrada (fatos congelados +
 * deliberação usada) com os fatos e a deliberação oficial VIGENTES. Nunca
 * altera a situação, não reabre Conselho e não cria retificação. Impacto só é
 * determinado re-executando o motor com a regra HISTÓRICA exata do registro;
 * sem ela, o impacto é indeterminado (falha fechada).
 */
import { determineAcademicStanding } from "./academic-standing-engine";
import type {
  AcademicStandingRecord,
  AcademicStandingRuleSet,
  InstitutionalDeliberationRecord,
  ResolvedFact,
  StandingPendency,
} from "./academic-standing-types";

export type StandingDivergenceChange =
  | { kind: "fact-value"; factId: string; before: unknown; after: unknown }
  | { kind: "fact-source-version"; factId: string; sourceId: string; before?: number; after?: number }
  | { kind: "fact-missing-now"; factId: string }
  | { kind: "deliberation"; beforeId?: string; afterId?: string; beforeMinute?: string; afterMinute?: string };

export type StandingDivergence =
  | { status: "no-divergence"; recordId: string }
  | {
      status: "divergent";
      recordId: string;
      changes: readonly StandingDivergenceChange[];
      impact:
        | { kind: "impact-undetermined"; reason: string }
        | { kind: "standing-unchanged"; standingId: string | null }
        | { kind: "standing-would-change"; before: string | null; after: string | null }
        | { kind: "determination-blocked"; pendencies: readonly StandingPendency[] };
      /** Rito de regularização não é inventado: pertence a política futura. */
      regularization: "not-declared";
    };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function projectStandingDivergence(input: {
  record: AcademicStandingRecord;
  currentFacts: readonly ResolvedFact[];
  currentDeliberation?: InstitutionalDeliberationRecord;
  /** Regra EXATA do registro (id + versão). Ausente ⇒ impacto indeterminado. */
  historicalRuleSet?: AcademicStandingRuleSet;
  studentName?: string;
}): StandingDivergence {
  const { record } = input;
  const changes: StandingDivergenceChange[] = [];
  const now = new Map(input.currentFacts.map((f) => [`${f.factId}|${f.scopeKey}`, f]));
  for (const before of record.facts) {
    const after = now.get(`${before.factId}|${before.scopeKey}`);
    if (!after) {
      changes.push({ kind: "fact-missing-now", factId: before.factId });
      continue;
    }
    if (!same(before.value, after.value))
      changes.push({ kind: "fact-value", factId: before.factId, before: before.value, after: after.value });
    for (const src of before.provenance.sources) {
      const cur = after.provenance.sources.find((s) => s.kind === src.kind && s.id === src.id);
      if (cur && cur.version !== src.version)
        changes.push({ kind: "fact-source-version", factId: before.factId, sourceId: src.id, before: src.version, after: cur.version });
    }
  }
  const afterDelib = input.currentDeliberation;
  const beforeMinute = record.deliberationSource
    ? `${record.deliberationSource.minuteId}#${record.deliberationSource.minuteVersion}`
    : undefined;
  const afterMinute = afterDelib?.minuteSource
    ? `${afterDelib.minuteSource.minuteId}#${afterDelib.minuteSource.minuteVersion}`
    : undefined;
  if (record.deliberationId !== afterDelib?.id || beforeMinute !== afterMinute)
    changes.push({
      kind: "deliberation",
      ...(record.deliberationId ? { beforeId: record.deliberationId } : {}),
      ...(afterDelib ? { afterId: afterDelib.id } : {}),
      ...(beforeMinute ? { beforeMinute } : {}),
      ...(afterMinute ? { afterMinute } : {}),
    });

  if (changes.length === 0) return { status: "no-divergence", recordId: record.id };

  const rule = input.historicalRuleSet;
  if (!rule || rule.id !== record.ruleSetId || rule.version !== record.ruleSetVersion)
    return {
      status: "divergent",
      recordId: record.id,
      changes,
      impact: {
        kind: "impact-undetermined",
        reason: "A regra histórica exata do registro não está disponível; o impacto não é presumido.",
      },
      regularization: "not-declared",
    };

  const redetermined = determineAcademicStanding({
    cycle: { id: record.cycleId, kindId: record.cycleKindId, academicYearId: record.academicYearId },
    studentId: record.studentId,
    studentName: input.studentName ?? record.studentId,
    ruleSet: rule,
    facts: input.currentFacts as ResolvedFact[],
    factPendencies: [],
    cycleComplete: true,
    factsOfficial: true,
    ...(afterDelib ? { deliberation: afterDelib } : {}),
  });
  const impact =
    redetermined.operationalState !== "situacao-determinada"
      ? { kind: "determination-blocked" as const, pendencies: redetermined.pendencies }
      : redetermined.standingId === record.standingId
        ? { kind: "standing-unchanged" as const, standingId: record.standingId }
        : { kind: "standing-would-change" as const, before: record.standingId, after: redetermined.standingId };
  return { status: "divergent", recordId: record.id, changes, impact, regularization: "not-declared" };
}
