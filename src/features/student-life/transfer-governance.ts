/**
 * Etapa 13D — Motor de governança da Mobilidade Institucional.
 *
 * O motor é PURO e cego a norma. Conhece apenas primitivas:
 *   1. localizar o rito e a transição configurados;
 *   2. confrontar o estágio vigente DEDUZIDO do ledger com a transição;
 *   3. validar polos polimórficos contra o schema declarado do tipo;
 *   4. validar documentos e intervalo contra catálogos cadastrados;
 *   5. delegar requisitos aos avaliadores registrados;
 *   6. PUBLICAR FATOS (contagens, referências) para as políticas decidirem;
 *   7. executar os efeitos configurados via executores registrados;
 *   8. devolver diagnósticos estruturados e um plano atômico.
 *
 * O motor não conhece "interno", "externo", "AEE", "guia de transferência",
 * "trânsito regulamentar", "TRANSFERIDO", prazo legal nem qualquer situação.
 * Também não cria turma, alocação ou inscrição no destino: essa competência é da
 * unidade receptora (13B/13C).
 */
import { addDays } from "@/lib/academic-date";
import { diagnostic } from "./student-life-diagnostics";
import type {
  EventPayloadSchemaDefinition,
  InstitutionalActReference,
  StudentLifeDiagnostic,
  StudentLifeEventScope,
  StudentLifeProvenance,
} from "./student-life-types";
import type {
  AcademicCycleEnrollment,
  CycleParticipation,
  RequirementEffectDefinition,
  RequirementEvaluationStatus,
} from "./cycle-enrollment-types";
import type { AllocationTimingPolicy, ClassAllocation } from "./class-allocation-types";
import {
  TRANSFER_DIAGNOSTIC_CODES as CODES,
  TRANSFER_DIAGNOSTIC_TYPES as TYPES,
} from "./transfer-diagnostics";
import {
  applyConfiguredEffects,
  type TransferEffectAction,
  type TransferEffectOutcome,
  type TransferEffectRegistry,
  type TransferMobilityFacts,
} from "./transfer-effects";
import { currentStageOf, nextSequenceNumber } from "./transfer-ledger";
import type {
  InstitutionalTransferGovernanceConfiguration,
  InstitutionalTransferProcess,
  InstitutionalTransitionIntervalRecord,
  MobilityContextReference,
  MobilityPole,
  TransferDocumentRecord,
  TransferProcessVersionRecord,
  TransferStageTransitionDefinition,
  TransferStageTransitionRecord,
  TransferTransitionRequirement,
} from "./transfer-types";

/** Fatos da mobilidade, por chave aberta, publicados no formato numérico. */
export const TRANSFER_FACT_KEYS = {
  remainingEnrollmentsInBond: "inscricoes-vigentes-remanescentes-no-vinculo",
  remainingParticipationsInBond: "participacoes-vigentes-remanescentes-no-vinculo",
  impactedParticipations: "participacoes-impactadas",
  impactedAllocations: "alocacoes-impactadas",
} as const;

function degradeWith(current: boolean | null, next: boolean | null): boolean | null {
  if (next === false || current === false) return false;
  if (next === null || current === null) return null;
  return true;
}

// ----------------------------------------------- Polos polimórficos abertos

/**
 * Valida a referência de contexto contra o TIPO cadastrado e o SCHEMA declarado.
 * O motor não conhece nenhum tipo: só verifica se o tipo existe, se o schema
 * corresponde e se os atributos obrigatórios estão presentes e bem tipados.
 */
