/**
 * Etapa 13B — Motor de governança da Inscrição Letiva.
 *
 * O motor é PURO e cego a norma: não conhece nenhum identificador de estado,
 * rito, requisito, efeito, prazo, etapa, modalidade, oferta ou ano civil. Ele
 * apenas:
 *   1. localiza o rito configurado;
 *   2. verifica as exigências ESTRUTURAIS declaradas por esse rito;
 *   3. delega requisitos aos avaliadores registrados e lê seus efeitos;
 *   4. compara coexistência entre inscrições por política;
 *   5. valida vigência (primitiva temporal);
 *   6. devolve diagnósticos estruturados.
 *
 * Nenhum estado "autoriza" coisa alguma por nome: a capacidade de constituir
 * inscrição é declarada em `requestStateCapabilities`.
 */
import { diagnostic } from "./student-life-diagnostics";
import { validateTransition } from "./student-life-governance";
import type {
  StudentLifeDiagnostic,
  StudentLifeEventScope,
  StudentLifeValidationResult,
} from "./student-life-types";
import {
  CYCLE_ENROLLMENT_DIAGNOSTIC_CODES as CODES,
  CYCLE_ENROLLMENT_DIAGNOSTIC_TYPES as TYPES,
} from "./cycle-enrollment-diagnostics";
import {
  assessRequirements,
  NATIVE_REQUIREMENT_EVALUATORS,
  type RequirementAssessment,
  type RequirementEvaluationFacts,
  type RequirementEvaluator,
} from "./cycle-enrollment-requirements";
import type {
  AcademicCycleEnrollment,
  AdmissionProcessDefinition,
  CycleEnrollmentGovernanceConfiguration,
  CycleParticipation,
  EnrollmentCoexistencePolicy,
  EnrollmentRequest,
  EnrollmentValidity,
} from "./cycle-enrollment-types";

const OPEN_ENDED = "9999-12-31";

function overlaps(a: EnrollmentValidity, b: EnrollmentValidity): boolean {
  return a.validFrom <= (b.validUntil ?? OPEN_ENDED) && b.validFrom <= (a.validUntil ?? OPEN_ENDED);
}

export function findAdmissionProcess(
  configuration: CycleEnrollmentGovernanceConfiguration,
  processKindId: string,
): AdmissionProcessDefinition | undefined {
  return configuration.admissionProcesses.find((item) => item.processKindId === processKindId);
}

/** Capacidade CONFIGURADA: o estado do requerimento autoriza constituir inscrição? */
export function requestStateAllowsEnrollmentCreation(
  configuration: CycleEnrollmentGovernanceConfiguration,
  requestStateDefinitionId: string,
): boolean | null {
  const capability = configuration.requestStateCapabilities.find(
    (item) => item.requestStateDefinitionId === requestStateDefinitionId,
  );
  if (!capability) return null;
  return capability.allowsEnrollmentCreation;
}

export type ConstituteEnrollmentRequest = {
  configuration: CycleEnrollmentGovernanceConfiguration;
  admissionProcessKindId: string;
  scope: StudentLifeEventScope;
  /** Existe vínculo institucional com a unidade (13A)? */
  hasExistingSchoolBond: boolean;
  /** Requerimento originador, quando a política adotar rito prévio. */
  originatingRequest?: Pick<EnrollmentRequest, "requestId" | "requestStateDefinitionId"> | null;
  requirementFacts?: RequirementEvaluationFacts;
  /** Inscrições já vigentes do aluno, em qualquer unidade. */
  existingEnrollments?: readonly AcademicCycleEnrollment[];
  /** Participações vigentes das inscrições existentes. */
  existingParticipations?: readonly CycleParticipation[];
  /** Naturezas de participação pretendidas nesta inscrição. */
  intendedNatureDefinitionIds?: readonly string[];
  /** Vigência pretendida da inscrição. */
  validity?: EnrollmentValidity;
  evaluators?: Readonly<Record<string, RequirementEvaluator>>;
};

export type ConstituteEnrollmentResult = {
  /** `true` autoriza; `false` impede; `null` inconclusivo por falta de definição. */
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
  requirements: RequirementAssessment | null;
  /** Estado inicial declarado pelo rito, quando resolvido. */
  initialEnrollmentStateDefinitionId: string | null;
};

/**
 * Avalia se a inscrição letiva pode ser constituída. Matrícula inicial e
 * rematrícula percorrem ESTE mesmo caminho: o que difere é o rito configurado.
 */
