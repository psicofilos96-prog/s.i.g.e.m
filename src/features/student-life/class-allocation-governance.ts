/**
 * Etapa 13C — Motor de governança da Enturmação.
 *
 * O motor é PURO e cego a norma. Ele conhece apenas primitivas:
 *   1. localizar o processo originador configurado;
 *   2. validar as DENORMALIZAÇÕES contra a cadeia canônica;
 *   3. comparar dimensões declaradas de compatibilidade;
 *   4. contar alocações simultâneas e confrontar a cardinalidade configurada;
 *   5. delegar capacidade e demais requisitos aos avaliadores registrados;
 *   6. executar a política TEMPORAL declarada na movimentação;
 *   7. devolver diagnósticos estruturados.
 *
 * Ele não conhece turno, etapa, modalidade, sala, cota, ano civil, nome de
 * estado, nome de turma nem o significado institucional de "mover".
 * Não existe `effectiveDate - 1 dia` nativo: a semântica é da política.
 */
import { addDays } from "@/lib/academic-date";
import { diagnostic } from "./student-life-diagnostics";
import { validateTransition } from "./student-life-governance";
import type {
  InstitutionalActReference,
  StudentLifeDiagnostic,
  StudentLifeEventScope,
  StudentLifeValidationResult,
} from "./student-life-types";
import type { AcademicCycleEnrollment, CycleParticipation } from "./cycle-enrollment-types";
import {
  CLASS_ALLOCATION_DIAGNOSTIC_CODES as CODES,
  CLASS_ALLOCATION_DIAGNOSTIC_TYPES as TYPES,
} from "./class-allocation-diagnostics";
import {
  assessAllocationRequirements,
  NATIVE_ALLOCATION_EVALUATORS,
  type AllocationRequirementAssessment,
  type AllocationRequirementEvaluator,
  type AllocationRequirementFacts,
} from "./class-allocation-capacity";
import {
  capacityRecordInForceOn,
  factualOccupancyOn,
  groupingsInForceOn,
  inForceOn,
  reservationsInForceOn,
  validitiesOverlap,
  currentAllocationVersions,
} from "./class-allocation-ledger";
import type {
  AcademicClass,
  AllocationCardinalityPolicy,
  AllocationCompatibilityPolicy,
  AllocationDenormalizedReferences,
  AllocationTimingBoundaryDefinition,
  AllocationTimingPolicy,
  AllocationValidity,
  CapacityQuotaReservation,
  ClassAllocation,
  ClassCapacityRecord,
  ClassGroupingDefinition,
  ClassAllocationGovernanceConfiguration,
} from "./class-allocation-types";

const OPEN_ENDED = "9999-12-31";

function degradeWith(
  current: boolean | null,
  next: boolean | null,
): boolean | null {
  if (next === false || current === false) return false;
  if (next === null || current === null) return null;
  return true;
}

// --------------------------------------------------- denormalizações controladas

/**
 * As referências materializadas na alocação são DENORMALIZAÇÕES CONTROLADAS.
 * A verdade relacional é `allocation → participation → enrollment →
 * student/school`; qualquer divergência é erro de integridade, nunca "outra
 * versão do fato".
 */
export function validateDenormalizedReferences(
  denormalized: AllocationDenormalizedReferences,
  participation: Pick<CycleParticipation, "participationId" | "cycleEnrollmentId">,
  enrollment: Pick<AcademicCycleEnrollment, "cycleEnrollmentId" | "studentId" | "schoolId">,
  scope: StudentLifeEventScope,
): StudentLifeValidationResult {
  const diagnostics: StudentLifeDiagnostic[] = [];
  const mismatch = (field: string, materialized: string, canonical: string) =>
    diagnostics.push(
      diagnostic(CODES.denormalizationDiverges, TYPES.integrity, "blocker", scope, {
        parameters: { field, materialized, canonical },
        message: "Referência materializada divergente da cadeia canônica.",
      }),
    );

  if (participation.cycleEnrollmentId !== enrollment.cycleEnrollmentId) {
    diagnostics.push(
      diagnostic(CODES.enrollmentMissing, TYPES.integrity, "blocker", scope, {
        parameters: {
          participationId: participation.participationId,
          cycleEnrollmentId: participation.cycleEnrollmentId,
        },
        message: "A participação informada não pertence à inscrição informada.",
      }),
    );
  }
  if (denormalized.cycleEnrollmentId !== participation.cycleEnrollmentId) {
    mismatch("cycleEnrollmentId", denormalized.cycleEnrollmentId, participation.cycleEnrollmentId);
  }
  if (denormalized.studentId !== enrollment.studentId) {
    mismatch("studentId", denormalized.studentId, enrollment.studentId);
  }
  if (denormalized.schoolId !== enrollment.schoolId) {
    mismatch("schoolId", denormalized.schoolId, enrollment.schoolId);
  }

  return { allowed: diagnostics.length === 0, diagnostics };
}

