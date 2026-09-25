/**
 * Etapa 12I — Situação Acadêmica e Regras de Promoção (tipos).
 *
 * PRIMITIVAS × CONCEITOS NORMATIVOS (ajuste 1)
 * Esta camada só conhece primitivas matemáticas e lógicas: comparar, agregar,
 * compor com E/OU/NÃO, referenciar um fato e produzir uma consequência. Não
 * existe aqui nenhum conceito escolar da rede — nem "aprovado", nem "retido",
 * nem "abonar como presença", nem frequência mínima, nem nota de corte. Todo
 * efeito institucional é CONFIGURAÇÃO construída sobre estas primitivas.
 *
 * MOTOR DECLARATIVO (ajuste 2)
 * Um critério é sempre: referência a fato + escopo + operador + parâmetro,
 * composto logicamente, produzindo uma consequência. Não há um `kind` por
 * conceito escolar: critérios novos são CADASTRADOS, não programados.
 *
 * SITUAÇÕES ABERTAS (ajuste 3)
 * Situação acadêmica é entidade configurável com ID estável, rótulo e
 * propriedades/efeitos declarados pela regra. Nenhuma categoria é fixada.
 *
 * QUATRO CAMADAS SEMPRE SEPARADAS
 *   1. fatos acadêmicos (12H, 12H.1, movimentações, componentes);
 *   2. regra institucional homologada;
 *   3. deliberação humana institucional;
 *   4. situação acadêmica resultante.
 *
 * Estados OPERACIONAIS (ciclo em andamento, pendência administrativa,
 * aguardando deliberação) NUNCA são situações acadêmicas da rede (ajuste 10).
 * Datas trafegam no formato canônico interno; DD/MM/AAAA é apresentação
 * (ajuste 6).
 */

// ------------------------------------------------------------------- Fatos

export type StandingValue = number | string | boolean;

export type FactValueKind = "numero" | "texto" | "booleano" | "colecao";

/**
 * Natureza do fato, para que o motor analítico do CIECE distinga o que é
 * elementar do que é derivado (ajustes 8 e 9).
 */
export type FactCategory =
  | "primario"
  | "consolidado"
  | "resultado-normativo"
  | "materializacao-analitica";

export const FACT_CATEGORY_LABEL: Record<FactCategory, string> = {
  primario: "Fato primário",
  consolidado: "Fato consolidado",
  "resultado-normativo": "Resultado normativo",
  "materializacao-analitica": "Materialização analítica reproduzível",
};

/** Catálogo de fatos disponíveis ao cadastro de critérios. Extensível por dado. */
export type FactDefinition = {
  id: string;
  label: string;
  description: string;
  valueKind: FactValueKind;
  category: FactCategory;
  /** Escopo natural do fato, declarado livremente (ciclo, período, componente…). */
  scopeKind: string;
  unit?: string;
};

/** Escopo do fato. `kind` é string livre: o motor não conhece escopos escolares. */
export type FactScopeRef = { kind: string; id?: string };

export const scopeKeyOf = (scope?: FactScopeRef) =>
  scope ? `${scope.kind}:${scope.id ?? "*"}` : "*";

export type FactProvenanceSource = {
  kind: string;
  id: string;
  version?: number;
  at?: string;
};

/** Proveniência obrigatória de todo fato derivado (ajuste 9). */
export type FactProvenance = {
  sources: readonly FactProvenanceSource[];
  /** Algoritmo/configuração que produziu o valor, em texto reproduzível. */
  algorithm: string;
  policyId?: string;
  policyVersion?: number;
  ruleId?: string;
  ruleVersion?: number;
  ruleSetId?: string;
  ruleSetVersion?: number;
  configuration?: Record<string, StandingValue>;
  materializedAt: string;
};

export type ResolvedFact = {
  factId: string;
  scope: FactScopeRef;
  scopeKey: string;
  category: FactCategory;
  valueKind: FactValueKind;
  /** `null` = fato não disponível. Nunca substituído por zero ou presunção. */
  value: StandingValue | readonly StandingValue[] | null;
  unit?: string;
  /** Motivo da indisponibilidade, quando `value` é `null`. */
  unavailableReason?: string;
  provenance: FactProvenance;
};

