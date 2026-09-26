/**
 * Etapa 12J — Deliberações Institucionais e Colegiados (tipos).
 *
 * INFRAESTRUTURA GENÉRICA
 * "Conselho de Classe" é UMA configuração possível desta infraestrutura, não um
 * conceito do motor. Nenhuma natureza de sessão, papel, quórum, forma de decisão,
 * assinatura, motivo de provocação ou competência decisória existe em código:
 * tudo é dado configurado, versionado e homologado pela governança da rede.
 *
 * QUATRO ENTIDADES SEPARADAS (ajuste 5)
 *   1. SESSÃO      — a reunião do colegiado (pode não deliberar sobre ninguém);
 *   2. PAUTA       — assuntos, com ou sem vínculo a estudante;
 *   3. DELIBERAÇÃO — decisão institucional sobre um item de pauta;
 *   4. ATA         — registro estruturado e imutável da sessão.
 *
 * CAMADAS DO RESULTADO (ajuste 7)
 * resultado matemático → deliberação → situação resultante. O resultado
 * calculado NUNCA é reescrito para "combinar" com a decisão do colegiado.
 *
 * Datas trafegam em ISO interno; DD/MM/AAAA é apresentação.
 */
import type {
  FactProvenance,
  StandingValue,
} from "@/features/assessment/academic-standing-types";

// --------------------------------------------------------------- Identidade

/** Capacidade institucional. Identificador ABERTO: a rede cadastra as suas. */
export type CollegialCapability = string;

export type CollegialActor = {
  id: string;
  name: string;
  /** Rótulo humano do perfil; não governa capacidade. */
  profileLabel: string;
  capabilities: readonly CollegialCapability[];
};

export type CollegialActorStamp = {
  actorId: string;
  actorName: string;
  profileLabel: string;
  at: string;
};

// ------------------------------------------- Configuração do colegiado

/**
 * Natureza da sessão (ajuste 1). Cadastro aberto: "ordinária" e "extraordinária"
 * podem existir como dado, nunca como enumeração do motor.
 */
export type SessionNature = {
  id: string;
  label: string;
  description?: string;
};

/**
 * Papel de participante exigido (ajuste 2). O motor só exige o que a
 * configuração declarar: sem `minimum`, nada é obrigatório.
 */
export type ParticipantRoleRequirement = {
  roleId: string;
  label: string;
  minimum?: number;
  maximum?: number;
  note?: string;
};

/**
 * Política de quórum (ajuste 2). Ausente = o colegiado não declara quórum, e o
 * motor não inventa nenhum mínimo.
 */
export type QuorumPolicy = {
  id: string;
  label: string;
  /** Exigência declarada em unidade livre (participantes, proporção, outra). */
  requirement?: { unit: string; minimum: number };
  note?: string;
};

/**
 * Forma de decisão (ajuste 3). `recordsVotes` declara se há votação; quando não
 * há, votos não são registrados nem presumidos.
 */
export type DecisionMethod = {
  id: string;
  label: string;
  recordsVotes: boolean;
  /**
   * Aprovação declarada como comparação sobre a apuração dos votos, quando a
   * política previr votação. Base e valor são dados, nunca constantes.
   */
  approval?: { basis: string; operator: "maior" | "maior-ou-igual"; value: number; unit?: string };
  /** Manifestações admitidas (voto, abstenção, impedimento…), abertas. */
  voteOptions?: readonly { id: string; label: string; countsAsFavorable?: boolean }[];
  note?: string;
};

/** Política de assinatura/aceite (ajuste 2). Ausente = nada é exigido. */
export type SignaturePolicy = {
  id: string;
  label: string;
  requiredRoleIds?: readonly string[];
  requiresAllPresent?: boolean;
  note?: string;
};

/**
 * Governança da provocação formal (ajuste 8). Sem política cadastrada, ninguém
 * inclui estudante em pauta por provocação: a capacidade não é presumida.
 */
export type ProvocationPolicy = {
  id: string;
  label: string;
  allowedCapabilities: readonly CollegialCapability[];
  admittedReasons: readonly {
    id: string;
    label: string;
    requiresDocument?: boolean;
    note?: string;
  }[];
  note?: string;
};

