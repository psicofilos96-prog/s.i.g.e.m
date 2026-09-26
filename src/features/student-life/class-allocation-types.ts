/**
 * Etapa 13C — Enturmação, Alocação Temporal e Movimentações (contratos).
 *
 * CADEIA CONCEITUAL
 *   [13A] PESSOA → ALUNO → VÍNCULO COM A UNIDADE
 *   → [13B] INSCRIÇÃO LETIVA → [13B] PARTICIPAÇÃO EDUCACIONAL
 *   → [13C] ALOCAÇÃO EM TURMA  → [13D] TRANSFERÊNCIA INSTITUCIONAL
 *
 * PRINCÍPIOS DESTE CONTRATO
 * - Enturmação NÃO é atributo do aluno nem da turma: é RELAÇÃO TEMPORAL entre
 *   uma participação educacional e uma turma. Não existe `student.classId`.
 * - `AcademicClass` carrega IDENTIDADE e CONFIGURAÇÃO ESTRUTURAL da turma.
 *   Capacidade NÃO mora nela: `ClassCapacityRecord` é entidade temporal própria,
 *   com vigência, versão e proveniência, permitindo responder "qual era a
 *   capacidade oficial desta turma em 15/03/2027?".
 * - Nenhum comportamento normativo é booleano do motor: excedente, bloqueio,
 *   exigência de ato e autorização são EFEITOS CONFIGURADOS resolvidos pela
 *   cadeia fato → requisito → avaliador → efeito institucional.
 * - Reserva de vagas é DEFINIÇÃO própria (quantidade, natureza, política
 *   instituidora, vigência, público), nunca um número solto.
 * - `studentId`, `schoolId` e `cycleEnrollmentId` materializados na alocação são
 *   DENORMALIZAÇÕES CONTROLADAS, validadas contra a cadeia canônica
 *   `allocation → participation → enrollment → student/school`. Jamais fonte
 *   concorrente de verdade.
 * - Apenas a referência retrospectiva da retificação é gravada
 *   (`supersedesAllocationId`); "quem me superou" é PROJEÇÃO da cadeia.
 * - O motor não presume semântica temporal: não existe `effectiveDate - 1 dia`
 *   nativo. A relação entre saída e entrada é definida por política temporal.
 * - Eventos usam o contrato aberto da 13A (`eventTypeDefinitionId` +
 *   `payloadSchemaDefinitionId`); nenhum tipo de evento é conhecido pelo motor.
 * - Datas trafegam em ISO (aaaa-mm-dd); DD/MM/AAAA é apresentação.
 */
import type {
  InstitutionalActReference,
  InstitutionalIdentifier,
  InternalId,
  StudentLifeProvenance,
} from "./student-life-types";
import type {
  RequirementEffectDefinition,
  RequirementEvaluationStatus,
  VersionedDefinitionReference,
} from "./cycle-enrollment-types";

export const CLASS_ALLOCATION_SCHEMA_VERSION = 1;

// ------------------------------------------------------------------ Vigência

/** Vigência pura: início e fim. Nenhuma causa institucional mora aqui. */
export type AllocationValidity = {
  validFrom: string;
  /** `null` = em curso. Sem semântica de motivo, rito ou ato. */
  validUntil: string | null;
};

// -------------------------------------------------------------------- Turma

/**
 * Turma canônica: UNIDADE OPERACIONAL de atendimento. Referencia apenas IDs
 * estáveis — nunca ano civil, rótulo de série, texto de turno ou de jornada.
 *
 * NÃO possui capacidade, ocupação, contagem de alunos nem situação derivada:
 * capacidade é entidade própria e ocupação é projeção das alocações vigentes.
 */
export type AcademicClass = {
  classId: InternalId;
  institutionalIdentifier?: InstitutionalIdentifier;

  schoolId: string;
  /** Estrutura TEMPORAL do atendimento (ciclo já resolvido, como na 12H/13B). */
  academicCycleId: string;
  /** SERVIÇO educacional ofertado. */
  educationalOfferId: string;
  /** POSIÇÃO/agrupamento curricular predominante, quando a oferta o define. */
  academicOrganizationId?: string;
  /** Recorte de horário, declarado por definição configurada. */
  shiftDefinitionId: string;
  /** Organização do tempo escolar, declarada por definição configurada. */
  journeyDefinitionId: string;
  /** Estruturas curriculares aplicáveis: zero, uma ou várias. */
  curriculumMatrixIds: readonly string[];

  /** Estado configurado da turma (máquina própria, declarada em dado). */
  classStateDefinitionId: string;
  classStateReasonDefinitionId?: string;

  validity: AllocationValidity;

  recordVersion: number;
  supersedesClassId?: InternalId | null;
  sourceEventIds: readonly InternalId[];
  provenance: StudentLifeProvenance;
};

