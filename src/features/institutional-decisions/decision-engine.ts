/**
 * Etapa 13I — Motor de decisão institucional e de governança de configuração.
 *
 * O motor conhece apenas primitivas: comparar vigência, intersectar escopo,
 * verificar capacidade declarada, verificar disponibilidade de fato, aplicar
 * restrição registrada e encadear versões.
 *
 * Ele NÃO conhece Direção, Secretaria, Supervisão, cargo, turma, matrícula,
 * encerramento, transferência nem qualquer efeito concreto: tipos de processo,
 * alternativas, naturezas de ato, efeitos e restrições entram por configuração
 * e por REGISTRO de executores — nunca por `switch`.
 */
import {
  FACT_AVAILABILITY,
  type AllowedOverride,
  type ConsideredFactReference,
  type DecisionAlternativeDefinition,
  type DecisionProcessTypeDefinition,
  type DelegatedConfigurationCapability,
  type InstitutionalActEmission,
  type InstitutionalCompetenceGrant,
  type InstitutionalDecisionProcess,
  type InstitutionalDecisionRecord,
  type OverrideConstraint,
  type PolicyScope,
} from "./decision-types";
import type { DossierEntityReference } from "@/features/student-life/dossier-types";

// ------------------------------------------------------------- Primitivas

function withinValidity(input: {
  validFrom: string;
  validUntil: string | null;
  isoDate: string;
}): boolean {
  const day = input.isoDate.slice(0, 10);
  if (day < input.validFrom.slice(0, 10)) return false;
  if (input.validUntil === null) return true;
  return day <= input.validUntil.slice(0, 10);
}

function scopeIntersects(
  left: readonly DossierEntityReference[],
  right: readonly DossierEntityReference[],
): boolean {
  return left.some((entry) => right.some((other) => other.entityId === entry.entityId));
}

// ------------------------------------------------------------- Competência

export const COMPETENCE_OUTCOME = {
  held: "competencia-exercivel",
  notHeld: "competencia-ausente",
  inconclusive: "competencia-inconclusiva",
} as const;
export type CompetenceOutcome =
  (typeof COMPETENCE_OUTCOME)[keyof typeof COMPETENCE_OUTCOME];

export type CompetenceResolution = {
  outcome: CompetenceOutcome;
  /** Concessões que sustentam a competência na data avaliada. */
  grants: readonly InstitutionalCompetenceGrant[];
  explanation: string;
};

/**
 * Resolve competência por CAPACIDADE + ESCOPO + VIGÊNCIA. O cargo do agente é
 * irrelevante: mesmo rótulo pode ter capacidades diferentes, e a mesma pessoa
 * pode exercer uma competência em uma unidade e não em outra.
 */
export function resolveCompetence(input: {
  grants: readonly InstitutionalCompetenceGrant[];
  agentId: string;
  capacityDefinitionId: string;
  scopeEntities: readonly DossierEntityReference[];
  isoDate: string;
}): CompetenceResolution {
  if (input.capacityDefinitionId.trim().length === 0) {
    return {
      outcome: COMPETENCE_OUTCOME.inconclusive,
      grants: [],
      explanation:
        "Não é possível determinar a competência porque a configuração não declarou qual capacidade é exigida.",
    };
  }
  if (input.scopeEntities.length === 0) {
    return {
      outcome: COMPETENCE_OUTCOME.inconclusive,
      grants: [],
      explanation:
        "Não é possível determinar a competência porque o escopo institucional do objeto não foi informado.",
    };
  }
  const matching = input.grants.filter(
    (grant) =>
      grant.agentId === input.agentId &&
      grant.capacityDefinitionId === input.capacityDefinitionId &&
      scopeIntersects(grant.scopeEntities, input.scopeEntities) &&
      withinValidity({
        validFrom: grant.validFrom,
        validUntil: grant.validUntil,
        isoDate: input.isoDate,
      }),
  );
  if (matching.length === 0) {
    return {
      outcome: COMPETENCE_OUTCOME.notHeld,
      grants: [],
      explanation:
        "O agente não possui, nesta data e neste escopo, concessão vigente da capacidade exigida. Rótulo de cargo não substitui a concessão.",
    };
  }
  return {
    outcome: COMPETENCE_OUTCOME.held,
    grants: matching,
    explanation:
      "Competência exercível: capacidade concedida, escopo compatível e vigência em curso na data avaliada.",
  };
}

