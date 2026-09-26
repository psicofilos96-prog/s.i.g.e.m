/**
 * Etapa 13E — Códigos estruturados de diagnóstico da Continuidade do Percurso.
 *
 * O código é o CONTRATO; a mensagem é cortesia humana. Nenhum código pressupõe
 * norma: não existe "aluno reprovado", "dependência excedida", "documentação
 * obrigatória" nem "equivalência negada" como conceito do motor.
 */
export const CONTINUITY_DIAGNOSTIC_CODES = {
  policyNotHomologated: "SL-CONT-POLICY-NOT-HOMOLOGATED",
  policyOutOfValidity: "SL-CONT-POLICY-OUT-OF-VALIDITY",
  noRuleMatched: "SL-CONT-NO-RULE-MATCHED",
  resolutionUndeclared: "SL-CONT-RESOLUTION-UNDECLARED",
  resolutionStateUndeclared: "SL-CONT-RESOLUTION-STATE-UNDECLARED",
  conditionEvaluatorMissing: "SL-CONT-CONDITION-EVALUATOR-MISSING",
  comparatorMissing: "SL-CONT-COMPARATOR-MISSING",
  combinatorMissing: "SL-CONT-COMBINATOR-MISSING",
  factUnavailable: "SL-CONT-FACT-UNAVAILABLE",
  consequenceExecutorMissing: "SL-CONT-CONSEQUENCE-EXECUTOR-MISSING",
  consequenceInconclusive: "SL-CONT-CONSEQUENCE-INCONCLUSIVE",
  obligationNatureUndeclared: "SL-CONT-OBLIGATION-NATURE-UNDECLARED",
  obligationStatusUndeclared: "SL-CONT-OBLIGATION-STATUS-UNDECLARED",
  obligationEventTypeUndeclared: "SL-CONT-OBLIGATION-EVENT-TYPE-UNDECLARED",
  obligationStatusChainBroken: "SL-CONT-OBLIGATION-STATUS-CHAIN-BROKEN",
  issueTypeUndeclared: "SL-CONT-ISSUE-TYPE-UNDECLARED",
  equivalenceCapacityMissing: "SL-CONT-EQUIVALENCE-CAPACITY-MISSING",
  equivalenceCapacityNotAuthorized: "SL-CONT-EQUIVALENCE-CAPACITY-NOT-AUTHORIZED",
  equivalenceDecisionKindUndeclared: "SL-CONT-EQUIVALENCE-DECISION-KIND-UNDECLARED",
  equivalenceGroupEmpty: "SL-CONT-EQUIVALENCE-GROUP-EMPTY",
  equivalenceTargetVersionMissing: "SL-CONT-EQUIVALENCE-TARGET-VERSION-MISSING",
  originResolutionAbsent: "SL-CONT-ORIGIN-RESOLUTION-ABSENT",
  correctionReasonMissing: "SL-CONT-CORRECTION-REASON-MISSING",
} as const;

export const CONTINUITY_DIAGNOSTIC_TYPES = {
  policy: "politica",
  origin: "origem",
  consequence: "consequencia",
  obligation: "obrigacao",
  equivalence: "equivalencia",
  integrity: "integridade",
} as const;

/** Ato institucional cuja autorização depende de competência declarada. */
export const CONTINUITY_ACT_KIND_IDS = {
  equivalenceDecision: "decidir-equivalencia-curricular",
  obligationStatusChange: "alterar-estado-de-obrigacao",
} as const;
