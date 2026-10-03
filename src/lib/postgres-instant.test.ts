import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
import { instantMicros, isKnownAt, sameInstant } from "./postgres-instant";
import { readMySchedule, readPlaceNames, mapPersonScheduleRows } from "@/features/schedules/person-schedule-source";
import { isKnownAt as calendarIsKnownAt } from "@/features/calendar/institutional-calendar-source";

describe("postgres-instant (compartilhado B4.5/B4.6)", () => {
  it("offsets equivalentes e zeros na fração", () => {
    expect(sameInstant("2026-10-03T12:00:00Z", "2026-10-03 09:00:00.000000-03")).toBe(true);
    expect(sameInstant("2026-10-03T12:00:00.5+00:00", "2026-10-03T12:00:00.500000+0000")).toBe(true);
  });
  it("1µs e .123456/.123999 são distintos", () => {
    expect(sameInstant("2026-10-03T12:00:00.123456Z", "2026-10-03T12:00:00.123999Z")).toBe(false);
    expect(sameInstant("2026-10-03T12:00:00.000001Z", "2026-10-03T12:00:00Z")).toBe(false);
  });
  it("componentes impossíveis rejeitados; bissexto válido aceito", () => {
    expect(instantMicros("2026-02-30T12:00:00Z")).toBeNull();
    expect(instantMicros("2026-02-29T12:00:00Z")).toBeNull();
    expect(isKnownAt("2028-02-29T12:00:00Z")).toBe(true);
    expect(sameInstant("2026-02-30T12:00:00Z", "2026-03-02T12:00:00Z")).toBe(false);
  });
  it("calendário mantém o mesmo export", () => {
    expect(calendarIsKnownAt).toBe(isKnownAt);
  });
});

describe("B4.5 parser estrito", () => {
  const row = (known_at: string) => ({ result_kind: "access-denied", valid_on: "2026-10-03", known_at });
  it("snapshot com 1µs de diferença é recusado; equivalente aceito", () => {
    const t = { validOn: "2026-10-03", knownAt: "2026-10-03T12:00:00.123Z" };
    expect(mapPersonScheduleRows([row("2026-10-03 09:00:00.123-03")], t).kind).toBe("negado");
    expect(() => mapPersonScheduleRows([row("2026-10-03T12:00:00.123001Z")], t)).toThrow();
    expect(() => mapPersonScheduleRows([row("2026-02-30T12:00:00Z")], { ...t, knownAt: "2026-03-02T12:00:00Z" })).toThrow();
  });
  it("knownAt inválido impede a chamada", async () => {
    const rpc = vi.fn(); const from = vi.fn();
    await expect(readMySchedule({ validOn: "2026-10-03", knownAt: "2026-02-30T12:00:00Z" }, { rpc })).rejects.toThrow();
    await expect(readPlaceNames(["c"], ["s"], { validOn: "2026-10-03", knownAt: "ontem" }, { rpc, from })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled();
  });
});
