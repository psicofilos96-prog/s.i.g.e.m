import { describe, expect, it } from "vitest";
import { buildDaysPayload, buildImportPlan, customizationsAgainstReference, readBrowserCalendarsOnRequest, referenceCalendars2027, BROWSER_CALENDAR_KEY } from "./calendar-browser-import";

describe("B4.6.7b importação do navegador", () => {
  it("ausente quando não há registro; nunca grava", () => {
    const writes: string[] = [];
    const r = readBrowserCalendarsOnRequest((k) => { writes.push(k); return null; });
    expect(r.state).toBe("ausente"); expect(writes).toEqual([BROWSER_CALENDAR_KEY]);
  });
  it("ilegível não importa", () => {
    expect(readBrowserCalendarsOnRequest(() => "{x").state).toBe("ilegivel");
    expect(readBrowserCalendarsOnRequest(() => "[{\"a\":1}]").state).toBe("ilegivel");
  });
  it("detecta personalizações do salvo e preserva original", () => {
    const ref = referenceCalendars2027()[0]!;
    const saved = { ...ref, title: "TÍTULO PERSONALIZADO", signatures: ["Assinatura X"] };
    const raw = JSON.stringify([saved]);
    const r = readBrowserCalendarsOnRequest(() => raw);
    expect(r.state).toBe("lido");
    if (r.state !== "lido") return;
    expect(r.raw).toBe(raw);
    expect(customizationsAgainstReference(r.entries[0]!)).toEqual(expect.arrayContaining(["title", "signatures"]));
    const plan = buildImportPlan(r.entries[0]!);
    expect(plan.presentation["title"]).toBe("TÍTULO PERSONALIZADO");
    expect(plan.presentation["signatures"]).toEqual(["Assinatura X"]);
  });
  it("uma declaração por data resolvida; efeito preservado; null nunca vira false", () => {
    const plan = buildImportPlan(referenceCalendars2027()[0]!);
    expect(new Set(plan.days.map((d) => d.day)).size).toBe(plan.days.length);
    const map = Object.fromEntries(plan.types.map((t) => [t.code, { versionId: `v-${t.code}`, schoolDayEffect: t.countsAsSchoolDay }]));
    const ok = buildDaysPayload(plan, map);
    expect(ok.ok).toBe(true);
    const t0 = plan.types[0]!;
    const wrong = buildDaysPayload(plan, { ...map, [t0.code]: { versionId: "x", schoolDayEffect: t0.countsAsSchoolDay === true ? null : true } });
    expect(wrong.ok).toBe(false);
    const missing = buildDaysPayload(plan, { ...map, [t0.code]: undefined });
    expect(missing.ok).toBe(false);
  });
});