// ---------------------------------------------------- Primitivas do motor

/** Operadores de comparação. Primitivas puras, sem semântica institucional. */
export type ComparisonOperator =
  | "igual"
  | "diferente"
  | "maior"
  | "maior-ou-igual"
  | "menor"
  | "menor-ou-igual"
  | "entre"
  | "pertence-ao-conjunto"
  | "nao-pertence-ao-conjunto"
  | "existe"
  | "ausente"
  | "verdadeiro"
  | "falso";

export const COMPARISON_OPERATOR_LABEL: Record<ComparisonOperator, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  maior: "é maior que",
  "maior-ou-igual": "é maior ou igual a",
  menor: "é menor que",
  "menor-ou-igual": "é menor ou igual a",
  entre: "está entre",
  "pertence-ao-conjunto": "pertence ao conjunto",
  "nao-pertence-ao-conjunto": "não pertence ao conjunto",
  existe: "está disponível",
  ausente: "não está disponível",
  verdadeiro: "é verdadeiro",
  falso: "é falso",
};

/** Agregadores. Primitivas puras aplicadas a uma coleção de fatos. */
export type AggregationOperator =
  | "contagem"
  | "soma"
  | "media"
  | "minimo"
  | "maximo"
  | "proporcao";

export const AGGREGATION_OPERATOR_LABEL: Record<AggregationOperator, string> = {
  contagem: "quantidade de ocorrências",
  soma: "soma",
  media: "média",
  minimo: "menor valor",
  maximo: "maior valor",
  proporcao: "proporção entre ocorrências que satisfazem o filtro e o total",
};

/** Parâmetro do critério: literal, conjunto, intervalo, parâmetro ou outro fato. */
export type ParameterRef =
  | { kind: "literal"; value: StandingValue }
  | { kind: "conjunto"; values: readonly StandingValue[] }
  | { kind: "intervalo"; from: number; to: number }
  | { kind: "parametro"; parameterId: string }
  | { kind: "fato"; factId: string; scope?: FactScopeRef }
  | { kind: "sem-parametro" };

/**
 * Critério declarativo. Só existem DUAS formas estruturais: comparação e
 * composição lógica. Qualquer conceito novo da rede é cadastrado como dado.
 */
export type CriterionNode =
  | {
      id: string;
      kind: "comparacao";
      label?: string;
      fact: { factId: string; scope?: FactScopeRef };
      /**
       * Agregação genérica sobre TODOS os fatos que casam a referência
       * (por exemplo, os fatos por componente do percurso). O filtro `where`
       * é avaliado escopo a escopo, com o escopo corrente vinculado.
       */
      aggregation?: {
        operator: AggregationOperator;
        where?: CriterionNode;
      };
      operator: ComparisonOperator;
      parameter: ParameterRef;
    }
  | {
      id: string;
      kind: "composicao";
      label?: string;
      logic: "e" | "ou" | "nao";
      children: readonly CriterionNode[];
    };

/**
 * Consequência produzida por um critério satisfeito. São primitivas de
 * infraestrutura — atribuir uma situação configurada, encaminhar a um órgão
 * deliberativo configurado, registrar pendência ou seguir avaliando. Nenhuma
 * delas nomeia conceito escolar.
 */
export type Consequence =
  | { kind: "atribuir-situacao"; standingId: string; note?: string }
  | {
      kind: "encaminhar-para-deliberacao";
      bodyId: string;
      competenceId: string;
      note?: string;
    }
  | { kind: "registrar-pendencia"; pendencyId: string; message: string }
  | { kind: "prosseguir"; note?: string };

/**
 * Passo da sequência de avaliação. A ORDEM é declarada pela regra (ajuste 2):
 * o motor não conhece ordem normativa universal entre frequência, rendimento,
 * dependência ou qualquer outro critério.
 */
export type StandingRuleStep = {
  id: string;
  order: number;
  label: string;
  description?: string;
  when: CriterionNode;
  consequence: Consequence;
  /** Satisfeito, encerra a sequência? Declarado pela regra, nunca presumido. */
  stopsOnMatch: boolean;
};