export function evaluateEnrollmentConstitution(
  request: ConstituteEnrollmentRequest,
): ConstituteEnrollmentResult {
  const { configuration, scope } = request;
  const diagnostics: StudentLifeDiagnostic[] = [];
  const process = findAdmissionProcess(configuration, request.admissionProcessKindId);

  if (!process) {
    return {
      allowed: null,
      requirements: null,
      initialEnrollmentStateDefinitionId: null,
      diagnostics: [
        diagnostic(CODES.processUndeclared, TYPES.process, "blocker", scope, {
          parameters: { processKindId: request.admissionProcessKindId },
          message: "Rito de constituição de inscrição não declarado pela configuração.",
        }),
      ],
    };
  }

  let allowed: boolean | null = true;
  const degrade = (value: boolean | null) => {
    if (value === false) allowed = false;
    else if (value === null && allowed !== false) allowed = null;
  };

  if (process.requiresExistingSchoolBond && !request.hasExistingSchoolBond) {
    diagnostics.push(
      diagnostic(CODES.bondRequiredMissing, TYPES.process, "blocker", scope, {
        parameters: { processKindId: process.processKindId },
        message: "O rito configurado exige vínculo institucional preexistente com a unidade.",
      }),
    );
    degrade(false);
  }

  if (process.requiresOriginatingRequest) {
    if (!request.originatingRequest) {
      diagnostics.push(
        diagnostic(CODES.requestRequiredMissing, TYPES.process, "blocker", scope, {
          parameters: { processKindId: process.processKindId },
          message: "O rito configurado exige requerimento prévio registrado.",
        }),
      );
      degrade(false);
    } else {
      const capable = requestStateAllowsEnrollmentCreation(
        configuration,
        request.originatingRequest.requestStateDefinitionId,
      );
      if (capable !== true) {
        diagnostics.push(
          diagnostic(
            CODES.requestStateNotCapable,
            TYPES.process,
            capable === null ? "warning" : "blocker",
            scope,
            {
              parameters: {
                requestStateDefinitionId: request.originatingRequest.requestStateDefinitionId,
                declared: capable !== null,
              },
              message:
                capable === null
                  ? "A configuração não declarou se este estado do requerimento constitui inscrição."
                  : "O estado do requerimento não possui capacidade de constituir inscrição.",
            },
          ),
        );
        degrade(capable);
      }
    }
  }

  const policy = configuration.requirementPolicies.find(
    (item) => item.policyId === process.requirementPolicyId,
  );
  let requirements: RequirementAssessment | null = null;
  if (policy) {
    requirements = assessRequirements(
      policy,
      process.processKindId,
      request.requirementFacts ?? {},
      scope,
      request.evaluators ?? NATIVE_REQUIREMENT_EVALUATORS,
    );
    diagnostics.push(...requirements.diagnostics);
    if (!requirements.allowed) degrade(false);
  }

  if (request.intendedNatureDefinitionIds && request.intendedNatureDefinitionIds.length > 0) {
    const coexistence = evaluateEnrollmentCoexistence({
      policy: configuration.coexistencePolicy,
      scope,
      candidate: {
        schoolId: scope.schoolId ?? null,
        natureDefinitionIds: request.intendedNatureDefinitionIds,
        validity: request.validity ?? { validFrom: OPEN_ENDED, validUntil: null },
      },
      existingEnrollments: request.existingEnrollments ?? [],
      existingParticipations: request.existingParticipations ?? [],
    });
    diagnostics.push(...coexistence.diagnostics);
    degrade(coexistence.allowed);
  }

  return {
    allowed,
    diagnostics,
    requirements,
    initialEnrollmentStateDefinitionId: process.initialEnrollmentStateDefinitionId,
  };
}

// ------------------------------------------------- coexistência entre inscrições

export type CoexistenceCandidate = {
  schoolId: string | null;
  natureDefinitionIds: readonly string[];
  validity: EnrollmentValidity;
};

/**
 * Compara a inscrição pretendida com as inscrições vigentes do aluno, por
 * escopo de comparação CONFIGURADO. O motor apenas identifica se as unidades
 * coincidem e entrega essa informação à política — jamais decide por si.
 */
