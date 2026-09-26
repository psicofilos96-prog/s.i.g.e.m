/**
 * Etapa 13C — Fatos atômicos da Enturmação para o CIECE (Capítulo 14).
 *
 * A 13C publica FATOS e DATAS: alocações, vigências, processos originadores,
 * agrupamentos, capacidade vigente e versionada. Ela NÃO publica interpretação:
 * nada de "excedente", "turma cheia", "ingresso tardio", taxa ou indicador.
 *
 * Duas naturezas distintas e rotuladas:
 *   FATO ATÔMICO         — existe independentemente de qualquer política.
 *   PROJEÇÃO REPRODUZÍVEL— resultado de uma política, versão e data explícitas.
 * `institutionalActReference` substitui qualquer flag `hasInstitutionalAct`: o
 * consumidor decide se existe ou não.
 */
import type { InstitutionalActReference } from "./student-life-types";
import {
  capacityRecordInForceOn,
  factualOccupancyOn,
  reservationsInForceOn,
} from "./class-allocation-ledger";
import type {
  CapacityQuotaReservation,
  ClassAllocation,
  ClassCapacityRecord,
} from "./class-allocation-types";

/** FATO ATÔMICO da alocação. */
export type AllocationFactRow = {
  allocationId: string;
  recordVersion: number;
  participationId: string;
  cycleEnrollmentId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  groupingId: string | null;
  originatingProcessKindId: string;
  allocationStateDefinitionId: string;
  allocationStateReasonDefinitionId: string | null;
  validFrom: string;
  validUntil: string | null;
  recordedAt: string;
  supersedesAllocationId: string | null;
  /** Referência estruturada ao ato; nunca um booleano derivado. */
  institutionalActReference: InstitutionalActReference | null;
};

/** FATO ATÔMICO da movimentação, derivado do encadeamento das vigências. */
export type ClassMovementFactRow = {
  participationId: string;
  studentId: string;
  fromAllocationId: string;
  fromClassId: string;
  fromValidUntil: string | null;
  toAllocationId: string;
  toClassId: string;
  toValidFrom: string;
  toOriginatingProcessKindId: string;
};

/** FATO ATÔMICO da capacidade: o registro vigente e sua versão. */
export type ClassCapacityFactRow = {
  capacityRecordId: string;
  classId: string;
  referenceLimit: number;
  basisDefinitionId: string | null;
  policyId: string;
  policyVersion: number | null;
  validFrom: string;
  validUntil: string | null;
  recordVersion: number;
  supersedesCapacityRecordId: string | null;
  institutionalActReference: InstitutionalActReference | null;
};

/** FATO ATÔMICO da reserva de vaga, com natureza, política e vigência. */
export type CapacityReservationFactRow = {
  reservationId: string;
  classId: string;
  capacityRecordId: string | null;
  quantity: number;
  reservationNatureDefinitionId: string;
  institutingPolicyId: string;
  institutingPolicyVersion: number | null;
  audienceCriterionDefinitionId: string | null;
  validFrom: string;
  validUntil: string | null;
};

/**
 * PROJEÇÃO REPRODUZÍVEL — não é fato atômico. Publica a ocupação factual na data
 * explícita e a capacidade vigente identificada por política e versão. A
 * comparação entre ambas (excedente) pertence ao motor analítico do CIECE.
 */
export type ClassOccupancyProjectionRow = {
  projectionKind: "projecao-reproduzivel";
  classId: string;
  referenceDate: string;
  factualOccupancy: number;
  capacityRecordId: string | null;
  referenceLimit: number | null;
  capacityPolicyId: string | null;
  capacityPolicyVersion: number | null;
  reservedQuantity: number;
};

export function projectAllocationFacts(
  allocations: readonly ClassAllocation[],
): AllocationFactRow[] {
  return allocations.map((item) => ({
    allocationId: item.allocationId,
    recordVersion: item.recordVersion,
    participationId: item.participationId,
    cycleEnrollmentId: item.denormalized.cycleEnrollmentId,
    studentId: item.denormalized.studentId,
    schoolId: item.denormalized.schoolId,
    classId: item.classId,
    groupingId: item.groupingId ?? null,
    originatingProcessKindId: item.originatingProcessKindId,
    allocationStateDefinitionId: item.allocationStateDefinitionId,
    allocationStateReasonDefinitionId: item.allocationStateReasonDefinitionId ?? null,
    validFrom: item.validity.validFrom,
    validUntil: item.validity.validUntil,
    recordedAt: item.provenance.recordedAt,
    supersedesAllocationId: item.supersedesAllocationId ?? null,
    institutionalActReference: item.originatingAct ?? item.provenance.act ?? null,
  }));
}

