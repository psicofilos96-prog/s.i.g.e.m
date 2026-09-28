/**
 * Etapa 6D.3.1 — Versionamento imutável do RESULTADO AVALIATIVO.
 *
 * Princípio estrutural (mesmo já congelado em 6D.1 e 6D.2): cada versão é um
 * FATO independente e encadeado. A versão vigente não guarda o próprio passado:
 * ela APONTA para a versão que substituiu (`supersedesVersionId`). O histórico é
 * projeção derivada da cadeia — nunca um `history[]` dentro do objeto vigente.
 *
 * Invariantes:
 * - A entidade é RESULTADO AVALIATIVO, não "nota": `EntryValue` preserva as
 *   quatro naturezas do domínio (numérica, conceitual, descritiva e não
 *   registrado). Nenhuma delas é privilegiada e não há conversão entre elas.
 * - Ausência NUNCA é zero: "não registrado" é fato epistêmico com motivo
 *   declarado, e não existe "ausência justificada" como categoria universal.
 * - Atributos de retificação pertencem ao ATO (`AssessmentRectificationAct`),
 *   que só existe na versão que substitui outra.
 * - Versão registrada é imutável: corrige-se criando a versão seguinte.
 * - Estado da cadeia (vigente, substituída, quantidade) é sempre projeção.
 */
import type {
  AcademicPlacement,
  EntryContextSnapshot,
  EntryValue,
  AuthorshipStamp,
} from "./assessment-types";
import type { EntryOrigin } from "./assessment-composition-types";

/** rascunho: trabalho em andamento. registrado: fato oficial imutável. */
export type AssessmentEntryVersionStatus = "rascunho" | "registrado";

/** Capacidades institucionais são identificadores ABERTOS, declarados por configuração. */
export type AssessmentCapability = string;

/**
 * Aspectos que podem mudar entre duas versões. Identificadores abertos: o motor
 * não fecha a lista, e "valor" não significa "nota".
 */
export type AssessmentChangeAspect = string;

export const ASSESSMENT_CHANGE_ASPECTS = {
  /** Mudou a natureza do resultado (ex.: não registrado → conceitual). */
  valueKind: "natureza-do-resultado",
  /** Mudou o valor dentro da mesma natureza. */
  value: "resultado-registrado",
  /** Mudou o motivo declarado de "não registrado". */
  missingReason: "motivo-da-ausencia-de-registro",
  /** Mudou a origem administrativa declarada do valor. */
  origin: "origem-do-resultado",
} as const;

/**
 * Ato de retificação: existe SOMENTE na versão que substitui outra. Guarda a
 * proveniência normativa que tornou aquela correção admissível, permitindo
 * explicar a correção depois sem reabrir a regra.
 */
export type AssessmentRectificationAct = {
  actedAt: string;
  agentId: string;
  /** Regra vigente no momento da retificação. */
  policyId: string;
  policyVersion: number;
  policyLabel: string;
  /** Exigências efetivamente projetadas pela regra e atendidas no ato. */
  satisfiedRequirements: readonly { code: string; label: string; provenance: string }[];
  justification?: string;
  /** Aspectos que efetivamente mudaram em relação à versão substituída. */
  changedAspects: readonly AssessmentChangeAspect[];
  /** Fechamento de período consultado, quando havia um vigente. */
  consultedClosing?: { closingId: string; closingVersion: number; periodLabel: string };
  /** Capacidades exercidas no ato, quando a regra as exigiu. */
  exercisedCapabilities?: readonly AssessmentCapability[];
};

/**
 * Versão autônoma do resultado avaliativo de um estudante em um instrumento.
 * `logicalEntryId` é a identidade estável do resultado ao longo das versões.
 */
export type AssessmentEntryVersion = {
  id: string;
  logicalEntryId: string;
  version: number;
  /** Versão substituída por esta. Ausente na primeira versão. */
  supersedesVersionId?: string;
  instrumentId: string;
  studentId: string;
  /** Contexto acadêmico da época — nunca o cadastro atual. */
  placement: Pick<
    AcademicPlacement,
    "enrollmentId" | "academicLinkId" | "participationId" | "allocationId"
  >;
  value: EntryValue;
  /** Rótulo do valor na escala DA ÉPOCA (conceitos podem ser renomeados depois). */
  valueLabel?: string;
  status: AssessmentEntryVersionStatus;
  recordedAt: string;
  recordedByAssignmentId: string;
  recordedBy?: AuthorshipStamp;
  /** Retrato imutável do contexto acadêmico no momento do lançamento. */
  context?: EntryContextSnapshot;
  /** Ausente equivale a "diario". Origens administrativas não são convertidas. */
  origin?: EntryOrigin;
  originMetadata?: Readonly<Record<string, string>>;
  /** Presente apenas quando esta versão nasceu de uma retificação. */
  rectification?: AssessmentRectificationAct;
};

