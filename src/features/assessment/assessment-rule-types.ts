/**
 * Etapa 12F — Regra avaliativa institucional: tipos.
 *
 * A regra deixa de ser fixture técnica e passa a ter identidade institucional,
 * escopo, vigência, versão, estado, autoria e histórico.
 *
 * Três níveis SEMPRE distintos:
 * 1. CAPACIDADE — o que estes tipos e o motor (12E) conseguem representar;
 * 2. CONFIGURADA — o que a Supervisão cadastrou (rascunho/em revisão);
 * 3. HOMOLOGADA — ato normativo registrado, imutável, único que alimenta o motor.
 *
 * Nada aqui fixa quantidade de períodos, escala, categorias, pesos, tetos,
 * forma de prevalência da recuperação, percentual de referência ou total anual.
 * Toda regra concreta é DADO da configuração, nunca estrutura do domínio.
 */
import type {
  AdministrativeEntryPolicy,
  AggregationRule,
  CompositionCategory,
  RoundingPolicy,
  RoundingPoint,
  ValueSemantics,
} from "./assessment-composition-types";
import type { AssessmentStrategyKind, ScaleDefinition } from "./assessment-types";

/** Estados institucionais. "Demonstrativo" NÃO é estado de regra. */
export type AssessmentRuleStatus = "rascunho" | "em-revisao" | "homologada" | "arquivada";

/**
 * Formas de prevalência/substituição que o domínio é CAPAZ de representar.
 * Nenhuma delas é a regra do SIGEM: a regra institucional escolhe uma.
 * "maior-resultado" é a forma atualmente informada para os contextos da rede em
 * que a recuperação se aplica — e continua sendo apenas um valor configurável.
 */
export type RecoveryPrevalence =
  | "maior-resultado"
  | "menor-resultado"
  | "substituicao-direta"
  | "ultimo-resultado"
  | "media-entre-resultados";

export const RECOVERY_PREVALENCE_LABEL: Record<RecoveryPrevalence, string> = {
  "maior-resultado": "Prevalece o maior resultado",
  "menor-resultado": "Prevalece o menor resultado",
  "substituicao-direta": "A recuperação substitui diretamente",
  "ultimo-resultado": "Prevalece o resultado mais recente",
  "media-entre-resultados": "Média entre os resultados",
};

/**
 * Subconjunto EXPOSTO na interface administrativa da Supervisão: formas com
 * finalidade pedagógica/normativa reconhecida. Curadoria de interface, nunca
 * enumeração arquitetônica: o domínio permanece capaz de representar as demais
 * caso a norma da rede passe a exigi-las.
 */
export const SUPERVISION_RECOVERY_PREVALENCES: RecoveryPrevalence[] = [
  "maior-resultado",
  "substituicao-direta",
];

/**
 * Critério/gatilho de acesso à recuperação. `undefined` = ainda não definido
 * pela rede: o sistema não presume elegibilidade nem patamar de corte.
 */
export type RecoveryEligibility =
  { kind: "sem-restricao" } | { kind: "limite-de-pontuacao"; threshold?: number };

/**
 * Recuperação (periódica ou final). Mesma estrutura genérica, dois usos —
 * o nível é declarado em `scope`. Categorias substituíveis SEMPRE por ID.
 *
 * Campos opcionais que permanecem `undefined` significam PENDENTE DE DEFINIÇÃO
 * normativa: nada é preenchido só para completar o objeto.
 */
export type RecoveryRule = {
  id: string;
  enabled: boolean;
  scope: "periodo" | "anual";
  /** Categorias cuja parcela a recuperação substitui. Vazio = substitui o conjunto. */
  replacesCategoryIds: string[];
  /** Tipos de instrumento admitidos como registro da recuperação. */
  instrumentTypeIds: string[];
  /** Teto da recuperação, quando a configuração o definir. */
  maxScore?: number;
  /** Pendente enquanto `undefined`: nenhuma prevalência é presumida. */
  prevalence?: RecoveryPrevalence;
  /** Como os registros da recuperação se reduzem a um valor. Pendente se ausente. */
  aggregation?: AggregationRule;
  /** Critério de elegibilidade. Pendente enquanto `undefined`. */
  eligibility?: RecoveryEligibility;
  normativeStatus: "pendente" | "configurado" | "homologado";
};

