/**
 * SIGEM — Human Interface Language, camada de resolução de estados (Rodada 6B.1).
 *
 * Fronteiras desta camada (não negociáveis):
 *
 *  1. A tradução NUNCA afirma mais do que o fato canônico permite concluir.
 *     Responsável, prazo, requisito e próxima ação vêm dos fatos recebidos;
 *     o código de diagnóstico apenas SELECIONA uma estrutura de apresentação.
 *  2. Não existe dicionário `diagnosticCode → responsável`. Competência é
 *     resolvida de referência canônica (executor competente, capacidade,
 *     política, configuração). Sem referência, a tela diz que não há
 *     responsável definido — nunca inventa Direção, Supervisão ou Secretaria.
 *  3. `HumanStatusNature` é classificação EFÊMERA de apresentação: não possui
 *     identidade institucional, não é persistida e não participa de nenhuma
 *     decisão de domínio.
 *  4. Dado protegido: a política decide inclusive se a EXISTÊNCIA do dado pode
 *     ser revelada. Quando não pode, nada é projetado (retorno `null`).
 *  5. Não dramatização: estado pendente não é alerta. Atenção só aparece quando
 *     um fato/política declara que ela é necessária.
 *  6. Nenhuma tradução altera admissibilidade, autorização ou falha fechada.
 */

/** Naturezas de apresentação (efêmeras, nunca persistidas). */
export type HumanStatusNature =
  | "informativo"
  | "acompanhamento"
  | "dado-ausente"
  | "dado-protegido"
  | "sem-capacidade"
  | "requisito-pendente"
  | "dependencia-institucional"
  | "aguardando-terceiro"
  | "configuracao-ausente"
  | "politica-nao-homologada"
  | "nao-aplicavel"
  | "impossibilidade-tecnica";

/** Escala serena de apresentação (ver "não dramatização"). */
export type HumanStatusTone =
  | "neutro"
  | "informacao"
  | "acompanhamento"
  | "atencao"
  | "acao-necessaria"
  | "impedimento"
  | "erro";

/** Texto único de fallback quando a fonte não declara competência. */
export const RESPONSIBILITY_UNDETERMINED = "Ainda não há responsável definido para esta etapa.";

/** Texto único de fallback quando não há tradução específica para o diagnóstico. */
export const HEADLINE_FALLBACK = "Ainda não é possível concluir esta etapa.";

/** Frase usada quando a política permite dizer que algo foi omitido, sem dizer o quê. */
export const PROTECTED_CONTEXT_NOTE = "Algumas informações não estão disponíveis neste contexto.";

/**
 * Referência canônica de competência já resolvida pelo domínio.
 * Nada aqui é inferido pela apresentação.
 */
export interface CompetenceReference {
  /** Rótulo humano da definição de executor competente, quando existir. */
  readonly executorLabel?: string | null;
  /** Rótulo humano do órgão/instância declarado na política, quando existir. */
  readonly bodyLabel?: string | null;
  /** Identificador canônico do executor competente (Nível 3). */
  readonly competentExecutorDefinitionId?: string | null;
  /** Identificador da política que atribuiu a competência (Nível 3). */
  readonly policyDefinitionId?: string | null;
  /** Versão da política/configuração aplicada (Nível 3). */
  readonly policyVersion?: string | null;
}

/** Espera legítima declarada pelos fatos; prazo em curso não é alerta. */
export interface WaitingReference {
  /** De quem se aguarda, apenas quando a fonte declara. */
  readonly waitingForLabel?: string | null;
  /** Data limite em DD/MM/AAAA, já formatada pela camada de datas. */
  readonly dueDateLabel?: string | null;
  /** Atenção exigida por fato/política — nunca deduzida aqui. */
  readonly attentionRequired?: boolean;
}

/** Decisão de política sobre revelar (ou não) a própria existência do dado. */
export interface DisclosureDecision {
  /** Falso ⇒ nada é projetado, nem a existência do dado. */
  readonly existenceRevealable: boolean;
  /** Verdadeiro ⇒ a política autoriza apenas a nota genérica de omissão. */
  readonly genericNoteAllowed?: boolean;
}

