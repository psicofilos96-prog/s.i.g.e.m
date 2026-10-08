/**
 * Rodada 6B.3.1 — Camada de apresentação da Direção Escolar (gramática "Decidir").
 *
 * Esta camada TRADUZ; não substitui, não presume e não decide. Ela resolve
 * apresentação a partir de definição + diagnóstico + parâmetros + contexto
 * autorizado, seguindo a mesma filosofia de `resolveHumanStatus` — nunca um
 * dicionário rígido `identificador técnico → frase bonita`.
 *
 * FRONTEIRAS (não negociáveis):
 *  1. Nenhum verbo decisório é conhecido aqui: alternativas, efeitos, rito, ato,
 *     fundamentação e competência vêm da configuração canônica.
 *  2. Fato cuja própria existência não é revelável ao agente NÃO é projetado —
 *     nem como ausência. A ausência aparece somente quando revelável.
 *  3. Nenhum número é inventado: resumo só existe quando deriva de projeção
 *     autorizada. O layout não exige quantidade fixa de resumos.
 *  4. Conformidade é operacional: objetos concretos com providência pendente.
 *     Nenhuma taxa, série, ranking ou indicador (competência do CIECE).
 *  5. Falha fechada preservada: sem competência ou sem fato exigido, a
 *     alternativa permanece inexecutável, com explicação humana.
 */
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";
import { resolveActionDisclosure } from "@/lib/human-status";
import {
  ALTERNATIVE_ADMISSIBILITY,
  COMPETENCE_OUTCOME,
  type AlternativeAssessment,
  type DecisionAssessment,
} from "@/features/institutional-decisions/decision-engine";
import {
  FACT_AVAILABILITY,
  type ConsideredFactReference,
  type DecisionAlternativeDefinition,
  type DecisionProcessTypeDefinition,
  type InstitutionalDecisionProcess,
} from "@/features/institutional-decisions/decision-types";
import {
  FACT_SENSITIVITY_REQUIRED_CAPACITIES,
  LEADERSHIP_GENERIC_OMISSION_ALLOWED,
  type LeadershipClosingImpediment,
} from "@/features/institutional-decisions/decision-fixtures";
import type { OperationalQueueItem } from "@/features/workspace/workspace-types";

/* --------------------------------------------------- fatos autorizados (trava 2) */

export type AuthorizedFactProjection = {
  /** Fatos que o agente está autorizado a conhecer nesta finalidade. */
  facts: readonly ConsideredFactReference[];
  /** Quantos fatos foram suprimidos por sensibilidade não autorizada. */
  suppressedCount: number;
  /** Nota genérica de omissão, apenas quando a política a autoriza. */
  omissionNote: string | null;
};

/**
 * Projeta apenas os fatos cuja existência pode ser revelada ao agente.
 *
 * Fato com sensibilidade declarada exige a capacidade mapeada pela configuração.
 * Sensibilidade não mapeada NÃO é liberada por omissão: o fato é suprimido.
 * Fato indisponível cuja ausência não é revelável também é suprimido por
 * completo, para que a própria ausência não permita inferência.
 */
export function projectAuthorizedDecisionFacts(input: {
  facts: readonly ConsideredFactReference[];
  capacityDefinitionIds: readonly string[];
}): AuthorizedFactProjection {
  const visible: ConsideredFactReference[] = [];
  let suppressed = 0;

  for (const fact of input.facts) {
    const sensitivity = fact.sensitivityLevelDefinitionId;
    if (sensitivity) {
      const requiredCapacity = FACT_SENSITIVITY_REQUIRED_CAPACITIES[sensitivity];
      if (!requiredCapacity || !input.capacityDefinitionIds.includes(requiredCapacity)) {
        suppressed += 1;
        continue;
      }
    }
    if (
      fact.availability === FACT_AVAILABILITY.unavailable &&
      fact.absenceRevealable === false
    ) {
      suppressed += 1;
      continue;
    }
    visible.push(fact);
  }

  return {
    facts: visible,
    suppressedCount: suppressed,
    omissionNote:
      suppressed > 0 && LEADERSHIP_GENERIC_OMISSION_ALLOWED
        ? "Algumas informações não estão disponíveis neste contexto."
        : null,
  };
}