/**
 * Explicabilidade histórica: uma decisão tomada durante determinada vigência
 * continua válida e explicável depois que o agente perde a competência, porque
 * a verificação é feita na DATA DE EFICÁCIA da decisão, nunca "hoje".
 */
export function explainHistoricalDecision(input: {
  decision: InstitutionalDecisionRecord;
  grants: readonly InstitutionalCompetenceGrant[];
}): { competentAtDecisionTime: boolean; explanation: string } {
  const grant = input.grants.find(
    (candidate) => candidate.grantId === input.decision.exercisedGrantId,
  );
  if (!grant) {
    return {
      competentAtDecisionTime: false,
      explanation:
        "A concessão de competência referenciada pela decisão não foi localizada: a explicabilidade fica inconclusiva.",
    };
  }
  const competent = withinValidity({
    validFrom: grant.validFrom,
    validUntil: grant.validUntil,
    isoDate: input.decision.effectiveDate,
  });
  return {
    competentAtDecisionTime: competent,
    explanation: competent
      ? "A decisão foi tomada dentro da vigência da competência exercida e permanece historicamente válida, mesmo que essa competência já tenha cessado."
      : "A decisão foi registrada fora da vigência da competência declarada: exige análise institucional.",
  };
}

// ------------------------------------------------- Alternativas admissíveis

export const ALTERNATIVE_ADMISSIBILITY = {
  admissible: "alternativa-admissivel",
  inadmissible: "alternativa-inadmissivel",
  inconclusive: "alternativa-inconclusiva",
} as const;
export type AlternativeAdmissibility =
  (typeof ALTERNATIVE_ADMISSIBILITY)[keyof typeof ALTERNATIVE_ADMISSIBILITY];

export type AlternativeAssessment = {
  alternativeDefinitionId: string;
  labelSnapshot: string;
  admissibility: AlternativeAdmissibility;
  competence: CompetenceResolution;
  missingCapacityDefinitionIds: readonly string[];
  missingFactKeys: readonly string[];
  unavailableFactKeys: readonly string[];
  explanation: string;
};

export type DecisionAssessment = {
  decisionProcessId: string;
  decisionProcessTypeDefinitionId: string;
  requiringPolicyId: string;
  requiringPolicyVersion: number;
  requirementNarrativeSnapshot: string;
  alternatives: readonly AlternativeAssessment[];
  /** Alternativas efetivamente executáveis pelo agente nesta data. */
  admissibleAlternativeDefinitionIds: readonly string[];
  diagnostics: readonly string[];
};

