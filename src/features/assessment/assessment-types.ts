/**
 * Módulo 12 — Domínio de Avaliação (Etapa 12A: fundação).
 *
 * Tipos puros. Nenhuma fórmula, escala, média, arredondamento, frequência
 * mínima ou situação final é definida aqui. Toda regra ainda não homologada é
 * representada explicitamente como pendência normativa.
 * Vocabulário: docs/avaliacao-arquitetura.md.
 */

/** Grau de validade normativa de qualquer configuração. */
export type NormativeStatus =
  /** Regra não definida pela rede; o sistema não pode decidir. */
  | "pendente"
  /** Valor apenas para demonstração; nunca regra oficial. */
  | "demonstrativo"
  /** Estruturalmente configurado pela rede, mas ainda não homologado. */
  | "configurado"
  /** Reservado para regras homologadas no futuro. Nenhuma fixture o usa. */
  | "homologado";

/** Referências arquiteturais, não modelos oficiais da rede. */
export type AssessmentStrategyKind =
  "quantitativa" | "conceitual" | "descritiva" | "hibrida" | "acompanhamento";

// ---------------------------------------------------------------- Temporal

export type { AcademicYear } from "@/features/academic/academic-structure";

/** Período avaliativo: identidade própria, sem pressupor bimestre. */
export type AssessmentPeriod = {
  id: string;
  structureId: string;
  /** Vínculo explícito com o ano letivo (identidade, não rótulo). */
  academicYearId: string;
  sequence: number;
  /** Rótulo livre ("Etapa 1", "Semestre 1", "Período único"...). Nunca usado como chave. */
  label: string;
  /** Datas canônicas ISO. Quando `calendarPeriodId` existe, são SEMPRE resolvidas do calendário (nunca editadas aqui). */
  start: string;
  end: string;
  /** Referência ao período oficial do calendário da rede (12B.1). */
  calendarPeriodId?: string;
};

export type AssessmentPeriodStructure = {
  id: string;
  academicYearId: string;
  label: string;
  normativeStatus: NormativeStatus;
  periods: AssessmentPeriod[];
  /** Calendário da rede de onde os períodos são referenciados. */
  calendarId?: string;
  /**
   * B4.6.2b.3 — proveniência institucional B2.4 (versões/validOn/knownAt lidos). Presente ⇒ períodos
   * institucionais B2.4, nunca legado; ausência de `calendarId` aqui é dependência de calendário
   * não resolvida, não origem demonstrativa.
   */
  provenance?: import("@/features/academic/institutional-period-source").B24Provenance;
};

// ------------------------------------------------------------ Configuração

export type ScaleDefinition =
  | { kind: "numerica"; min: number; max: number; step: number; normativeStatus: NormativeStatus }
  | {
      kind: "conceitual";
      /** Ordenada: a sequência das opções tem significado; não ordenada: apenas categorias. */
      ordered: boolean;
      options: Array<{ id: string; label: string }>;
      normativeStatus: NormativeStatus;
    }
  | { kind: "descritiva" };

/** Regra de consolidação (fórmula futura). Sem homologação, nenhum cálculo ocorre. */
export type ConsolidationRule = {
  id: string;
  level: ResultLevel;
  normativeStatus: NormativeStatus;
  description: string;
};

export type AssessmentConfigurationScope = {
  /** IDs de etapa/modalidade estruturados (academic-structure.stageReferences). */
  stageIds?: string[];
  classIds?: string[];
};

/**
 * Configuração avaliativa: ponto único onde diferenças entre segmentos vivem.
 * A UI consulta a configuração; nunca faz `if (educacaoInfantil)`.
 */
