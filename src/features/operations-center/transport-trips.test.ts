import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openOccurrences, pendingRecord, tripKm, tripState, validateExecution, type TripRecord } from "./transport-trips";

const SQL = readFileSync("drizzle/migrations/0428_ops20_transport_trips.sql", "utf8");
const T: TripRecord = { planned: true, programming: { driverPerson: "mot", monitorPerson: "mon" }, execution: null, occurrences: [{ id: "o1", measures: 0 }] };
const NOW = "2026-10-12T12:00:00Z";
const ok = { outcome: "realizada" as const, startedAt: "2026-10-12T06:00:00Z", endedAt: "2026-10-12T07:10:00Z", kmStart: 1000, kmEnd: 1042.5, lastVehicleKm: 990 };

describe("Centro de Operações L20 — viagens e ocorrências", () => {
  it("estágios distintos; data passada sem registro é pendência, não resultado", () => {
    expect(tripState({ ...T, programming: null })).toBe("planejada");
    expect(tripState(T)).toBe("programada");
    expect(pendingRecord(T, "2026-10-11", "2026-10-12")).toBe(true);
    expect(tripState({ ...T, execution: { outcome: "realizada", startedAt: ok.startedAt, endedAt: ok.endedAt, kmStart: 1000, kmEnd: 1042.5, recordedBy: "mot" } })).toBe("realizada");
    expect(tripKm({ ...T, execution: { outcome: "realizada", startedAt: "", endedAt: "", kmStart: 1000, kmEnd: 1042.5, recordedBy: "mot" } })).toBe(42.5);
  });
  it("execução real: só o motorista, horário e quilometragem coerentes; não realização com motivo", () => {
    expect(validateExecution(T, "mot", ok, NOW).ok).toBe(true);
    expect(validateExecution(T, "mon", ok, NOW).reason).toBe("not-the-driver");
    expect(validateExecution(T, "mot", { ...ok, lastVehicleKm: 1100 }, NOW).reason).toBe("odometer-regression");
    expect(validateExecution(T, "mot", { ...ok, endedAt: "2026-10-13T00:00:00Z" }, NOW).reason).toBe("invalid-time");
    expect(validateExecution(T, "esc", { outcome: "nao-realizada", reason: "curto", actorCanSchedule: true }, NOW).reason).toBe("reason-required");
    expect(openOccurrences(T)).toEqual(["o1"]);
  });
  it("banco: entidades separadas, autoria da sessão, sem edição", () => {
    for (const r of ["opstrip:route-not-approved", "opstrip:driver-not-scheduled", "opstripx:not-the-driver", "opstripx:odometer-regression", "opstripx:future-time", "opstripx:already-recorded", "opsocc:forbidden"]) expect(SQL).toContain(r);
    for (const t of ["ops_trips", "ops_trip_programmings", "ops_trip_executions", "ops_trip_occurrences", "ops_trip_occurrence_measures"]) expect(SQL).toContain(`CREATE TABLE public.${t} (`);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