// ------------------------------------------------------------ compatibilidade

/** Contexto comparável, sempre por IDs estáveis. */
export type AllocationComparableContext = {
  schoolId?: string | null;
  academicCycleId?: string | null;
  educationalOfferId?: string | null;
  academicOrganizationId?: string | null;
  groupingId?: string | null;
};

/**
 * Compara as dimensões DECLARADAS pela política. Ausência de dado em qualquer
 * lado deixa a dimensão inconclusiva: omissão nunca satisfaz requisito.
 */
export function evaluateAllocationCompatibility(input: {
  policy: AllocationCompatibilityPolicy;
  enrollmentContext: AllocationComparableContext;
  classContext: AllocationComparableContext;
  scope: StudentLifeEventScope;
}): StudentLifeValidationResult {
  const { policy, enrollmentContext, classContext, scope } = input;
  const diagnostics: StudentLifeDiagnostic[] = [];
  let allowed: boolean | null = true;

  for (const requirement of policy.requirements) {
    const left = enrollmentContext[requirement.dimensionId] ?? null;
    const right = classContext[requirement.dimensionId] ?? null;
    const status =
      left === null || right === null ? "inconclusivo" : left === right ? "satisfeito" : "nao-satisfeito";

    if (status === "satisfeito") continue;

    const effectId = requirement.effectByStatus[status] ?? null;
    const effect = policy.effects.find((item) => item.effectDefinitionId === effectId);

    if (!effect) {
      diagnostics.push(
        diagnostic(CODES.dimensionEffectUndeclared, TYPES.compatibility, "blocker", scope, {
          parameters: { dimensionId: requirement.dimensionId, status, policyId: policy.policyId },
          message: "A política não declarou efeito institucional para este resultado.",
        }),
      );
      allowed = false;
      continue;
    }

    diagnostics.push(
      diagnostic(
        status === "inconclusivo" ? CODES.dimensionInconclusive : CODES.dimensionDiverges,
        TYPES.compatibility,
        effect.severity,
        scope,
        {
          parameters: {
            dimensionId: requirement.dimensionId,
            enrollmentValue: left,
            classValue: right,
            effectDefinitionId: effect.effectDefinitionId,
          },
          message:
            status === "inconclusivo"
              ? "Dimensão de compatibilidade não pôde ser avaliada por ausência de dado."
              : "Dimensão de compatibilidade divergente entre a inscrição e a turma.",
        },
      ),
    );

    if (effect.preventsTransition) allowed = false;
    else if (status === "inconclusivo") allowed = degradeWith(allowed, null);
  }

  return { allowed, diagnostics };
}

// ------------------------------------------------------------- cardinalidade

/**
 * Cardinalidade das alocações simultâneas DA MESMA participação. Coexistência
 * entre participações DISTINTAS é outra pergunta e pertence à política de
 * coexistência da 13B.
 */
export function evaluateAllocationCardinality(input: {
  policy: AllocationCardinalityPolicy;
  natureDefinitionId: string;
  /** Alocações da mesma participação que se sobrepõem à vigência pretendida. */
  overlappingCount: number;
  scope: StudentLifeEventScope;
}): StudentLifeValidationResult {
  const { policy, natureDefinitionId, overlappingCount, scope } = input;
  const rule = policy.rules.find((item) => item.natureDefinitionId === natureDefinitionId);

  if (!rule) {
    if (policy.undeclaredNatureStateId === "allow") return { allowed: true, diagnostics: [] };
    const deny = policy.undeclaredNatureStateId === "deny";
    return {
      allowed: deny ? false : null,
      diagnostics: [
        diagnostic(CODES.cardinalityUndeclared, TYPES.cardinality, deny ? "blocker" : "warning", scope, {
          parameters: { natureDefinitionId, policyId: policy.policyId },
          message: "A política não declarou cardinalidade para esta natureza de participação.",
        }),
      ],
    };
  }

  if (rule.maxSimultaneousAllocations === null) return { allowed: true, diagnostics: [] };

  if (overlappingCount + 1 > rule.maxSimultaneousAllocations) {
    return {
      allowed: false,
      diagnostics: [
        diagnostic(CODES.cardinalityExceeded, TYPES.cardinality, "blocker", scope, {
          parameters: {
            ruleId: rule.ruleId,
            natureDefinitionId,
            maxSimultaneousAllocations: rule.maxSimultaneousAllocations,
            overlappingCount,
          },
          message: rule.note ?? "Excede a quantidade de alocações simultâneas declarada pela política.",
        }),
      ],
    };
  }

  return { allowed: true, diagnostics: [] };
}

