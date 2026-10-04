import { describe, expect, it } from "vitest";
import { parseComposedDays, ComposedDaysShapeError } from "./calendar-composed-days-source";

const exp = { allocation: "a-1", from: "2026-04-20", to: "2026-04-21", knownAt: "2026-10-04T11:00:00.123456Z" };
const ok = (days: unknown[], over: Record<string, unknown> = {}) => ({
  contract: "b4.6.6/1", state: "lido", authorizes: false, publishes: false, allocation: "a-1",
  snapshot: { from: exp.from, to: exp.to, knownAt: "2026-10-04 11:00:00.123456+00" }, days, ...over,
});
const letivo = { on: "2026-04-20", result: "letivo", schoolDayEffect: true, calendarId: "cal-x", versionId: "v" };

describe("parseComposedDays", () => {
  it("aceita decisão do servidor com proveniência e µs equivalentes", () => {
    const r = parseComposedDays(ok([letivo, { on: "2026-04-21", result: "conflito" }]), exp);
    expect(r.kind).toBe("lido");
    if (r.kind === "lido") { expect(r.days[0]!.schoolDayEffect).toBe(true); expect(r.days[1]!.schoolDayEffect).toBeNull(); }
  });
  it("access-denied sem metadado", () => {
    expect(parseComposedDays({ contract: "b4.6.6/1", state: "access-denied" }, exp)).toEqual({ kind: "access-denied" });
    expect(() => parseComposedDays({ contract: "b4.6.6/1", state: "access-denied", school: "x" }, exp)).toThrow(ComposedDaysShapeError);
  });
  it("recusa knownAt divergente, dia faltante, efeito em indeterminado, autoridade e estado desconhecido", () => {
    expect(() => parseComposedDays(ok([letivo, { on: "2026-04-21", result: "conflito" }], { snapshot: { ...ok([]).snapshot, knownAt: "2026-10-04T11:00:00.123457Z" } }), exp)).toThrow();
    expect(() => parseComposedDays(ok([letivo]), exp)).toThrow();
    expect(() => parseComposedDays(ok([letivo, { on: "2026-04-21", result: "conflito", schoolDayEffect: false }]), exp)).toThrow();
    expect(() => parseComposedDays(ok([letivo, { on: "2026-04-21", result: "x" }]), exp)).toThrow();
    expect(() => parseComposedDays(ok([letivo, { on: "2026-04-21", result: "conflito" }], { authorizes: true }), exp)).toThrow();
    expect(() => parseComposedDays(ok([{ ...letivo, calendarId: undefined }, { on: "2026-04-21", result: "conflito" }]), exp)).toThrow();
  });
});