/** Estrutura de apresentação selecionada por um código de diagnóstico. */
export interface StatusTemplate {
  readonly nature: HumanStatusNature;
  /** Frase de primeiro nível; pode usar parâmetros estruturados. */
  readonly headline: (parameters: StatusParameters) => string;
  /** Motivo factual; só existe quando os parâmetros necessários existirem. */
  readonly because?: (parameters: StatusParameters) => string | null;
  /** Consequência institucional declarada pela fonte. */
  readonly consequence?: (parameters: StatusParameters) => string | null;
  /** Parâmetros obrigatórios: ausentes ⇒ fallback humano seguro. */
  readonly requires?: readonly string[];
}

export type StatusParameters = Readonly<Record<string, string | number | null | undefined>>;

export type StatusTemplateRegistry = ReadonlyMap<string, StatusTemplate>;

/** Registro imutável de estruturas de apresentação. */
export function createStatusTemplateRegistry(
  entries: readonly (readonly [string, StatusTemplate])[],
): StatusTemplateRegistry {
  return new Map(entries);
}

export interface HumanStatusInput {
  /** Código canônico do diagnóstico; preservado integralmente para o Nível 3. */
  readonly diagnosticCode?: string | null;
  /** Natureza usada quando não há código canônico (estados de formulário). */
  readonly nature?: HumanStatusNature;
  /** Parâmetros estruturados vindos do fato. */
  readonly parameters?: StatusParameters;
  /** Competência canônica; ausente ⇒ fallback explícito. */
  readonly competence?: CompetenceReference | null;
  /** Espera declarada pelos fatos. */
  readonly waiting?: WaitingReference | null;
  /** Requisitos atômicos ainda não satisfeitos, tal como o domínio os informou. */
  readonly pendingRequirements?: readonly string[];
  /** Decisão de política sobre revelação; obrigatória para dado protegido. */
  readonly disclosure?: DisclosureDecision | null;
  /** Estruturas de apresentação disponíveis. */
  readonly registry?: StatusTemplateRegistry;
}

export interface HumanStatusPresentation {
  readonly nature: HumanStatusNature;
  readonly tone: HumanStatusTone;
  /** Nível 1: o que está acontecendo. */
  readonly headline: string;
  /** Nível 1: por que, quando o fato informa. */
  readonly because: string | null;
  /** Nível 1: o que decorre disso, quando o fato informa. */
  readonly consequence: string | null;
  /** Nível 1: de quem depende — jamais inventado. */
  readonly responsibility: string;
  /** Falso quando a competência não pôde ser determinada pela fonte. */
  readonly responsibilityKnown: boolean;
  /** Linha serena de espera/prazo, quando declarada. */
  readonly waitingLine: string | null;
  /** Requisitos pendentes, exatamente como o domínio os declarou. */
  readonly pendingRequirements: readonly string[];
  /** Verdadeiro apenas quando nenhuma estrutura específica foi encontrada. */
  readonly usedFallback: boolean;
  /** Níveis 2 e 3: fundamentação preservada sem tradução. */
  readonly provenance: {
    readonly diagnosticCode: string | null;
    readonly competentExecutorDefinitionId: string | null;
    readonly policyDefinitionId: string | null;
    readonly policyVersion: string | null;
  };
}

const TONE_BY_NATURE: Record<HumanStatusNature, HumanStatusTone> = {
  informativo: "informacao",
  acompanhamento: "acompanhamento",
  "dado-ausente": "acao-necessaria",
  "dado-protegido": "neutro",
  "sem-capacidade": "impedimento",
  "requisito-pendente": "acao-necessaria",
  "dependencia-institucional": "acompanhamento",
  "aguardando-terceiro": "acompanhamento",
  "configuracao-ausente": "impedimento",
  "politica-nao-homologada": "impedimento",
  "nao-aplicavel": "neutro",
  "impossibilidade-tecnica": "erro",
};

function resolveResponsibility(competence: CompetenceReference | null | undefined): {
  text: string;
  known: boolean;
} {
  const label = competence?.executorLabel?.trim() || competence?.bodyLabel?.trim() || "";
  if (label.length === 0) {
    return { text: RESPONSIBILITY_UNDETERMINED, known: false };
  }
  return { text: `Depende de: ${label}`, known: true };
}

