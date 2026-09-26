/**
 * Etapa 13A — Motor de governança da Vida Escolar.
 *
 * O motor conhece apenas PRIMITIVAS: comparar estados, verificar declaração de
 * transição, exigir motivo/ato/requisito quando a configuração exigir, validar
 * payload contra o schema declarado e comparar sobreposição temporal.
 *
 * O motor NÃO conhece: nome de estado, motivo, escola, etapa, modalidade,
 * horário, capacidade de turma ou qualquer norma da rede.
 */
import {
  STUDENT_LIFE_DIAGNOSTIC_CODES as CODES,
  STUDENT_LIFE_DIAGNOSTIC_TYPES as TYPES,
  diagnostic,
} from "./student-life-diagnostics";
import type {
  BondValidityEpisode,
  ParticipationCoexistencePolicy,
  StudentLifeDiagnostic,
  StudentLifeEvent,
  StudentLifeEventScope,
  StudentLifeGovernanceConfiguration,
  StudentLifeStateMachine,
  StudentLifeTransitionDefinition,
  StudentLifeValidationResult,
} from "./student-life-types";

// ------------------------------------------------------------- transições

export type TransitionRequest = {
  machineId: string;
  fromStateDefinitionId: string;
  toStateDefinitionId: string;
  reasonDefinitionId?: string;
  /** Requisitos formais já satisfeitos, por código estruturado. */
  satisfiedRequirementTypeIds?: readonly string[];
  hasInstitutionalAct?: boolean;
  scope: StudentLifeEventScope;
};

export function findMachine(
  configuration: StudentLifeGovernanceConfiguration,
  machineId: string,
): StudentLifeStateMachine | undefined {
  return configuration.machines.find((machine) => machine.machineId === machineId);
}

export function findTransition(
  machine: StudentLifeStateMachine | undefined,
  request: Pick<TransitionRequest, "fromStateDefinitionId" | "toStateDefinitionId">,
): StudentLifeTransitionDefinition | undefined {
  return machine?.transitions.find(
    (transition) =>
      transition.fromStateDefinitionId === request.fromStateDefinitionId &&
      transition.toStateDefinitionId === request.toStateDefinitionId,
  );
}

/** Valida uma transição institucional sem conhecer nenhuma norma concreta. */
export function validateTransition(
  configuration: StudentLifeGovernanceConfiguration,
  request: TransitionRequest,
): StudentLifeValidationResult {
  const machine = findMachine(configuration, request.machineId);
  const transition = findTransition(machine, request);

  if (!transition) {
    return {
      allowed: false,
      diagnostics: [
        diagnostic(CODES.transitionUndeclared, TYPES.governance, "blocker", request.scope, {
          parameters: {
            machineId: request.machineId,
            fromStateDefinitionId: request.fromStateDefinitionId,
            toStateDefinitionId: request.toStateDefinitionId,
          },
          message: "Transição não declarada pela configuração institucional vigente.",
        }),
      ],
    };
  }

  const diagnostics: StudentLifeDiagnostic[] = [];

  if (transition.reasonRequired && !request.reasonDefinitionId) {
    diagnostics.push(
      diagnostic(CODES.transitionReasonMissing, TYPES.governance, "blocker", request.scope, {
        parameters: { transitionDefinitionId: transition.transitionDefinitionId },
        message: "A transição exige motivo declarado.",
      }),
    );
  }

  const allowedReasons = transition.allowedReasonDefinitionIds;
  if (
    request.reasonDefinitionId &&
    allowedReasons &&
    allowedReasons.length > 0 &&
    !allowedReasons.includes(request.reasonDefinitionId)
  ) {
    diagnostics.push(
      diagnostic(CODES.transitionReasonNotAllowed, TYPES.governance, "blocker", request.scope, {
        parameters: {
          transitionDefinitionId: transition.transitionDefinitionId,
          reasonDefinitionId: request.reasonDefinitionId,
        },
        message: "Motivo não admitido para esta transição.",
      }),
    );
  }

  const satisfied = new Set(request.satisfiedRequirementTypeIds ?? []);
  for (const requirementTypeId of transition.requirementTypeIds ?? []) {
    if (!satisfied.has(requirementTypeId)) {
      diagnostics.push(
        diagnostic(
          CODES.transitionRequirementPending,
          TYPES.governance,
          "requirement",
          request.scope,
          {
            parameters: {
              transitionDefinitionId: transition.transitionDefinitionId,
              requirementTypeId,
            },
            message: "Exigência formal pendente para esta transição.",
          },
        ),
      );
    }
  }

  if (transition.requiresInstitutionalAct && !request.hasInstitutionalAct) {
    diagnostics.push(
      diagnostic(CODES.transitionActMissing, TYPES.governance, "blocker", request.scope, {
        parameters: { transitionDefinitionId: transition.transitionDefinitionId },
        message: "A transição exige ato institucional originador.",
      }),
    );
  }

  const blocked = diagnostics.some(
    (item) => item.severity === "blocker" || item.severity === "requirement",
  );
  return { allowed: !blocked, diagnostics };
}

