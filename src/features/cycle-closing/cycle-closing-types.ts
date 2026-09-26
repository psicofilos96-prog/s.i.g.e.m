/**
 * Etapa 12K — Encerramento Oficial do Ciclo e Turma (tipos).
 *
 * A 12K é ORQUESTRADORA DE INTEGRIDADE, não motor acadêmico: ela não calcula
 * nota, frequência, situação nem deliberação. Ela confere a cadeia declarada
 * pela política, congela as fontes e registra o ato estruturado de encerramento.
 *
 * CONFIGURABILIDADE NORMATIVA
 *   requisito configurado → avaliador registrado → resultado do diagnóstico
 * Não existe `switch (requirement.kind)`: cada requisito referencia um avaliador
 * registrado por identificador estável. Uma nova exigência institucional é
 * cadastrada como dado e atendida por um avaliador registrado, sem alterar este
 * arquivo nem o inspetor.
 *
 * IMUTABILIDADE
 * O congelamento em memória é apenas defesa da implementação atual. A garantia
 * arquitetural de imutabilidade virá da persistência append-only versionada,
 * com autorização e auditoria, quando houver backend.
 *
 * Datas trafegam em ISO interno; DD/MM/AAAA é apresentação.
 */
import type {
  FactProvenance,
  StandingValue,
} from "@/features/assessment/academic-standing-types";

// --------------------------------------------------------------- Identidade

/** Capacidade institucional. Identificador ABERTO: a rede cadastra as suas. */
export type ClosingCapability = string;

export type ClosingActor = {
  id: string;
  name: string;
  /** Rótulo humano do perfil; não governa capacidade. */
  profileLabel: string;
  capabilities: readonly ClosingCapability[];
};

export type ClosingActorStamp = {
  actorId: string;
  actorName: string;
  profileLabel: string;
  at: string;
};

export type ClosingAuditEvent = {
  at: string;
  action: string;
  actor: ClosingActorStamp;
  detail: string;
};

/**
 * Estado institucional da turma/ciclo. Identificador ABERTO: "aberto",
 * "encerrado" e "em-retificacao" são configurações atuais, não estados eternos
 * do motor.
 */
export type InstitutionalState = string;

// ------------------------------------------------------- Fontes e observações

/** Referência exata à fonte que produziu um fato, com versão preservada. */
export type ClosingSourceReference = {
  kind: string;
  id: string;
  version?: number;
  state?: string;
  materializedAt?: string;
  label?: string;
};

/**
 * Fato materializado no snapshot (ajuste 7). O snapshot guarda o VALOR e a
 * REFERÊNCIA: em 2032 uma consulta sobre 2027 não deve depender de reconstruir
 * a cadeia de objetos antigos.
 */
export type ClosingMaterializedFact = {
  factId: string;
  scopeKey: string;
  label: string;
  /** `null` = fato indisponível. Nunca substituído por zero nem presunção. */
  value: StandingValue | readonly StandingValue[] | null;
  unit?: string;
  unavailableReason?: string;
  provenance: FactProvenance;
};

/**
 * Observação genérica de uma fonte oficial, produzida por adaptadores de cada
 * módulo. O inspetor não conhece módulo algum: lê `sourceKind`, `state` e
 * dimensões abertas.
 */
export type ClosingObservation = {
  sourceKind: string;
  sourceId: string;
  version?: number;
  /** Estado declarado pela fonte (aberto). `undefined` = estado desconhecido. */
  state?: string;
  /** Dimensões abertas: ciclo, período, turma, estudante, componente, outra. */
  dimensions: Readonly<Record<string, string | undefined>>;
  materializedAt?: string;
  facts?: readonly ClosingMaterializedFact[];
  label?: string;
  note?: string;
};

/**
 * O que a cadeia esperava existir, declarado pelos próprios módulos (períodos do
 * calendário, componentes da matriz, estudantes vinculados). Permite distinguir
 * "não aplicável" de "esperado e ausente".
 */
export type ClosingExpectation = {
  sourceKind: string;
  dimensions: Readonly<Record<string, string | undefined>>;
  label: string;
};

