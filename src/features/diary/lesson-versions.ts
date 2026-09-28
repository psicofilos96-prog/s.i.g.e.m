/**
 * Etapa 6D.2.1 — versionamento imutável do registro de aula.
 *
 * Princípio estrutural: cada versão é um FATO independente e encadeado.
 * A versão vigente não contém nem reescreve seu próprio passado: ela apenas
 * APONTA para a versão que substituiu (`supersedesVersionId`). O histórico é
 * uma projeção derivada da cadeia, nunca um array guardado dentro do objeto.
 *
 * Invariantes:
 * - `rectifiedAt`/motivo não são propriedades universais do registro: pertencem
 *   ao ato de retificação (`LessonRectificationAct`), que só existe quando houve
 *   retificação.
 * - Versão concluída é imutável: nada a sobrescreve; corrige-se com nova versão.
 * - Estado da cadeia (vigente, substituída, quantidade de versões) é projeção.
 * - Nenhum fato ausente é convertido em valor: ausência permanece ausência.
 */
import type { LessonRecordInput } from "./lesson-records";

/** Fatos da aula registrados em uma versão. Mesmo contrato do preenchimento. */
export type LessonFacts = LessonRecordInput;

export type LessonVersionStatus = "Em elaboração" | "Concluída";

/**
 * Ato de retificação: existe SOMENTE na versão que substitui outra.
 * Guarda a proveniência normativa que tornou aquela correção admissível.
 */
export type LessonRectificationAct = {
  actedAt: string;
  agentId: string;
  /** Regra vigente no momento da retificação (permite explicar depois). */
  policyId: string;
  policyVersion: number;
  policyLabel: string;
  /** Exigências efetivamente projetadas pela regra e atendidas no ato. */
  satisfiedRequirements: readonly { code: string; label: string; provenance: string }[];
  justification?: string;
  /** Aspectos que efetivamente mudaram em relação à versão substituída. */
  changedAspects: readonly LessonChangeAspect[];
  /** Fechamento oficial consultado, quando havia um vigente. */
  consultedClosing?: { closingId: string; closingVersion: number; periodLabel: string };
};

/** Identificadores abertos: o motor não fecha a lista de aspectos possíveis. */
export type LessonChangeAspect = string;

export const LESSON_CHANGE_ASPECTS = {
  content: "conteudo-realizado",
  contentMode: "forma-de-registro-do-conteudo",
  blocks: "aulas-referenciadas",
  quantity: "quantidade-de-aulas",
  planningRelation: "relacao-com-o-planejamento",
  complements: "complementos-pedagogicos",
  schedule: "horario-fora-da-previsao",
} as const;

export type LessonRecordVersion = {
  id: string;
  /** Identidade do registro lógico da aula; estável entre versões. */
  logicalRecordId: string;
  version: number;
  /** Versão substituída por esta. Ausente na primeira versão. */
  supersedesVersionId?: string;
  status: LessonVersionStatus;
  facts: LessonFacts;
  createdAt: string;
  concludedAt?: string;
  /** Presente apenas quando esta versão nasceu de uma retificação. */
  rectification?: LessonRectificationAct;
};

// ---------------------------------------------------------------------------
// Projeções derivadas da cadeia
// ---------------------------------------------------------------------------

/** Cadeia ordenada (v1 → vN) do registro lógico. */
export function lessonVersionChain(
  versions: readonly LessonRecordVersion[],
  logicalRecordId: string,
): LessonRecordVersion[] {
  return versions
    .filter((item) => item.logicalRecordId === logicalRecordId)
    .sort((a, b) => a.version - b.version);
}

/** Versão vigente: a última da cadeia que não foi substituída por outra. */
export function currentLessonVersion(
  versions: readonly LessonRecordVersion[],
  logicalRecordId: string,
): LessonRecordVersion | undefined {
  const chain = lessonVersionChain(versions, logicalRecordId);
  const superseded = new Set(
    chain.map((item) => item.supersedesVersionId).filter((id): id is string => Boolean(id)),
  );
  return [...chain].reverse().find((item) => !superseded.has(item.id));
}

export function isCurrentLessonVersion(
  versions: readonly LessonRecordVersion[],
  versionId: string,
): boolean {
  const target = versions.find((item) => item.id === versionId);
  if (!target) return false;
  return currentLessonVersion(versions, target.logicalRecordId)?.id === versionId;
}

/** Linha do histórico: derivada, nunca persistida. */
export type LessonHistoryLine = {
  versionId: string;
  version: number;
  status: LessonVersionStatus;
  current: boolean;
  supersedesVersionId?: string;
  rectification?: LessonRectificationAct;
};