// ---------------------------------------------------- Situação acadêmica

/**
 * Situação acadêmica configurável. Sem categoria fixa (ajuste 3): as
 * propriedades e efeitos são DECLARADOS pela regra institucional.
 */
/**
 * Origem institucional da situação. "determinacao-por-regra" pode ser
 * atribuída pelo motor; "vida-escolar" provém da movimentação/matrícula
 * (ex.: transferência) e NUNCA é produzida pelo motor de promoção.
 */
export type StandingOrigin = "determinacao-por-regra" | "vida-escolar";

export const STANDING_ORIGIN_LABEL: Record<StandingOrigin, string> = {
  "determinacao-por-regra": "Determinada pela regra institucional",
  "vida-escolar": "Proveniente da vida escolar (movimentação/matrícula)",
};

export type AcademicStandingDefinition = {
  id: string;
  code: string;
  label: string;
  /** Rótulo exatamente como aparece no documento histórico de origem. */
  historicalLabel?: string;
  description: string;
  /** Ausente equivale a "determinacao-por-regra" (compatibilidade). */
  origin?: StandingOrigin;
  /** Referência documental que comprova a existência da situação. */
  documentaryEvidence?: string;
  /** Propriedades declaradas pela regra (chave/valor livres). */
  properties: Record<string, StandingValue>;
  /** Efeitos declarados pela regra, com identificadores estáveis. */
  effects: readonly { id: string; label: string; note?: string }[];
};

/**
 * Situação de vida escolar registrada a partir da movimentação/matrícula.
 * Encerra o percurso na unidade/ciclo sem fabricar resultado de promoção.
 */
export type SchoolLifeStandingRecord = {
  id: string;
  standingId: string;
  /** Rótulo histórico preservado no momento do registro. */
  historicalLabel: string;
  studentId: string;
  cycleId: string;
  unitId?: string;
  /** Movimentação/matrícula de origem. */
  sourceMovementId: string;
  /** Data civil ISO da determinação (exibida em DD/MM/AAAA). */
  determinedOn: string;
  endsPathInScope: true;
  producesPromotionResult: false;
};


// ------------------------------------------------------------ Governança

export type StandingRuleStatus = "rascunho" | "em-revisao" | "homologada" | "arquivada";

export const STANDING_RULE_STATUS_LABEL: Record<StandingRuleStatus, string> = {
  rascunho: "Rascunho — sem valor institucional",
  "em-revisao": "Em revisão institucional",
  homologada: "Homologada",
  arquivada: "Arquivada",
};

/**
 * Capacidades institucionais (ajuste 4). Nenhum cargo é fixado no domínio: os
 * perfis demonstrativos apenas associam capacidades a rótulos humanos.
 */
export type StandingCapability =
  | "criar-regra-de-situacao"
  | "editar-regra-de-situacao"
  | "revisar-regra-de-situacao"
  | "homologar-regra-de-situacao"
  | "arquivar-regra-de-situacao"
  | "deliberar-situacao"
  | "reprocessar-situacao"
  | "consultar-auditoria-de-situacao";

export const STANDING_CAPABILITY_LABEL: Record<StandingCapability, string> = {
  "criar-regra-de-situacao": "Criar regra de situação acadêmica",
  "editar-regra-de-situacao": "Editar regra em rascunho",
  "revisar-regra-de-situacao": "Revisar regra",
  "homologar-regra-de-situacao": "Homologar regra",
  "arquivar-regra-de-situacao": "Arquivar regra",
  "deliberar-situacao": "Deliberar sobre situação acadêmica",
  "reprocessar-situacao": "Reprocessar determinação de situação",
  "consultar-auditoria-de-situacao": "Consultar auditoria das determinações",
};

export type StandingActor = {
  id: string;
  name: string;
  /** Rótulo humano do perfil; não governa capacidade. */
  profileLabel: string;
  capabilities: readonly StandingCapability[];
};

export type StandingActorStamp = {
  actorId: string;
  actorName: string;
  profileLabel: string;
  at: string;
};

export type StandingRuleAuditAction =
  | "criada"
  | "alterada"
  | "enviada-para-revisao"
  | "devolvida-para-rascunho"
  | "homologada"
  | "arquivada"
  | "duplicada";