export function validateMobilityContextReference(
  reference: MobilityContextReference,
  configuration: Pick<
    InstitutionalTransferGovernanceConfiguration,
    "contextReferenceTypes" | "payloadSchemas"
  >,
  scope: StudentLifeEventScope,
  poleKindId: string,
): { allowed: boolean; diagnostics: StudentLifeDiagnostic[] } {
  const diagnostics: StudentLifeDiagnostic[] = [];
  const type = configuration.contextReferenceTypes.find(
    (item) =>
      item.contextReferenceTypeDefinitionId === reference.contextReferenceTypeDefinitionId,
  );
  if (!type) {
    diagnostics.push(
      diagnostic(CODES.contextTypeUndeclared, TYPES.context, "blocker", scope, {
        parameters: {
          poleKindId,
          contextReferenceTypeDefinitionId: reference.contextReferenceTypeDefinitionId,
        },
        message: "Tipo de referência de contexto não cadastrado na configuração.",
      }),
    );
    return { allowed: false, diagnostics };
  }
  if (type.payloadSchemaDefinitionId !== reference.payloadSchemaDefinitionId) {
    diagnostics.push(
      diagnostic(CODES.contextSchemaMismatch, TYPES.context, "blocker", scope, {
        parameters: {
          poleKindId,
          declared: reference.payloadSchemaDefinitionId,
          expected: type.payloadSchemaDefinitionId,
        },
        message: "O schema declarado na referência difere do schema do tipo cadastrado.",
      }),
    );
  }
  const schema: EventPayloadSchemaDefinition | undefined = configuration.payloadSchemas.find(
    (item) => item.payloadSchemaDefinitionId === type.payloadSchemaDefinitionId,
  );
  if (!schema) {
    diagnostics.push(
      diagnostic(CODES.contextSchemaUnknown, TYPES.context, "blocker", scope, {
        parameters: { poleKindId, payloadSchemaDefinitionId: type.payloadSchemaDefinitionId },
        message: "Schema de payload do contexto não cadastrado.",
      }),
    );
    return { allowed: false, diagnostics };
  }
  for (const field of schema.fields) {
    const value = reference.attributes[field.key];
    if (value === undefined || value === null) {
      if (field.required) {
        diagnostics.push(
          diagnostic(CODES.contextFieldMissing, TYPES.context, "blocker", scope, {
            parameters: { poleKindId, key: field.key },
            message: "Atributo obrigatório do contexto ausente.",
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
        diagnostic(CODES.contextFieldType, TYPES.context, "blocker", scope, {
          parameters: { poleKindId, key: field.key, expected: field.valueType },
          message: "Atributo do contexto com tipo divergente do schema.",
        }),
      );
    }
  }
  return { allowed: diagnostics.length === 0, diagnostics };
}

/**
 * Valida um POLO: exatamente uma das representações — referência presente ou
 * ausência registrada com motivo estruturado. Nunca um booleano de conhecimento.
 */
export function validateMobilityPole(
  pole: MobilityPole,
  configuration: Pick<
    InstitutionalTransferGovernanceConfiguration,
    "contextReferenceTypes" | "payloadSchemas"
  >,
  scope: StudentLifeEventScope,
  poleKindId: string,
): { allowed: boolean; diagnostics: StudentLifeDiagnostic[] } {
  const diagnostics: StudentLifeDiagnostic[] = [];
  if (pole.reference && pole.absence) {
    diagnostics.push(
      diagnostic(CODES.poleAmbiguous, TYPES.context, "blocker", scope, {
        parameters: { poleKindId },
        message: "O polo declara simultaneamente referência e ausência de contexto.",
      }),
    );
    return { allowed: false, diagnostics };
  }
  if (!pole.reference && !pole.absence) {
    diagnostics.push(
      diagnostic(CODES.poleUndetermined, TYPES.context, "blocker", scope, {
        parameters: { poleKindId },
        message: "O polo não declara referência nem ausência registrada de contexto.",
      }),
    );
    return { allowed: false, diagnostics };
  }
  if (pole.absence) {
    if (!pole.absence.absenceReasonDefinitionId) {
      diagnostics.push(
        diagnostic(CODES.poleAbsenceReasonMissing, TYPES.context, "blocker", scope, {
          parameters: { poleKindId },
          message: "Ausência de contexto sem motivo estruturado declarado.",
        }),
      );
    }
    return { allowed: diagnostics.length === 0, diagnostics };
  }
  return validateMobilityContextReference(pole.reference!, configuration, scope, poleKindId);
}

// -------------------------------------------- Documentos e intervalo

/** Estados documentais e de verificação devem existir no catálogo cadastrado. */
export function validateTransferDocuments(
  documents: readonly TransferDocumentRecord[],
  configuration: Pick<
    InstitutionalTransferGovernanceConfiguration,
    "documentStatuses" | "verificationStatuses"
  >,
  scope: StudentLifeEventScope,
): { allowed: boolean; diagnostics: StudentLifeDiagnostic[] } {
  const diagnostics: StudentLifeDiagnostic[] = [];
  for (const document of documents) {
    const statusKnown = configuration.documentStatuses.some(
      (item) => item.documentStatusDefinitionId === document.documentStatusDefinitionId,
    );
    if (!statusKnown) {
      diagnostics.push(
        diagnostic(CODES.documentStatusUndeclared, TYPES.documentation, "blocker", scope, {
          parameters: {
            documentRecordId: document.documentRecordId,
            documentStatusDefinitionId: document.documentStatusDefinitionId,
          },
          message: "Estado documental não cadastrado na configuração.",
        }),
      );
    }
    if (document.verificationStatusDefinitionId !== undefined) {
      const verificationKnown = configuration.verificationStatuses.some(
        (item) =>
          item.verificationStatusDefinitionId === document.verificationStatusDefinitionId,
      );
      if (!verificationKnown) {
        diagnostics.push(
          diagnostic(CODES.verificationStatusUndeclared, TYPES.documentation, "blocker", scope, {
            parameters: {
              documentRecordId: document.documentRecordId,
              verificationStatusDefinitionId: document.verificationStatusDefinitionId,
            },
            message: "Estado de verificação documental não cadastrado na configuração.",
          }),
        );
      }
    }
  }
  return { allowed: diagnostics.length === 0, diagnostics };
}

/**
 * Valida o intervalo institucional: a NATUREZA deve estar cadastrada e as datas
 * não podem estar invertidas. O motor não conhece nenhuma natureza específica.
 */
export function validateTransitionInterval(
  interval: InstitutionalTransitionIntervalRecord,
  configuration: Pick<InstitutionalTransferGovernanceConfiguration, "transitionIntervalKinds">,
  scope: StudentLifeEventScope,
): { allowed: boolean; diagnostics: StudentLifeDiagnostic[] } {
  const diagnostics: StudentLifeDiagnostic[] = [];
  const known = configuration.transitionIntervalKinds.some(
    (item) => item.transitionKindDefinitionId === interval.transitionKindDefinitionId,
  );
  if (!known) {
    diagnostics.push(
      diagnostic(CODES.transitionIntervalKindUndeclared, TYPES.temporality, "blocker", scope, {
        parameters: { transitionKindDefinitionId: interval.transitionKindDefinitionId },
        message: "Natureza do intervalo institucional não cadastrada na configuração.",
      }),
    );
  }
  const end = interval.concludedDate ?? interval.deadlineDate ?? null;
  if (end !== null && end < interval.startDate) {
    diagnostics.push(
      diagnostic(CODES.transitionIntervalInverted, TYPES.temporality, "blocker", scope, {
        parameters: { startDate: interval.startDate, end },
        message: "Intervalo institucional com término anterior ao início.",
      }),
    );
  }
  return { allowed: diagnostics.length === 0, diagnostics };
}

// ------------------------------------------------- Requisitos declarativos

/** Fatos BRUTOS oferecidos aos avaliadores de requisito; nenhum é interpretação. */
export type TransferRequirementFacts = {
  originatingAct?: InstitutionalActReference;
  documents: readonly TransferDocumentRecord[];
  originPole: MobilityPole;
  destinationPole: MobilityPole;
  numericFacts: Readonly<Record<string, number>>;
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
};

export type TransferRequirementEvaluator = (input: {
  definition: TransferTransitionRequirement;
  facts: TransferRequirementFacts;
}) => { status: RequirementEvaluationStatus; detail?: string };

/** PRIMITIVA: existe ato institucional originador declarado? */
const originatingActEvaluator: TransferRequirementEvaluator = ({ facts }) => ({
  status: facts.originatingAct ? "satisfeito" : "nao-satisfeito",
});

/**
 * PRIMITIVA: existe documento do tipo declarado em um dos estados declarados?
 * Tipos e estados vêm dos parâmetros configurados; o motor não conhece nenhum.
 */
const documentInStateEvaluator: TransferRequirementEvaluator = ({ definition, facts }) => {
  const typeId = definition.parameters?.["documentTypeDefinitionId"];
  const statusList = definition.parameters?.["documentStatusDefinitionIds"];
  if (typeof typeId !== "string" || typeof statusList !== "string") {
    return { status: "erro-de-configuracao", detail: "Parâmetros do requisito incompletos." };
  }
  const accepted = statusList.split(",").map((value) => value.trim()).filter(Boolean);
  const candidates = facts.documents.filter((item) => item.documentTypeDefinitionId === typeId);
  if (candidates.length === 0) return { status: "nao-satisfeito" };
  return candidates.some((item) => accepted.includes(item.documentStatusDefinitionId))
    ? { status: "satisfeito" }
    : { status: "nao-satisfeito" };
};

/** PRIMITIVA: o polo declarado nos parâmetros possui referência conhecida? */
const knownContextEvaluator: TransferRequirementEvaluator = ({ definition, facts }) => {
  const poleKindId = definition.parameters?.["poleKindId"];
  if (poleKindId !== "origem" && poleKindId !== "destino") {
    return { status: "erro-de-configuracao", detail: "Polo do requisito não declarado." };
  }
  const pole = poleKindId === "origem" ? facts.originPole : facts.destinationPole;
  if (!pole.reference && !pole.absence) return { status: "inconclusivo" };
  return pole.reference ? { status: "satisfeito" } : { status: "nao-satisfeito" };
};

/** PRIMITIVA: comparação numérica sobre um fato publicado pelo motor. */
const numericFactEvaluator: TransferRequirementEvaluator = ({ definition, facts }) => {
  const factKeyId = definition.parameters?.["factKeyId"];
  const value = definition.parameters?.["value"];
  const comparator = definition.parameters?.["comparator"];
  if (typeof factKeyId !== "string" || typeof value !== "number" || typeof comparator !== "string") {
    return { status: "erro-de-configuracao", detail: "Parâmetros do requisito incompletos." };
  }
  const fact = facts.numericFacts[factKeyId];
  if (fact === undefined) return { status: "inconclusivo" };
  const satisfied =
    comparator === "eq"
      ? fact === value
      : comparator === "lte"
        ? fact <= value
        : comparator === "gte"
          ? fact >= value
          : comparator === "lt"
            ? fact < value
            : comparator === "gt"
              ? fact > value
              : null;
  if (satisfied === null) {
    return { status: "erro-de-configuracao", detail: "Comparador não suportado." };
  }
  return { status: satisfied ? "satisfeito" : "nao-satisfeito" };
};

export const TRANSFER_REQUIREMENT_EVALUATOR_IDS = {
  originatingAct: "aval-ato-originador-presente",
  documentInState: "aval-documento-em-estado-declarado",
  knownContext: "aval-contexto-do-polo-conhecido",
  numericFact: "aval-comparacao-de-fato-numerico",
} as const;

export const NATIVE_TRANSFER_REQUIREMENT_EVALUATORS: Readonly<
  Record<string, TransferRequirementEvaluator>
> = {
  [TRANSFER_REQUIREMENT_EVALUATOR_IDS.originatingAct]: originatingActEvaluator,
  [TRANSFER_REQUIREMENT_EVALUATOR_IDS.documentInState]: documentInStateEvaluator,
  [TRANSFER_REQUIREMENT_EVALUATOR_IDS.knownContext]: knownContextEvaluator,
  [TRANSFER_REQUIREMENT_EVALUATOR_IDS.numericFact]: numericFactEvaluator,
};

/** Fato atômico do requisito; a interpretação pertence ao consumidor. */
export type TransferRequirementEvaluation = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  status: RequirementEvaluationStatus;
  requirementEffectDefinitionId: string | null;
  detail?: string;
};

export type TransferRequirementAssessment = {
  allowed: boolean | null;
  evaluations: readonly TransferRequirementEvaluation[];
  diagnostics: readonly StudentLifeDiagnostic[];
};

export function assessTransitionRequirements(
  requirements: readonly TransferTransitionRequirement[],
  effects: readonly RequirementEffectDefinition[],
  facts: TransferRequirementFacts,
  scope: StudentLifeEventScope,
  evaluators: Readonly<Record<string, TransferRequirementEvaluator>> = NATIVE_TRANSFER_REQUIREMENT_EVALUATORS,
): TransferRequirementAssessment {
  const evaluations: TransferRequirementEvaluation[] = [];
  const diagnostics: StudentLifeDiagnostic[] = [];
  let allowed: boolean | null = true;

  for (const definition of requirements) {
    const evaluator = evaluators[definition.evaluatorId];
    if (!evaluator) {
      allowed = degradeWith(allowed, null);
      diagnostics.push(
        diagnostic(CODES.requirementEvaluatorMissing, TYPES.process, "blocker", scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            evaluatorId: definition.evaluatorId,
          },
          message: "Requisito sem avaliador registrado.",
        }),
      );
      evaluations.push({
        requirementDefinitionId: definition.requirementDefinitionId,
        labelSnapshot: definition.labelSnapshot,
        status: "erro-de-configuracao",
        requirementEffectDefinitionId: null,
      });
      continue;
    }
    const { status, detail } = evaluator({ definition, facts });
    const effectId =
      definition.effectByStatus[status] ?? definition.defaultEffectDefinitionId ?? null;
    const effect = effectId
      ? effects.find((item) => item.effectDefinitionId === effectId) ?? null
      : null;

    if (effectId && !effect) {
      allowed = degradeWith(allowed, null);
      diagnostics.push(
        diagnostic(CODES.requirementEffectUndeclared, TYPES.process, "blocker", scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effectId,
          },
          message: "Efeito configurado inexistente no catálogo da rede.",
        }),
      );
    } else if (!effectId && status !== "satisfeito" && status !== "nao-aplicavel") {
      allowed = degradeWith(allowed, null);
      diagnostics.push(
        diagnostic(CODES.requirementEffectUndeclared, TYPES.process, "requirement", scope, {
          parameters: { requirementDefinitionId: definition.requirementDefinitionId, status },
          message: "A política não declarou efeito para o resultado obtido.",
        }),
      );
    } else if (effect?.preventsTransition) {
      allowed = degradeWith(allowed, false);
      diagnostics.push(
        diagnostic(CODES.requirementEffect, TYPES.process, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            status,
            effectDefinitionId: effect.effectDefinitionId,
          },
          message: effect.labelSnapshot,
        }),
      );
    } else if (effect) {
      diagnostics.push(
        diagnostic(CODES.requirementEffect, TYPES.process, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            status,
            effectDefinitionId: effect.effectDefinitionId,
          },
          message: effect.labelSnapshot,
        }),
      );
    }

    evaluations.push({
      requirementDefinitionId: definition.requirementDefinitionId,
      labelSnapshot: definition.labelSnapshot,
      status,
      requirementEffectDefinitionId: effectId,
      ...(detail === undefined ? {} : { detail }),
    });
  }

  return { allowed, evaluations, diagnostics };
}

