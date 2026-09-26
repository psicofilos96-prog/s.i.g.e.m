/**
 * Etapa 13B — Códigos estruturados de diagnóstico da Inscrição Letiva.
 *
 * Os códigos são semanticamente NEUTROS: nenhum pressupõe taxonomia de
 * participação ("principal"), de estado ou de efeito institucional. Os
 * parâmetros identificam as políticas, naturezas e definições envolvidas.
 */
export const CYCLE_ENROLLMENT_DIAGNOSTIC_CODES = {
  processUndeclared: "SL-ENROLL-PROCESS-UNDECLARED",
  bondRequiredMissing: "SL-ENROLL-BOND-REQUIRED-MISSING",
  requestRequiredMissing: "SL-ENROLL-REQUEST-REQUIRED-MISSING",
  requestStateNotCapable: "SL-ENROLL-REQUEST-STATE-NOT-CAPABLE",
  requirementEffectUndeclared: "SL-ENROLL-REQUIREMENT-EFFECT-UNDECLARED",
  requirementEffectPrevents: "SL-ENROLL-REQUIREMENT-EFFECT-PREVENTS",
  requirementDeadlineMissing: "SL-ENROLL-REQUIREMENT-DEADLINE-MISSING",
  requirementActMissing: "SL-ENROLL-REQUIREMENT-ACT-MISSING",
  requirementEvaluatorUnknown: "SL-ENROLL-REQUIREMENT-EVALUATOR-UNKNOWN",
  participationIncompatible: "SL-ENROLL-PARTICIPATION-INCOMPATIBLE",
  participationCombinationUndeclared: "SL-ENROLL-PARTICIPATION-COMBINATION-UNDECLARED",
  validityOutsideEnrollment: "SL-ENROLL-PARTICIPATION-VALIDITY-OUTSIDE",
  duplicateContext: "SL-ENROLL-CONTEXT-ALREADY-ENROLLED",
  correctionReasonMissing: "SL-ENROLL-CORRECTION-REASON-MISSING",
} as const;

export const CYCLE_ENROLLMENT_DIAGNOSTIC_TYPES = {
  process: "rito",
  requirement: "requisito",
  coexistence: "coexistencia",
  temporality: "temporalidade",
  ledger: "ledger",
} as const;