// --------------------------------------------------------- avaliação da alocação

export type EvaluateAllocationInput = {
  configuration: ClassAllocationGovernanceConfiguration;
  originatingProcessKindId: string;
  scope: StudentLifeEventScope;
  participation: CycleParticipation;
  enrollment: AcademicCycleEnrollment;
  academicClass: AcademicClass;
  denormalized: AllocationDenormalizedReferences;
  validity: AllocationValidity;
  groupingId?: string;
  groupings?: readonly ClassGroupingDefinition[];
  /** Alocações já registradas (todas as versões); o motor projeta as vigentes. */
  existingAllocations?: readonly ClassAllocation[];
  capacityRecords?: readonly ClassCapacityRecord[];
  reservations?: readonly CapacityQuotaReservation[];
  requirementFacts?: AllocationRequirementFacts;
  originatingAct?: InstitutionalActReference;
  evaluators?: Readonly<Record<string, AllocationRequirementEvaluator>>;
};

export type EvaluateAllocationResult = {
  /** `true` autoriza; `false` impede; `null` inconclusivo por falta de definição. */
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
  requirements: AllocationRequirementAssessment | null;
  initialAllocationStateDefinitionId: string | null;
  /** Fatos brutos usados na avaliação de capacidade — reproduzíveis e auditáveis. */
  capacityFacts: {
    referenceDate: string;
    factualOccupancy: number;
    referenceLimit: number | null;
    reservedQuantity: number;
    capacityRecordId: string | null;
  };
};