// -------------------------------------------------- Temporalidade declarada

/**
 * Resolve a data de encerramento da vigência na origem a partir da política
 * TEMPORAL da 13C. `null` = política não resolvida. Não existe "-1 dia" nativo.
 */
export function resolveOriginClosureDate(
  effectiveDate: string,
  timingPolicy: AllocationTimingPolicy | undefined,
  boundaryDefinitionId: string | undefined,
): string | null {
  if (!timingPolicy) return null;
  const targetId = boundaryDefinitionId ?? timingPolicy.activeBoundaryDefinitionId;
  if (!targetId) return null;
  const boundary = timingPolicy.boundaries.find(
    (item) => item.boundaryDefinitionId === targetId,
  );
  if (!boundary) return null;
  const shifted = addDays(effectiveDate, boundary.originClosureOffsetDays);
  return boundary.originClosureInclusive ? shifted : addDays(shifted, -1);
}

// ------------------------------------------------------ Publicação de fatos

function inForce(validUntil: string | null, referenceDate: string): boolean {
  return validUntil === null || validUntil >= referenceDate;
}

/**
 * Publica os FATOS da mobilidade. O motor conta e referencia; nunca conclui.
 * "Restam 0 inscrições vigentes no vínculo" é fato; o efeito é da política.
 */