export type AssessmentConfiguration = {
  id: string;
  label: string;
  academicYearId: string;
  scope: AssessmentConfigurationScope;
  strategy: AssessmentStrategyKind;
  periodStructureId: string;
  /** Escalas aceitas pelos lançamentos. Estratégia híbrida pode aceitar mais de uma. */
  scales: ScaleDefinition[];
  /** Tipos de instrumento admitidos (instrumentTypes). Vazio na estratégia de acompanhamento. */
  allowedInstrumentTypeIds: string[];
  /** Estratégia de acompanhamento trabalha com registros pedagógicos do Diário. */
  usesPedagogicalRecords: boolean;
  /** Admite nota/conceito numérico? Falso na Educação Infantil. */
  allowsGrades: boolean;
  /** Admite situação de aprovação/reprovação? Falso na Educação Infantil. */
  allowsPromotionDecision: boolean;
  consolidationRules: ConsolidationRule[];
  pendingRuleIds: string[];
  normativeStatus: NormativeStatus;
  version: number;
};

export type PendingNormativeRule = {
  id: string;
  topic: string;
  description: string;
};

// --------------------------------------------------------- Processo pedagógico

/** Tipo de instrumento configurável; não é taxonomia normativa. */
export type InstrumentType = { id: string; label: string };

/** Retrato de rótulos na época; identidade sempre pelos IDs. */
export type LabelSnapshot = { classLabel: string; fieldLabel: string };

/**
 * 12D.1 — Identidade estável de componente/campo. Nunca o nome exibido.
 * "matriz": código canônico da matriz curricular (ex.: "mat") ou do campo de experiência.
 * "atuacao": sem código canônico na fixture; a identidade é a própria atuação
 * pedagógica (estável e única), explicitamente provisória.
 */
export type CurriculumRef =
  { kind: "matriz"; componentId: string } | { kind: "atuacao"; assignmentId: string };

/** 12D.1 — Autoria historicamente estável (identidades demonstrativas). */
export type AuthorshipStamp = {
  professionalId: string;
  pedagogicalAssignmentId: string;
  /** Nome exibido naquele momento, quando disponível. */
  displayName?: string;
  at: string;
};

/** Instrumento avaliativo: aquilo que o professor utilizou para avaliar. */
export type AssessmentInstrument = {
  id: string;
  configurationId: string;
  periodId: string;
  /** Atuação pedagógica existente (pedagogical-data) — mesma fonte do Diário. */
  pedagogicalAssignmentId: string;
  classId: string;
  instrumentTypeId: string;
  title: string;
  appliedOn: string;
  snapshot: LabelSnapshot;
  /** 12D.1 — Identidade do componente/campo (não o rótulo). */
  curriculumRef?: CurriculumRef;
  /** 12D.1 — Versão da configuração aplicável na criação. */
  configurationVersion?: number;
  /** 12D.1 — Autoria da criação. */
  createdBy?: AuthorshipStamp;
  /**
   * 12C — Período oficial do calendário homologado (identidade, não rótulo).
   * Ausente apenas no cenário legado/demonstrativo (ver `periodSource`).
   */
  calendarPeriodId?: string;
  /** Origem do período: calendário homologado ou legado demonstrativo (não oficial). */
  periodSource?: PeriodSource;
  /** Ciclo de vida do instrumento — estado de UX, sem efeito normativo. */
  status?: InstrumentStatus;
  description?: string;
  professionalId?: string;
  createdAt?: string;
};

/** "legado-demonstrativo": dados de 2026 sem calendário homologado. Nunca oficial. */
export type PeriodSource = "calendario-homologado" | "legado-demonstrativo" | "institucional-b2.4";
/**
 * planejado: cadastrado, ainda sem pauta. aplicado: pauta aberta.
 * Não pressupõe que todos os lançamentos estejam encerrados.
 */
export type InstrumentStatus = "planejado" | "aplicado";

/** Colocação acadêmica do aluno, derivada da trajetória existente. */
export type AcademicPlacement = {
  studentId: string;
  enrollmentId: string;
  unitId: string;
  academicLinkId: string;
  participationId: string;
  participationNature: string | null;
  allocationId: string;
  classId?: string | undefined;
  from: string | null;
  until: string | null;
};

