/**
 * Etapa 13B — Projeções derivadas da Inscrição Letiva.
 *
 * Nada derivável é persistido. Versão vigente, participações ativas, trajetória
 * de ciclos e datas de referência são PROJEÇÕES da cadeia de registros e do
 * ledger da 13A, jamais campos editáveis.
 */
import { sortEventsChronologically } from "./student-life-ledger";
import type { InternalId, StudentLifeEvent } from "./student-life-types";
import type { AcademicCycleEnrollment, CycleParticipation } from "./cycle-enrollment-types";

/** PROJEÇÃO: versões vigentes das inscrições (retificadas permanecem no histórico). */
export function currentEnrollmentVersions(
  enrollments: readonly AcademicCycleEnrollment[],
): AcademicCycleEnrollment[] {
  const superseded = new Set(
    enrollments
      .map((item) => item.supersedesEnrollmentId)
      .filter((value): value is string => Boolean(value)),
  );
  return enrollments.filter((item) => !superseded.has(item.cycleEnrollmentId));
}

/** PROJEÇÃO: cadeia completa de versões de uma inscrição, da original à vigente. */
export function enrollmentVersionChain(
  enrollments: readonly AcademicCycleEnrollment[],
  cycleEnrollmentId: InternalId,
): AcademicCycleEnrollment[] {
  const byId = new Map(enrollments.map((item) => [item.cycleEnrollmentId, item]));
  const chain: AcademicCycleEnrollment[] = [];
  let cursor = byId.get(cycleEnrollmentId);
  while (cursor) {
    chain.unshift(cursor);
    const preceding = cursor.supersedesEnrollmentId;
    cursor = preceding ? byId.get(preceding) : undefined;
  }
  let successor = enrollments.find((item) => item.supersedesEnrollmentId === cycleEnrollmentId);
  while (successor) {
    chain.push(successor);
    const nextId = successor.cycleEnrollmentId;
    successor = enrollments.find((item) => item.supersedesEnrollmentId === nextId);
  }
  return chain;
}

/** PROJEÇÃO: participações vigentes de uma inscrição (entidade própria, por ID). */
export function participationsOfEnrollment(
  participations: readonly CycleParticipation[],
  cycleEnrollmentId: InternalId,
): CycleParticipation[] {
  const superseded = new Set(
    participations
      .map((item) => item.supersedesParticipationId)
      .filter((value): value is string => Boolean(value)),
  );
  return participations.filter(
    (item) => item.cycleEnrollmentId === cycleEnrollmentId && !superseded.has(item.participationId),
  );
}

/** PROJEÇÃO: participações em curso em determinada data de referência. */
export function participationsInForce(
  participations: readonly CycleParticipation[],
  referenceDate: string,
): CycleParticipation[] {
  return participations.filter(
    (item) =>
      item.validity.validFrom <= referenceDate &&
      (item.validity.validUntil === null || item.validity.validUntil >= referenceDate),
  );
}

/** PROJEÇÃO: inscrições do aluno em ordem de vigência — sem presumir anualidade. */
export function studentEnrollmentTrajectory(
  enrollments: readonly AcademicCycleEnrollment[],
  studentId: InternalId,
): AcademicCycleEnrollment[] {
  return currentEnrollmentVersions(enrollments)
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => (a.validity.validFrom < b.validity.validFrom ? -1 : 1));
}

/** PROJEÇÃO: inscrições em curso na data de referência, em qualquer unidade. */
export function enrollmentsInForce(
  enrollments: readonly AcademicCycleEnrollment[],
  studentId: InternalId,
  referenceDate: string,
): AcademicCycleEnrollment[] {
  return studentEnrollmentTrajectory(enrollments, studentId).filter(
    (item) =>
      item.validity.validFrom <= referenceDate &&
      (item.validity.validUntil === null || item.validity.validUntil >= referenceDate),
  );
}

/** PROJEÇÃO: eventos do ledger 13A que explicam uma inscrição, em ordem. */
export function enrollmentLedger(
  events: readonly StudentLifeEvent[],
  cycleEnrollmentId: InternalId,
): StudentLifeEvent[] {
  return sortEventsChronologically(
    events.filter((event) => event.scope.enrollmentId === cycleEnrollmentId),
  );
}

/**
 * PROJEÇÃO bitemporal: quando o fato teve eficácia e quando foi registrado. A
 * divergência entre as duas datas é legítima e nunca é corrigida silenciosamente.
 */
export function enrollmentBitemporalTrace(
  events: readonly StudentLifeEvent[],
  cycleEnrollmentId: InternalId,
): { eventId: string; effectiveDate: string; recordedAt: string; isCorrection: boolean }[] {
  return enrollmentLedger(events, cycleEnrollmentId).map((event) => ({
    eventId: event.eventId,
    effectiveDate: event.effectiveDate,
    recordedAt: event.provenance.recordedAt,
    isCorrection: event.isCorrection,
  }));
}
