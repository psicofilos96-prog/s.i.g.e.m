/**
 * Etapa 13C — Projeções derivadas da Enturmação.
 *
 * Nada derivável é persistido: versão vigente, "quem me superou", composição da
 * turma em uma data, ocupação factual e capacidade aplicável são PROJEÇÕES da
 * cadeia de registros. Nenhuma delas é campo editável.
 *
 * Bitemporalidade: `...OnDate` responde pela EFICÁCIA do fato;
 * `...AsKnownAt` responde pelo que o sistema CONHECIA em determinado instante de
 * registro — é o que permite explicar por que a tela mostrava outro número antes
 * de uma retificação, sem apagar a versão anterior.
 */
import type { InternalId } from "./student-life-types";
import type {
  AllocationValidity,
  CapacityQuotaReservation,
  ClassAllocation,
  ClassCapacityRecord,
  ClassGroupingDefinition,
} from "./class-allocation-types";

const OPEN_ENDED = "9999-12-31";

/** Primitiva temporal: a vigência cobre a data de referência? */
export function inForceOn(validity: AllocationValidity, referenceDate: string): boolean {
  return (
    validity.validFrom <= referenceDate &&
    (validity.validUntil === null || validity.validUntil >= referenceDate)
  );
}

/** Primitiva temporal: duas vigências se sobrepõem? */
export function validitiesOverlap(a: AllocationValidity, b: AllocationValidity): boolean {
  return a.validFrom <= (b.validUntil ?? OPEN_ENDED) && b.validFrom <= (a.validUntil ?? OPEN_ENDED);
}

/** PROJEÇÃO: versões vigentes; as retificadas permanecem íntegras no histórico. */
export function currentAllocationVersions(
  allocations: readonly ClassAllocation[],
): ClassAllocation[] {
  const superseded = new Set(
    allocations
      .map((item) => item.supersedesAllocationId)
      .filter((value): value is string => Boolean(value)),
  );
  return allocations.filter((item) => !superseded.has(item.allocationId));
}

/** PROJEÇÃO: a alocação que superou esta, derivada da cadeia (nunca campo). */
export function supersedingAllocation(
  allocations: readonly ClassAllocation[],
  allocationId: InternalId,
): ClassAllocation | null {
  return allocations.find((item) => item.supersedesAllocationId === allocationId) ?? null;
}

/** PROJEÇÃO: cadeia completa de versões, da original à vigente. */
export function allocationVersionChain(
  allocations: readonly ClassAllocation[],
  allocationId: InternalId,
): ClassAllocation[] {
  const byId = new Map(allocations.map((item) => [item.allocationId, item]));
  const chain: ClassAllocation[] = [];
  let cursor = byId.get(allocationId);
  while (cursor) {
    chain.unshift(cursor);
    const preceding = cursor.supersedesAllocationId;
    cursor = preceding ? byId.get(preceding) : undefined;
  }
  let successor = supersedingAllocation(allocations, allocationId);
  while (successor) {
    chain.push(successor);
    successor = supersedingAllocation(allocations, successor.allocationId);
  }
  return chain;
}

/** PROJEÇÃO: alocações vigentes de uma participação na data de referência. */
export function allocationsOfParticipationOn(
  allocations: readonly ClassAllocation[],
  participationId: InternalId,
  referenceDate: string,
): ClassAllocation[] {
  return currentAllocationVersions(allocations).filter(
    (item) => item.participationId === participationId && inForceOn(item.validity, referenceDate),
  );
}

/** PROJEÇÃO: trajetória completa de alocações da participação, em ordem. */
export function participationAllocationTrajectory(
  allocations: readonly ClassAllocation[],
  participationId: InternalId,
): ClassAllocation[] {
  return currentAllocationVersions(allocations)
    .filter((item) => item.participationId === participationId)
    .sort((a, b) => (a.validity.validFrom < b.validity.validFrom ? -1 : 1));
}

/**
 * PROJEÇÃO CENTRAL: composição histórica da turma na data de referência.
 * Consultas em datas diferentes devolvem composições diferentes sem que nenhuma
 * etapa anterior tenha sido apagada.
 */
export function classCompositionOn(
  allocations: readonly ClassAllocation[],
  classId: InternalId,
  referenceDate: string,
): ClassAllocation[] {
  return currentAllocationVersions(allocations).filter(
    (item) => item.classId === classId && inForceOn(item.validity, referenceDate),
  );
}

/** PROJEÇÃO: ocupação FACTUAL da turma — contagem de alocações vigentes na data. */
export function factualOccupancyOn(
  allocations: readonly ClassAllocation[],
  classId: InternalId,
  referenceDate: string,
): number {
  return classCompositionOn(allocations, classId, referenceDate).length;
}

/**
 * PROJEÇÃO BITEMPORAL: composição da turma na data `referenceDate` conforme o
 * que estava REGISTRADO até `knownAt`. Preserva a explicação de por que o
 * sistema exibia outro resultado antes de uma retificação.
 */
export function classCompositionAsKnownAt(
  allocations: readonly ClassAllocation[],
  classId: InternalId,
  referenceDate: string,
  knownAt: string,
): ClassAllocation[] {
  const knownRecords = allocations.filter((item) => item.provenance.recordedAt <= knownAt);
  return classCompositionOn(knownRecords, classId, referenceDate);
}

/** PROJEÇÃO: capacidade aplicável à turma na data de referência. */
export function capacityRecordInForceOn(
  records: readonly ClassCapacityRecord[],
  classId: InternalId,
  referenceDate: string,
): ClassCapacityRecord | null {
  const superseded = new Set(
    records
      .map((item) => item.supersedesCapacityRecordId)
      .filter((value): value is string => Boolean(value)),
  );
  const candidates = records
    .filter(
      (item) =>
        item.classId === classId &&
        !superseded.has(item.capacityRecordId) &&
        inForceOn(item.validity, referenceDate),
    )
    .sort((a, b) => (a.validity.validFrom < b.validity.validFrom ? -1 : 1));
  return candidates[candidates.length - 1] ?? null;
}

/** PROJEÇÃO: reservas de vaga aplicáveis à turma na data de referência. */
export function reservationsInForceOn(
  reservations: readonly CapacityQuotaReservation[],
  classId: InternalId,
  referenceDate: string,
): CapacityQuotaReservation[] {
  return reservations.filter(
    (item) => item.classId === classId && inForceOn(item.validity, referenceDate),
  );
}

/** PROJEÇÃO: agrupamentos internos aplicáveis à turma na data de referência. */
export function groupingsInForceOn(
  groupings: readonly ClassGroupingDefinition[],
  classId: InternalId,
  referenceDate: string,
): ClassGroupingDefinition[] {
  return groupings.filter(
    (item) => item.classId === classId && inForceOn(item.validity, referenceDate),
  );
}