// -------------------------------------------------------- Diagnóstico

/** Cinco estados possíveis por requisito (ajuste 4). */
export type RequirementDiagnosisStatus =
  | "satisfeito"
  | "nao-satisfeito"
  | "nao-aplicavel"
  | "inconclusivo"
  | "erro-configuracao";

export const REQUIREMENT_STATUS_LABEL: Record<RequirementDiagnosisStatus, string> = {
  satisfeito: "Satisfeito",
  "nao-satisfeito": "Não satisfeito",
  "nao-aplicavel": "Não aplicável",
  inconclusivo: "Inconclusivo",
  "erro-configuracao": "Erro de configuração",
};

export type RequirementDiagnosis = {
  requirementId: string;
  label: string;
  evaluatorId: string;
  mandatory: boolean;
  perStudent: boolean;
  studentId?: string;
  status: RequirementDiagnosisStatus;
  reason: string;
  evidence?: readonly ClosingSourceReference[];
};

export type StudentDiagnosis = {
  studentId: string;
  studentName?: string;
  status: RequirementDiagnosisStatus;
  diagnoses: readonly RequirementDiagnosis[];
  /** Situação acadêmica encontrada, quando existir. Pode legitimamente faltar. */
  terminalStandingId?: string;
  reason: string;
};

export type ClosingDiagnosis = {
  policyId: string;
  policyVersion: number;
  evaluatedAt: string;
  classRequirements: readonly RequirementDiagnosis[];
  students: readonly StudentDiagnosis[];
  counts: Record<RequirementDiagnosisStatus, number>;
  /** "100%" = todos os requisitos OBRIGATÓRIOS e APLICÁVEIS satisfeitos. */
  applicableMandatory: number;
  satisfiedMandatory: number;
  closable: boolean;
  impediments: readonly string[];
};

// ------------------------------------------------------------ Requisitos

/**
 * Requisito configurado. `evaluatorId` referencia um avaliador REGISTRADO; não
 * existe enumeração normativa de exigências no motor.
 */
export type ClosingRequirement = {
  id: string;
  label: string;
  evaluatorId: string;
  mandatory: boolean;
  /** Estrutural, não institucional: o requisito é apurado por estudante? */
  perStudent: boolean;
  description?: string;
  parameters?: Readonly<Record<string, StandingValue | readonly StandingValue[]>>;
  note?: string;
};

// ------------------------------------------ Admissibilidade de operações

export type OperationAdmissibility = "permitida" | "vedada" | "exige-rito";

export const ADMISSIBILITY_LABEL: Record<OperationAdmissibility, string> = {
  permitida: "Permitida",
  vedada: "Vedada",
  "exige-rito": "Exige rito formal de retificação ou reabertura",
};

/**
 * Matriz governável (ajuste 6): operationId × institutionalState →
 * admissibilidade. Módulos futuros participam do regime de encerramento
 * cadastrando operações, sem alterar o núcleo da 12K.
 */
export type OperationAdmissibilityRule = {
  operationId: string;
  label: string;
  institutionalStates: readonly InstitutionalState[];
  admissibility: OperationAdmissibility;
  requiredCapabilities?: readonly ClosingCapability[];
  note?: string;
};

export type OperationAdmissibilityPolicy = {
  id: string;
  label: string;
  rules: readonly OperationAdmissibilityRule[];
  /** Admissibilidade quando nenhuma regra cadastrada alcança a operação. */
  fallback: OperationAdmissibility;
  note?: string;
};

// --------------------------------------------------------------- Política

export type CycleClosingPolicyStatus = "rascunho" | "em-revisao" | "homologada" | "arquivada";

export const CLOSING_POLICY_STATUS_LABEL: Record<CycleClosingPolicyStatus, string> = {
  rascunho: "Rascunho — sem valor institucional",
  "em-revisao": "Em revisão institucional",
  homologada: "Homologada",
  arquivada: "Arquivada",
};