/**
 * FATOS de movimentação: pares consecutivos da trajetória da MESMA participação.
 * A 13C não classifica o motivo institucional da troca; apenas publica o par.
 */
export function projectClassMovementFacts(
  allocations: readonly ClassAllocation[],
): ClassMovementFactRow[] {
  const byParticipation = new Map<string, ClassAllocation[]>();
  for (const allocation of allocations) {
    const list = byParticipation.get(allocation.participationId) ?? [];
    list.push(allocation);
    byParticipation.set(allocation.participationId, list);
  }

  const rows: ClassMovementFactRow[] = [];
  for (const list of byParticipation.values()) {
    const ordered = [...list].sort((a, b) =>
      a.validity.validFrom < b.validity.validFrom ? -1 : 1,
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      if (previous.classId === current.classId) continue;
      rows.push({
        participationId: current.participationId,
        studentId: current.denormalized.studentId,
        fromAllocationId: previous.allocationId,
        fromClassId: previous.classId,
        fromValidUntil: previous.validity.validUntil,
        toAllocationId: current.allocationId,
        toClassId: current.classId,
        toValidFrom: current.validity.validFrom,
        toOriginatingProcessKindId: current.originatingProcessKindId,
      });
    }
  }
  return rows;
}

export function projectCapacityFacts(
  records: readonly ClassCapacityRecord[],
): ClassCapacityFactRow[] {
  return records.map((item) => ({
    capacityRecordId: item.capacityRecordId,
    classId: item.classId,
    referenceLimit: item.referenceLimit,
    basisDefinitionId: item.basisDefinitionId ?? null,
    policyId: item.policy.definitionId,
    policyVersion: item.policy.definitionVersion ?? null,
    validFrom: item.validity.validFrom,
    validUntil: item.validity.validUntil,
    recordVersion: item.recordVersion,
    supersedesCapacityRecordId: item.supersedesCapacityRecordId ?? null,
    institutionalActReference: item.act ?? null,
  }));
}

export function projectReservationFacts(
  reservations: readonly CapacityQuotaReservation[],
): CapacityReservationFactRow[] {
  return reservations.map((item) => ({
    reservationId: item.reservationId,
    classId: item.classId,
    capacityRecordId: item.capacityRecordId ?? null,
    quantity: item.quantity,
    reservationNatureDefinitionId: item.reservationNatureDefinitionId,
    institutingPolicyId: item.institutingPolicy.definitionId,
    institutingPolicyVersion: item.institutingPolicy.definitionVersion ?? null,
    audienceCriterionDefinitionId: item.audienceCriterionDefinitionId ?? null,
    validFrom: item.validity.validFrom,
    validUntil: item.validity.validUntil,
  }));
}

/** PROJEÇÃO REPRODUZÍVEL de ocupação: identificada por data, política e versão. */
export function projectClassOccupancy(input: {
  allocations: readonly ClassAllocation[];
  capacityRecords: readonly ClassCapacityRecord[];
  reservations?: readonly CapacityQuotaReservation[];
  classId: string;
  referenceDate: string;
}): ClassOccupancyProjectionRow {
  const capacity = capacityRecordInForceOn(input.capacityRecords, input.classId, input.referenceDate);
  const reserved = reservationsInForceOn(
    input.reservations ?? [],
    input.classId,
    input.referenceDate,
  ).reduce((total, item) => total + item.quantity, 0);
  return {
    projectionKind: "projecao-reproduzivel",
    classId: input.classId,
    referenceDate: input.referenceDate,
    factualOccupancy: factualOccupancyOn(input.allocations, input.classId, input.referenceDate),
    capacityRecordId: capacity?.capacityRecordId ?? null,
    referenceLimit: capacity?.referenceLimit ?? null,
    capacityPolicyId: capacity?.policy.definitionId ?? null,
    capacityPolicyVersion: capacity?.policy.definitionVersion ?? null,
    reservedQuantity: reserved,
  };
}
