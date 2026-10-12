// Centro de Operações L20 — viagem planejada/programada/realizada/não realizada e ocorrências (migration 0428).
// Cada estágio é registro próprio; o estado é projeção e nunca há "realizada" sem execução registrada pelo motorista.

export type TripRecord = {
  planned: boolean;
  programming: { driverPerson: string; monitorPerson: string | null } | null;
  execution: { outcome: "realizada"; startedAt: string; endedAt: string; kmStart: number; kmEnd: number; recordedBy: string }
    | { outcome: "nao-realizada"; reason: string; recordedBy: string } | null;
  occurrences: { id: string; measures: number }[];
};
export type TripState = "planejada" | "programada" | "realizada" | "nao-realizada";

export function tripState(t: TripRecord): TripState {
  if (t.execution) return t.execution.outcome;
  return t.programming ? "programada" : "planejada";
}

/** Data passada sem execução não vira "realizada" nem "não realizada": fica pendente de registro. */
export function pendingRecord(t: TripRecord, tripDate: string, today: string): boolean {
  return t.programming !== null && t.execution === null && tripDate < today;
}

export function tripKm(t: TripRecord): number | null {
  return t.execution?.outcome === "realizada" ? Math.round((t.execution.kmEnd - t.execution.kmStart) * 10) / 10 : null;
}

export function validateExecution(t: TripRecord, actor: string, input:
  { outcome: "realizada"; startedAt: string; endedAt: string; kmStart: number; kmEnd: number; lastVehicleKm: number | null }
  | { outcome: "nao-realizada"; reason: string; actorCanSchedule: boolean }, now: string): { ok: boolean; reason?: string } {
  if (!t.programming) return { ok: false, reason: "not-programmed" };
  if (t.execution) return { ok: false, reason: "already-recorded" };
  if (input.outcome === "realizada") {
    if (actor !== t.programming.driverPerson) return { ok: false, reason: "not-the-driver" };
    if (input.endedAt > now || input.startedAt >= input.endedAt) return { ok: false, reason: "invalid-time" };
    if (input.kmEnd < input.kmStart || input.kmStart < 0) return { ok: false, reason: "invalid-km" };
    if (input.lastVehicleKm !== null && input.kmStart < input.lastVehicleKm) return { ok: false, reason: "odometer-regression" };
    return { ok: true };
  }
  if (actor !== t.programming.driverPerson && !input.actorCanSchedule) return { ok: false, reason: "forbidden" };
  return input.reason.trim().length >= 10 ? { ok: true } : { ok: false, reason: "reason-required" };
}

export function openOccurrences(t: TripRecord) { return t.occurrences.filter((o) => o.measures === 0).map((o) => o.id); }