/** Identidade lógica canônica do resultado: instrumento + estudante. */
export function assessmentLogicalEntryId(instrumentId: string, studentId: string): string {
  return `res-${instrumentId}-${studentId}`;
}

// ---------------------------------------------------------------------------
// Projeções derivadas da cadeia
// ---------------------------------------------------------------------------

/** Cadeia ordenada (v1 → vN) do resultado lógico. */
export function assessmentEntryChain(
  versions: readonly AssessmentEntryVersion[],
  logicalEntryId: string,
): AssessmentEntryVersion[] {
  return versions
    .filter((item) => item.logicalEntryId === logicalEntryId)
    .sort((a, b) => a.version - b.version);
}

/** Versão vigente: a última da cadeia que não foi substituída por outra. */
export function currentAssessmentEntryVersion(
  versions: readonly AssessmentEntryVersion[],
  logicalEntryId: string,
): AssessmentEntryVersion | undefined {
  const chain = assessmentEntryChain(versions, logicalEntryId);
  const superseded = new Set(
    chain.map((item) => item.supersedesVersionId).filter((id): id is string => Boolean(id)),
  );
  return [...chain].reverse().find((item) => !superseded.has(item.id));
}

export function isCurrentAssessmentEntryVersion(
  versions: readonly AssessmentEntryVersion[],
  versionId: string,
): boolean {
  const target = versions.find((item) => item.id === versionId);
  if (!target) return false;
  return currentAssessmentEntryVersion(versions, target.logicalEntryId)?.id === versionId;
}

/** Linha do histórico: derivada da cadeia, nunca persistida. */
export type AssessmentEntryHistoryLine = {
  versionId: string;
  version: number;
  status: AssessmentEntryVersionStatus;
  current: boolean;
  value: EntryValue;
  valueLabel?: string;
  recordedAt: string;
  supersedesVersionId?: string;
  rectification?: AssessmentRectificationAct;
};

