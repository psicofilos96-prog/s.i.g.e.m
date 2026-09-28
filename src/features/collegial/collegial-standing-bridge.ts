/**
 * 6D.4.1 — Ponte estrutural Colegiado → Situação acadêmica.
 *
 * Fonte ÚNICA de deliberações: `collegial-store`. A situação acadêmica não
 * mantém lista própria; ela lê a deliberação registrada pelo colegiado e o
 * motor (`determineAcademicStanding`) continua sendo o único a validar órgão,
 * competência e situações autorizadas pela regra homologada.
 *
 * A ponte é tradução pura: não decide, não filtra por política, não cria
 * situação. Seleção = deliberação mais recente do escopo (mesma semântica do
 * canal anterior), para não introduzir norma nova.
 */
import type { InstitutionalDeliberationRecord } from "@/features/assessment/academic-standing-types";
import type { CollegialDeliberation } from "./collegial-types";

export function collegialDeliberationToStandingRecord(
  deliberation: CollegialDeliberation,
  bodyLabelOf: (bodyId: string) => string | undefined,
): InstitutionalDeliberationRecord | undefined {
  if (!deliberation.studentId || !deliberation.cycleId || !deliberation.scopeKey) return undefined;
  return {
    id: deliberation.id,
    scopeKey: deliberation.scopeKey,
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
    ...(deliberation.documentRefs ? { documentRefs: deliberation.documentRefs } : {}),
  };
}

/** Deliberação vigente do escopo, lida do colegiado. Ausência ⇒ undefined. */
export function standingDeliberationFor(
  deliberations: readonly CollegialDeliberation[],
  scopeKey: string,
  bodyLabelOf: (bodyId: string) => string | undefined,
): InstitutionalDeliberationRecord | undefined {
  const latest = deliberations
    .filter((item) => item.scopeKey === scopeKey)
    .reduce<CollegialDeliberation | undefined>(
      (acc, item) => (!acc || item.at > acc.at ? item : acc),
      undefined,
    );
  return latest ? collegialDeliberationToStandingRecord(latest, bodyLabelOf) : undefined;
}