function assessAlternative(input: {
  alternative: DecisionAlternativeDefinition;
  process: InstitutionalDecisionProcess;
  grants: readonly InstitutionalCompetenceGrant[];
  agentId: string;
  isoDate: string;
}): AlternativeAssessment {
  const { alternative, process } = input;
  const missingCapacities: string[] = [];
  let competence: CompetenceResolution = {
    outcome: COMPETENCE_OUTCOME.inconclusive,
    grants: [],
    explanation:
      "Não é possível determinar a autorização porque a alternativa não declara capacidade exigida na configuração.",
  };

  if (alternative.requiredCapacityDefinitionIds.length > 0) {
    const resolutions = alternative.requiredCapacityDefinitionIds.map((capacity) => ({
      capacity,
      resolution: resolveCompetence({
        grants: input.grants,
        agentId: input.agentId,
        capacityDefinitionId: capacity,
        scopeEntities: process.scopeEntities,
        isoDate: input.isoDate,
      }),
    }));
    for (const entry of resolutions) {
      if (entry.resolution.outcome !== COMPETENCE_OUTCOME.held) {
        missingCapacities.push(entry.capacity);
      }
    }
    const inconclusive = resolutions.find(
      (entry) => entry.resolution.outcome === COMPETENCE_OUTCOME.inconclusive,
    );
    const held = resolutions.every(
      (entry) => entry.resolution.outcome === COMPETENCE_OUTCOME.held,
    );
    competence = inconclusive
      ? inconclusive.resolution
      : held
        ? {
            outcome: COMPETENCE_OUTCOME.held,
            grants: resolutions.flatMap((entry) => entry.resolution.grants),
            explanation:
              "Todas as capacidades exigidas pela alternativa estão concedidas, no escopo e na vigência da data avaliada.",
          }
        : {
            outcome: COMPETENCE_OUTCOME.notHeld,
            grants: [],
            explanation:
              "Falta ao agente pelo menos uma capacidade exigida pela alternativa nesta data e neste escopo.",
          };
  }

  const requiredFacts = alternative.requiredFactKeys ?? [];
  const missingFactKeys: string[] = [];
  const unavailableFactKeys: string[] = [];
  for (const factKey of requiredFacts) {
    const fact = process.consideredFacts.find((entry) => entry.factKey === factKey);
    if (!fact) {
      missingFactKeys.push(factKey);
      continue;
    }
    if (fact.availability === FACT_AVAILABILITY.unavailable) {
      unavailableFactKeys.push(factKey);
    }
  }

  let admissibility: AlternativeAdmissibility;
  let explanation: string;
  if (competence.outcome === COMPETENCE_OUTCOME.inconclusive) {
    admissibility = ALTERNATIVE_ADMISSIBILITY.inconclusive;
    explanation = competence.explanation;
  } else if (competence.outcome === COMPETENCE_OUTCOME.notHeld) {
    admissibility = ALTERNATIVE_ADMISSIBILITY.inadmissible;
    explanation = `A alternativa existe no processo, mas o agente não possui a competência exigida (${missingCapacities.join(", ")}).`;
  } else if (missingFactKeys.length > 0 || unavailableFactKeys.length > 0) {
    admissibility = ALTERNATIVE_ADMISSIBILITY.inconclusive;
    explanation =
      "Não é possível decidir por esta alternativa porque fato exigido pela configuração não foi apresentado. Ausência de informação produz inconclusão, nunca autorização.";
  } else {
    admissibility = ALTERNATIVE_ADMISSIBILITY.admissible;
    explanation =
      "Alternativa admissível: competência vigente no escopo e fatos exigidos apresentados.";
  }

  return {
    alternativeDefinitionId: alternative.alternativeDefinitionId,
    labelSnapshot: alternative.labelSnapshot,
    admissibility,
    competence,
    missingCapacityDefinitionIds: missingCapacities,
    missingFactKeys,
    unavailableFactKeys,
    explanation,
  };
}

/**
 * Avalia o processo decisório: o que se decide, qual regra exige, quais fatos
 * foram considerados e quais alternativas são admissíveis para este agente.
 *
 * Um processo pode exigir decisão sem permitir NENHUMA alternativa até que
 * determinado fato seja apresentado — e isso é resultado legítimo.
 */
export function assessDecisionProcess(input: {
  process: InstitutionalDecisionProcess;
  typeDefinition: DecisionProcessTypeDefinition;
  grants: readonly InstitutionalCompetenceGrant[];
  agentId: string;
  isoDate: string;
}): DecisionAssessment {
  const diagnostics: string[] = [];
  if (!input.typeDefinition.homologated) {
    diagnostics.push(
      "Tipo de processo decisório sem homologação: nenhuma decisão produz efeito institucional oficial.",
    );
  }
  if (
    !withinValidity({
      validFrom: input.typeDefinition.validFrom,
      validUntil: input.typeDefinition.validUntil,
      isoDate: input.isoDate,
    })
  ) {
    diagnostics.push(
      "Tipo de processo decisório fora de vigência na data avaliada: a decisão fica inconclusiva.",
    );
  }
  for (const fact of input.process.consideredFacts) {
    if (fact.availability === FACT_AVAILABILITY.unavailable) {
      diagnostics.push(
        `Fato "${fact.labelSnapshot}" indisponível${
          fact.unavailabilityReasonSnapshot
            ? `: ${fact.unavailabilityReasonSnapshot}`
            : ""
        }. Dado ausente não é tratado como zero nem como atendimento.`,
      );
    }
  }

  const alternatives = input.typeDefinition.alternatives.map((alternative) =>
    assessAlternative({
      alternative,
      process: input.process,
      grants: input.grants,
      agentId: input.agentId,
      isoDate: input.isoDate,
    }),
  );

  const outOfValidity = diagnostics.some((entry) => entry.includes("fora de vigência"));

  return {
    decisionProcessId: input.process.decisionProcessId,
    decisionProcessTypeDefinitionId:
      input.typeDefinition.decisionProcessTypeDefinitionId,
    requiringPolicyId: input.typeDefinition.requiringPolicyId,
    requiringPolicyVersion: input.typeDefinition.requiringPolicyVersion,
    requirementNarrativeSnapshot: input.typeDefinition.requirementNarrativeSnapshot,
    alternatives,
    admissibleAlternativeDefinitionIds: outOfValidity
      ? []
      : alternatives
          .filter(
            (entry) => entry.admissibility === ALTERNATIVE_ADMISSIBILITY.admissible,
          )
          .map((entry) => entry.alternativeDefinitionId),
    diagnostics,
  };
}

