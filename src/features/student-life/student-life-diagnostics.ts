/**
 * Etapa 13A — Códigos estruturados de diagnóstico da Vida Escolar.
 *
 * O código é o CONTRATO consumido por sistema, consultas e CIECE.
 * A mensagem é apresentação humana complementar e jamais critério de decisão.
 */
import type { StudentLifeDiagnostic, StudentLifeEventScope } from "./student-life-types";

export const STUDENT_LIFE_DIAGNOSTIC_CODES = {
  transitionUndeclared: "SL-TRANS-UNDECLARED",
  transitionReasonMissing: "SL-TRANS-REASON-MISSING",
  transitionReasonNotAllowed: "SL-TRANS-REASON-NOT-ALLOWED",
  transitionRequirementPending: "SL-TRANS-REQUIREMENT-PENDING",
  transitionActMissing: "SL-TRANS-ACT-MISSING",
  bondOverlappingValidity: "SL-BOND-OVERLAPPING-VALIDITY",
  bondReturnStrategyUndeclared: "SL-BOND-RETURN-STRATEGY-UNDECLARED",
  participationIncompatible: "SL-PART-COMBINATION-INCOMPATIBLE",
  participationCombinationUndeclared: "SL-PART-COMBINATION-UNDECLARED",
  participationPrincipalMissing: "SL-PART-PRINCIPAL-MISSING",
  eventPayloadFieldMissing: "SL-EVENT-PAYLOAD-FIELD-MISSING",
  eventPayloadFieldType: "SL-EVENT-PAYLOAD-FIELD-TYPE",
  eventScopeMissing: "SL-EVENT-SCOPE-MISSING",
  eventTypeUnknown: "SL-EVENT-TYPE-UNKNOWN",
} as const;

export const STUDENT_LIFE_DIAGNOSTIC_TYPES = {
  governance: "governanca",
  temporality: "temporalidade",
  participation: "participacao",
  ledger: "ledger",
} as const;

export function diagnostic(
  code: string,
  typeId: string,
  severity: StudentLifeDiagnostic["severity"],
  scopeReference: StudentLifeEventScope,
  extra?: Partial<Pick<StudentLifeDiagnostic, "parameters" | "message" | "sourceReference">>,
): StudentLifeDiagnostic {
  return { code, typeId, severity, scopeReference, ...extra };
}

/** Agrupamento por código: base para respostas como "37 casos pelo mesmo requisito". */
export function countDiagnosticsByCode(
  diagnostics: readonly StudentLifeDiagnostic[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of diagnostics) {
    totals[item.code] = (totals[item.code] ?? 0) + 1;
  }
  return totals;
}
