/**
 * Etapa 13D — Projeções derivadas da Mobilidade Institucional.
 *
 * NADA DERIVÁVEL É PERSISTIDO. São projeções da cadeia, nunca campos:
 *   - versão vigente do registro do processo;
 *   - quantidade de versões;
 *   - estágio vigente (deduzido do ledger de transições);
 *   - "destino conhecido?";
 *   - intervalo institucional de transição vigente em uma data.
 *
 * Bitemporalidade: `...On` responde pela EFICÁCIA do fato; `...AsKnownAt`
 * responde pelo que o sistema CONHECIA em determinado instante de registro — é o
 * que explica por que a tela mostrava outro estágio antes de uma retificação,
 * sem apagar a versão anterior.
 */
import type { InternalId } from "./student-life-types";
import type {
  InstitutionalTransitionIntervalRecord,
  MobilityContextReference,
  MobilityPole,
  TransferProcessVersionRecord,
  TransferStageTransitionRecord,
} from "./transfer-types";

// ------------------------------------------------------ Versões do registro

/** PROJEÇÃO: versões do processo, em ordem de encadeamento retrospectivo. */
export function processVersionChain(
  versions: readonly TransferProcessVersionRecord[],
  transferProcessId: InternalId,
): TransferProcessVersionRecord[] {
  const own = versions.filter((item) => item.transferProcessId === transferProcessId);
  const byId = new Map(own.map((item) => [item.transferProcessVersionId, item]));
  const superseded = new Set(
    own.map((item) => item.precedingVersionId).filter((value): value is string => Boolean(value)),
  );
  const head = own.find((item) => !superseded.has(item.transferProcessVersionId));
  if (!head) return own;
  const chain: TransferProcessVersionRecord[] = [];
  let cursor: TransferProcessVersionRecord | undefined = head;
  while (cursor) {
    chain.unshift(cursor);
    const preceding: string | null | undefined = cursor.precedingVersionId;
    cursor = preceding ? byId.get(preceding) : undefined;
  }
  return chain;
}

/** PROJEÇÃO: versão vigente — derivada da cadeia, nunca gravada. */
export function currentProcessVersion(
  versions: readonly TransferProcessVersionRecord[],
  transferProcessId: InternalId,
): TransferProcessVersionRecord | null {
  const chain = processVersionChain(versions, transferProcessId);
  return chain[chain.length - 1] ?? null;
}

/** PROJEÇÃO: quantidade de versões — calculada, nunca gravada. */
export function processVersionCount(
  versions: readonly TransferProcessVersionRecord[],
  transferProcessId: InternalId,
): number {
  return processVersionChain(versions, transferProcessId).length;
}

/** PROJEÇÃO BITEMPORAL: versão vigente conforme o que se conhecia em `knownAt`. */
export function processVersionAsKnownAt(
  versions: readonly TransferProcessVersionRecord[],
  transferProcessId: InternalId,
  knownAt: string,
): TransferProcessVersionRecord | null {
  const known = versions.filter((item) => item.provenance.recordedAt <= knownAt);
  return currentProcessVersion(known, transferProcessId);
}

// ---------------------------------------------------- Transições e estágio

/**
 * PROJEÇÃO: transições vigentes do processo. Uma retificação não apaga a
 * transição anterior: a antiga permanece no ledger e é excluída da leitura
 * vigente por estar referenciada como `precedingTransitionId`.
 */
