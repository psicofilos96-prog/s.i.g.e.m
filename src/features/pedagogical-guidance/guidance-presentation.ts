/**
 * Rodada 6B.3.2 — Camada de apresentação da Orientação Pedagógica
 * (gramática "Acompanhar" / Follow-up Workspace).
 *
 * Esta camada TRADUZ; não substitui, não presume, não classifica e não decide.
 * Ela resolve apresentação a partir de definição vigente + eventos + estado
 * configurado + contexto autorizado — nunca de um dicionário rígido
 * `identificador técnico → frase bonita`.
 *
 * FRONTEIRAS (não negociáveis):
 *  1. Nenhuma prioridade é atribuída aqui. Sem política de priorização, não
 *     existe ordem de risco, ranking nem destaque de "caso grave". Quando há
 *     motivo institucional (prazo, retorno pactuado), ele é mostrado por extenso.
 *  2. Nenhum estado de acompanhamento é enumerado no frontend: a linha humana é
 *     derivada dos fatos do item (espera declarada, conclusão registrada) e cai
 *     em fallback sereno e verdadeiro quando não há como especializar.
 *  3. Nenhuma ação é conhecida por nome: as ações chegam projetadas da
 *     configuração, com rótulo humano, admissibilidade, capacidade e efeito.
 *  4. O sinal é um ACONTECIMENTO no percurso, nunca atributo da pessoa: a
 *     apresentação devolve o fato material observado, com data e origem.
 *  5. Ausência é ausência: nenhum "está tudo bem", nenhum zero presumido,
 *     nenhuma leitura positiva a partir da falta de registro.
 *  6. Autorização de contato é temporal e contextual (vigência + capacidade +
 *     finalidade), nunca atributo permanente de um familiar.
 *  7. Conteúdo não autorizado não anuncia a própria existência além da nota
 *     genérica de omissão já praticada pela política.
 */
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";
import { resolveActionDisclosure } from "@/lib/human-status";
import { personsHoldingCapacity } from "@/features/student-life/dossier-records";
import type { StudentResponsibilityAssignment } from "@/features/student-life/dossier-types";
import {
  WORKSPACE_AUTHORIZATION,
  type OperationalQueueItem,
  type WorkspaceActionDescriptor,
} from "@/features/workspace/workspace-types";
import { isActionExecutable } from "@/features/workspace/workspace-engine";
import type {
  CommunicationRecord,
  FollowUpPlanVersion,
  GuidanceFact,
  InterventionRecord,
  PedagogicalSignalOccurrence,
  ReferralRecord,
} from "./guidance-types";

/** Rótulos humanos declarados pela configuração para identificadores abertos. */
export type GuidanceHumanLabels = Readonly<Record<string, string>>;

/**
 * Resolve um rótulo humano para um identificador configurado. Sem rótulo
 * declarado, NADA é afirmado no primeiro nível: o identificador permanece na
 * proveniência e o chamador decide omitir.
 */
export function resolveConfiguredLabel(
  definitionId: string | null | undefined,
  labels?: GuidanceHumanLabels,
): string | null {
  const id = definitionId?.trim();
  if (!id) return null;
  const label = labels?.[id]?.trim();
  return label && label.length > 0 ? label : null;
}

/* ------------------------------------------- ações projetadas da configuração */

