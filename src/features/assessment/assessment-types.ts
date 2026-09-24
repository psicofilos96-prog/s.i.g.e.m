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
};

/** Colocação acadêmica do aluno, derivada da trajetória existente. */
export type AcademicPlacement = {
  studentId: string;
  enrollmentId: string;
  unitId: string;
  academicLinkId: string;
  participationId: string;
  participationNature: string;
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