export function assessmentEntryHistory(
  versions: readonly AssessmentEntryVersion[],
  logicalEntryId: string,
): AssessmentEntryHistoryLine[] {
  const chain = assessmentEntryChain(versions, logicalEntryId);
  const currentId = currentAssessmentEntryVersion(versions, logicalEntryId)?.id;
  return chain.map((item) => ({
    versionId: item.id,
    version: item.version,
    status: item.status,
    current: item.id === currentId,
    value: item.value,
    recordedAt: item.recordedAt,
    ...(item.valueLabel ? { valueLabel: item.valueLabel } : {}),
    ...(item.supersedesVersionId ? { supersedesVersionId: item.supersedesVersionId } : {}),
    ...(item.rectification ? { rectification: item.rectification } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Detecção semântica de mudança factual
// ---------------------------------------------------------------------------

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

/**
 * Comparação SEMÂNTICA entre dois resultados, em cada uma das quatro naturezas.
 * Naturezas diferentes são sempre resultados diferentes: não há equivalência
 * entre ausência de registro e valor, nem entre conceito e número.
 */
export function sameAssessmentValue(base: EntryValue, next: EntryValue): boolean {
  if (base.kind !== next.kind) return false;
  if (base.kind === "numerica" && next.kind === "numerica") return base.value === next.value;
  if (base.kind === "conceitual" && next.kind === "conceitual")
    return base.optionId === next.optionId;
  if (base.kind === "descritiva" && next.kind === "descritiva")
    return normalizeText(base.text) === normalizeText(next.text);
  if (base.kind === "nao-registrado" && next.kind === "nao-registrado")
    return normalizeText(base.reason) === normalizeText(next.reason);
  return false;
}

export type AssessmentValueDeltaInput = {
  value: EntryValue;
  origin?: EntryOrigin;
};

/**
 * Aspectos que mudaram entre o resultado vigente e o proposto.
 * Lista vazia significa: nenhuma nova versão deve existir.
 */
export function assessmentValueDelta(
  base: AssessmentValueDeltaInput,
  next: AssessmentValueDeltaInput,
): AssessmentChangeAspect[] {
  const aspects: AssessmentChangeAspect[] = [];
  if (base.value.kind !== next.value.kind) aspects.push(ASSESSMENT_CHANGE_ASPECTS.valueKind);
  else if (!sameAssessmentValue(base.value, next.value))
    aspects.push(
      base.value.kind === "nao-registrado"
        ? ASSESSMENT_CHANGE_ASPECTS.missingReason
        : ASSESSMENT_CHANGE_ASPECTS.value,
    );
  const baseOrigin = base.origin ?? "diario";
  const nextOrigin = next.origin ?? "diario";
  if (baseOrigin !== nextOrigin) aspects.push(ASSESSMENT_CHANGE_ASPECTS.origin);
  return aspects;
}

export function hasAssessmentValueChanged(
  base: AssessmentValueDeltaInput,
  next: AssessmentValueDeltaInput,
): boolean {
  return assessmentValueDelta(base, next).length > 0;
}

// ---------------------------------------------------------------------------
// Construção de versões (fatos independentes e encadeados)
// ---------------------------------------------------------------------------

export function createFirstAssessmentEntryVersion(input: {
  versionId: string;
  logicalEntryId?: string;
  instrumentId: string;
  studentId: string;
  placement: AssessmentEntryVersion["placement"];
  value: EntryValue;
  valueLabel?: string;
  status: AssessmentEntryVersionStatus;
  recordedByAssignmentId: string;
  recordedBy?: AuthorshipStamp;
  context?: EntryContextSnapshot;
  origin?: EntryOrigin;
  originMetadata?: Readonly<Record<string, string>>;
  now: string;
}): AssessmentEntryVersion {
  const version: AssessmentEntryVersion = {
    id: input.versionId,
    logicalEntryId:
      input.logicalEntryId ?? assessmentLogicalEntryId(input.instrumentId, input.studentId),
    version: 1,
    instrumentId: input.instrumentId,
    studentId: input.studentId,
    placement: { ...input.placement },
    value: input.value,
    status: input.status,
    recordedAt: input.now,
    recordedByAssignmentId: input.recordedByAssignmentId,
    ...(input.valueLabel ? { valueLabel: input.valueLabel } : {}),
    ...(input.recordedBy ? { recordedBy: input.recordedBy } : {}),
    ...(input.context ? { context: input.context } : {}),
    ...(input.origin ? { origin: input.origin } : {}),
    ...(input.originMetadata ? { originMetadata: input.originMetadata } : {}),
  };
  return freezeVersion(version);
}

/**
 * Conclusão do rascunho: NÃO cria nova versão da cadeia. A transição
 * rascunho → registrado é o nascimento do fato oficial v1, e só a partir dela a
 * alteração passa a exigir retificação versionada.
 */
export function registerAssessmentEntryVersion(
  version: AssessmentEntryVersion,
  now: string,
): AssessmentEntryVersion {
  if (version.status === "registrado") return version;
  return freezeVersion({ ...version, status: "registrado", recordedAt: now });
}

export function createSupersedingAssessmentEntryVersion(input: {
  base: AssessmentEntryVersion;
  versionId: string;
  value: EntryValue;
  valueLabel?: string;
  origin?: EntryOrigin;
  originMetadata?: Readonly<Record<string, string>>;
  rectification: AssessmentRectificationAct;
  recordedBy?: AuthorshipStamp;
  now: string;
}): AssessmentEntryVersion {
  const { base } = input;
  const version: AssessmentEntryVersion = {
    id: input.versionId,
    logicalEntryId: base.logicalEntryId,
    version: base.version + 1,
    supersedesVersionId: base.id,
    instrumentId: base.instrumentId,
    studentId: base.studentId,
    // O contexto acadêmico da época é preservado, nunca recalculado.
    placement: { ...base.placement },
    value: input.value,
    status: "registrado",
    recordedAt: input.now,
    recordedByAssignmentId: base.recordedByAssignmentId,
    rectification: input.rectification,
    ...(input.valueLabel ? { valueLabel: input.valueLabel } : {}),
    ...(input.recordedBy ?? base.recordedBy
      ? { recordedBy: input.recordedBy ?? base.recordedBy! }
      : {}),
    ...(base.context ? { context: base.context } : {}),
    ...(input.origin ?? base.origin ? { origin: input.origin ?? base.origin! } : {}),
    ...(input.originMetadata ?? base.originMetadata
      ? { originMetadata: input.originMetadata ?? base.originMetadata! }
      : {}),
  };
  return freezeVersion(version);
}

/** Congelamento em memória: defesa da implementação, não substituto de persistência. */
function freezeVersion(version: AssessmentEntryVersion): AssessmentEntryVersion {
  Object.freeze(version.placement);
  Object.freeze(version.value);
  if (version.originMetadata) Object.freeze(version.originMetadata);
  return Object.freeze(version);
}