export type GuidanceActionView = {
  id: string;
  label: string;
  available: boolean;
  unavailableReason: string | null;
  /** Nível 2/3: capacidades exigidas, domínio executor, diagnóstico íntegro. */
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Traduz uma ação já projetada pelo motor. A primitiva de interface não conhece
 * "iniciar escuta", "arquivar" nem "abrir acompanhamento": recebe isto.
 */
export function resolveGuidanceAction(action: WorkspaceActionDescriptor): GuidanceActionView {
  const executable = isActionExecutable(action);
  const relevance = executable
    ? "disponivel"
    : action.actorAuthorization === WORKSPACE_AUTHORIZATION.notAuthorized ||
        action.missingCapacityDefinitionIds.length > 0
      ? "sem-capacidade"
      : "requisito-pendente";

  const disclosure = resolveActionDisclosure(relevance, {
    capacityExplanation:
      "Esta ação existe neste acompanhamento, mas não está entre as suas atribuições nesta escola e nesta data.",
    pendingRequirements: action.impedimentMessages,
  });

  return {
    id: action.actionKey,
    label: action.labelSnapshot,
    available: executable && disclosure.enabled,
    unavailableReason: executable ? null : (disclosure.explanation ?? action.explanation),
    provenance: [
      { term: "Ação (identificador)", detail: action.operationDefinitionId },
      {
        term: "Capacidades exigidas",
        detail:
          action.requiredCapacityDefinitionIds.join(", ") ||
          "nenhuma capacidade declarada na configuração",
      },
      { term: "Domínio que executa", detail: action.executingDomainId },
      { term: "Diagnóstico do motor", detail: action.explanation },
      ...action.impedimentMessages.map((message, index) => ({
        term: `Impedimento declarado ${index + 1}`,
        detail: message,
      })),
    ],
  };
}

export function resolveGuidanceActions(
  item: OperationalQueueItem,
): readonly GuidanceActionView[] {
  return item.actions.map(resolveGuidanceAction);
}

/* ------------------------------------------------ situação, sem enumeração */

/**
 * Linha humana de situação resolvida a partir dos FATOS do item, com fallback
 * sereno. Não existe lista fechada de estados: quando nada pode ser
 * especializado, a frase permanece verdadeira e não avalia a pessoa.
 */
export function resolveGuidanceStateLine(item: OperationalQueueItem): string {
  if (item.concludedAt) {
    return `Encerrado em ${formatAcademicDate(civilDateOf(item.concludedAt))}. Encerrar não significa que a situação foi resolvida.`;
  }
  const awaiting = item.awaitingPartyDefinitionId ?? "";
  if (awaiting.includes("orientacao")) {
    return "Aguardando uma ação da Orientação Pedagógica.";
  }
  if (awaiting.includes("familia") || awaiting.includes("responsavel")) {
    return "Aguardando retorno de quem responde pelo estudante.";
  }
  if (awaiting.includes("terceiro") || awaiting.includes("destino")) {
    return "Aguardando retorno do destino para onde a questão foi encaminhada.";
  }
  return "Em acompanhamento.";
}

/**
 * Motivo institucional declarado para retornar a este item — prazo do plano ou
 * prazo da política. Nunca é um grau de urgência inventado pela interface.
 */
export function resolveGuidanceTimingLine(item: OperationalQueueItem): string | null {
  if (!item.deadline) return null;
  const label = item.deadline.labelSnapshot?.trim();
  const base = `Retorno previsto para ${formatAcademicDate(item.deadline.dueDate)}`;
  return label ? `${base} · ${label}` : base;
}

/** Nota de omissão: parte do conteúdo foi retirada pela política de acesso. */
export function resolveRedactionNote(item: OperationalQueueItem): string | null {
  return item.redactedFieldPaths.length > 0
    ? "Algumas informações não estão disponíveis neste contexto."
    : null;
}

/* --------------------------- o sinal como acontecimento, nunca como rótulo */

export type ObservedFactLine = {
  key: string;
  /** Fato material observado, em linguagem humana. */
  text: string;
  /** Verdadeiro quando o que se apresenta é a ausência do dado. */
  absence: boolean;
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Converte os fatos congelados na ocorrência em frases materiais. Fato sem
 * rótulo humano declarado não é traduzido: permanece apenas na proveniência,
 * para que a interface não invente a natureza do que foi observado.
 *
 * Ausência NUNCA vira zero nem condição atendida.
 */
export function resolveObservedFactLines(
  facts: readonly GuidanceFact[],
): readonly ObservedFactLine[] {
  return facts.flatMap<ObservedFactLine>((fact, index) => {
    const label = fact.labelSnapshot?.trim();
    const key = `${fact.factKey}::${fact.scopeKey ?? index}`;
    const provenance = [
      { term: "Fato (identificador)", detail: fact.factKey },
      {
        term: "Origem do fato",
        detail: fact.sourceReference
          ? `${fact.sourceReference.sourceTypeDefinitionId} · ${fact.sourceReference.entityId}`
          : "origem não declarada pela fonte",
      },
    ];

    if (fact.value === null) {
      const reason = fact.unavailableReason?.trim();
      return [
        {
          key,
          absence: true,
          text: reason
            ? `Informação ainda não disponível: ${reason}`
            : "Informação ainda não disponível.",
          provenance,
        },
      ];
    }

    if (!label) {
      return [
        {
          key,
          absence: false,
          text: "Um fato registrado foi considerado; a origem está nos detalhes.",
          provenance,
        },
      ];
    }

    const unit = fact.unit?.trim();
    const value =
      typeof fact.value === "boolean" ? (fact.value ? "sim" : "não") : String(fact.value);
    return [
      {
        key,
        absence: false,
        text: unit ? `${label}: ${value} (${unit})` : `${label}: ${value}`,
        provenance,
      },
    ];
  });
}

export type SignalOccurrenceView = {
  occurrenceId: string;
  /** Data em que o acontecimento passou a existir institucionalmente. */
  observedOnLine: string;
  observedFacts: readonly ObservedFactLine[];
  /** Nível 2/3: definição, versão e proveniência da apuração. */
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Apresenta a ocorrência de sinal como acontecimento no percurso. A pessoa
 * permanece o sujeito visual: aqui não há rótulo, grau, cor nem classificação.
 */
export function resolveSignalOccurrenceView(input: {
  occurrence: PedagogicalSignalOccurrence;
  signalLabels?: GuidanceHumanLabels;
}): SignalOccurrenceView {
  const { occurrence } = input;
  const definitionLabel = resolveConfiguredLabel(
    occurrence.signalDefinitionId,
    input.signalLabels,
  );
  return {
    occurrenceId: occurrence.occurrenceId,
    observedOnLine: `Registrado em ${formatAcademicDate(civilDateOf(occurrence.materializedAt))}`,
    observedFacts: resolveObservedFactLines(occurrence.factSnapshot),
    provenance: [
      {
        term: "Condição configurada",
        detail: definitionLabel
          ? `${definitionLabel} · versão ${occurrence.definitionVersion}`
          : `${occurrence.signalDefinitionId} · versão ${occurrence.definitionVersion}`,
      },
      { term: "Apuração (identificador)", detail: occurrence.evaluationId },
      {
        term: "Registrado por",
        detail: `${occurrence.provenance.originTypeId} · ${occurrence.provenance.recordedAt}`,
      },
      {
        term: "Natureza do registro",
        detail:
          "Condição configurada apurada sobre fatos canônicos. Não constitui diagnóstico, classificação pessoal nem abertura de acompanhamento.",
      },
    ],
  };
}

/* --------------------------------- acompanhamento atual e combinados (pacto) */

export type PactItemView = {
  key: string;
  objective: string;
  /** Rótulo humano da ação combinada, quando a configuração o declara. */
  actionLabel: string | null;
  /** Data do retorno combinado, quando declarada. */
  returnLine: string | null;
};

export type PactView = {
  planVersionId: string;
  versionLine: string;
  items: readonly PactItemView[];
  /** Nível 2/3: versão anterior, motivo da revisão, autoria. */
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Combinados atuais do acompanhamento. Ausência de plano é legítima e serena:
 * quem chama recebe `null` e apresenta "ainda não há combinados registrados",
 * nunca "pendência" nem "falha".
 */
export function resolvePactView(input: {
  planVersion: FollowUpPlanVersion | null;
  actionLabels?: GuidanceHumanLabels;
  revisionReasonLabels?: GuidanceHumanLabels;
}): PactView | null {
  const version = input.planVersion;
  if (!version) return null;
  return {
    planVersionId: version.planVersionId,
    versionLine: `Combinados na versão ${version.version}, registrada em ${formatAcademicDate(version.createdAt)}`,
    items: version.items.map((item) => ({
      key: item.planItemId,
      objective: item.objectiveSnapshot,
      actionLabel: resolveConfiguredLabel(item.actionTypeDefinitionId, input.actionLabels),
      returnLine: item.dueDate
        ? `Retorno combinado para ${formatAcademicDate(item.dueDate)}`
        : null,
    })),
    provenance: [
      { term: "Versão do plano (identificador)", detail: version.planVersionId },
      {
        term: "Versão anterior",
        detail: version.precedingPlanVersionId ?? "esta é a primeira versão registrada",
      },
      {
        term: "Motivo da revisão",
        detail:
          resolveConfiguredLabel(version.revisionReasonDefinitionId, input.revisionReasonLabels) ??
          version.revisionReasonDefinitionId ??
          "nenhum motivo de revisão declarado",
      },
      {
        term: "Registrado por",
        detail:
          version.createdBy.agentNameSnapshot ??
          version.createdBy.agentId ??
          "autoria não declarada",
      },
    ],
  };
}

/* ------------------------- contato autorizado: temporal, contextual, não rótulo */

export type AuthorizedContactView = {
  personId: string;
  /** Nome humano SOMENTE quando declarado; nunca inventado. */
  personLabel: string | null;
  /** Frase que explica a capacidade, não um selo sobre a pessoa. */
  authorizationLine: string;
  authorized: boolean;
  validityLine: string;
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Quem a escola pode contatar PARA ESTA FINALIDADE, nesta data. Relação pessoal
 * não confere poder: exige responsabilidade vigente com a capacidade declarada.
 * A frase descreve a autorização contextual, nunca um atributo permanente.
 */
export function projectAuthorizedContacts(input: {
  studentId: string;
  assignments: readonly StudentResponsibilityAssignment[];
  requiredCapacityDefinitionId: string;
  isoDate: string;
  purposeLabel: string;
  personLabels?: GuidanceHumanLabels;
}): readonly AuthorizedContactView[] {
  const holders = personsHoldingCapacity({
    assignments: input.assignments,
    studentId: input.studentId,
    capacityDefinitionId: input.requiredCapacityDefinitionId,
    isoDate: input.isoDate,
  });

  return input.assignments
    .filter((assignment) => assignment.subjectReference.entityId === input.studentId)
    .map((assignment) => {
      const authorized = holders.includes(assignment.personId);
      return {
        personId: assignment.personId,
        personLabel: resolveConfiguredLabel(assignment.personId, input.personLabels),
        authorized,
        authorizationLine: authorized
          ? `Pode ser contatado pela escola para ${input.purposeLabel}.`
          : `Não há, nesta data, responsabilidade vigente com a capacidade exigida para ${input.purposeLabel}.`,
        validityLine: assignment.validUntil
          ? `Vigência declarada de ${formatAcademicDate(assignment.validFrom)} a ${formatAcademicDate(assignment.validUntil)}`
          : `Vigência declarada a partir de ${formatAcademicDate(assignment.validFrom)}, sem término registrado`,
        provenance: [
          { term: "Atribuição (identificador)", detail: assignment.assignmentId },
          {
            term: "Capacidades declaradas",
            detail: assignment.responsibilityCapacityDefinitionIds.join(", "),
          },
          { term: "Capacidade exigida aqui", detail: input.requiredCapacityDefinitionId },
          { term: "Data avaliada", detail: formatAcademicDate(input.isoDate) },
          {
            term: "Natureza da autorização",
            detail:
              "Autorização temporal e contextual, vinculada à finalidade desta operação. Parentesco, por si só, não autoriza contato institucional.",
          },
        ],
      };
    });
}

/* --------------------- linha do tempo: projeção, nunca prontuário paralelo */

export type TimelineEntryView = {
  key: string;
  isoDate: string;
  dateLine: string;
  /** O que aconteceu, em linguagem humana. */
  title: string;
  /** Complemento sereno, quando a fonte o declara. */
  detail: string | null;
  /** Referência ao fato canônico correspondente — a timeline não armazena nada. */
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Projeção composicional do percurso: cada entrada REFERENCIA o registro que a
 * originou, sem copiar conteúdo protegido e sem duplicar os ledgers da 13F/13H.
 *
 * Conteúdo de sensibilidade restrita não é transcrito aqui: apenas a existência
 * institucional do atendimento, quando a projeção já o autorizou.
 */
export function buildGuidanceTimeline(input: {
  caseId: string;
  interventions: readonly InterventionRecord[];
  communications: readonly CommunicationRecord[];
  referrals: readonly ReferralRecord[];
  interventionLabels?: GuidanceHumanLabels;
  communicationLabels?: GuidanceHumanLabels;
  referralLabels?: GuidanceHumanLabels;
  /** Conteúdo restrito só é mencionado quando a capacidade foi concedida. */
  mayReadRestrictedContent: boolean;
}): readonly TimelineEntryView[] {
  const entries: TimelineEntryView[] = [];

  for (const intervention of input.interventions) {
    if (intervention.caseId !== input.caseId) continue;
    const label = resolveConfiguredLabel(
      intervention.interventionTypeDefinitionId,
      input.interventionLabels,
    );
    const summary =
      input.mayReadRestrictedContent && typeof intervention.structuredPayload["resumo"] === "string"
        ? (intervention.structuredPayload["resumo"] as string)
        : null;
    entries.push({
      key: `interv::${intervention.interventionId}`,
      isoDate: intervention.occurredAt,
      dateLine: formatAcademicDate(intervention.occurredAt),
      title: label ?? "Ação de acompanhamento registrada",
      detail: summary,
      provenance: [
        { term: "Registro (identificador)", detail: intervention.interventionId },
        { term: "Tipo configurado", detail: intervention.interventionTypeDefinitionId },
        {
          term: "Fontes referenciadas",
          detail:
            intervention.sourceReferences
              .map((reference) => `${reference.sourceTypeDefinitionId}:${reference.entityId}`)
              .join(" | ") || "nenhuma fonte externa referenciada",
        },
        { term: "Sensibilidade declarada", detail: intervention.sensitivityLevelDefinitionId },
      ],
    });
  }

  for (const communication of input.communications) {
    if (communication.caseId !== input.caseId) continue;
    const label = resolveConfiguredLabel(
      communication.communicationNatureDefinitionId,
      input.communicationLabels,
    );
    const outcome = resolveConfiguredLabel(
      communication.outcomeDefinitionId,
      input.communicationLabels,
    );
    entries.push({
      key: `com::${communication.communicationId}`,
      isoDate: communication.occurredAt,
      dateLine: formatAcademicDate(communication.occurredAt),
      title: label ?? "Comunicação institucional registrada",
      detail: outcome,
      provenance: [
        { term: "Registro (identificador)", detail: communication.communicationId },
        { term: "Natureza configurada", detail: communication.communicationNatureDefinitionId },
        { term: "Canal configurado", detail: communication.channelDefinitionId },
        {
          term: "Fundamento da participação",
          detail:
            communication.participants
              .map(
                (participant) =>
                  participant.authorizationBasisReference
                    ? `${participant.authorizationBasisReference.sourceTypeDefinitionId}:${participant.authorizationBasisReference.entityId}`
                    : "sem fundamento declarado",
              )
              .join(" | ") || "nenhum participante declarado",
        },
      ],
    });
  }

  for (const referral of input.referrals) {
    if (referral.caseId !== input.caseId) continue;
    const label = resolveConfiguredLabel(referral.referralTypeDefinitionId, input.referralLabels);
    entries.push({
      key: `enc::${referral.referralId}`,
      isoDate: referral.issuedAt,
      dateLine: formatAcademicDate(referral.issuedAt),
      title: label ?? "Encaminhamento registrado",
      detail:
        referral.destinationReference.labelSnapshot
          ? `Destino: ${referral.destinationReference.labelSnapshot}`
          : null,
      provenance: [
        { term: "Registro (identificador)", detail: referral.referralId },
        { term: "Tipo configurado", detail: referral.referralTypeDefinitionId },
        {
          term: "Política aplicada",
          detail: `${referral.referralPolicyId} · versão ${referral.referralPolicyVersion}`,
        },
        { term: "Motivo declarado", detail: referral.reasonSnapshot },
      ],
    });
  }

  return entries
    .slice()
    .sort((left, right) =>
      left.isoDate === right.isoDate
        ? left.key.localeCompare(right.key)
        : right.isoDate.localeCompare(left.isoDate),
    );
}

/* ------------------------------------------------- ausência, dita com serenidade */

/**
 * Frase para o percurso sem sinal e sem acompanhamento ativo. Ausência de
 * registro NUNCA é traduzida como avaliação positiva sobre o estudante.
 */
export const NO_ACTIVE_FOLLOW_UP_NOTE =
  "Não há acompanhamento ativo registrado para este estudante nesta finalidade. Isso não afirma que está tudo bem: apenas nada foi registrado ou projetado para você.";

export const NO_PACT_NOTE =
  "Ainda não há combinados registrados para este acompanhamento.";

export const NO_AUTHORIZED_CONTACT_NOTE =
  "Nenhuma pessoa possui, nesta data, responsabilidade vigente com a capacidade exigida para este contato. Relação familiar, por si só, não autoriza a conversa institucional.";