/** Avalia se uma participação pode ser alocada na turma na vigência pretendida. */
export function evaluateClassAllocation(input: EvaluateAllocationInput): EvaluateAllocationResult {
  const { configuration, scope, participation, enrollment, academicClass } = input;
  const diagnostics: StudentLifeDiagnostic[] = [];
  const referenceDate = input.validity.validFrom;
  const allocations = currentAllocationVersions(input.existingAllocations ?? []);
  const capacityRecord = capacityRecordInForceOn(
    input.capacityRecords ?? [],
    academicClass.classId,
    referenceDate,
  );
  const reservedQuantity = reservationsInForceOn(
    input.reservations ?? [],
    academicClass.classId,
    referenceDate,
  ).reduce((total, item) => total + item.quantity, 0);
  const factualOccupancy = factualOccupancyOn(allocations, academicClass.classId, referenceDate);

  const capacityFacts = {
    referenceDate,
    factualOccupancy,
    referenceLimit: capacityRecord?.referenceLimit ?? null,
    reservedQuantity,
    capacityRecordId: capacityRecord?.capacityRecordId ?? null,
  };

  const process = configuration.originatingProcesses.find(
    (item) => item.processKindId === input.originatingProcessKindId,
  );

  if (!process) {
    return {
      allowed: null,
      requirements: null,
      initialAllocationStateDefinitionId: null,
      capacityFacts,
      diagnostics: [
        diagnostic(CODES.processUndeclared, TYPES.process, "blocker", scope, {
          parameters: { processKindId: input.originatingProcessKindId },
          message: "Processo originador da alocação não declarado pela configuração.",
        }),
      ],
    };
  }

  let allowed: boolean | null = true;
  const degrade = (value: boolean | null) => {
    allowed = degradeWith(allowed, value);
  };

  // 1. integridade das denormalizações
  const integrity = validateDenormalizedReferences(
    input.denormalized,
    participation,
    enrollment,
    scope,
  );
  diagnostics.push(...integrity.diagnostics);
  degrade(integrity.allowed);

  // 2. vigências (primitivas temporais)
  const candidateUntil = input.validity.validUntil ?? OPEN_ENDED;
  const classUntil = academicClass.validity.validUntil ?? OPEN_ENDED;
  if (input.validity.validFrom < academicClass.validity.validFrom || candidateUntil > classUntil) {
    diagnostics.push(
      diagnostic(CODES.classValidityOutside, TYPES.temporality, "blocker", scope, {
        parameters: { classId: academicClass.classId, validFrom: input.validity.validFrom },
        message: "A vigência da alocação excede a vigência da turma.",
      }),
    );
    degrade(false);
  }

  const participationUntil = participation.validity.validUntil ?? OPEN_ENDED;
  if (
    input.validity.validFrom < participation.validity.validFrom ||
    candidateUntil > participationUntil
  ) {
    diagnostics.push(
      diagnostic(CODES.participationValidityOutside, TYPES.temporality, "blocker", scope, {
        parameters: {
          participationId: participation.participationId,
          validFrom: input.validity.validFrom,
        },
        message: "A vigência da alocação excede a vigência da participação educacional.",
      }),
    );
    degrade(false);
  }

  // 3. agrupamento interno da turma
  if (input.groupingId) {
    const grouping = (input.groupings ?? []).find((item) => item.groupingId === input.groupingId);
    if (!grouping) {
      diagnostics.push(
        diagnostic(CODES.groupingUnknown, TYPES.compatibility, "blocker", scope, {
          parameters: { groupingId: input.groupingId },
          message: "Agrupamento interno não declarado.",
        }),
      );
      degrade(false);
    } else if (grouping.classId !== academicClass.classId) {
      diagnostics.push(
        diagnostic(CODES.groupingOutsideClass, TYPES.compatibility, "blocker", scope, {
          parameters: {
            groupingId: grouping.groupingId,
            groupingClassId: grouping.classId,
            classId: academicClass.classId,
          },
          message: "O agrupamento informado pertence a outra turma.",
        }),
      );
      degrade(false);
    }
  }

  // 4. compatibilidade declarativa
  const groupingsOfClass = groupingsInForceOn(
    input.groupings ?? [],
    academicClass.classId,
    referenceDate,
  );
  const compatibility = evaluateAllocationCompatibility({
    policy: configuration.compatibilityPolicy,
    scope,
    enrollmentContext: {
      schoolId: enrollment.schoolId,
      academicCycleId: enrollment.academicCycleId,
      educationalOfferId: enrollment.educationalOfferId,
      academicOrganizationId: enrollment.academicOrganizationId ?? null,
      groupingId: input.groupingId ?? null,
    },
    classContext: {
      schoolId: academicClass.schoolId,
      academicCycleId: academicClass.academicCycleId,
      educationalOfferId: academicClass.educationalOfferId,
      /**
       * Em turma multietapa a posição curricular do aluno é o AGRUPAMENTO;
       * quando o aluno traz agrupamento declarado, é ele que responde pela
       * dimensão — a turma não finge ter uma única posição.
       */
      academicOrganizationId: input.groupingId
        ? (groupingsOfClass.find((item) => item.groupingId === input.groupingId)
            ?.academicOrganizationId ?? null)
        : (academicClass.academicOrganizationId ?? null),
      groupingId: input.groupingId ?? null,
    },
  });
  diagnostics.push(...compatibility.diagnostics);
  degrade(compatibility.allowed);

  // 5. cardinalidade da mesma participação
  const overlapping = allocations.filter(
    (item) =>
      item.participationId === participation.participationId &&
      validitiesOverlap(item.validity, input.validity),
  ).length;
  const cardinality = evaluateAllocationCardinality({
    policy: configuration.cardinalityPolicy,
    natureDefinitionId: participation.natureDefinitionId,
    overlappingCount: overlapping,
    scope,
  });
  diagnostics.push(...cardinality.diagnostics);
  degrade(cardinality.allowed);

  // 6. requisitos declarativos (capacidade e demais exigências configuradas)
  const policy = configuration.requirementPolicies.find(
    (item) => item.policyId === process.requirementPolicyId,
  );
  let requirements: AllocationRequirementAssessment | null = null;
  if (policy) {
    requirements = assessAllocationRequirements(
      policy,
      process.processKindId,
      {
        factualOccupancy,
        referenceLimit: capacityRecord?.referenceLimit ?? null,
        reservedQuantity,
        intendedIncrement: 1,
        ...(input.requirementFacts ?? {}),
      },
      scope,
      input.evaluators ?? NATIVE_ALLOCATION_EVALUATORS,
    );
    diagnostics.push(...requirements.diagnostics);
    if (!requirements.allowed) degrade(false);
    else if (requirements.inconclusive) degrade(null);
  }

  if (!capacityRecord && policy) {
    diagnostics.push(
      diagnostic(CODES.capacityRecordMissing, TYPES.capacity, "warning", scope, {
        parameters: { classId: academicClass.classId, referenceDate },
        message: "Nenhum registro de capacidade vigente para a turma na data de referência.",
      }),
    );
  }

  // 7. ato institucional exigido pelo processo configurado
  if (process.requiresInstitutionalAct && !input.originatingAct) {
    diagnostics.push(
      diagnostic(CODES.actMissing, TYPES.process, "blocker", scope, {
        parameters: { processKindId: process.processKindId },
        message: "O processo originador configurado exige ato institucional.",
      }),
    );
    degrade(false);
  }

  return {
    allowed,
    diagnostics,
    requirements,
    initialAllocationStateDefinitionId: process.initialAllocationStateDefinitionId,
    capacityFacts,
  };
}