// --------------------------------------------- Registro de emissores de ato

export type InstitutionalActEmitter = (input: {
  decisionProcess: InstitutionalDecisionProcess;
  alternative: DecisionAlternativeDefinition;
  typeDefinition: DecisionProcessTypeDefinition;
  agentId: string;
  effectiveDate: string;
  recordedAt: string;
}) => InstitutionalActEmission;

export type InstitutionalActEmitterRegistry = Map<string, InstitutionalActEmitter>;

export const INSTITUTIONAL_ACT_EMITTER_IDS = {
  /** Emissor genérico: registra o ato declarado pela configuração. */
  declaredAct: "emitir-ato-declarado-pela-configuracao",
} as const;

export function createActEmitterRegistry(): InstitutionalActEmitterRegistry {
  const registry: InstitutionalActEmitterRegistry = new Map();
  registry.set(
    INSTITUTIONAL_ACT_EMITTER_IDS.declaredAct,
    ({ decisionProcess, alternative, typeDefinition, agentId, effectiveDate, recordedAt }) => ({
      actId: `ato::${decisionProcess.decisionProcessId}::${alternative.alternativeDefinitionId}`,
      actNatureDefinitionId: typeDefinition.actNatureDefinitionId,
      labelSnapshot: alternative.labelSnapshot,
      effectiveDate,
      recordedAt,
      emittedByAgentId: agentId,
      effects: alternative.effects,
      objectReferences: decisionProcess.objectReferences,
    }),
  );
  return registry;
}

/** Nova espécie de ato institucional entra por registro, nunca por `switch`. */
export function registerActEmitter(
  registry: InstitutionalActEmitterRegistry,
  emitterId: string,
  emitter: InstitutionalActEmitter,
): InstitutionalActEmitterRegistry {
  registry.set(emitterId, emitter);
  return registry;
}

// --------------------------------------------------------- Decidir / retificar

export type DecisionOutcomePlan = {
  decision: InstitutionalDecisionRecord | null;
  /** Fato original devolvido INTACTO: decisão nunca o reescreve. */
  unchangedProcess: InstitutionalDecisionProcess;
  diagnostics: readonly string[];
};

