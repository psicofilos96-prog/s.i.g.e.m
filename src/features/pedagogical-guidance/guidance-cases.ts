/**
 * Etapa 13H — Projeções da camada de acompanhamento.
 *
 * Nada aqui é estado persistido: estado do caso, encerramento, responsável
 * vigente, participação vigente, versão vigente do plano e pendência de retorno
 * do encaminhamento são SEMPRE derivados dos registros e do ledger.
 *
 * Encerrar um caso NÃO significa "resolvido": estado final e motivo são
 * independentes e configurados. Ausência de caso/sinal/intervenção é ausência.
 */
import { personsHoldingCapacity } from "@/features/student-life/dossier-records";
import type { StudentResponsibilityAssignment } from "@/features/student-life/dossier-types";
import type {
  CaseEvent,
  CaseParticipation,
  CaseResponsibilityAssignment,
  FollowUpPlan,
  FollowUpPlanVersion,
  GuidanceDiagnostic,
  PedagogicalFollowUpCase,
  PedagogicalSubjectReference,
  ReferralPolicy,
  ReferralRecord,
  ReferralResponseEvent,
} from "./guidance-types";

const withinValidity = (
  item: { validFrom: string; validUntil: string | null },
  isoDate: string,
): boolean =>
  isoDate >= item.validFrom && (item.validUntil === null || isoDate <= item.validUntil);

// --------------------------------------------------------- Estado do caso

export type CaseStateProjection = {
  caseId: string;
  stateDefinitionId: string;
  /** `true` apenas quando um evento declarou a conclusão; nunca inferido. */
  concluded: boolean;
  /** Motivo do encerramento, independente do estado alcançado. */
  concludingReasonDefinitionId: string | null;
  concludedOn: string | null;
  lastEventId: string | null;
  diagnostics: readonly GuidanceDiagnostic[];
};

/** Estado do caso DERIVADO do ledger de eventos, reconstruível em qualquer data. */
export function projectCaseState(input: {
  followUpCase: PedagogicalFollowUpCase;
  events: readonly CaseEvent[];
  asOf: string;
}): CaseStateProjection {
  const relevant = input.events
    .filter(
      (event) => event.caseId === input.followUpCase.caseId && event.effectiveDate <= input.asOf,
    )
    .slice()
    .sort((left, right) =>
      left.effectiveDate === right.effectiveDate
        ? left.eventId.localeCompare(right.eventId)
        : left.effectiveDate.localeCompare(right.effectiveDate),
    );

  const diagnostics: GuidanceDiagnostic[] = [];
  const superseded = new Set(
    relevant.filter((event) => event.isCorrection).map((event) => event.precedingEventId),
  );

  let state = input.followUpCase.initialLifecycleStateDefinitionId;
  let concluded = false;
  let reason: string | null = null;
  let concludedOn: string | null = null;
  let lastEventId: string | null = null;

  for (const event of relevant) {
    if (superseded.has(event.eventId)) continue; // retificado: preservado, não aplicado
    if (!input.followUpCase.lifecycleStateDefinitionIds.includes(event.toStateDefinitionId)) {
      diagnostics.push({
        diagnosticCode: "ESTADO-DE-CASO-NAO-CADASTRADO",
        messageSnapshot: `O estado "${event.toStateDefinitionId}" não consta na política configurada deste acompanhamento.`,
      });
      continue;
    }
    state = event.toStateDefinitionId;
    lastEventId = event.eventId;
    if (event.concludesCase === true) {
      concluded = true;
      reason = event.reasonDefinitionId ?? null;
      concludedOn = event.effectiveDate;
    } else {
      concluded = false;
      reason = null;
      concludedOn = null;
    }
  }

  return {
    caseId: input.followUpCase.caseId,
    stateDefinitionId: state,
    concluded,
    concludingReasonDefinitionId: reason,
    concludedOn,
    lastEventId,
    diagnostics,
  };
}

// ------------------------------------------- Responsabilidade e participação

export function responsibleAssignmentsAsOf(
  assignments: readonly CaseResponsibilityAssignment[],
  caseId: string,
  isoDate: string,
): readonly CaseResponsibilityAssignment[] {
  return assignments.filter(
    (assignment) => assignment.caseId === caseId && withinValidity(assignment, isoDate),
  );
}

export function participationsAsOf(
  participations: readonly CaseParticipation[],
  caseId: string,
  isoDate: string,
): readonly CaseParticipation[] {
  return participations.filter(
    (participation) =>
      participation.caseId === caseId && withinValidity(participation, isoDate),
  );
}

/** Casos em que a entidade é sujeito — a ficha do aluno apenas projeta isto. */
export function casesForSubject(
  cases: readonly PedagogicalFollowUpCase[],
  entityId: string,
): readonly PedagogicalFollowUpCase[] {
  return cases.filter((followUpCase) =>
    followUpCase.subjects.some((subject) => subject.reference.entityId === entityId),
  );
}

export function subjectEntityIds(
  subjects: readonly PedagogicalSubjectReference[],
): readonly string[] {
  return subjects.map((subject) => subject.reference.entityId);
}

// --------------------------------------------------------------- Planos

/** Versão vigente do plano: a última da cadeia, nunca um campo "atual". */
export function currentPlanVersion(
  versions: readonly FollowUpPlanVersion[],
  planId: string,
): FollowUpPlanVersion | null {
  const chain = versions.filter((version) => version.planId === planId);
  if (chain.length === 0) return null;
  const supersededIds = new Set(
    chain
      .map((version) => version.precedingPlanVersionId)
      .filter((value): value is string => Boolean(value)),
  );
  const heads = chain.filter((version) => !supersededIds.has(version.planVersionId));
  return (
    heads.slice().sort((left, right) => right.version - left.version)[0] ??
    chain.slice().sort((left, right) => right.version - left.version)[0] ??
    null
  );
}