// ---------------------------------------------------------- política temporal

export type ResolvedTimingBoundary = {
  boundary: AllocationTimingBoundaryDefinition;
  /** Fim da vigência da origem, conforme a política declarada. */
  originValidUntil: string;
};

/**
 * Resolve o fim da vigência da origem pela POLÍTICA declarada. Sem política
 * declarada o motor devolve `null` e diagnóstico: ele não inventa "um dia antes".
 */
export function resolveOriginClosure(
  policy: AllocationTimingPolicy,
  effectiveDate: string,
  scope: StudentLifeEventScope,
): { resolved: ResolvedTimingBoundary | null; diagnostics: readonly StudentLifeDiagnostic[] } {
  if (!policy.activeBoundaryDefinitionId) {
    return {
      resolved: null,
      diagnostics: [
        diagnostic(CODES.timingPolicyUndeclared, TYPES.temporality, "blocker", scope, {
          parameters: { policyId: policy.policyId },
          message: "A política temporal de transição entre alocações não foi declarada.",
        }),
      ],
    };
  }
  const boundary = policy.boundaries.find(
    (item) => item.boundaryDefinitionId === policy.activeBoundaryDefinitionId,
  );
  if (!boundary) {
    return {
      resolved: null,
      diagnostics: [
        diagnostic(CODES.timingBoundaryUnknown, TYPES.temporality, "blocker", scope, {
          parameters: {
            policyId: policy.policyId,
            boundaryDefinitionId: policy.activeBoundaryDefinitionId,
          },
          message: "A semântica temporal declarada não existe na política.",
        }),
      ],
    };
  }

  const closureDate = addDays(effectiveDate, boundary.originClosureOffsetDays);
  const originValidUntil = boundary.originClosureInclusive
    ? closureDate
    : addDays(closureDate, -1);
  return { resolved: { boundary, originValidUntil }, diagnostics: [] };
}

// --------------------------------------------------------------- movimentação

export type ClassMovementInput = Omit<EvaluateAllocationInput, "validity"> & {
  /** Alocação de origem a ser encerrada pela mesma operação institucional. */
  origin: ClassAllocation;
  /** Data de eficácia da ENTRADA no destino. */
  effectiveDate: string;
  /** Fim de vigência pretendido no destino; `null` = em curso. */
  targetValidUntil?: string | null;
  /** Identidade e proveniência da nova alocação, fornecidas pelo chamador. */
  target: Pick<
    ClassAllocation,
    "allocationId" | "definitionSnapshot" | "provenance" | "sourceEventIds"
  > &
    Partial<Pick<ClassAllocation, "institutionalIdentifier">>;
};

export type ClassMovementResult = {
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
  requirements: AllocationRequirementAssessment | null;
  /**
   * Plano da operação ATÔMICA. `null` quando a operação não pode ser concluída:
   * nesse caso a origem permanece exatamente como estava e nenhum registro novo
   * é produzido.
   */
  plan: { terminatedOrigin: ClassAllocation; createdAllocation: ClassAllocation } | null;
};

/**
 * MOVIMENTAÇÃO: operação institucional ATÔMICA. Mover não é alterar `classId`:
 * encerra-se a vigência da alocação de origem e constitui-se outra alocação.
 * Se o destino não for admissível, nada é encerrado e nada é criado.
 */
