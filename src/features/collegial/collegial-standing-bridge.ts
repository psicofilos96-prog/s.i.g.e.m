/**
 * 6D.4.1 — Ponte estrutural Colegiado → Situação acadêmica.
 *
 * Fonte ÚNICA de deliberações: o colegiado. Decisão normativa (6D.4.1b):
 * deliberação só produz efeito na Situação Acadêmica depois que a ata da
 * sessão for oficialmente encerrada. Por isso a ponte lê EXCLUSIVAMENTE as
 * deliberações congeladas na versão vigente de cada ata encerrada; deliberação
 * registrada em sessão aberta é preparação e nunca é consumida.
 *
 * A ponte é tradução pura: não decide nem valida competência — isso continua
 * exclusivo de `determineAcademicStanding` contra a regra homologada.
 */
import { standingScopeKey } from "@/features/assessment/academic-standing-store";
import type { InstitutionalDeliberationRecord } from "@/features/assessment/academic-standing-types";
import type { CollegialDeliberation, StructuredMinute } from "./collegial-types";

/** Chave canônica do escopo: a declarada ou a derivada de ciclo + estudante. */
export function scopeKeyOf(d: CollegialDeliberation): string | undefined {
  if (d.scopeKey) return d.scopeKey;
  return d.studentId && d.cycleId ? standingScopeKey({ cycleId: d.cycleId, studentId: d.studentId }) : undefined;
}

export function collegialDeliberationToStandingRecord(
  deliberation: CollegialDeliberation,
  minute: Pick<StructuredMinute, "id" | "version" | "sessionId" | "closedAt">,
  bodyLabelOf: (bodyId: string) => string | undefined,
): InstitutionalDeliberationRecord | undefined {
  const scopeKey = scopeKeyOf(deliberation);
  if (!deliberation.studentId || !deliberation.cycleId || !scopeKey) return undefined;
  return {
    id: deliberation.id,
    scopeKey,
    cycleId: deliberation.cycleId,
    studentId: deliberation.studentId,
    bodyId: deliberation.bodyId,
    bodyLabel: bodyLabelOf(deliberation.bodyId) ?? deliberation.bodyId,
    competenceId: deliberation.competenceId,
    competenceLabel: deliberation.competenceLabel,
    actor: { ...deliberation.actor },
    consideredFacts: deliberation.dossier.facts.map((fact) => ({
      factId: fact.factId,
      scopeKey: fact.scopeKey,
      value: fact.value,
      provenance: fact.provenance,
    })),
    decision: {
      ...(deliberation.decision.standingId ? { standingId: deliberation.decision.standingId } : {}),
      note: deliberation.decision.note ?? deliberation.decision.outcomeLabel,
    },
    rationale: deliberation.rationale,
    at: deliberation.at,
    minuteSource: {
      sessionId: minute.sessionId,
      minuteId: minute.id,
      minuteVersion: minute.version,
      closedAt: minute.closedAt,
    },
    ...(deliberation.documentRefs ? { documentRefs: deliberation.documentRefs } : {}),
  };
}

/** Versão vigente de cada ata (a que não foi superada por retificação). */
export function currentMinutes(minutes: readonly StructuredMinute[]): StructuredMinute[] {
  const superseded = new Set(minutes.map((m) => m.precedingMinuteId).filter(Boolean) as string[]);
  return minutes.filter((m) => !superseded.has(m.id));
}

/**
 * Deliberação OFICIAL vigente do escopo: a mais recente dentre as congeladas
 * em atas encerradas vigentes. Ausência ⇒ undefined (nunca presunção).
 */
export function officialStandingDeliberationFor(
  minutes: readonly StructuredMinute[],
  scopeKey: string,
  bodyLabelOf: (bodyId: string) => string | undefined,
): InstitutionalDeliberationRecord | undefined {
  let best: { d: CollegialDeliberation; m: StructuredMinute } | undefined;
  for (const minute of currentMinutes(minutes))
    for (const d of minute.deliberations) {
      if (scopeKeyOf(d) !== scopeKey) continue;
      const key = `${minute.closedAt}|${d.at}`;
      if (!best || key > `${best.m.closedAt}|${best.d.at}`) best = { d, m: minute };
    }
  return best ? collegialDeliberationToStandingRecord(best.d, best.m, bodyLabelOf) : undefined;
}

/** Deliberações em preparação (sessão sem ata encerrada): só apresentação. */
export function preparingDeliberationsFor(
  deliberations: readonly CollegialDeliberation[],
  minutes: readonly StructuredMinute[],
  scopeKey: string,
): CollegialDeliberation[] {
  const closedSessions = new Set(minutes.map((m) => m.sessionId));
  return deliberations.filter((d) => scopeKeyOf(d) === scopeKey && !closedSessions.has(d.sessionId));
}