export function decideInstitutionalProcess(input: {
  process: InstitutionalDecisionProcess;
  typeDefinition: DecisionProcessTypeDefinition;
  grants: readonly InstitutionalCompetenceGrant[];
  agentId: string;
  chosenAlternativeDefinitionId: string;
  justificationSnapshot?: string;
  effectiveDate: string;
  recordedAt: string;
  decisionRecordId: string;
  actEmitterId?: string;
  actEmitterRegistry?: InstitutionalActEmitterRegistry;
  provenanceOriginTypeId?: string;
}): DecisionOutcomePlan {
  const diagnostics: string[] = [];
  const assessment = assessDecisionProcess({
    process: input.process,
    typeDefinition: input.typeDefinition,
    grants: input.grants,
    agentId: input.agentId,
    isoDate: input.effectiveDate,
  });
  diagnostics.push(...assessment.diagnostics);

  // Falha fechada: definição sem homologação não decide nada.
  if (!input.typeDefinition.homologated) {
    return { decision: null, unchangedProcess: input.process, diagnostics };
  }


  const alternative = input.typeDefinition.alternatives.find(
    (entry) => entry.alternativeDefinitionId === input.chosenAlternativeDefinitionId,
  );
  if (!alternative) {
    diagnostics.push(
      "Alternativa escolhida não existe na configuração do processo: nenhuma decisão é registrada.",
    );
    return { decision: null, unchangedProcess: input.process, diagnostics };
  }
  if (
    !assessment.admissibleAlternativeDefinitionIds.includes(
      input.chosenAlternativeDefinitionId,
    )
  ) {
    const detail = assessment.alternatives.find(
      (entry) => entry.alternativeDefinitionId === input.chosenAlternativeDefinitionId,
    );
    diagnostics.push(
      detail?.explanation ??
        "Alternativa não admissível para este agente nesta data: nenhuma decisão é registrada.",
    );
    return { decision: null, unchangedProcess: input.process, diagnostics };
  }
  if (
    input.typeDefinition.requiresJustification &&
    (input.justificationSnapshot ?? "").trim().length === 0
  ) {
    diagnostics.push(
      "A configuração exige fundamentação por extenso: sem ela a decisão não é registrada.",
    );
    return { decision: null, unchangedProcess: input.process, diagnostics };
  }

  const competence = resolveCompetence({
    grants: input.grants,
    agentId: input.agentId,
    capacityDefinitionId: alternative.requiredCapacityDefinitionIds[0] ?? "",
    scopeEntities: input.process.scopeEntities,
    isoDate: input.effectiveDate,
  });
  const grantId = competence.grants[0]?.grantId;
  if (!grantId) {
    diagnostics.push(
      "Não foi possível identificar a concessão de competência exercida: nada é decidido.",
    );
    return { decision: null, unchangedProcess: input.process, diagnostics };
  }

  const registry = input.actEmitterRegistry ?? createActEmitterRegistry();
  const emitterId = input.actEmitterId ?? INSTITUTIONAL_ACT_EMITTER_IDS.declaredAct;
  const emitter = registry.get(emitterId);
  if (!emitter) {
    diagnostics.push(
      `Emissor de ato "${emitterId}" não registrado: a decisão não produz ato institucional.`,
    );
  }

  const act = emitter
    ? emitter({
        decisionProcess: input.process,
        alternative,
        typeDefinition: input.typeDefinition,
        agentId: input.agentId,
        effectiveDate: input.effectiveDate,
        recordedAt: input.recordedAt,
      })
    : undefined;

  const decision: InstitutionalDecisionRecord = {
    decisionRecordId: input.decisionRecordId,
    decisionProcessId: input.process.decisionProcessId,
    decisionProcessTypeDefinitionId:
      input.typeDefinition.decisionProcessTypeDefinitionId,
    chosenAlternativeDefinitionId: alternative.alternativeDefinitionId,
    exercisedCapacityDefinitionId:
      alternative.requiredCapacityDefinitionIds[0] ?? "",
    exercisedGrantId: grantId,
    agentId: input.agentId,
    ...(input.justificationSnapshot
      ? { justificationSnapshot: input.justificationSnapshot }
      : {}),
    consideredFactSnapshot: input.process.consideredFacts.map(
      (fact): ConsideredFactReference => ({ ...fact }),
    ),
    effectiveDate: input.effectiveDate,
    recordedAt: input.recordedAt,
    ...(act ? { act } : {}),
    provenance: {
      originTypeId: input.provenanceOriginTypeId ?? "decisao-registrada-no-sigem",
      recordedAt: input.recordedAt,
      recordedByAgentId: input.agentId,
    },
  };

  return { decision, unchangedProcess: input.process, diagnostics };
}

/** Retificação encadeada: a decisão anterior permanece íntegra e referenciada. */
export function rectifyDecision(input: {
  previous: InstitutionalDecisionRecord;
  decisionRecordId: string;
  chosenAlternativeDefinitionId: string;
  justificationSnapshot?: string;
  correctionReasonDefinitionId: string;
  correctionNote?: string;
  effectiveDate: string;
  recordedAt: string;
  agentId: string;
  exercisedGrantId: string;
}): InstitutionalDecisionRecord {
  return {
    ...input.previous,
    decisionRecordId: input.decisionRecordId,
    chosenAlternativeDefinitionId: input.chosenAlternativeDefinitionId,
    ...(input.justificationSnapshot
      ? { justificationSnapshot: input.justificationSnapshot }
      : {}),
    agentId: input.agentId,
    exercisedGrantId: input.exercisedGrantId,
    effectiveDate: input.effectiveDate,
    recordedAt: input.recordedAt,
    supersedesDecisionRecordId: input.previous.decisionRecordId,
    correctionReasonDefinitionId: input.correctionReasonDefinitionId,
    ...(input.correctionNote ? { correctionNote: input.correctionNote } : {}),
    provenance: {
      ...input.previous.provenance,
      recordedAt: input.recordedAt,
      recordedByAgentId: input.agentId,
      supersedesId: input.previous.decisionRecordId,
      correctionReasonDefinitionId: input.correctionReasonDefinitionId,
      ...(input.correctionNote ? { correctionNote: input.correctionNote } : {}),
    },
  };
}