export type StandingRuleAuditEvent = {
  at: string;
  action: StandingRuleAuditAction;
  actor: StandingActorStamp;
  detail: string;
};

/** Parâmetro quantitativo/qualitativo da regra. É número ou valor, não decisão. */
export type StandingRuleParameter = {
  id: string;
  label: string;
  /** Unidade livre declarada pela regra (pontos, unidades, minutos, proporção…). */
  unit?: string;
  value?: StandingValue;
  note?: string;
};

/** Órgão deliberativo configurado, com as competências que a rede lhe atribuir. */
export type DeliberationBody = {
  id: string;
  label: string;
  description?: string;
  competences: readonly {
    id: string;
    label: string;
    description?: string;
    /** Situações que esta competência pode produzir, quando a regra restringir. */
    allowedStandingIds?: readonly string[];
  }[];
};

/**
 * Conjunto normativo de situação acadêmica. Homologado, torna-se imutável: nova
 * norma gera nova versão, sem reescrever determinações históricas.
 */
export type AcademicStandingRuleSet = {
  id: string;
  version: number;
  label: string;
  description?: string;
  status: StandingRuleStatus;
  scope: {
    academicYearId: string;
    stageIds?: readonly string[];
    classIds?: readonly string[];
    /** Tipos de ciclo abrangidos, por ID da configuração. */
    cycleKindIds?: readonly string[];
  };
  standings: readonly AcademicStandingDefinition[];
  parameters: readonly StandingRuleParameter[];
  bodies: readonly DeliberationBody[];
  steps: readonly StandingRuleStep[];
  /** Consequência quando nenhum passo é satisfeito. Declarada, nunca presumida. */
  defaultConsequence?: Consequence;
  supersedesId?: string;
  audit: {
    events: readonly StandingRuleAuditEvent[];
    homologatedBy?: StandingActorStamp;
    demonstrative: boolean;
  };
  note?: string;
};

// ------------------------------------------------- Deliberação institucional

/**
 * Registro genérico de deliberação institucional (ajuste 5). Conselho de Classe
 * é UMA aplicação configurada desta infraestrutura, não a forma universal de
 * decisão humana. A competência exercida é sempre declarada pela regra.
 */
export type InstitutionalDeliberationRecord = {
  id: string;
  scopeKey: string;
  cycleId: string;
  studentId: string;
  bodyId: string;
  bodyLabel: string;
  competenceId: string;
  competenceLabel: string;
  actor: StandingActorStamp;
  participants?: readonly { id?: string; name: string; role?: string }[];
  /** Fatos efetivamente considerados, com valor e proveniência preservados. */
  consideredFacts: readonly {
    factId: string;
    scopeKey: string;
    value: StandingValue | readonly StandingValue[] | null;
    provenance: FactProvenance;
  }[];
  decision: { standingId?: string; note: string };
  rationale: string;
  at: string;
  documentRefs?: readonly string[];
};

// ------------------------------------------------- Avaliação explicável

export type NodeEvaluation = {
  nodeId: string;
  kind: "comparacao" | "composicao";
  label?: string;
  factId?: string;
  scopeKey?: string;
  aggregation?: { operator: AggregationOperator; matchedScopeKeys: readonly string[] };
  /** Valor efetivamente encontrado (após agregação, quando houver). */
  value?: StandingValue | readonly StandingValue[] | null;
  operator?: ComparisonOperator;
  parameter?: { description: string; value?: StandingValue | readonly StandingValue[] };
  /** `null` = não avaliável (fato ou parâmetro indisponível). Nunca falso por omissão. */
  result: boolean | null;
  reason: string;
  provenance?: FactProvenance;
  children?: readonly NodeEvaluation[];
};

export type StepEvaluation = {
  stepId: string;
  order: number;
  label: string;
  ruleSetId: string;
  ruleSetVersion: number;
  node: NodeEvaluation;
  result: boolean | null;
  /** Consequência produzida quando satisfeito; `null` quando não satisfeito. */
  consequence: Consequence | null;
  /** Este passo determinou o desfecho da avaliação? */
  applied: boolean;
};