/** Valor legível de um fato disponível; ausência nunca vira zero. */
export function factValueLine(fact: ConsideredFactReference): string | null {
  if (fact.availability === FACT_AVAILABILITY.unavailable) return null;
  const value = fact.valueSnapshot;
  if (value === null || value === undefined) return "Registrado, sem valor declarado.";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

/** Nota de ausência — só quando a fonte declarou o motivo. */
export function factAbsenceLine(fact: ConsideredFactReference): string | null {
  if (fact.availability !== FACT_AVAILABILITY.unavailable) return null;
  const reason = fact.unavailabilityReasonSnapshot?.trim();
  return reason
    ? `Informação ainda não disponível: ${reason}.`
    : "Informação ainda não disponível.";
}

/* ------------------------------------------- alternativas em linguagem humana */

export type DecisionOptionPresentation = {
  id: string;
  label: string;
  description: string | null;
  available: boolean;
  unavailableReason: string | null;
  effects: readonly string[];
  /** Nível 3 preservado integralmente. */
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Resolve a apresentação de uma alternativa a partir do que o motor avaliou.
 * Os motivos são derivados do diagnóstico (capacidade ausente, fato exigido
 * indisponível, avaliação inconclusiva) e nunca de uma lista de verbos.
 */
export function resolveDecisionOptionPresentation(input: {
  definition: DecisionAlternativeDefinition;
  assessment: AlternativeAssessment;
  facts: readonly ConsideredFactReference[];
}): DecisionOptionPresentation {
  const { assessment, definition } = input;
  const admissible = assessment.admissibility === ALTERNATIVE_ADMISSIBILITY.admissible;

  const pendingRequirements = [
    ...assessment.missingFactKeys,
    ...assessment.unavailableFactKeys,
  ].map((factKey) => {
    const fact = input.facts.find((entry) => entry.factKey === factKey);
    const reason = fact?.unavailabilityReasonSnapshot?.trim();
    const label = fact?.labelSnapshot ?? "um fato exigido pela configuração";
    return reason ? `${label} (${reason})` : label;
  });

  const relevance = admissible
    ? "disponivel"
    : assessment.competence.outcome === COMPETENCE_OUTCOME.notHeld ||
        assessment.missingCapacityDefinitionIds.length > 0
      ? "sem-capacidade"
      : "requisito-pendente";

  const disclosure = resolveActionDisclosure(relevance, {
    capacityExplanation:
      "Esta alternativa existe neste assunto, mas decidir assim não está entre as suas atribuições nesta escola e nesta data.",
    pendingRequirements,
  });

  const inconclusive = assessment.admissibility === ALTERNATIVE_ADMISSIBILITY.inconclusive;

  return {
    id: definition.alternativeDefinitionId,
    label: definition.labelSnapshot,
    description: definition.descriptionSnapshot ?? null,
    available: admissible && disclosure.enabled,
    /**
     * Quando existe requisito pendente declarado, a explicação humana nomeia o
     * que falta (usando apenas fatos autorizados). O diagnóstico do motor
     * permanece íntegro na proveniência, nunca substituído.
     */
    unavailableReason: admissible
      ? null
      : pendingRequirements.length > 0
        ? (disclosure.explanation ?? assessment.explanation)
        : inconclusive
          ? assessment.explanation
          : (disclosure.explanation ?? assessment.explanation),
    effects: definition.effects.map(
      (effect) => effect.labelSnapshot ?? `Efeito institucional declarado: ${effect.effectDefinitionId}`,
    ),
    provenance: [
      { term: "Alternativa (identificador)", detail: definition.alternativeDefinitionId },
      {
        term: "Capacidades exigidas",
        detail:
          definition.requiredCapacityDefinitionIds.join(", ") ||
          "nenhuma capacidade declarada na configuração",
      },
      {
        term: "Efeitos declarados",
        detail: definition.effects
          .map((effect) => `${effect.effectDefinitionId} · executor ${effect.executorId}`)
          .join(" | "),
      },
      { term: "Diagnóstico do motor", detail: assessment.explanation },
      { term: "Competência avaliada", detail: assessment.competence.explanation },
    ],
  };
}

/* ----------------------------------------------------------- rito exigido */

export type DecisionRitualPresentation = {
  justification: { label: string; hint?: string } | null;
  competenceDeclaration: { label: string } | null;
  actNote: string | null;
};

/**
 * O rito é integralmente derivado da configuração do tipo de processo.
 * Nada é universal: sem exigência declarada, a Mesa não pede nada.
 */
export function resolveDecisionRitual(input: {
  typeDefinition: DecisionProcessTypeDefinition;
  /** Rótulo humano da natureza do ato, quando a configuração o fornecer. */
  actNatureLabel?: string | null;
  /** Declaração exigida pelo rito; ausente ⇒ nenhuma declaração é pedida. */
  competenceDeclarationLabel?: string | null;
}): DecisionRitualPresentation {
  return {
    justification: input.typeDefinition.requiresJustification
      ? {
          label: "Fundamentação da sua decisão",
          hint: "Escreva o que sustenta a escolha. Este texto acompanha o registro institucional.",
        }
      : null,
    competenceDeclaration: input.competenceDeclarationLabel
      ? { label: input.competenceDeclarationLabel }
      : null,
    actNote: input.actNatureLabel
      ? `Esta decisão produz um registro institucional: ${input.actNatureLabel}.`
      : null,
  };
}

/* --------------------------------------------- assunto completo para a Mesa */

export type LeadershipDecisionView = {
  processId: string;
  title: string;
  personLine: string | null;
  arrivalReason: string;
  requirementNote: string;
  timingLine: string | null;
  facts: AuthorizedFactProjection;
  options: readonly DecisionOptionPresentation[];
  ritual: DecisionRitualPresentation;
  blockedNote: string | null;
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

export function buildLeadershipDecisionView(input: {
  process: InstitutionalDecisionProcess;
  typeDefinition: DecisionProcessTypeDefinition;
  assessment: DecisionAssessment;
  capacityDefinitionIds: readonly string[];
  personLine?: string | null;
  actNatureLabel?: string | null;
  competenceDeclarationLabel?: string | null;
}): LeadershipDecisionView {
  const facts = projectAuthorizedDecisionFacts({
    facts: input.process.consideredFacts,
    capacityDefinitionIds: input.capacityDefinitionIds,
  });

  const options = input.typeDefinition.alternatives.map((definition) => {
    const assessment = input.assessment.alternatives.find(
      (entry) => entry.alternativeDefinitionId === definition.alternativeDefinitionId,
    );
    return resolveDecisionOptionPresentation({
      definition,
      assessment: assessment ?? {
        alternativeDefinitionId: definition.alternativeDefinitionId,
        labelSnapshot: definition.labelSnapshot,
        admissibility: ALTERNATIVE_ADMISSIBILITY.inconclusive,
        competence: {
          outcome: COMPETENCE_OUTCOME.inconclusive,
          grants: [],
          explanation:
            "O motor não avaliou esta alternativa nesta data: a admissibilidade fica inconclusiva.",
        },
        missingCapacityDefinitionIds: [],
        missingFactKeys: [],
        unavailableFactKeys: [],
        explanation:
          "Não é possível determinar se esta alternativa é admissível com as informações disponíveis.",
      },
      facts: facts.facts,
    });
  });

  const openedLine = `Chegou em ${formatAcademicDate(input.process.openedOn)}`;
  const deadlineLine = input.process.deadline
    ? ` · prazo declarado até ${formatAcademicDate(input.process.deadline.dueDate)}`
    : "";

  const noneAvailable = options.length > 0 && options.every((option) => !option.available);

  return {
    processId: input.process.decisionProcessId,
    title: input.typeDefinition.labelSnapshot,
    personLine: input.personLine ?? null,
    arrivalReason: input.process.escalationNarrativeSnapshot,
    requirementNote: input.typeDefinition.requirementNarrativeSnapshot,
    timingLine: `${openedLine}${deadlineLine}`,
    facts,
    options,
    ritual: resolveDecisionRitual({
      typeDefinition: input.typeDefinition,
      actNatureLabel: input.actNatureLabel ?? null,
      competenceDeclarationLabel: input.competenceDeclarationLabel ?? null,
    }),
    blockedNote: noneAvailable
      ? "Cada alternativa abaixo explica o que ainda falta ou qual atribuição é exigida. Nada é decidido enquanto isso permanecer."
      : null,
    provenance: [
      { term: "Processo (identificador)", detail: input.process.decisionProcessId },
      {
        term: "Tipo de processo",
        detail: input.typeDefinition.decisionProcessTypeDefinitionId,
      },
      {
        term: "Regra que exige a decisão",
        detail: `${input.typeDefinition.requiringPolicyId} · versão ${input.typeDefinition.requiringPolicyVersion}`,
      },
      {
        term: "Homologação da configuração",
        detail: input.typeDefinition.homologated
          ? "tipo de processo homologado"
          : "tipo de processo sem homologação: nenhuma decisão produz efeito oficial",
      },
      {
        term: "Registrado por",
        detail: `${input.process.provenance.recordedByAgentId} · ${input.process.provenance.originTypeId}`,
      },
      ...input.assessment.diagnostics.map((diagnostic, index) => ({
        term: `Diagnóstico ${index + 1}`,
        detail: diagnostic,
      })),
    ],
  };
}

/* ----------------------------------- estado do item, resolvido com fallback */

/**
 * Resolve uma linha de situação a partir da definição + contexto, com fallback
 * humano seguro. Não existe dicionário fechado: quando a definição não é
 * reconhecida, a frase permanece serena e verdadeira.
 */
export function resolveLeadershipStateLine(item: OperationalQueueItem): string {
  const awaiting = item.awaitingPartyDefinitionId;
  if (awaiting && awaiting.includes("direcao")) {
    return "Aguardando a sua decisão.";
  }
  if (awaiting && awaiting.includes("secretaria")) {
    return "Aguardando providência da Secretaria da escola.";
  }
  if (awaiting && awaiting.includes("orientacao")) {
    return "Aguardando providência da Orientação Pedagógica.";
  }
  if (awaiting && awaiting.includes("autoridade")) {
    return "Aguardando providência de instância superior.";
  }
  if (item.concludedAt) {
    return `Concluído em ${formatAcademicDate(civilDateOf(item.concludedAt))}.`;
  }
  return "Em acompanhamento institucional.";
}

/** Linha serena de prazo. Prazo em curso é informação, não alarme. */
export function resolveDeadlineLine(item: OperationalQueueItem): string | null {
  if (!item.deadline) return null;
  return `Prazo declarado até ${formatAcademicDate(item.deadline.dueDate)}`;
}

/* ------------------------------ conformidade: providências concretas (trava 4) */

export type LeadershipPendingProvision = {
  key: string;
  classLabel: string;
  classId: string;
  /** O que exatamente está pendente, como o domínio declarou. */
  requirementLine: string;
  /**
   * De quem depende, em linguagem humana, SOMENTE quando a fonte declara um
   * rótulo humano. Identificador técnico não é apresentado no primeiro nível:
   * ele permanece na proveniência.
   */
  responsibilityLine: string | null;
  /** Verdadeiro quando o domínio não conseguiu concluir a avaliação. */
  inconclusive: boolean;
  provenance: ReadonlyArray<{ term: string; detail: string }>;
};

/**
 * Responde a uma pergunta operacional: quais turmas têm providência concreta
 * pendente. Não produz taxa, média, série nem comparação entre turmas.
 */
export function projectPendingProvisions(input: {
  impediments: readonly LeadershipClosingImpediment[];
  unitIds: readonly string[];
  /** Rótulos humanos de executor declarados pela configuração, quando houver. */
  executorLabels?: Readonly<Record<string, string>>;
}): readonly LeadershipPendingProvision[] {
  return input.impediments
    .filter((impediment) => input.unitIds.includes(impediment.unitId))
    .map((impediment) => ({
      key: impediment.impedimentId,
      classId: impediment.classId,
      classLabel: impediment.classLabelSnapshot,
      requirementLine: impediment.messageSnapshot,
      responsibilityLine: resolveProvisionResponsibility({
        executorDefinitionId: impediment.competentExecutorDefinitionId,
        executorLabels: input.executorLabels,
      }),
      inconclusive: impediment.inconclusive,
      provenance: [
        { term: "Exigência", detail: impediment.requirementDefinitionId },
        {
          term: "Política aplicada",
          detail: `${impediment.policyId} · versão ${impediment.policyVersion}`,
        },
        { term: "Efeito declarado", detail: impediment.effectDefinitionId },
        {
          term: "Executor competente",
          detail:
            impediment.competentExecutorDefinitionId ||
            "nenhum executor competente declarado pela fonte",
        },
        { term: "Data de eficácia", detail: formatAcademicDate(impediment.effectiveDate) },
      ],
    }));
}

/**
 * Resolve de quem depende a providência. Sem rótulo humano declarado, nada é
 * afirmado no primeiro nível: o identificador permanece na proveniência e a
 * tela não inventa Secretaria, Colegiado nem Supervisão.
 */
function resolveProvisionResponsibility(input: {
  executorDefinitionId?: string | null;
  executorLabels?: Readonly<Record<string, string>> | undefined;
}): string | null {
  const id = input.executorDefinitionId?.trim();
  if (!id) return "Ainda não há responsável definido para esta etapa.";
  const label = input.executorLabels?.[id]?.trim();
  return label ? `Depende de: ${label}` : null;
}
