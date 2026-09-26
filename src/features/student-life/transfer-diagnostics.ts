/**
 * Etapa 13D — Códigos estruturados de diagnóstico da Mobilidade Institucional.
 *
 * O código é o CONTRATO; a mensagem é cortesia humana. Nenhum código pressupõe
 * norma: não existe "transferência irregular", "prazo estourado", "documentação
 * obrigatória faltando" nem "aluno evadido".
 */
export const TRANSFER_DIAGNOSTIC_CODES = {
  processKindUndeclared: "SL-TRF-PROCESS-KIND-UNDECLARED",
  transitionUndeclared: "SL-TRF-TRANSITION-UNDECLARED",
  transitionStageMismatch: "SL-TRF-TRANSITION-STAGE-MISMATCH",
  transitionReasonMissing: "SL-TRF-TRANSITION-REASON-MISSING",
  transitionReasonNotAllowed: "SL-TRF-TRANSITION-REASON-NOT-ALLOWED",
  requirementEffect: "SL-TRF-REQUIREMENT-EFFECT",
  requirementEvaluatorMissing: "SL-TRF-REQUIREMENT-EVALUATOR-MISSING",
  requirementEffectUndeclared: "SL-TRF-REQUIREMENT-EFFECT-UNDECLARED",
  contextTypeUndeclared: "SL-TRF-CONTEXT-TYPE-UNDECLARED",
  contextSchemaUnknown: "SL-TRF-CONTEXT-SCHEMA-UNKNOWN",
  contextSchemaMismatch: "SL-TRF-CONTEXT-SCHEMA-MISMATCH",
  contextFieldMissing: "SL-TRF-CONTEXT-FIELD-MISSING",
  contextFieldType: "SL-TRF-CONTEXT-FIELD-TYPE",
  poleUndetermined: "SL-TRF-POLE-UNDETERMINED",
  poleAmbiguous: "SL-TRF-POLE-AMBIGUOUS",
  poleAbsenceReasonMissing: "SL-TRF-POLE-ABSENCE-REASON-MISSING",
  documentStatusUndeclared: "SL-TRF-DOCUMENT-STATUS-UNDECLARED",
  verificationStatusUndeclared: "SL-TRF-VERIFICATION-STATUS-UNDECLARED",
  transitionIntervalKindUndeclared: "SL-TRF-INTERVAL-KIND-UNDECLARED",
  transitionIntervalInverted: "SL-TRF-INTERVAL-INVERTED",
  effectExecutorMissing: "SL-TRF-EFFECT-EXECUTOR-MISSING",
  effectInconclusive: "SL-TRF-EFFECT-INCONCLUSIVE",
  participationEffectUndeclared: "SL-TRF-PARTICIPATION-EFFECT-UNDECLARED",
  bondEffectUndeclared: "SL-TRF-BOND-EFFECT-UNDECLARED",
  timingBoundaryUndeclared: "SL-TRF-TIMING-BOUNDARY-UNDECLARED",
  correctionReasonMissing: "SL-TRF-CORRECTION-REASON-MISSING",
  versionChainBroken: "SL-TRF-VERSION-CHAIN-BROKEN",
  situationProjectionUndeclared: "SL-TRF-SITUATION-PROJECTION-UNDECLARED",
} as const;

export const TRANSFER_DIAGNOSTIC_TYPES = {
  process: "rito",
  context: "contexto",
  documentation: "documentacao",
  effect: "efeito",
  temporality: "temporalidade",
  integrity: "integridade",
  projection: "projecao",
} as const;