/** Estados OPERACIONAIS — nunca situações acadêmicas da rede (ajuste 10). */
export type StandingOperationalState =
  | "aguardando-regra-homologada"
  | "ciclo-em-andamento"
  | "pendencia-administrativa"
  | "criterio-nao-avaliavel"
  | "aguardando-deliberacao"
  | "situacao-determinada"
  | "nao-aplicavel";

export const STANDING_OPERATIONAL_STATE_LABEL: Record<StandingOperationalState, string> = {
  "aguardando-regra-homologada": "Aguardando regra de situação homologada",
  "ciclo-em-andamento": "Ciclo em andamento",
  "pendencia-administrativa": "Pendência administrativa",
  "criterio-nao-avaliavel": "Critério não avaliável com os fatos disponíveis",
  "aguardando-deliberacao": "Aguardando deliberação institucional",
  "situacao-determinada": "Situação acadêmica determinada",
  "nao-aplicavel": "Determinação não aplicável a este percurso",
};

export type StandingPendency = {
  id: string;
  severity: "bloqueante" | "pendencia-administrativa" | "aviso";
  message: string;
  factId?: string;
  scopeKey?: string;
  stepId?: string;
};

export type AcademicStandingDetermination = {
  cycleId: string;
  cycleKindId: string;
  academicYearId: string;
  studentId: string;
  studentName?: string;
  ruleSetId?: string;
  ruleSetVersion?: number;
  operationalState: StandingOperationalState;
  /** Situação acadêmica resultante; `null` enquanto não determinada. */
  standingId: string | null;
  standing: AcademicStandingDefinition | null;
  appliedStepId?: string;
  /** Encaminhamento a órgão deliberativo configurado, quando a regra o previr. */
  requiresDeliberation: { bodyId: string; competenceId: string; note?: string } | null;
  deliberation: InstitutionalDeliberationRecord | null;
  steps: readonly StepEvaluation[];
  pendencies: readonly StandingPendency[];
  facts: readonly ResolvedFact[];
  reasons: readonly string[];
  /** Oficial apenas com regra homologada e fatos oficiais em todo o ciclo. */
  official: boolean;
};

// --------------------------------------- Registro versionado da determinação

export type StandingRecordRevision = {
  kind: "retificacao" | "reprocessamento" | "deliberacao";
  justification: string;
  authorizedBy: StandingActorStamp;
};

/**
 * Versão IMUTÁVEL da determinação. Determinação histórica nunca é reescrita:
 * retificação, reprocessamento ou deliberação geram a versão seguinte,
 * encadeada por `precedingRecordId`.
 */
export type AcademicStandingRecord = {
  id: string;
  scopeKey: string;
  version: number;
  precedingRecordId?: string;
  factKind: "situacao-academica-do-ciclo";
  cycleId: string;
  cycleKindId: string;
  academicYearId: string;
  studentId: string;
  ruleSetId: string;
  ruleSetVersion: number;
  standingId: string | null;
  operationalState: StandingOperationalState;
  determinedBy: StandingActorStamp;
  determinedAt: string;
  revision?: StandingRecordRevision;
  deliberationId?: string;
  /** Explicabilidade estrutural preservada na própria versão (ajuste 12). */
  steps: readonly StepEvaluation[];
  facts: readonly ResolvedFact[];
  pendencies: readonly StandingPendency[];
};

export type StandingRecordSourceReference = {
  recordId: string;
  recordVersion: number;
  scopeKey: string;
  ruleSetId: string;
  ruleSetVersion: number;
  materializedAt: string;
};

export const ACADEMIC_STANDING_LABEL = "Situação acadêmica do ciclo";

export const ACADEMIC_STANDING_NOTE =
  "Situação acadêmica é sempre o resultado de três camadas distintas: fatos acadêmicos consolidados, regra institucional homologada e, quando a regra previr, deliberação institucional registrada. Nenhum patamar de rendimento, percentual de frequência, efeito de justificativa, competência de colegiado ou regra de progressão está homologado nesta etapa: a infraestrutura existe, e a determinação permanece bloqueada até que a rede cadastre e homologue sua norma.";