export function publishMobilityFacts(input: {
  effectiveDate: string;
  impactedParticipations: readonly CycleParticipation[];
  impactedAllocations: readonly ClassAllocation[];
  impactedEnrollments: readonly AcademicCycleEnrollment[];
  /** Universo de inscrições do vínculo, para a contagem remanescente. */
  bondEnrollments?: readonly AcademicCycleEnrollment[];
  /** Universo de participações do vínculo, para a contagem remanescente. */
  bondParticipations?: readonly CycleParticipation[];
  impactedBondIds?: readonly string[];
}): TransferMobilityFacts {
  const impactedEnrollmentIds = new Set(
    input.impactedEnrollments.map((item) => item.cycleEnrollmentId),
  );
  const impactedParticipationIds = new Set(
    input.impactedParticipations.map((item) => item.participationId),
  );

  const remainingEnrollments = (input.bondEnrollments ?? []).filter(
    (item) =>
      !impactedEnrollmentIds.has(item.cycleEnrollmentId) &&
      inForce(item.validity.validUntil, input.effectiveDate),
  ).length;

  const remainingParticipations = (input.bondParticipations ?? []).filter(
    (item) =>
      !impactedParticipationIds.has(item.participationId) &&
      inForce(item.validity.validUntil, input.effectiveDate),
  ).length;

  return {
    numericFacts: {
      [TRANSFER_FACT_KEYS.remainingEnrollmentsInBond]: remainingEnrollments,
      [TRANSFER_FACT_KEYS.remainingParticipationsInBond]: remainingParticipations,
      [TRANSFER_FACT_KEYS.impactedParticipations]: input.impactedParticipations.length,
      [TRANSFER_FACT_KEYS.impactedAllocations]: input.impactedAllocations.length,
    },
    impactedBondIds: input.impactedBondIds ?? [],
    impactedEnrollmentIds: [...impactedEnrollmentIds],
  };
}