/** Versão vigente DERIVADA da cadeia; nunca campo persistido. */
export function currentDecisionRecord(
  records: readonly InstitutionalDecisionRecord[],
  decisionProcessId: string,
): InstitutionalDecisionRecord | null {
  const chain = records.filter(
    (record) => record.decisionProcessId === decisionProcessId,
  );
  if (chain.length === 0) return null;
  const superseded = new Set(
    chain
      .map((record) => record.supersedesDecisionRecordId)
      .filter((value): value is string => value !== undefined),
  );
  const live = chain.filter((record) => !superseded.has(record.decisionRecordId));
  return live[live.length - 1] ?? null;
}

// --------------------------------------- Governança local de configuração

export const OVERRIDE_OUTCOME = {
  allowed: "override-permitido",
  blocked: "override-bloqueado",
  inconclusive: "override-inconclusivo",
  requiresSuperiorHomologation: "override-pendente-de-homologacao-superior",
} as const;
export type OverrideOutcome =
  (typeof OVERRIDE_OUTCOME)[keyof typeof OVERRIDE_OUTCOME];

export type OverrideConstraintExecutor = (input: {
  proposedValue: unknown;
  parameters: Readonly<Record<string, unknown>>;
}) => { satisfied: boolean; messageSnapshot?: string };

export type OverrideConstraintRegistry = Map<string, OverrideConstraintExecutor>;

export const OVERRIDE_CONSTRAINT_EXECUTOR_IDS = {
  numberWithinRange: "valor-numerico-dentro-do-intervalo",
  valueInSet: "valor-em-conjunto-declarado",
} as const;

export function createOverrideConstraintRegistry(): OverrideConstraintRegistry {
  const registry: OverrideConstraintRegistry = new Map();
  registry.set(
    OVERRIDE_CONSTRAINT_EXECUTOR_IDS.numberWithinRange,
    ({ proposedValue, parameters }) => {
      const min = parameters["minimum"];
      const max = parameters["maximum"];
      if (typeof proposedValue !== "number") {
        return {
          satisfied: false,
          messageSnapshot:
            "O valor proposto não é numérico: a restrição declarada não pode ser avaliada.",
        };
      }
      if (typeof min === "number" && proposedValue < min) {
        return {
          satisfied: false,
          messageSnapshot: `O valor proposto está abaixo do limite declarado (${min}).`,
        };
      }
      if (typeof max === "number" && proposedValue > max) {
        return {
          satisfied: false,
          messageSnapshot: `O valor proposto excede o limite declarado (${max}).`,
        };
      }
      return { satisfied: true };
    },
  );
  registry.set(OVERRIDE_CONSTRAINT_EXECUTOR_IDS.valueInSet, ({ proposedValue, parameters }) => {
    const allowed = parameters["allowedValues"];
    if (!Array.isArray(allowed)) {
      return {
        satisfied: false,
        messageSnapshot:
          "A restrição não declarou o conjunto de valores permitidos: resultado inconclusivo.",
      };
    }
    return allowed.includes(proposedValue)
      ? { satisfied: true }
      : {
          satisfied: false,
          messageSnapshot: "O valor proposto não pertence ao conjunto declarado.",
        };
  });
  return registry;
}

export function registerOverrideConstraintExecutor(
  registry: OverrideConstraintRegistry,
  executorId: string,
  executor: OverrideConstraintExecutor,
): OverrideConstraintRegistry {
  registry.set(executorId, executor);
  return registry;
}

export type OverrideEvaluation = {
  outcome: OverrideOutcome;
  policyScopeId: string;
  parameterDefinitionId: string;
  explanation: string;
  unsatisfiedConstraintMessages: readonly string[];
};

/**
 * Avalia se a unidade pode configurar determinado parâmetro. Sem override
 * declarado, a configuração é da autoridade proprietária e a unidade NÃO a
 * altera; sem executor de restrição registrado, o resultado é inconclusivo.
 */