export function planClassMovement(input: ClassMovementInput): ClassMovementResult {
  const { scope } = input;
  const diagnostics: StudentLifeDiagnostic[] = [];

  if (!inForceOn(input.origin.validity, input.effectiveDate)) {
    diagnostics.push(
      diagnostic(CODES.movementOriginNotInForce, TYPES.temporality, "blocker", scope, {
        parameters: {
          allocationId: input.origin.allocationId,
          effectiveDate: input.effectiveDate,
        },
        message: "A alocação de origem não está vigente na data de eficácia informada.",
      }),
    );
  }

  const timing = resolveOriginClosure(
    input.configuration.timingPolicy,
    input.effectiveDate,
    scope,
  );
  diagnostics.push(...timing.diagnostics);

  const validity: AllocationValidity = {
    validFrom: input.effectiveDate,
    validUntil: input.targetValidUntil ?? null,
  };

  const destination = evaluateClassAllocation({ ...input, validity });
  diagnostics.push(...destination.diagnostics);

  let allowed: boolean | null = destination.allowed;
  if (diagnostics.some((item) => item.severity === "blocker")) allowed = false;
  else if (!timing.resolved) allowed = degradeWith(allowed, null);

  if (
    timing.resolved &&
    !timing.resolved.boundary.allowsSameDateCoexistence &&
    timing.resolved.originValidUntil >= input.effectiveDate
  ) {
    diagnostics.push(
      diagnostic(CODES.movementAborted, TYPES.temporality, "blocker", scope, {
        parameters: {
          reason: "coexistencia-na-data-nao-declarada",
          boundaryDefinitionId: timing.resolved.boundary.boundaryDefinitionId,
        },
        message:
          "A semântica temporal declarada não admite origem e destino vigentes na mesma data.",
      }),
    );
    allowed = false;
  }

  if (allowed !== true || !timing.resolved) {
    diagnostics.push(
      diagnostic(CODES.movementAborted, TYPES.process, "info", scope, {
        parameters: {
          originAllocationId: input.origin.allocationId,
          targetClassId: input.academicClass.classId,
        },
        message: "Movimentação não concluída: origem preservada e nenhum registro constituído.",
      }),
    );
    return { allowed, diagnostics, requirements: destination.requirements, plan: null };
  }

  const terminatedOrigin: ClassAllocation = {
    ...input.origin,
    validity: { ...input.origin.validity, validUntil: timing.resolved.originValidUntil },
  };

  const createdAllocation: ClassAllocation = {
    allocationId: input.target.allocationId,
    ...(input.target.institutionalIdentifier
      ? { institutionalIdentifier: input.target.institutionalIdentifier }
      : {}),
    participationId: input.participation.participationId,
    classId: input.academicClass.classId,
    ...(input.groupingId ? { groupingId: input.groupingId } : {}),
    denormalized: input.denormalized,
    originatingProcessKindId: input.originatingProcessKindId,
    allocationStateDefinitionId: destination.initialAllocationStateDefinitionId as string,
    validity,
    definitionSnapshot: input.target.definitionSnapshot,
    ...(input.originatingAct ? { originatingAct: input.originatingAct } : {}),
    recordVersion: 1,
    supersedesAllocationId: null,
    sourceEventIds: input.target.sourceEventIds,
    provenance: input.target.provenance,
  };

  return {
    allowed: true,
    diagnostics,
    requirements: destination.requirements,
    plan: { terminatedOrigin, createdAllocation },
  };
}

// ------------------------------------------------------------- retificação

/** Transições de estado da alocação usam o motor declarativo da 13A. */
export const evaluateAllocationStateTransition = validateTransition;

/** Retificação exige motivo configurado; o registro anterior permanece íntegro. */
export function validateAllocationCorrection(
  input: { correctionReasonDefinitionId?: string; supersedesAllocationId?: string | null },
  scope: StudentLifeEventScope,
): StudentLifeValidationResult {
  if (!input.correctionReasonDefinitionId) {
    return {
      allowed: false,
      diagnostics: [
        diagnostic(CODES.correctionReasonMissing, TYPES.ledger, "blocker", scope, {
          parameters: { supersedesAllocationId: input.supersedesAllocationId ?? null },
          message: "A retificação exige motivo configurado declarado.",
        }),
      ],
    };
  }
  return { allowed: true, diagnostics: [] };
}

/**
 * Produz a NOVA VERSÃO retificadora encadeada. O registro original permanece no
 * histórico e continua explicando o que o sistema conhecia antes.
 */
export function rectifyAllocation(
  original: ClassAllocation,
  changes: Partial<Pick<ClassAllocation, "validity" | "classId" | "groupingId" | "allocationStateDefinitionId">>,
  newAllocationId: string,
  provenance: ClassAllocation["provenance"],
): ClassAllocation {
  return {
    ...original,
    ...changes,
    allocationId: newAllocationId,
    recordVersion: original.recordVersion + 1,
    supersedesAllocationId: original.allocationId,
    provenance,
  };
}