export type CollegialConfigurationStatus = "rascunho" | "em-revisao" | "homologada" | "arquivada";

export const COLLEGIAL_STATUS_LABEL: Record<CollegialConfigurationStatus, string> = {
  rascunho: "Rascunho — sem valor institucional",
  "em-revisao": "Em revisão institucional",
  homologada: "Homologada",
  arquivada: "Arquivada",
};

export type CollegialAuditEvent = {
  at: string;
  action: string;
  actor: CollegialActorStamp;
  detail: string;
};

/**
 * Configuração de um colegiado. Homologada, torna-se imutável: alteração gera
 * nova versão e não reescreve sessões nem atas históricas.
 *
 * A COMPETÊNCIA DECISÓRIA NÃO MORA AQUI (ajuste 12): quando a decisão produz
 * situação acadêmica, a competência é a declarada pela regra de situação
 * homologada (12I). A existência documental de um colegiado não lhe atribui
 * poder algum.
 */
export type CollegialBodyConfiguration = {
  id: string;
  version: number;
  label: string;
  description?: string;
  status: CollegialConfigurationStatus;
  scope: {
    academicYearId?: string;
    unitIds?: readonly string[];
    classIds?: readonly string[];
    cycleKindIds?: readonly string[];
  };
  sessionNatures: readonly SessionNature[];
  requiredParticipantRoles: readonly ParticipantRoleRequirement[];
  quorumPolicy?: QuorumPolicy;
  decisionMethod?: DecisionMethod;
  signaturePolicy?: SignaturePolicy;
  provocationPolicy?: ProvocationPolicy;
  /** Capacidades exigidas para conduzir a sessão e encerrar a ata. */
  conductCapabilities?: readonly CollegialCapability[];
  audit: { events: readonly CollegialAuditEvent[]; demonstrative: boolean };
  note?: string;
};

// ---------------------------------------------------------------- Dossiê

/** Versão exata de uma fonte oficial usada na decisão (ajuste 6). */
export type DossierSourceReference = {
  kind: string;
  id: string;
  version?: number;
  materializedAt?: string;
  label?: string;
};

export type DossierFactEntry = {
  factId: string;
  scopeKey: string;
  label: string;
  /** `null` = fato indisponível. Nunca substituído por zero. */
  value: StandingValue | readonly StandingValue[] | null;
  unit?: string;
  unavailableReason?: string;
  provenance: FactProvenance;
};

/**
 * Dossiê congelado no momento em que o colegiado analisou o caso. Retificação
 * posterior das fontes não altera o que foi efetivamente analisado.
 */
export type DeliberationDossier = {
  referenceSnapshotAt: string;
  sources: readonly DossierSourceReference[];
  facts: readonly DossierFactEntry[];
  /** Resultado matemático preservado como camada própria (ajuste 7). */
  computed?: {
    standingId: string | null;
    operationalState: string;
    ruleSetId?: string;
    ruleSetVersion?: number;
  };
  note?: string;
};

/** Divergência entre o dossiê analisado e o estado atual das fontes. */
export type DossierDivergence = {
  source: DossierSourceReference;
  currentVersion?: number;
  message: string;
};

// ----------------------------------------------------------------- Pauta

/**
 * Origem do item de pauta. Encaminhamento por regra vem da própria regra de
 * situação (12I); provocação formal exige política; pauta institucional não
 * trata de estudante algum.
 */
export type AgendaOrigin =
  | {
      kind: "encaminhamento-por-regra";
      ruleSetId: string;
      ruleSetVersion: number;
      stepId?: string;
      bodyId: string;
      competenceId: string;
      note?: string;
    }
  | {
      kind: "provocacao-formal";
      policyId: string;
      reasonId: string;
      requestedBy: CollegialActorStamp;
      justification: string;
      documentRefs?: readonly string[];
    }
  | { kind: "pauta-institucional"; note?: string };

export type SessionAgendaItem = {
  id: string;
  order: number;
  title: string;
  description?: string;
  /** Assunto de tipo aberto; `studentId` só existe quando o item o tiver. */
  subject: { kind: string; studentId?: string; studentName?: string; note?: string };
  origin: AgendaOrigin;
  dossier?: DeliberationDossier;
};

// --------------------------------------------------------------- Sessão

