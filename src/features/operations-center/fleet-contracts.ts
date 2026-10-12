// Centro de Operações L21 — contratos, medições, custos e trava de uso de veículo (migration 0429).
// Valores só com referência ao sistema oficial + comprovante; medição é derivada das execuções registradas (L20).

export type AvailabilityEvent = { onDate: string; seq: number; available: boolean };

/** Sem evento até a data ⇒ indisponível (fail-closed), espelha `ops_vehicle_available_on`. */
export function availableOn(events: AvailabilityEvent[], on: string): boolean {
  const e = events.filter((x) => x.onDate <= on).sort((a, b) => (a.onDate === b.onDate ? b.seq - a.seq : b.onDate.localeCompare(a.onDate)))[0];
  return e?.available ?? false;
}

export function canProgramVehicle(input: { available: boolean; validation: { validatedBy: string } | null; programmer: string; lastInspectionFailed: boolean }) {
  if (input.available) return { ok: true as const };
  if (!input.validation) return { ok: false as const, reason: "vehicle-unavailable" };
  if (input.validation.validatedBy === input.programmer) return { ok: false as const, reason: "self-validated-use" };
  if (input.lastInspectionFailed) return { ok: false as const, reason: "inspection-failed" };
  return { ok: true as const };
}

export type Execution = { outcome: "realizada" | "nao-realizada"; tripDate: string; kmStart?: number; kmEnd?: number };

export function measure(execs: Execution[], start: string, end: string) {
  const inP = execs.filter((e) => e.tripDate >= start && e.tripDate <= end);
  const done = inP.filter((e) => e.outcome === "realizada");
  return {
    tripsRealized: done.length,
    tripsNotRealized: inP.length - done.length,
    kmRealized: Math.round(done.reduce((s, e) => s + ((e.kmEnd ?? 0) - (e.kmStart ?? 0)), 0) * 10) / 10,
  };
}

export type CostView = { amountCents: number | null; status: "informado" | "nao-informado" | "medicao-nao-conferida" };

export function costView(conferred: "conferida" | "divergente" | null, cost: { amountCents: number; officialSystemRef: string } | null): CostView {
  if (conferred !== "conferida") return { amountCents: null, status: "medicao-nao-conferida" };
  return cost ? { amountCents: cost.amountCents, status: "informado" } : { amountCents: null, status: "nao-informado" };
}