// ------------------------------------------------- sobreposição de vigência

function overlaps(
  a: { from: string; until: string | null },
  b: { from: string; until: string | null },
): boolean {
  const aUntil = a.until ?? "9999-12-31";
  const bUntil = b.until ?? "9999-12-31";
  return a.from <= bUntil && b.from <= aUntil;
}

/**
 * Invariante temporal (não `unique(studentId, schoolId)` eterno): o mesmo aluno
 * não pode possuir dois episódios de vigência simultâneos na mesma unidade.
 * Relações históricas distintas permanecem legítimas.
 */
export function validateBondValidity(
  episodes: readonly BondValidityEpisode[],
  candidate: { validFrom: string; validUntil: string | null },
  scope: StudentLifeEventScope,
): StudentLifeValidationResult {
  const conflicts = episodes.filter((episode) =>
    overlaps(
      { from: episode.validFrom, until: episode.validUntil },
      { from: candidate.validFrom, until: candidate.validUntil },
    ),
  );

  if (conflicts.length === 0) return { allowed: true, diagnostics: [] };

  return {
    allowed: false,
    diagnostics: conflicts.map((episode) =>
      diagnostic(CODES.bondOverlappingValidity, TYPES.temporality, "blocker", scope, {
        parameters: {
          episodeId: episode.episodeId,
          validFrom: episode.validFrom,
          validUntil: episode.validUntil,
        },
        message: "Já existe episódio de vigência sobreposto para este vínculo.",
      }),
    ),
  };
}

/** Estratégia de retorno à mesma unidade: decidida pela política, não pelo motor. */
export function resolveReturnStrategy(
  configuration: StudentLifeGovernanceConfiguration,
  scope: StudentLifeEventScope,
): { strategyId: "reactivate-episode" | "chain-new-bond" | null; diagnostics: StudentLifeDiagnostic[] } {
  const strategyId = configuration.returnPolicy.returnStrategyId;
  if (!strategyId) {
    return {
      strategyId: null,
      diagnostics: [
        diagnostic(
          CODES.bondReturnStrategyUndeclared,
          TYPES.governance,
          "blocker",
          scope,
          {
            parameters: { policyId: configuration.returnPolicy.policyId },
            message: "A rede ainda não declarou como representar o retorno à mesma unidade.",
          },
        ),
      ],
    };
  }
  return { strategyId, diagnostics: [] };
}

// ------------------------------------------------------------ coexistência

/**
 * Compatibilidade entre naturezas de participação, sem qualquer noção de
 * horário, turno, capacidade ou operação — isso pertence a etapas futuras.
 */
