/**
 * Etapa 13C — Códigos estruturados de diagnóstico da Enturmação.
 *
 * O código é o CONTRATO; a mensagem é cortesia humana. Nenhum código pressupõe
 * norma: não existe "excedeu em 3", "turma cheia" nem "aluno já tem turma".
 */
export const CLASS_ALLOCATION_DIAGNOSTIC_CODES = {
  processUndeclared: "SL-ALLOC-PROCESS-UNDECLARED",
  actMissing: "SL-ALLOC-ACT-MISSING",
  denormalizationDiverges: "SL-ALLOC-DENORMALIZATION-DIVERGES",
  participationMissing: "SL-ALLOC-PARTICIPATION-MISSING",
  enrollmentMissing: "SL-ALLOC-ENROLLMENT-MISSING",
  classMissing: "SL-ALLOC-CLASS-MISSING",
  classValidityOutside: "SL-ALLOC-CLASS-VALIDITY-OUTSIDE",
  participationValidityOutside: "SL-ALLOC-PARTICIPATION-VALIDITY-OUTSIDE",
  groupingUnknown: "SL-ALLOC-GROUPING-UNKNOWN",
  groupingOutsideClass: "SL-ALLOC-GROUPING-OUTSIDE-CLASS",
  dimensionDiverges: "SL-ALLOC-DIMENSION-DIVERGES",
  dimensionInconclusive: "SL-ALLOC-DIMENSION-INCONCLUSIVE",
  dimensionEffectUndeclared: "SL-ALLOC-DIMENSION-EFFECT-UNDECLARED",
  cardinalityExceeded: "SL-ALLOC-CARDINALITY-EXCEEDED",
  cardinalityUndeclared: "SL-ALLOC-CARDINALITY-UNDECLARED",
  capacityRecordMissing: "SL-ALLOC-CAPACITY-RECORD-MISSING",
  capacityRequirementEffect: "SL-ALLOC-CAPACITY-REQUIREMENT-EFFECT",
  timingPolicyUndeclared: "SL-ALLOC-TIMING-POLICY-UNDECLARED",
  timingBoundaryUnknown: "SL-ALLOC-TIMING-BOUNDARY-UNKNOWN",
  movementOriginNotInForce: "SL-ALLOC-MOVEMENT-ORIGIN-NOT-IN-FORCE",
  movementAborted: "SL-ALLOC-MOVEMENT-ABORTED",
  correctionReasonMissing: "SL-ALLOC-CORRECTION-REASON-MISSING",
} as const;

export const CLASS_ALLOCATION_DIAGNOSTIC_TYPES = {
  process: "rito",
  compatibility: "compatibilidade",
  cardinality: "cardinalidade",
  capacity: "capacidade",
  temporality: "temporalidade",
  integrity: "integridade",
  ledger: "ledger",
} as const;