export type SessionOperationalState = "agendada" | "em-andamento" | "concluida";

export const SESSION_STATE_LABEL: Record<SessionOperationalState, string> = {
  agendada: "Agendada",
  "em-andamento": "Em andamento",
  concluida: "Concluída com ata encerrada",
};

export type SessionParticipant = {
  id?: string;
  name: string;
  roleId?: string;
  roleLabel?: string;
  present: boolean;
  /** Motivo da ausência, quando registrado. */
  note?: string;
};

export type CollegialSession = {
  id: string;
  bodyId: string;
  bodyConfigurationVersion: number;
  natureId: string;
  scope: {
    academicYearId?: string;
    unitId?: string;
    classId?: string;
    cycleId?: string;
    note?: string;
  };
  convokedAt?: string;
  scheduledFor: string;
  openedAt?: string;
  closedAt?: string;
  state: SessionOperationalState;
  participants: readonly SessionParticipant[];
  agenda: readonly SessionAgendaItem[];
  createdBy: CollegialActorStamp;
  note?: string;
};

// ---------------------------------------------------------- Deliberação

export type CollegialVote = {
  participantId?: string;
  participantName: string;
  /** Identificador da manifestação declarada pela política (aberto). */
  optionId: string;
  note?: string;
};

/**
 * Deliberação institucional sobre um item de pauta. Pode ou não produzir
 * situação acadêmica: quando produz, a competência vem da regra homologada e a
 * situação resultante é registrada ao lado — nunca em lugar — do resultado
 * matemático.
 */
export type CollegialDeliberation = {
  id: string;
  sessionId: string;
  agendaItemId: string;
  bodyId: string;
  competenceId: string;
  competenceLabel: string;
  /** Preenchido só quando o item de pauta trata de um estudante. */
  studentId?: string;
  cycleId?: string;
  scopeKey?: string;
  decisionMethodId?: string;
  votes?: readonly CollegialVote[];
  /** Camada 3: a decisão. `standingId` ausente = não altera situação. */
  decision: { outcomeId: string; outcomeLabel: string; standingId?: string; note?: string };
  rationale: string;
  dossier: DeliberationDossier;
  actor: CollegialActorStamp;
  at: string;
  documentRefs?: readonly string[];
};

// ------------------------------------------------------------------ Ata

export type MinuteStatement = {
  id: string;
  at: string;
  authorName: string;
  authorRoleId?: string;
  text: string;
};

export type MinuteSignature = {
  participantId?: string;
  name: string;
  roleId?: string;
  kind: string;
  acceptedAt: string;
};

/**
 * Ata ESTRUTURADA (ajustes 9 e 10): dado atômico, sem layout, cabeçalho, A4 nem
 * PDF — isso é Capítulo 15. Ata encerrada é imutável; correção posterior gera
 * nova versão encadeada por `precedingMinuteId`.
 */
export type StructuredMinute = {
  id: string;
  sessionId: string;
  version: number;
  precedingMinuteId?: string;
  bodyId: string;
  bodyConfigurationVersion: number;
  natureId: string;
  openedAt: string;
  closedAt: string;
  participants: readonly SessionParticipant[];
  agenda: readonly SessionAgendaItem[];
  deliberations: readonly CollegialDeliberation[];
  statements: readonly MinuteStatement[];
  signatures: readonly MinuteSignature[];
  quorum: { policyId?: string; satisfied: boolean | null; reason: string };
  closedBy: CollegialActorStamp;
  rectification?: {
    justification: string;
    authorizedBy: CollegialActorStamp;
    supersedesMinuteId: string;
  };
  documentRefs?: readonly string[];
  note?: string;
};

export const COLLEGIAL_MODULE_LABEL = "Colegiados e deliberações institucionais";

export const COLLEGIAL_MODULE_NOTE =
  "Sessão, pauta, deliberação e ata são registros distintos. Composição obrigatória, quórum, forma de decisão, assinatura e provocação formal só são exigidos quando a configuração do colegiado os declarar. A competência para produzir situação acadêmica vem exclusivamente da regra de situação homologada: a existência documental de um colegiado não lhe atribui poder algum. O resultado calculado permanece intacto — a deliberação é registrada como camada própria.";