function resolveWaitingLine(waiting: WaitingReference | null | undefined): string | null {
  if (!waiting) return null;
  const who = waiting.waitingForLabel?.trim() ?? "";
  const due = waiting.dueDateLabel?.trim() ?? "";
  if (who.length === 0 && due.length === 0) return null;
  if (who.length === 0) return `Prazo até ${due}`;
  if (due.length === 0) return `Aguardando ${who}`;
  return `Aguardando ${who} — prazo até ${due}`;
}

function hasRequired(template: StatusTemplate, parameters: StatusParameters): boolean {
  return (template.requires ?? []).every((key) => {
    const value = parameters[key];
    return value !== undefined && value !== null && String(value).trim().length > 0;
  });
}

/**
 * Resolve a apresentação humana a partir de fatos canônicos.
 * Retorna `null` quando a política não autoriza revelar nem a existência do dado.
 */
export function resolveHumanStatus(input: HumanStatusInput): HumanStatusPresentation | null {
  const parameters = input.parameters ?? {};
  const template = input.diagnosticCode
    ? (input.registry?.get(input.diagnosticCode) ?? null)
    : null;
  const usable = template !== null && hasRequired(template, parameters);
  const nature: HumanStatusNature =
    (usable ? template?.nature : undefined) ?? input.nature ?? "requisito-pendente";

  if (nature === "dado-protegido") {
    const disclosure = input.disclosure;
    if (!disclosure || disclosure.existenceRevealable !== true) {
      return null;
    }
  }

  const responsibility = resolveResponsibility(input.competence);
  const waitingLine = resolveWaitingLine(input.waiting);
  const attention = input.waiting?.attentionRequired === true;

  return {
    nature,
    tone: attention ? "atencao" : TONE_BY_NATURE[nature],
    headline: usable && template ? template.headline(parameters) : HEADLINE_FALLBACK,
    because: usable && template?.because ? (template.because(parameters) ?? null) : null,
    consequence:
      usable && template?.consequence ? (template.consequence(parameters) ?? null) : null,
    responsibility: responsibility.text,
    responsibilityKnown: responsibility.known,
    waitingLine,
    pendingRequirements: input.pendingRequirements ?? [],
    usedFallback: !usable,
    provenance: {
      diagnosticCode: input.diagnosticCode ?? null,
      competentExecutorDefinitionId: input.competence?.competentExecutorDefinitionId ?? null,
      policyDefinitionId: input.competence?.policyDefinitionId ?? null,
      policyVersion: input.competence?.policyVersion ?? null,
    },
  };
}

/** Pertinência da ação — decide presença, nunca autorização. */
export type ActionRelevance =
  /** Não pertence ao contexto do agente: permanece ausente. */
  | "irrelevante"
  /** Pertinente, porém o agente não possui a capacidade declarada. */
  | "sem-capacidade"
  /** Pertinente, porém requisito institucional ainda não satisfeito. */
  | "requisito-pendente"
  /** Pertinente e executável. */
  | "disponivel";

export interface ActionDisclosure {
  /** Falso ⇒ a ação não é apresentada de forma alguma. */
  readonly present: boolean;
  /** Falso ⇒ apresentada, porém não executável. */
  readonly enabled: boolean;
  /** Explicação humana obrigatória quando presente e não executável. */
  readonly explanation: string | null;
}

/**
 * Traduz pertinência em presença/execução. Não concede nem amplia autorização:
 * ação sem capacidade permanece não executável (falha fechada preservada).
 */
export function resolveActionDisclosure(
  relevance: ActionRelevance,
  facts: {
    /** Explicação de capacidade, derivada da fonte (nunca inventada). */
    readonly capacityExplanation?: string | null;
    /** Requisitos pendentes exatamente como declarados pelo domínio. */
    readonly pendingRequirements?: readonly string[];
  } = {},
): ActionDisclosure {
  if (relevance === "irrelevante") {
    return { present: false, enabled: false, explanation: null };
  }
  if (relevance === "disponivel") {
    return { present: true, enabled: true, explanation: null };
  }
  if (relevance === "sem-capacidade") {
    return {
      present: true,
      enabled: false,
      explanation:
        facts.capacityExplanation?.trim() ||
        "Esta ação existe neste contexto, mas não está entre as suas atribuições.",
    };
  }
  const pending = facts.pendingRequirements ?? [];
  return {
    present: true,
    enabled: false,
    explanation:
      pending.length > 0
        ? `Falta ${pending.join("; ")}.`
        : "Ainda falta uma informação para esta ação ser válida.",
  };
}
