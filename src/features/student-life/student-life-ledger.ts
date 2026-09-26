/**
 * Etapa 13A — Ledger histórico e projeções derivadas da Vida Escolar.
 *
 * Toda pergunta de "quando", "quantas vezes" e "por quê" é respondida a partir
 * dos EVENTOS. Nenhum fato derivável é persistido como segunda verdade nas
 * entidades: `getFirstNetworkAdmissionDate` é projeção, não campo.
 */
import type {
  InternalId,
  SchoolInstitutionalBond,
  StudentLifeEvent,
} from "./student-life-types";

/** Ordena por eficácia do fato e, em empate, pelo instante de registro. */
export function sortEventsChronologically(
  events: readonly StudentLifeEvent[],
): StudentLifeEvent[] {
  return [...events].sort((a, b) => {
    if (a.effectiveDate !== b.effectiveDate) {
      return a.effectiveDate < b.effectiveDate ? -1 : 1;
    }
    return a.provenance.recordedAt < b.provenance.recordedAt ? -1 : 1;
  });
}

/** Ledger de um aluno, em ordem cronológica de eficácia. */
export function studentLedger(
  events: readonly StudentLifeEvent[],
  studentId: InternalId,
): StudentLifeEvent[] {
  return sortEventsChronologically(events.filter((event) => event.scope.studentId === studentId));
}

/** Eventos vigentes: retificados permanecem no ledger, mas não são a versão atual. */
export function currentEventVersions(
  events: readonly StudentLifeEvent[],
): StudentLifeEvent[] {
  const superseded = new Set(
    events
      .filter((event) => event.isCorrection && event.precedingEventId)
      .map((event) => event.precedingEventId as string),
  );
  return sortEventsChronologically(events.filter((event) => !superseded.has(event.eventId)));
}

/** Cadeia completa de versões de um fato, da original à retificação mais recente. */
export function eventCorrectionChain(
  events: readonly StudentLifeEvent[],
  eventId: InternalId,
): StudentLifeEvent[] {
  const byId = new Map(events.map((event) => [event.eventId, event]));
  const chain: StudentLifeEvent[] = [];
  let cursor = byId.get(eventId);
  while (cursor) {
    chain.unshift(cursor);
    const preceding = cursor.precedingEventId;
    cursor = preceding ? byId.get(preceding) : undefined;
  }
  let successor = events.find((event) => event.precedingEventId === eventId);
  while (successor) {
    chain.push(successor);
    const nextId = successor.eventId;
    successor = events.find((event) => event.precedingEventId === nextId);
  }
  return chain;
}

/**
 * PROJEÇÃO: data de primeiro ingresso do aluno na Rede, derivada dos eventos de
 * ingresso vigentes. `null` quando o ledger não comprova ingresso — nunca
 * presumida a partir do estado atual.
 */
export function getFirstNetworkAdmissionDate(
  events: readonly StudentLifeEvent[],
  studentId: InternalId,
  admissionEventTypeDefinitionIds: readonly string[],
): string | null {
  const admissions = currentEventVersions(studentLedger(events, studentId)).filter((event) =>
    admissionEventTypeDefinitionIds.includes(event.eventTypeDefinitionId),
  );
  return admissions[0]?.effectiveDate ?? null;
}

/** PROJEÇÃO: quantidade de episódios de relação do aluno com determinada unidade. */
export function countSchoolRelationEpisodes(
  bonds: readonly SchoolInstitutionalBond[],
  studentId: InternalId,
  schoolId: string,
): number {
  return bonds
    .filter((bond) => bond.studentId === studentId && bond.schoolId === schoolId)
    .reduce((total, bond) => total + bond.episodes.length, 0);
}

/** PROJEÇÃO: episódio em curso do vínculo, quando houver. */
export function currentBondEpisode(bond: SchoolInstitutionalBond) {
  return bond.episodes.find((episode) => episode.validUntil === null) ?? null;
}

/**
 * Referência mínima do aluno para consulta por outros módulos, sem carregar
 * dossiê, documentos, ocorrências ou dados sensíveis (minimização LGPD).
 */
export type StudentReference = {
  studentId: InternalId;
  personId: InternalId;
  displayName: string;
  institutionalIdentifierValue: string;
  networkStateDefinitionId: string;
};