export function evaluateConfigurationOverride(input: {
  policyScope: PolicyScope;
  allowedOverrides: readonly AllowedOverride[];
  delegations: readonly DelegatedConfigurationCapability[];
  agentCapacityDefinitionIds: readonly string[];
  scopeEntities: readonly DossierEntityReference[];
  parameterDefinitionId: string;
  proposedValue: unknown;
  isoDate: string;
  constraintRegistry?: OverrideConstraintRegistry;
}): OverrideEvaluation {
  const base = {
    policyScopeId: input.policyScope.policyScopeId,
    parameterDefinitionId: input.parameterDefinitionId,
  };
  const override = input.allowedOverrides.find(
    (candidate) =>
      candidate.policyScopeId === input.policyScope.policyScopeId &&
      candidate.parameterDefinitionId === input.parameterDefinitionId,
  );
  if (!override) {
    return {
      ...base,
      outcome: OVERRIDE_OUTCOME.blocked,
      explanation:
        "A configuração pertence à autoridade proprietária e não declara override local: a unidade não pode alterá-la.",
      unsatisfiedConstraintMessages: [],
    };
  }

  const delegation = input.delegations.find(
    (candidate) =>
      candidate.policyScopeId === input.policyScope.policyScopeId &&
      input.agentCapacityDefinitionIds.includes(candidate.capacityDefinitionId) &&
      scopeIntersects(candidate.scopeEntities, input.scopeEntities) &&
      withinValidity({
        validFrom: candidate.validFrom,
        validUntil: candidate.validUntil,
        isoDate: input.isoDate,
      }),
  );
  if (!delegation) {
    return {
      ...base,
      outcome: OVERRIDE_OUTCOME.blocked,
      explanation:
        "Existe override permitido, mas o agente não possui capacidade delegada vigente neste escopo para exercê-lo.",
      unsatisfiedConstraintMessages: [],
    };
  }

  const registry = input.constraintRegistry ?? createOverrideConstraintRegistry();
  const unsatisfied: string[] = [];
  let inconclusive = false;
  for (const constraint of override.constraints) {
    const executor = registry.get(constraint.constraintExecutorId);
    if (!executor) {
      inconclusive = true;
      unsatisfied.push(
        `Restrição "${constraint.constraintExecutorId}" sem executor registrado: capacidade ainda não suportada.`,
      );
      continue;
    }
    const result = executor({
      proposedValue: input.proposedValue,
      parameters: constraint.parameters ?? {},
    });
    if (!result.satisfied) {
      unsatisfied.push(
        result.messageSnapshot ??
          constraint.messageSnapshot ??
          "Restrição declarada não satisfeita pelo valor proposto.",
      );
    }
  }

  if (inconclusive) {
    return {
      ...base,
      outcome: OVERRIDE_OUTCOME.inconclusive,
      explanation:
        "Não é possível determinar o override porque uma restrição declarada não possui executor registrado.",
      unsatisfiedConstraintMessages: unsatisfied,
    };
  }
  if (unsatisfied.length > 0) {
    return {
      ...base,
      outcome: OVERRIDE_OUTCOME.blocked,
      explanation:
        "O override é permitido apenas dentro dos limites declarados, e o valor proposto está fora deles.",
      unsatisfiedConstraintMessages: unsatisfied,
    };
  }
  if (override.requiresSuperiorHomologation) {
    return {
      ...base,
      outcome: OVERRIDE_OUTCOME.requiresSuperiorHomologation,
      explanation:
        "O valor proposto respeita os limites, porém a configuração depende de homologação da autoridade superior.",
      unsatisfiedConstraintMessages: [],
    };
  }
  return {
    ...base,
    outcome: OVERRIDE_OUTCOME.allowed,
    explanation:
      "Override permitido: há delegação vigente no escopo e o valor proposto respeita os limites declarados.",
    unsatisfiedConstraintMessages: [],
  };
}

/**
 * Exceção autorizada NÃO altera a regra geral: ela é decisão sobre o caso, e a
 * configuração normativa continua exatamente como estava.
 */
export function exceptionPreservesGeneralRule(input: {
  decision: InstitutionalDecisionRecord;
  policyScope: PolicyScope;
}): { generalRuleChanged: false; explanation: string } {
  return {
    generalRuleChanged: false,
    explanation: `A decisão ${input.decision.decisionRecordId} autoriza uma exceção no caso concreto; o âmbito normativo ${input.policyScope.policyScopeId} permanece inalterado e continua aplicável aos demais casos.`,
  };
}

export { withinValidity as isWithinValidity, scopeIntersects as intersectsScope };