export function planVersionHistory(
  versions: readonly FollowUpPlanVersion[],
  planId: string,
): readonly FollowUpPlanVersion[] {
  return versions
    .filter((version) => version.planId === planId)
    .slice()
    .sort((left, right) => left.version - right.version);
}

export function plansOfCase(
  plans: readonly FollowUpPlan[],
  caseId: string,
): readonly FollowUpPlan[] {
  return plans.filter((plan) => plan.caseId === caseId);
}

// ---------------------------------------------------- Comunicação autorizada

export const COMMUNICATION_AUTHORIZATION = {
  authorized: "comunicacao-autorizada",
  notAuthorized: "comunicacao-nao-autorizada",
  inconclusive: "autorizacao-inconclusiva",
} as const;
export type CommunicationAuthorization =
  (typeof COMMUNICATION_AUTHORIZATION)[keyof typeof COMMUNICATION_AUTHORIZATION];

/**
 * Relação pessoal NÃO confere poder: quem pode ser interlocutor institucional é
 * quem possui responsabilidade vigente com a capacidade exigida (13F).
 */
export function authorizeCommunicationParticipant(input: {
  personId: string;
  studentId: string;
  requiredCapacityDefinitionId: string;
  assignments: readonly StudentResponsibilityAssignment[];
  isoDate: string;
}): { authorization: CommunicationAuthorization; diagnostics: readonly GuidanceDiagnostic[] } {
  if (input.requiredCapacityDefinitionId.trim().length === 0) {
    return {
      authorization: COMMUNICATION_AUTHORIZATION.inconclusive,
      diagnostics: [
        {
          diagnosticCode: "CAPACIDADE-NAO-DECLARADA",
          messageSnapshot:
            "A configuração não declara a capacidade exigida para esta interação: a autorização não pode ser determinada.",
        },
      ],
    };
  }
  const holders = personsHoldingCapacity({
    assignments: input.assignments,
    studentId: input.studentId,
    capacityDefinitionId: input.requiredCapacityDefinitionId,
    isoDate: input.isoDate,
  });
  if (holders.includes(input.personId)) {
    return { authorization: COMMUNICATION_AUTHORIZATION.authorized, diagnostics: [] };
  }
  return {
    authorization: COMMUNICATION_AUTHORIZATION.notAuthorized,
    diagnostics: [
      {
        diagnosticCode: "SEM-RESPONSABILIDADE-VIGENTE",
        messageSnapshot:
          "A pessoa pode ter relação registrada, mas não possui responsabilidade vigente com a capacidade exigida para esta interação.",
      },
    ],
  };
}

// ------------------------------------------------ Encaminhamento e retorno

export type ReferralStatusProjection = {
  referralId: string;
  responseExpectationDefinitionId: string | null;
  requiresResponse: boolean | null;
  /** `true` só quando a política exige resposta e nenhuma foi registrada. */
  awaitingResponse: boolean;
  responseDueDate: string | null;
  responseEventIds: readonly string[];
  diagnostics: readonly GuidanceDiagnostic[];
};

function addDays(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(base)) return isoDate.slice(0, 10);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Situação do encaminhamento derivada da POLÍTICA: encaminhamento sem retorno
 * obrigatório nunca fica pendente; expectativa desconhecida é inconclusiva.
 */
export function projectReferralStatus(input: {
  referral: ReferralRecord;
  policy: ReferralPolicy;
  responses: readonly ReferralResponseEvent[];
}): ReferralStatusProjection {
  const diagnostics: GuidanceDiagnostic[] = [];
  const responses = input.responses.filter(
    (response) => response.referralId === input.referral.referralId,
  );
  const expectationId =
    input.policy.expectationsByReferralType[input.referral.referralTypeDefinitionId] ?? null;
  if (!expectationId) {
    diagnostics.push({
      diagnosticCode: "EXPECTATIVA-NAO-CONFIGURADA",
      messageSnapshot:
        "A política não declara a expectativa de retorno deste tipo de encaminhamento: nada é presumido como pendente.",
    });
    return {
      referralId: input.referral.referralId,
      responseExpectationDefinitionId: null,
      requiresResponse: null,
      awaitingResponse: false,
      responseDueDate: null,
      responseEventIds: responses.map((response) => response.responseEventId),
      diagnostics,
    };
  }
  const expectation = input.policy.expectations.find(
    (item) => item.responseExpectationDefinitionId === expectationId,
  );
  if (!expectation) {
    diagnostics.push({
      diagnosticCode: "EXPECTATIVA-NAO-CADASTRADA",
      messageSnapshot: `A expectativa "${expectationId}" não consta no catálogo da política.`,
    });
    return {
      referralId: input.referral.referralId,
      responseExpectationDefinitionId: expectationId,
      requiresResponse: null,
      awaitingResponse: false,
      responseDueDate: null,
      responseEventIds: responses.map((response) => response.responseEventId),
      diagnostics,
    };
  }
  const awaiting = expectation.requiresResponse && responses.length === 0;
  return {
    referralId: input.referral.referralId,
    responseExpectationDefinitionId: expectationId,
    requiresResponse: expectation.requiresResponse,
    awaitingResponse: awaiting,
    responseDueDate:
      expectation.requiresResponse && expectation.responseWindowDays !== undefined
        ? addDays(input.referral.issuedAt, expectation.responseWindowDays)
        : null,
    responseEventIds: responses.map((response) => response.responseEventId),
    diagnostics,
  };
}