/**
 * AGRUPAMENTO INTERNO da turma: subconjunto/posição acadêmica atendida DENTRO
 * de uma única turma. Permite representar turma multietapa/multisseriada
 *
 *   Turma X ├── 3º ano ├── 4º ano └── 5º ano
 *
 * sem fingir que existem três turmas. O aluno é alocado à TURMA e
 * CONTEXTUALIZADO no agrupamento.
 */
export type ClassGroupingDefinition = {
  groupingId: InternalId;
  classId: InternalId;
  labelSnapshot: string;
  /** Posição curricular representada pelo agrupamento, quando declarada. */
  academicOrganizationId?: string;
  /** Matrizes específicas do agrupamento, quando diferirem das da turma. */
  curriculumMatrixIds?: readonly string[];
  validity: AllocationValidity;
  provenance: StudentLifeProvenance;
};

// ---------------------------------------------------------------- Capacidade

/**
 * Capacidade APLICÁVEL à turma em determinada vigência. Entidade temporal
 * própria: 25 vagas em fevereiro e 28 em maio são dois registros, e o histórico
 * de fevereiro nunca é reescrito.
 */
export type ClassCapacityRecord = {
  capacityRecordId: InternalId;
  classId: InternalId;
  /** Limite de referência declarado para a vigência. */
  referenceLimit: number;
  /** Fundamento da capacidade (aberto): sala utilizada, ato, política, norma… */
  basisDefinitionId?: string;
  /** Política de capacidade vigente no ato, com versão preservada. */
  policy: VersionedDefinitionReference;
  validity: AllocationValidity;
  /** Ato institucional que fixou ou alterou a capacidade, quando houver. */
  act?: InstitutionalActReference;
  recordVersion: number;
  supersedesCapacityRecordId?: InternalId | null;
  sourceEventIds: readonly InternalId[];
  provenance: StudentLifeProvenance;
};

/**
 * Reserva de vagas como DEFINIÇÃO estruturada: quantidade, natureza, política
 * instituidora, vigência e, quando houver, público/critério associado.
 * A 13C não institui cotas nem prioridades: apenas permite representá-las.
 */
export type CapacityQuotaReservation = {
  reservationId: InternalId;
  classId: InternalId;
  /** Registro de capacidade a que a reserva se refere, quando vinculada. */
  capacityRecordId?: InternalId;
  quantity: number;
  /** Natureza da reserva (aberta): reserva técnica, judicial, prioridade… */
  reservationNatureDefinitionId: string;
  /** Política que instituiu a reserva, com versão preservada. */
  institutingPolicy: VersionedDefinitionReference;
  /** Público/critério associado, quando a política o declarar. */
  audienceCriterionDefinitionId?: string;
  validity: AllocationValidity;
  act?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

/**
 * Requisito declarativo de capacidade. O motor apenas executa o avaliador
 * registrado e resolve o EFEITO configurado: bloquear, exigir ato, permitir,
 * encaminhar autorização ou qualquer efeito futuro — sem novos booleanos.
 */
export type AllocationRequirementDefinition = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  evaluatorId: string;
  /** Processos originadores aos quais se aplica; vazio = todos. */
  appliesToProcessKindIds?: readonly string[];
  effectByStatus: Readonly<Partial<Record<RequirementEvaluationStatus, string>>>;
  defaultEffectDefinitionId?: string;
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
};

export type AllocationRequirementPolicy = {
  policyId: string;
  policyVersion: number;
  requirements: readonly AllocationRequirementDefinition[];
  effects: readonly RequirementEffectDefinition[];
};

// ------------------------------------------------------------ Cardinalidade

/**
 * Cardinalidade de alocações simultâneas DA MESMA PARTICIPAÇÃO, por natureza
 * configurada. O motor não presume "um aluno = uma turma".
 */
export type AllocationCardinalityRule = {
  ruleId: string;
  /** Natureza da participação (13A) à qual a regra se aplica. */
  natureDefinitionId: string;
  /**
   * Máximo de alocações simultâneas da MESMA participação.
   * `null` = sem limite declarado pela política.
   */
  maxSimultaneousAllocations: number | null;
  note?: string;
};

export type AllocationCardinalityPolicy = {
  policyId: string;
  policyVersion: number;
  rules: readonly AllocationCardinalityRule[];
  /** Natureza não declarada: a política decide; o motor nunca autoriza por omissão. */
  undeclaredNatureStateId: "allow" | "deny" | "inconclusive";
};

// ----------------------------------------------------- Compatibilidade

/** Dimensão comparável entre o contexto da participação e o da turma. */
export type AllocationComparableDimensionId =
  | "schoolId"
  | "academicCycleId"
  | "educationalOfferId"
  | "academicOrganizationId"
  | "groupingId";

/**
 * Declaração de qual dimensão é comparada e qual efeito a divergência produz.
 * Ausência de dado em qualquer lado deixa a dimensão INCONCLUSIVA — nunca
 * satisfeita por omissão.
 */