// ---------------------------------------------- Plano atômico da transição

export type TransferTransitionPlan = {
  /** `null` = inconclusivo: faltou definição configurada para decidir. */
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
  /** Transição a registrar; `null` quando o plano não é admissível. */
  transition: TransferStageTransitionRecord | null;
  requirementEvaluations: readonly TransferRequirementEvaluation[];
  effectOutcomes: readonly TransferEffectOutcome[];
  /** Ações institucionais propostas; vazias quando o plano não é admissível. */
  actions: readonly TransferEffectAction[];
  facts: TransferMobilityFacts;
  originClosureDate: string | null;
};

export type PlanTransferTransitionInput = {
  configuration: InstitutionalTransferGovernanceConfiguration;
  process: InstitutionalTransferProcess;
  version: TransferProcessVersionRecord;
  existingTransitions: readonly TransferStageTransitionRecord[];
  transitionDefinitionId: string;
  transitionId: string;
  effectiveDate: string;
  reasonDefinitionId?: string;
  originatingAct?: InstitutionalActReference;
  impactedParticipations?: readonly CycleParticipation[];
  impactedAllocations?: readonly ClassAllocation[];
  impactedEnrollments?: readonly AcademicCycleEnrollment[];
  bondEnrollments?: readonly AcademicCycleEnrollment[];
  bondParticipations?: readonly CycleParticipation[];
  impactedBondIds?: readonly string[];
  timingPolicy?: AllocationTimingPolicy;
  effectRegistry: TransferEffectRegistry;
  requirementEvaluators?: Readonly<Record<string, TransferRequirementEvaluator>>;
  provenance: StudentLifeProvenance;
  scope?: StudentLifeEventScope;
};