export function validateParticipationCoexistence(
  policy: ParticipationCoexistencePolicy,
  natureDefinitionIds: readonly string[],
  scope: StudentLifeEventScope,
): StudentLifeValidationResult {
  if (natureDefinitionIds.length < 2) {
    const single = natureDefinitionIds[0];
    const definition = policy.natures.find((item) => item.natureDefinitionId === single);
    if (definition?.requiresPrincipalParticipation) {
      return {
        allowed: false,
        diagnostics: [
          diagnostic(CODES.participationPrincipalMissing, TYPES.participation, "blocker", scope, {
            parameters: { natureDefinitionId: definition.natureDefinitionId },
            message: "Esta natureza exige participação principal simultânea.",
          }),
        ],
      };
    }
    return { allowed: true, diagnostics: [] };
  }

  const requested = [...natureDefinitionIds].sort();
  const rule = policy.rules.find((candidate) => {
    const declared = [...candidate.natureDefinitionIds].sort();
    return (
      declared.length === requested.length &&
      declared.every((value, index) => value === requested[index])
    );
  });

  if (!rule) {
    if (policy.undeclaredCombinationStateId === "compatible") {
      return { allowed: true, diagnostics: [] };
    }
    const severity = policy.undeclaredCombinationStateId === "incompatible" ? "blocker" : "warning";
    return {
      allowed: policy.undeclaredCombinationStateId === "incompatible" ? false : null,
      diagnostics: [
        diagnostic(
          CODES.participationCombinationUndeclared,
          TYPES.participation,
          severity,
          scope,
          {
            parameters: { natureDefinitionIds: requested.join("|") },
            message: "Combinação de participações não declarada pela política vigente.",
          },
        ),
      ],
    };
  }

  if (rule.compatible) return { allowed: true, diagnostics: [] };

  return {
    allowed: false,
    diagnostics: [
      diagnostic(
        rule.diagnosticCode ?? CODES.participationIncompatible,
        TYPES.participation,
        "blocker",
        scope,
        {
          parameters: { ruleId: rule.ruleId, natureDefinitionIds: requested.join("|") },
          message: rule.note ?? "Combinação declarada incompatível pela política vigente.",
        },
      ),
    ],
  };
}

// ------------------------------------------------------- payload de eventos

/** Valida o payload do evento contra o schema declarado pelo seu tipo. */
export function validateEventPayload(
  configuration: StudentLifeGovernanceConfiguration,
  event: Pick<
    StudentLifeEvent,
    "eventTypeDefinitionId" | "payloadSchemaDefinitionId" | "attributes" | "scope"
  >,
): StudentLifeValidationResult {
  const eventType = configuration.eventTypes.find(
    (item) => item.eventTypeDefinitionId === event.eventTypeDefinitionId,
  );
  if (!eventType) {
    return {
      allowed: false,
      diagnostics: [
        diagnostic(CODES.eventTypeUnknown, TYPES.ledger, "blocker", event.scope, {
          parameters: { eventTypeDefinitionId: event.eventTypeDefinitionId },
          message: "Tipo de evento não declarado pela configuração.",
        }),
      ],
    };
  }

  const diagnostics: StudentLifeDiagnostic[] = [];

  for (const scopeKey of eventType.requiredScopeKeys) {
    if (event.scope[scopeKey] === undefined) {
      diagnostics.push(
        diagnostic(CODES.eventScopeMissing, TYPES.ledger, "blocker", event.scope, {
          parameters: { eventTypeDefinitionId: eventType.eventTypeDefinitionId, scopeKey },
          message: "Escopo obrigatório ausente no evento.",
        }),
      );
    }
  }

  const schema = configuration.payloadSchemas.find(
    (item) => item.payloadSchemaDefinitionId === event.payloadSchemaDefinitionId,
  );

  if (schema) {
    for (const field of schema.fields) {
      const value = event.attributes[field.key];
      if (value === undefined || value === null) {
        if (field.required) {
          diagnostics.push(
            diagnostic(CODES.eventPayloadFieldMissing, TYPES.ledger, "blocker", event.scope, {
              parameters: { payloadSchemaDefinitionId: schema.payloadSchemaDefinitionId, field: field.key },
              message: "Campo obrigatório do payload ausente.",
            }),
          );
        }
        continue;
      }
      const typeOk =
        field.valueType === "number"
          ? typeof value === "number"
          : field.valueType === "boolean"
            ? typeof value === "boolean"
            : field.valueType === "isoDate"
              ? typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
              : typeof value === "string";
      if (!typeOk) {
        diagnostics.push(
          diagnostic(CODES.eventPayloadFieldType, TYPES.ledger, "blocker", event.scope, {
            parameters: {
              payloadSchemaDefinitionId: schema.payloadSchemaDefinitionId,
              field: field.key,
              expected: field.valueType,
            },
            message: "Campo do payload com tipo divergente do contrato declarado.",
          }),
        );
      }
    }
  }

  return { allowed: diagnostics.length === 0, diagnostics };
}