export type AllocationCompatibilityRequirement = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  dimensionId: AllocationComparableDimensionId;
  effectByStatus: Readonly<Partial<Record<RequirementEvaluationStatus, string>>>;
};

export type AllocationCompatibilityPolicy = {
  policyId: string;
  policyVersion: number;
  requirements: readonly AllocationCompatibilityRequirement[];
  effects: readonly RequirementEffectDefinition[];
};

// ------------------------------------------------- Política temporal

/**
 * Semântica temporal da transição entre alocações, DECLARADA pela rede.
 * O motor não sabe se a saída ocorre no dia anterior, no mesmo dia, se o fim da
 * vigência é inclusivo ou se origem e destino podem coexistir na data.
 */
export type AllocationTimingBoundaryDefinition = {
  boundaryDefinitionId: string;
  labelSnapshot: string;
  /**
   * Deslocamento, em dias, aplicado à data de eficácia da entrada para compor o
   * fim da vigência da origem. `0` encerra na própria data de eficácia.
   */
  originClosureOffsetDays: number;
  /** A data resultante ainda PERTENCE à vigência da origem? */
  originClosureInclusive: boolean;
  /** Origem e destino podem coexistir na data de eficácia? */
  allowsSameDateCoexistence: boolean;
};

export type AllocationTimingPolicy = {
  policyId: string;
  policyVersion: number;
  boundaries: readonly AllocationTimingBoundaryDefinition[];
  /** Semântica adotada pela rede; ausente = motor devolve inconclusivo. */
  activeBoundaryDefinitionId?: string;
};

// ------------------------------------------------------------- Alocação

/**
 * Enquadramento histórico congelado no ato da alocação: quais definições, em
 * quais versões, sustentaram aquele ato institucional.
 */
export type AllocationDefinitionSnapshot = {
  academicClass: VersionedDefinitionReference;
  grouping?: VersionedDefinitionReference;
  curriculumMatrices: readonly VersionedDefinitionReference[];
  capacityRecord?: VersionedDefinitionReference;
  cardinalityPolicy: VersionedDefinitionReference;
  compatibilityPolicy: VersionedDefinitionReference;
  timingPolicy: VersionedDefinitionReference;
  requirementPolicy?: VersionedDefinitionReference;
};

/**
 * Referências materializadas por conveniência de consulta e analítica.
 * São DENORMALIZAÇÕES CONTROLADAS: precisam ser validadas contra a cadeia
 * canônica e nunca podem divergir dela.
 */
export type AllocationDenormalizedReferences = {
  cycleEnrollmentId: InternalId;
  studentId: InternalId;
  schoolId: string;
};

/**
 * ALOCAÇÃO EM TURMA: liga temporalmente uma `CycleParticipation` a uma
 * `AcademicClass`, preservando identidade, vigência, snapshot e proveniência.
 * Mover NÃO é alterar `classId`: é encerrar uma alocação e constituir outra.
 */
export type ClassAllocation = {
  allocationId: InternalId;
  institutionalIdentifier?: InstitutionalIdentifier;

  /** Fonte canônica da relação. */
  participationId: InternalId;
  classId: InternalId;
  /** Contextualização no agrupamento interno da turma, quando houver. */
  groupingId?: InternalId;

  /** Denormalizações validadas; nunca fonte independente de verdade. */
  denormalized: AllocationDenormalizedReferences;

  /** Processo originador (aberto): alocação inicial, movimentação, retorno… */
  originatingProcessKindId: string;

  /** Estado configurado da alocação (máquina própria). */
  allocationStateDefinitionId: string;
  allocationStateReasonDefinitionId?: string;

  validity: AllocationValidity;

  definitionSnapshot: AllocationDefinitionSnapshot;

  /** Ato institucional originador, quando a política o exigir. */
  originatingAct?: InstitutionalActReference;

  recordVersion: number;
  /** Somente a direção retrospectiva é gravada; a futura é projetada. */
  supersedesAllocationId?: InternalId | null;

  sourceEventIds: readonly InternalId[];
  provenance: StudentLifeProvenance;
};

// ---------------------------------------------------- Configuração da 13C

export type ClassAllocationGovernanceConfiguration = {
  configurationId: string;
  configurationVersion: number;
  /** Máquinas de estado da turma e da alocação. */
  classMachineId: string;
  allocationMachineId: string;
  /** Processos originadores declarados (aberto). */
  originatingProcesses: readonly {
    processKindId: string;
    labelSnapshot: string;
    requirementPolicyId?: string;
    requiresInstitutionalAct?: boolean;
    initialAllocationStateDefinitionId: string;
  }[];
  cardinalityPolicy: AllocationCardinalityPolicy;
  compatibilityPolicy: AllocationCompatibilityPolicy;
  timingPolicy: AllocationTimingPolicy;
  requirementPolicies: readonly AllocationRequirementPolicy[];
};