export type CycleClosingPolicy = {
  id: string;
  version: number;
  label: string;
  description?: string;
  status: CycleClosingPolicyStatus;
  scope: {
    academicYearId?: string;
    unitIds?: readonly string[];
    classIds?: readonly string[];
    cycleKindIds?: readonly string[];
  };
  requirements: readonly ClosingRequirement[];
  /**
   * Situação acadêmica terminal (ajuste 3). Ausente = a política NÃO exige
   * situação terminal, e o percurso pode encerrar legitimamente sem ela.
   * Nenhuma situação é inventada para satisfazer o encerramento.
   */
  terminalStandingRequirement?: {
    required: boolean;
    acceptedStandingIds?: readonly string[];
    note?: string;
  };
  /** Ausente = a política não exige resolução de todos os percursos. */
  cohortCompletionPolicy?: { requiresAllStudentsResolved: boolean; note?: string };
  admissibilityPolicy?: OperationAdmissibilityPolicy;
  rectificationPolicy?: {
    requiresJustification: boolean;
    requiredCapabilities?: readonly ClosingCapability[];
    note?: string;
  };
  /** Capacidades exigidas para lavrar o ato de encerramento. */
  closingCapabilities?: readonly ClosingCapability[];
  audit: { events: readonly ClosingAuditEvent[]; demonstrative: boolean };
  note?: string;
};

// --------------------------------------------------- Registros do encerramento

export type StudentCycleClosingRecord = {
  studentId: string;
  studentName?: string;
  cycleId: string;
  /**
   * Origem institucional da resolução (ajuste 2). Identificador ABERTO e
   * cadastrável: regra acadêmica, movimentação, deliberação e percurso
   * qualitativo são configurações atuais, não enumeração eterna.
   */
  resolutionSourceTypeId?: string;
  /** Opcional (ajuste 3): a política pode não exigir situação terminal. */
  terminalStandingId?: string;
  completeness: RequirementDiagnosisStatus;
  reason: string;
  diagnoses: readonly RequirementDiagnosis[];
  facts: readonly ClosingMaterializedFact[];
  sources: readonly ClosingSourceReference[];
  note?: string;
};

/**
 * Ato estruturado de encerramento (ajuste 10). Não é documento: o "Termo de
 * Encerramento" visual, com layout, A4 e PDF, é representação deste registro
 * produzida no Capítulo 15.
 */
export type ClosingActRecord = {
  id: string;
  /** Natureza do ato: identificador aberto, cadastrável. */
  kindId: string;
  kindLabel: string;
  declaredAt: string;
  declaredBy: ClosingActorStamp;
  justification?: string;
  supersedesClosingId?: string;
  note?: string;
};

export type ClassCycleClosingSnapshot = {
  id: string;
  version: number;
  precedingClosingId?: string;
  classId: string;
  cycleId: string;
  unitId?: string;
  academicYearId?: string;
  /**
   * Intervalo temporal do ciclo, em ISO. Genérico por construção: a cadeia não
   * depende do conceito de "ano" e atende ciclos que não coincidem com ano civil
   * ou letivo. `academicYearId` permanece apenas quando existir.
   */
  cycleStartDate?: string;
  cycleEndDate?: string;
  policyId: string;
  policyVersion: number;
  institutionalState: InstitutionalState;
  act: ClosingActRecord;
  diagnosis: ClosingDiagnosis;
  students: readonly StudentCycleClosingRecord[];
  /** Referências exatas das fontes usadas (versão e data preservadas). */
  sources: readonly ClosingSourceReference[];
  /** Fatos materializados: o snapshot é autossuficiente para consulta futura. */
  facts: readonly ClosingMaterializedFact[];
  materializedAt: string;
};

export const CYCLE_CLOSING_MODULE_LABEL = "Encerramento oficial do ciclo e da turma";

export const CYCLE_CLOSING_MODULE_NOTE =
  "O encerramento não calcula nota, frequência, situação nem deliberação: ele confere a cadeia exigida pela política configurada, exibe cada exigência com seu estado por extenso e, quando tudo o que é obrigatório e aplicável estiver satisfeito, lavra o ato estruturado de encerramento com um retrato imutável das fontes e das versões utilizadas. Requisito ausente nunca é presumido como atendido, e nenhuma situação acadêmica é inventada para permitir o encerramento.";