export function currentTransitions(
  transitions: readonly TransferStageTransitionRecord[],
  transferProcessId: InternalId,
): TransferStageTransitionRecord[] {
  const own = transitions.filter((item) => item.transferProcessId === transferProcessId);
  const superseded = new Set(
    own.map((item) => item.precedingTransitionId).filter((value): value is string => Boolean(value)),
  );
  return own
    .filter((item) => !superseded.has(item.transitionId))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

/**
 * PROJEÇÃO CENTRAL: estágio vigente do processo, DEDUZIDO do ledger.
 * Não existe segunda verdade: nenhuma entidade grava o estágio.
 */
export function currentStageOf(
  transitions: readonly TransferStageTransitionRecord[],
  transferProcessId: InternalId,
): string | null {
  const chain = currentTransitions(transitions, transferProcessId);
  return chain[chain.length - 1]?.toStageDefinitionId ?? null;
}

/** PROJEÇÃO: estágio vigente na data de eficácia informada. */
export function stageOnDate(
  transitions: readonly TransferStageTransitionRecord[],
  transferProcessId: InternalId,
  referenceDate: string,
): string | null {
  const chain = currentTransitions(transitions, transferProcessId).filter(
    (item) => item.effectiveDate <= referenceDate,
  );
  return chain[chain.length - 1]?.toStageDefinitionId ?? null;
}

/** PROJEÇÃO BITEMPORAL: estágio conforme o que estava registrado em `knownAt`. */
export function stageAsKnownAt(
  transitions: readonly TransferStageTransitionRecord[],
  transferProcessId: InternalId,
  knownAt: string,
): string | null {
  const known = transitions.filter((item) => item.provenance.recordedAt <= knownAt);
  return currentStageOf(known, transferProcessId);
}

/** PROJEÇÃO: próximo número de sequência do ledger deste processo. */
export function nextSequenceNumber(
  transitions: readonly TransferStageTransitionRecord[],
  transferProcessId: InternalId,
): number {
  const chain = currentTransitions(transitions, transferProcessId);
  const last = chain[chain.length - 1];
  return last ? last.sequenceNumber + 1 : 1;
}

// ------------------------------------------------------------------- Polos

/**
 * PROJEÇÃO: o contexto do polo é conhecido?
 * Substitui qualquer `destinationKnown` gravado.
 */
export function isContextKnown(pole: MobilityPole | undefined): boolean {
  return Boolean(pole?.reference);
}

/** PROJEÇÃO: tipo de referência do polo, quando conhecido. */
export function contextTypeOf(pole: MobilityPole | undefined): string | null {
  return pole?.reference?.contextReferenceTypeDefinitionId ?? null;
}

/** Leitura tipada de conveniência de um atributo do polo. */
export function contextAttribute(
  reference: MobilityContextReference | null | undefined,
  key: string,
): string | number | boolean | null {
  if (!reference) return null;
  return reference.attributes[key] ?? null;
}

/** Leitura tipada de conveniência: atributo textual do polo. */
export function contextTextAttribute(
  reference: MobilityContextReference | null | undefined,
  key: string,
): string | null {
  const value = contextAttribute(reference, key);
  return typeof value === "string" ? value : null;
}

// ----------------------------------------- Intervalo institucional de transição

/**
 * PROJEÇÃO: o intervalo institucional cobre a data de referência?
 * A NATUREZA do intervalo vem do dado configurado; o motor só compara datas.
 */
export function transitionIntervalCovers(
  interval: InstitutionalTransitionIntervalRecord | undefined,
  referenceDate: string,
): boolean {
  if (!interval) return false;
  if (interval.startDate > referenceDate) return false;
  const end = interval.concludedDate ?? interval.deadlineDate ?? null;
  return end === null || end >= referenceDate;
}

/** PROJEÇÃO: intervalo institucional vigente do processo na data de referência. */
export function transitionIntervalInForceOn(
  versions: readonly TransferProcessVersionRecord[],
  transferProcessId: InternalId,
  referenceDate: string,
): InstitutionalTransitionIntervalRecord | null {
  const version = currentProcessVersion(versions, transferProcessId);
  const interval = version?.transitionInterval;
  return transitionIntervalCovers(interval, referenceDate) ? (interval ?? null) : null;
}

/**
 * PROJEÇÃO: todos os intervalos institucionais vigentes do aluno na data.
 * Consumido pela apuração de frequência para NÃO imputar falta ao percurso.
 */
export function studentTransitionIntervalsOn(
  versions: readonly TransferProcessVersionRecord[],
  studentId: InternalId,
  referenceDate: string,
): InstitutionalTransitionIntervalRecord[] {
  const processIds = new Set(
    versions.filter((item) => item.studentId === studentId).map((item) => item.transferProcessId),
  );
  const out: InstitutionalTransitionIntervalRecord[] = [];
  for (const processId of processIds) {
    const interval = transitionIntervalInForceOn(versions, processId, referenceDate);
    if (interval) out.push(interval);
  }
  return out;
}