export type EntryValue =
  | { kind: "numerica"; value: number }
  | { kind: "conceitual"; optionId: string }
  | { kind: "descritiva"; text: string }
  | { kind: "nao-registrado"; reason: string };

/** Lançamento: registro individual do aluno em um instrumento. */
export type AssessmentEntry = {
  id: string;
  instrumentId: string;
  studentId: string;
  /** Contexto acadêmico da época — não o cadastro atual. */
  placement: Pick<
    AcademicPlacement,
    "enrollmentId" | "academicLinkId" | "participationId" | "allocationId"
  >;
  value: EntryValue;
  recordedAt: string;
  recordedByAssignmentId: string;
  /** 12C — Estado do lançamento individual (independe do instrumento). */
  status?: EntryStatus;
  /** Retrato imutável do contexto acadêmico no momento do lançamento. */
  context?: EntryContextSnapshot;
  /** Versões anteriores preservadas em correções (nunca apagadas). */
  history?: EntryRevision[];
  /** 12D.1 — Autoria do lançamento original. */
  author?: AuthorshipStamp;
  /** 12D.1 — Rótulo do valor vigente na escala da época (conceitos podem ser renomeados). */
  valueLabel?: string;
  /**
   * 12E — Origem do valor. Ausente equivale a "diario". Valores administrativos
   * (ex.: "transferencia-externa") participam da composição SOMENTE quando a
   * configuração aplicável os admite; nunca são convertidos nem equiparados.
   */
  origin?: import("./assessment-composition-types").EntryOrigin;
  /** 12E — Metadados da origem administrativa, preservados sem interpretação. */
  originMetadata?: Readonly<Record<string, string>>;
};

/** rascunho: editável. registrado: somente leitura; alteração só por correção justificada. */
export type EntryStatus = "rascunho" | "registrado";

export type EntryContextSnapshot = {
  studentName: string;
  unitId: string;
  classId: string;
  classLabel: string;
  field: string;
  pedagogicalAssignmentId: string;
  professionalId: string;
  periodId: string;
  periodLabel: string;
  calendarPeriodId?: string;
  instrumentTypeLabel: string;
  appliedOn: string;
  periodSource: PeriodSource;
  /** 12D.1 — Identidade do componente e configuração da época. */
  curriculumRef?: CurriculumRef;
  configurationId?: string;
  configurationVersion?: number;
};

export type EntryRevision = {
  value: EntryValue;
  /** Rótulo do valor substituído, na escala da época. */
  valueLabel?: string;
  recordedAt: string;
  replacedAt: string;
  justification: string;
  /** 12D.1 — Quem corrigiu (identidade demonstrativa). */
  correctedBy?: AuthorshipStamp;
};

// ---------------------------------------------------------------- Resultado

export type ResultLevel = "instrumento" | "periodo" | "componente" | "final";

/** Resultado: informação derivada segundo uma regra. Nunca oficial nesta etapa. */
export type AssessmentResult =
  | {
      status: "sem-regra-homologada";
      level: ResultLevel;
      pendingRuleIds: string[];
      official: false;
    }
  | {
      status: "regra-nao-implementada";
      level: ResultLevel;
      ruleId: string;
      official: false;
    };

/** Situação acadêmica: sem regra homologada, é sempre indeterminada. */
export type AcademicStanding = {
  status: "nao-determinada" | "nao-aplicavel";
  reason: string;
  official: false;
};

/** Evidência de desenvolvimento (EI) que REFERENCIA registros do Diário, sem copiá-los. */
export type DevelopmentEvidenceRef = {
  id: string;
  studentId: string;
  periodId: string;
  sourceKind: "experiencia-coletiva" | "observacao-individual";
  /** ID do registro de infant-experiences.ts. */
  sourceId: string;
};

/** Fechamento: apenas identidade reservada. Não implementado. */
export type ClosingRecordPlaceholder = {
  id: string;
  periodId: string;
  classId: string;
  status: "nao-implementado";
};