export function evaluateEnrollmentCoexistence(input: {
  policy: EnrollmentCoexistencePolicy;
  scope: StudentLifeEventScope;
  candidate: CoexistenceCandidate;
  existingEnrollments: readonly AcademicCycleEnrollment[];
  existingParticipations: readonly CycleParticipation[];
}): StudentLifeValidationResult {
  const { policy, scope, candidate } = input;
  const diagnostics: StudentLifeDiagnostic[] = [];
  let allowed: boolean | null = true;

  for (const enrollment of input.existingEnrollments) {
    if (!overlaps(enrollment.validity, candidate.validity)) continue;

    const natures = input.existingParticipations
      .filter((participation) => participation.cycleEnrollmentId === enrollment.cycleEnrollmentId)
      .filter((participation) => overlaps(participation.validity, candidate.validity))
      .map((participation) => participation.natureDefinitionId);

    const sameSchool = candidate.schoolId !== null && candidate.schoolId === enrollment.schoolId;

    for (const existingNature of natures) {
      for (const candidateNature of candidate.natureDefinitionIds) {
        const pair = [existingNature, candidateNature].sort();
        const rule = policy.rules.find((item) => {
          const declared = [...item.natureDefinitionIds].sort();
          const scopeMatches = sameSchool
            ? item.comparisonScopeId === policy.comparisonScopeIds[0]
            : item.comparisonScopeId !== policy.comparisonScopeIds[0];
          return (
            declared.length === pair.length &&
            declared.every((value, index) => value === pair[index]) &&
            scopeMatches
          );
        });

        if (!rule) {
          if (policy.undeclaredCombinationStateId === "compatible") continue;
          const incompatible = policy.undeclaredCombinationStateId === "incompatible";
          diagnostics.push(
            diagnostic(
              CODES.participationCombinationUndeclared,
              TYPES.coexistence,
              incompatible ? "blocker" : "warning",
              scope,
              {
                parameters: {
                  natureDefinitionIds: pair.join("|"),
                  sameSchool,
                  policyId: policy.policyId,
                },
                message: "Coexistência não declarada pela política vigente.",
              },
            ),
          );
          if (incompatible) allowed = false;
          else if (allowed !== false) allowed = null;
          continue;
        }

        if (!rule.compatible) {
          diagnostics.push(
            diagnostic(
              rule.diagnosticCode ?? CODES.participationIncompatible,
              TYPES.coexistence,
              "blocker",
              scope,
              {
                parameters: {
                  ruleId: rule.ruleId,
                  natureDefinitionIds: pair.join("|"),
                  comparisonScopeId: rule.comparisonScopeId,
                  otherEnrollmentId: enrollment.cycleEnrollmentId,
                },
                message: rule.note ?? "Coexistência declarada incompatível pela política vigente.",
              },
            ),
          );
          allowed = false;
        }
      }
    }
  }

  return { allowed, diagnostics };
}

// -------------------------------------------------------- vigência da filha

/**
 * Primitiva temporal: a vigência da participação precisa caber na vigência da
 * inscrição. Nenhuma semântica de motivo, turno ou turma é considerada.
 */
export function validateParticipationValidity(
  enrollment: Pick<AcademicCycleEnrollment, "validity" | "cycleEnrollmentId">,
  candidate: EnrollmentValidity,
  scope: StudentLifeEventScope,
): StudentLifeValidationResult {
  const enrollmentUntil = enrollment.validity.validUntil ?? OPEN_ENDED;
  const candidateUntil = candidate.validUntil ?? OPEN_ENDED;
  const inside =
    candidate.validFrom >= enrollment.validity.validFrom && candidateUntil <= enrollmentUntil;

  if (inside) return { allowed: true, diagnostics: [] };

  return {
    allowed: false,
    diagnostics: [
      diagnostic(CODES.validityOutsideEnrollment, TYPES.temporality, "blocker", scope, {
        parameters: {
          cycleEnrollmentId: enrollment.cycleEnrollmentId,
          validFrom: candidate.validFrom,
          validUntil: candidate.validUntil,
        },
        message: "A vigência da participação excede a vigência da inscrição.",
      }),
    ],
  };
}

// ------------------------------------------------------------- transições

/**
 * Transições de estado da inscrição, da participação e do requerimento usam o
 * MESMO motor declarativo da 13A: nada aqui conhece nome de estado.
 */
export const evaluateEnrollmentStateTransition = validateTransition;

/** Retificação exige motivo configurado declarado; o passado nunca é sobrescrito. */
export function validateEnrollmentCorrection(
  input: { correctionReasonDefinitionId?: string; supersedesEnrollmentId?: string | null },
  scope: StudentLifeEventScope,
): StudentLifeValidationResult {
  if (!input.correctionReasonDefinitionId) {
    return {
      allowed: false,
      diagnostics: [
        diagnostic(CODES.correctionReasonMissing, TYPES.ledger, "blocker", scope, {
          parameters: { supersedesEnrollmentId: input.supersedesEnrollmentId ?? null },
          message: "A retificação exige motivo configurado declarado.",
        }),
      ],
    };
  }
  return { allowed: true, diagnostics: [] };
}