export function lessonHistory(
  versions: readonly LessonRecordVersion[],
  logicalRecordId: string,
): LessonHistoryLine[] {
  const chain = lessonVersionChain(versions, logicalRecordId);
  const currentId = currentLessonVersion(versions, logicalRecordId)?.id;
  return chain.map((item) => ({
    versionId: item.id,
    version: item.version,
    status: item.status,
    current: item.id === currentId,
    ...(item.supersedesVersionId ? { supersedesVersionId: item.supersedesVersionId } : {}),
    ...(item.rectification ? { rectification: item.rectification } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Detecção semântica de mudança
// ---------------------------------------------------------------------------

const normalizeText = (value: string | undefined) => (value ?? "").trim();

/** Textos efetivos conforme a forma de registro declarada (shared/individual). */
function effectiveContents(facts: LessonFacts): Record<string, string> {
  if (facts.contentMode === "shared") {
    const text = normalizeText(facts.contents["shared"]);
    return text ? { shared: text } : {};
  }
  const entries = facts.blockIds
    .map((id) => [id, normalizeText(facts.contents[id])] as const)
    .filter(([, text]) => Boolean(text));
  return Object.fromEntries(entries);
}

const sameStringSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

const sameRecord = (a: Record<string, string>, b: Record<string, string>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/**
 * Aspectos que mudaram entre duas versões de fatos.
 * Lista vazia significa: nenhuma nova versão deve existir.
 */
export function lessonFactsDelta(base: LessonFacts, next: LessonFacts): LessonChangeAspect[] {
  const aspects: LessonChangeAspect[] = [];
  if (!sameRecord(effectiveContents(base), effectiveContents(next)))
    aspects.push(LESSON_CHANGE_ASPECTS.content);
  if (base.contentMode !== next.contentMode) aspects.push(LESSON_CHANGE_ASPECTS.contentMode);
  if (!sameStringSet(base.blockIds, next.blockIds)) aspects.push(LESSON_CHANGE_ASPECTS.blocks);
  if (base.quantity !== next.quantity) aspects.push(LESSON_CHANGE_ASPECTS.quantity);
  if (base.planningRelation !== next.planningRelation)
    aspects.push(LESSON_CHANGE_ASPECTS.planningRelation);
  const complements = ["objectives", "skills", "strategies", "observations", "groupings"] as const;
  if (complements.some((key) => normalizeText(base[key]) !== normalizeText(next[key])))
    aspects.push(LESSON_CHANGE_ASPECTS.complements);
  if (
    base.extraordinary !== next.extraordinary ||
    normalizeText(base.extraordinaryStart) !== normalizeText(next.extraordinaryStart) ||
    normalizeText(base.extraordinaryEnd) !== normalizeText(next.extraordinaryEnd) ||
    normalizeText(base.justification) !== normalizeText(next.justification)
  )
    aspects.push(LESSON_CHANGE_ASPECTS.schedule);
  return aspects;
}

export function hasLessonFactsChanged(base: LessonFacts, next: LessonFacts): boolean {
  return lessonFactsDelta(base, next).length > 0;
}

// ---------------------------------------------------------------------------
// Construção de versões (fatos independentes e encadeados)
// ---------------------------------------------------------------------------

export function createFirstLessonVersion(input: {
  logicalRecordId: string;
  versionId: string;
  facts: LessonFacts;
  status: LessonVersionStatus;
  now: string;
}): LessonRecordVersion {
  return {
    id: input.versionId,
    logicalRecordId: input.logicalRecordId,
    version: 1,
    status: input.status,
    facts: freezeFacts(input.facts),
    createdAt: input.now,
    ...(input.status === "Concluída" ? { concludedAt: input.now } : {}),
  };
}

export function createSupersedingLessonVersion(input: {
  base: LessonRecordVersion;
  versionId: string;
  facts: LessonFacts;
  rectification: LessonRectificationAct;
  now: string;
}): LessonRecordVersion {
  return {
    id: input.versionId,
    logicalRecordId: input.base.logicalRecordId,
    version: input.base.version + 1,
    supersedesVersionId: input.base.id,
    status: "Concluída",
    facts: freezeFacts(input.facts),
    createdAt: input.now,
    concludedAt: input.now,
    rectification: input.rectification,
  };
}

/** Congelamento em memória: defesa da implementação, não substituto de persistência. */
function freezeFacts(facts: LessonFacts): LessonFacts {
  const copy: LessonFacts = {
    ...facts,
    blockIds: Object.freeze([...facts.blockIds]) as string[],
    contents: Object.freeze({ ...facts.contents }) as Record<string, string>,
  };
  return Object.freeze(copy);
}