/**
 * Planeja a transição do processo. A operação é ATÔMICA: se o plano não é
 * admissível, nenhuma ação é devolvida e nenhuma vigência é encerrada.
 */
export function planTransferTransition(
  input: PlanTransferTransitionInput,
): TransferTransitionPlan {
  const scope: StudentLifeEventScope = input.scope ?? { studentId: input.process.studentId };
  const diagnostics: StudentLifeDiagnostic[] = [];
  let allowed: boolean | null = true;

  const impactedParticipations = input.impactedParticipations ?? [];
  const impactedAllocations = input.impactedAllocations ?? [];
  const impactedEnrollments = input.impactedEnrollments ?? [];
  const documents = input.version.documents ?? [];

  const facts = publishMobilityFacts({
    effectiveDate: input.effectiveDate,
    impactedParticipations,
    impactedAllocations,
    impactedEnrollments,
    ...(input.bondEnrollments ? { bondEnrollments: input.bondEnrollments } : {}),
    ...(input.bondParticipations ? { bondParticipations: input.bondParticipations } : {}),
    ...(input.impactedBondIds ? { impactedBondIds: input.impactedBondIds } : {}),
  });

  // 1. Rito configurado.
  const processKind = input.configuration.processKinds.find(
    (item) => item.processKindDefinitionId === input.process.processKindDefinitionId,
  );
  if (!processKind) {
    allowed = degradeWith(allowed, false);
    diagnostics.push(
      diagnostic(CODES.processKindUndeclared, TYPES.process, "blocker", scope, {
        parameters: { processKindDefinitionId: input.process.processKindDefinitionId },
        message: "Rito de mobilidade não cadastrado na configuração.",
      }),
    );
  }

  // 2. Transição configurada e compatível com o estágio DEDUZIDO do ledger.
  const definition: TransferStageTransitionDefinition | undefined =
    input.configuration.transitions.find(
      (item) => item.transitionDefinitionId === input.transitionDefinitionId,
    );
  const currentStage = currentStageOf(input.existingTransitions, input.process.transferProcessId);

  if (!definition) {
    allowed = degradeWith(allowed, false);
    diagnostics.push(
      diagnostic(CODES.transitionUndeclared, TYPES.process, "blocker", scope, {
        parameters: { transitionDefinitionId: input.transitionDefinitionId },
        message: "Transição não cadastrada na configuração.",
      }),
    );
  } else {
    const applies = definition.appliesToProcessKindIds ?? [];
    if (applies.length > 0 && !applies.includes(input.process.processKindDefinitionId)) {
      allowed = degradeWith(allowed, false);
      diagnostics.push(
        diagnostic(CODES.transitionUndeclared, TYPES.process, "blocker", scope, {
          parameters: {
            transitionDefinitionId: definition.transitionDefinitionId,
            processKindDefinitionId: input.process.processKindDefinitionId,
          },
          message: "Transição não declarada para este rito.",
        }),
      );
    }
    if (definition.fromStageDefinitionId !== currentStage) {
      allowed = degradeWith(allowed, false);
      diagnostics.push(
        diagnostic(CODES.transitionStageMismatch, TYPES.process, "blocker", scope, {
          parameters: {
            transitionDefinitionId: definition.transitionDefinitionId,
            expectedFromStage: definition.fromStageDefinitionId,
            currentStage,
          },
          message: "O estágio vigente deduzido do ledger não admite esta transição.",
        }),
      );
    }
    if (definition.reasonRequired && !input.reasonDefinitionId) {
      allowed = degradeWith(allowed, false);
      diagnostics.push(
        diagnostic(CODES.transitionReasonMissing, TYPES.process, "blocker", scope, {
          parameters: { transitionDefinitionId: definition.transitionDefinitionId },
          message: "A transição configurada exige motivo declarado.",
        }),
      );
    }
    const allowedReasons = definition.allowedReasonDefinitionIds ?? [];
    if (
      input.reasonDefinitionId &&
      allowedReasons.length > 0 &&
      !allowedReasons.includes(input.reasonDefinitionId)
    ) {
      allowed = degradeWith(allowed, false);
      diagnostics.push(
        diagnostic(CODES.transitionReasonNotAllowed, TYPES.process, "blocker", scope, {
          parameters: {
            transitionDefinitionId: definition.transitionDefinitionId,
            reasonDefinitionId: input.reasonDefinitionId,
          },
          message: "Motivo não admitido pela transição configurada.",
        }),
      );
    }
  }

  // 3. Polos simétricos e polimórficos.
  for (const [poleKindId, pole] of [
    ["origem", input.version.originPole],
    ["destino", input.version.destinationPole],
  ] as const) {
    const result = validateMobilityPole(pole, input.configuration, scope, poleKindId);
    diagnostics.push(...result.diagnostics);
    if (!result.allowed) allowed = degradeWith(allowed, false);
  }

  // 4. Documentos e intervalo institucional.
  const documentResult = validateTransferDocuments(documents, input.configuration, scope);
  diagnostics.push(...documentResult.diagnostics);
  if (!documentResult.allowed) allowed = degradeWith(allowed, false);

  if (input.version.transitionInterval) {
    const intervalResult = validateTransitionInterval(
      input.version.transitionInterval,
      input.configuration,
      scope,
    );
    diagnostics.push(...intervalResult.diagnostics);
    if (!intervalResult.allowed) allowed = degradeWith(allowed, false);
  }

  // 5. Requisitos declarativos.
  const assessment = assessTransitionRequirements(
    definition?.requirements ?? [],
    input.configuration.requirementEffects,
    {
      ...(input.originatingAct ? { originatingAct: input.originatingAct } : {}),
      documents,
      originPole: input.version.originPole,
      destinationPole: input.version.destinationPole,
      numericFacts: facts.numericFacts,
    },
    scope,
    input.requirementEvaluators ?? NATIVE_TRANSFER_REQUIREMENT_EVALUATORS,
  );
  diagnostics.push(...assessment.diagnostics);
  allowed = degradeWith(allowed, assessment.allowed);

  // 6. Temporalidade declarada pela 13C.
  const originClosureDate = resolveOriginClosureDate(
    input.effectiveDate,
    input.timingPolicy,
    input.version.timingBoundaryDefinitionId,
  );

  if (allowed !== true) {
    return {
      allowed,
      diagnostics,
      transition: null,
      requirementEvaluations: assessment.evaluations,
      effectOutcomes: [],
      actions: [],
      facts,
      originClosureDate,
    };
  }

  // 7. Efeitos configurados via executores registrados.
  const effectOutcomes = applyConfiguredEffects(
    input.effectRegistry,
    definition?.effects ?? [],
    {
      process: input.process,
      version: input.version,
      transitionDefinitionId: input.transitionDefinitionId,
      effectiveDate: input.effectiveDate,
      scope,
      impactedParticipations,
      impactedAllocations,
      impactedEnrollments,
      facts,
      participationEffectPolicy: input.configuration.participationEffectPolicy,
      schoolBondEffectPolicy: input.configuration.schoolBondEffectPolicy,
      originClosureDate,
    },
  );

  for (const result of effectOutcomes) {
    diagnostics.push(...result.diagnostics);
    if (result.status === "erro-de-configuracao") allowed = degradeWith(allowed, false);
    if (result.status === "inconclusivo") allowed = degradeWith(allowed, null);
  }

  if (allowed !== true) {
    return {
      allowed,
      diagnostics,
      transition: null,
      requirementEvaluations: assessment.evaluations,
      effectOutcomes,
      actions: [],
      facts,
      originClosureDate,
    };
  }

  const appliedEffects = definition?.effects ?? [];
  const transition: TransferStageTransitionRecord = {
    transitionId: input.transitionId,
    transferProcessId: input.process.transferProcessId,
    transitionDefinitionId: input.transitionDefinitionId,
    sequenceNumber: nextSequenceNumber(
      input.existingTransitions,
      input.process.transferProcessId,
    ),
    fromStageDefinitionId: currentStage,
    toStageDefinitionId: definition!.toStageDefinitionId,
    ...(input.reasonDefinitionId ? { reasonDefinitionId: input.reasonDefinitionId } : {}),
    effectiveDate: input.effectiveDate,
    ...(appliedEffects.length > 0 ? { appliedEffects } : {}),
    ...(input.originatingAct ? { originatingAct: input.originatingAct } : {}),
    recordedInVersionId: input.version.transferProcessVersionId,
    isCorrection: false,
    precedingTransitionId: null,
    provenance: input.provenance,
  };

  return {
    allowed: true,
    diagnostics,
    transition,
    requirementEvaluations: assessment.evaluations,
    effectOutcomes,
    actions: effectOutcomes.flatMap((item) => item.actions),
    facts,
    originClosureDate,
  };
}

