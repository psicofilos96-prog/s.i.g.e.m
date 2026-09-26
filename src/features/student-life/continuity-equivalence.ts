/**
 * Etapa 13E — Equivalência e aproveitamento de estudos como PROCESSO.
 *
 * Nada de tabela mágica "Matemática de lá = Matemática daqui". A correspondência
 * curricular é N:M entre referências de qualquer natureza cadastrada
 * (componente, área, campo de experiência, competência, conjunto curricular).
 *
 * A decisão é autorizada pela COMPETÊNCIA institucional declarada, nunca pelo
 * nome de um cargo, e preserva ato, documentos de apoio, matriz de destino com
 * versão e proveniência completa.
 */
import { diagnostic } from "./student-life-diagnostics";
import type { StudentLifeDiagnostic, StudentLifeEventScope } from "./student-life-types";
import {
  CONTINUITY_ACT_KIND_IDS,
  CONTINUITY_DIAGNOSTIC_CODES as CODES,
  CONTINUITY_DIAGNOSTIC_TYPES as TYPES,
} from "./continuity-diagnostics";
import type {
  AcademicEquivalenceProcess,
  ContinuityGovernanceConfiguration,
  CurriculumCorrespondenceGroup,
  EquivalenceDecision,
} from "./continuity-types";

export type EquivalenceDecisionValidation = {
  /** `null` = inconclusivo: faltou definição configurada para decidir. */
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
};

/** Competência autoriza o ato; cargo, nome e lotação nunca autorizam. */
export function authorizeEquivalenceDecision(
  governance: ContinuityGovernanceConfiguration,
  decision: EquivalenceDecision,
  scope: StudentLifeEventScope,
): EquivalenceDecisionValidation {
  const diagnostics: StudentLifeDiagnostic[] = [];
  const capacity = governance.capacities.find(
    (item) => item.capacityDefinitionId === decision.capacityDefinitionId,
  );
  if (!capacity) {
    diagnostics.push(
      diagnostic(CODES.equivalenceCapacityMissing, TYPES.equivalence, "blocker", scope, {
        parameters: { capacityDefinitionId: decision.capacityDefinitionId },
      }),
    );
  } else if (!capacity.authorizedActKindIds.includes(CONTINUITY_ACT_KIND_IDS.equivalenceDecision)) {
    diagnostics.push(
      diagnostic(CODES.equivalenceCapacityNotAuthorized, TYPES.equivalence, "blocker", scope, {
        parameters: { capacityDefinitionId: decision.capacityDefinitionId },
      }),
    );
  }
  if (
    !governance.equivalenceDecisionKindDefinitionIds.includes(decision.decisionKindDefinitionId)
  ) {
    diagnostics.push(
      diagnostic(CODES.equivalenceDecisionKindUndeclared, TYPES.equivalence, "blocker", scope, {
        parameters: { decisionKindDefinitionId: decision.decisionKindDefinitionId },
      }),
    );
  }
  if (!decision.targetCurriculumVersion.definitionId) {
    diagnostics.push(
      diagnostic(CODES.equivalenceTargetVersionMissing, TYPES.equivalence, "blocker", scope),
    );
  }
  return {
    allowed: diagnostics.some((item) => item.severity === "blocker") ? false : true,
    diagnostics,
  };
}

/** Grupo N:M válido exige ao menos uma referência em cada polo. */
export function validateCorrespondenceGroup(
  group: CurriculumCorrespondenceGroup,
  scope: StudentLifeEventScope,
): readonly StudentLifeDiagnostic[] {
  if (group.originReferences.length === 0 || group.targetReferences.length === 0) {
    return [
      diagnostic(CODES.equivalenceGroupEmpty, TYPES.equivalence, "blocker", scope, {
        parameters: {
          groupId: group.groupId,
          originCount: group.originReferences.length,
          targetCount: group.targetReferences.length,
        },
      }),
    ];
  }
  return [];
}

export type EquivalenceProcessReview = {
  /** Grupos ainda sem decisão registrada; ausência não vira negativa. */
  undecidedGroupIds: readonly string[];
  decidedGroupIds: readonly string[];
  diagnostics: readonly StudentLifeDiagnostic[];
};

export function reviewEquivalenceProcess(
  process: AcademicEquivalenceProcess,
  governance: ContinuityGovernanceConfiguration,
): EquivalenceProcessReview {
  const scope: StudentLifeEventScope = { studentId: process.studentId };
  const diagnostics: StudentLifeDiagnostic[] = [];
  const undecided: string[] = [];
  const decided: string[] = [];
  for (const group of process.groups) {
    diagnostics.push(...validateCorrespondenceGroup(group, scope));
    if (!group.decision) {
      undecided.push(group.groupId);
      continue;
    }
    decided.push(group.groupId);
    const authorization = authorizeEquivalenceDecision(governance, group.decision, scope);
    diagnostics.push(...authorization.diagnostics);
  }
  return { undecidedGroupIds: undecided, decidedGroupIds: decided, diagnostics };
}