/**
 * Parâmetro quantitativo institucional (ex.: percentual de referência).
 * É número, nunca decisão acadêmica: não produz aprovado, reprovado ou retido.
 */
export type RuleParameter = {
  id: string;
  label: string;
  kind: "percentual" | "pontos" | "quantidade";
  value?: number;
  note?: string;
};

export type RuleAuditAction =
  | "criada"
  | "alterada"
  | "enviada-revisao"
  | "devolvida-rascunho"
  | "homologada"
  | "arquivada"
  | "duplicada";

export type RuleAuditEvent = {
  at: string;
  actorId: string;
  actorName: string;
  action: RuleAuditAction;
  detail: string;
};

/** Auditoria demonstrativa: sem backend, nada disso é registro oficial. */
export type RuleAudit = {
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  homologatedBy?: string;
  homologatedByName?: string;
  homologatedAt?: string;
  archivedBy?: string;
  archivedByName?: string;
  archivedAt?: string;
  events: RuleAuditEvent[];
  demonstrative: true;
};

/** Contexto de aplicação — por identidade, nunca por nome. */
export type RuleScope = {
  academicYearId: string;
  /** Calendário da rede cujos períodos oficiais a regra referencia. */
  calendarId: string;
  /** Etapas/modalidades abrangidas (academic-structure.stageReferences). */
  stageIds: string[];
  /** Restrição opcional a turmas específicas. */
  classIds?: string[];
};

/** Peso do período na consolidação anual, referenciado pelo período do calendário. */
export type AnnualPeriodWeight = { calendarPeriodId: string; weight: number };

export type InstitutionalAssessmentRule = {
  id: string;
  name: string;
  version: number;
  status: AssessmentRuleStatus;
  scope: RuleScope;
  /** Vigência declarada pela Supervisão (ISO). */
  validFrom?: string;
  validUntil?: string;

  strategy: AssessmentStrategyKind;
  scaleSemantics: ValueSemantics;
  scales: ScaleDefinition[];
  allowsGrades: boolean;
  usesPedagogicalRecords: boolean;
  allowsPromotionDecision: boolean;

  categories: CompositionCategory[];
  periodAggregation: AggregationRule;
  periodMaxScore?: number;

  /**
   * Forma de consolidação anual. `undefined` = PENDENTE DE DEFINIÇÃO normativa:
   * o cálculo anual permanece bloqueado e nada é presumido.
   */
  annualAggregation?: AggregationRule;
  requiresAllPeriods: boolean;
  annualPeriodWeights?: AnnualPeriodWeight[];

  periodicRecovery?: RecoveryRule;
  finalRecovery?: RecoveryRule;

  rounding: RoundingPolicy;
  administrativeEntries: AdministrativeEntryPolicy;
  parameters: RuleParameter[];

  /** Configuração avaliativa (12A/12B) governada por esta regra, quando houver. */
  configurationId?: string;
  /** Origem, quando a regra nasceu de duplicação. */
  originRuleId?: string;
  originVersion?: number;

  audit: RuleAudit;
};

/** Perfil demonstrativo. Autorização real depende de backend (RBAC:). */
export type RuleActor = { id: string; name: string; role: "supervisao" | "direcao" | "professor" };

export const ROUNDING_POINT_LABEL: Record<RoundingPoint, string> = {
  instrumento: "No fechamento de cada instrumento",
  categoria: "No fechamento de cada categoria",
  periodo: "No fechamento do período",
  componente: "No fechamento do componente",
  anual: "No fechamento anual",
};