// ---------------------------------------------------------- Retificação

export type RectifyProcessVersionInput = {
  configuration: InstitutionalTransferGovernanceConfiguration;
  currentVersion: TransferProcessVersionRecord;
  /** Alterações da REPRESENTAÇÃO administrativa; a identidade nunca muda. */
  changes: Partial<
    Pick<
      TransferProcessVersionRecord,
      "originPole" | "destinationPole" | "timingBoundaryDefinitionId" | "transitionInterval" | "documents"
    >
  >;
  newVersionId: string;
  provenance: StudentLifeProvenance;
  scope?: StudentLifeEventScope;
};

export type RectifyProcessVersionResult = {
  allowed: boolean;
  diagnostics: readonly StudentLifeDiagnostic[];
  version: TransferProcessVersionRecord | null;
};

/**
 * Retifica a REPRESENTAÇÃO do processo criando nova versão encadeada.
 * O `transferProcessId` permanece o mesmo: corrigir data ou destino NÃO cria
 * outro processo institucional de mobilidade.
 */
export function rectifyProcessVersion(
  input: RectifyProcessVersionInput,
): RectifyProcessVersionResult {
  const scope: StudentLifeEventScope =
    input.scope ?? { studentId: input.currentVersion.studentId };
  const diagnostics: StudentLifeDiagnostic[] = [];

  if (!input.provenance.correctionReasonDefinitionId) {
    diagnostics.push(
      diagnostic(CODES.correctionReasonMissing, TYPES.integrity, "blocker", scope, {
        parameters: { transferProcessId: input.currentVersion.transferProcessId },
        message: "Retificação sem motivo estruturado declarado.",
      }),
    );
    return { allowed: false, diagnostics, version: null };
  }

  const version: TransferProcessVersionRecord = {
    ...input.currentVersion,
    ...input.changes,
    transferProcessVersionId: input.newVersionId,
    precedingVersionId: input.currentVersion.transferProcessVersionId,
    provenance: input.provenance,
  };

  for (const [poleKindId, pole] of [
    ["origem", version.originPole],
    ["destino", version.destinationPole],
  ] as const) {
    const result = validateMobilityPole(pole, input.configuration, scope, poleKindId);
    diagnostics.push(...result.diagnostics);
  }
  if (version.transitionInterval) {
    const result = validateTransitionInterval(
      version.transitionInterval,
      input.configuration,
      scope,
    );
    diagnostics.push(...result.diagnostics);
  }
  const documentResult = validateTransferDocuments(
    version.documents ?? [],
    input.configuration,
    scope,
  );
  diagnostics.push(...documentResult.diagnostics);

  const blocked = diagnostics.some((item) => item.severity === "blocker");
  return { allowed: !blocked, diagnostics, version: blocked ? null : version };
}
