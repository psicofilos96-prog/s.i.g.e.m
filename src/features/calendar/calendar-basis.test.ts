import { describe, expect, it } from "vitest";
import { calendarBasisSnapshot, preserveFactDate, ratioOverSchoolDays } from "./calendar-basis";
import { institutionalCalendarDependency, summarizeCalendarRange } from "./institutional-calendar-days";
import { documentAvailability, documentDependencies, documentDependenciesForSession } from "@/features/assessment/document-dependencies";

const K = "2026-03-02T12:00:00.000000Z";

describe("B4.6.3f calendar basis", () => {
  it("sem calendário aplicável: denominador desconhecido nunca vira percentual nem zero", () => {
    const { summary } = institutionalCalendarDependency({ start: "2026-03-01", end: "2026-03-31" }, K);
    const basis = calendarBasisSnapshot(summary, { calendarId: null, knownAt: K, start: "2026-03-01", end: "2026-03-31" });
    expect(basis.schoolDays).toBeNull();
    const r = ratioOverSchoolDays(12, basis);
    expect(r.kind).toBe("indisponivel");
    expect(r.value).toBeNull();
    expect(r.kind === "indisponivel" && r.reason).toMatch(/não há calendário institucional declarado/);
  });

  it("numerador ausente não é zero; base determinada divide; zero dias não divide", () => {
    const det = summarizeCalendarRange([]);
    expect(det.kind).toBe("determinado");
    const zero = calendarBasisSnapshot(det, { calendarId: "cal-ficticio", knownAt: K, start: "2026-03-01", end: "2026-03-01" });
    expect(ratioOverSchoolDays(3, zero).kind).toBe("indisponivel");
    const five = { ...zero, schoolDays: 5 };
    expect(ratioOverSchoolDays(4, five)).toMatchObject({ kind: "calculado", value: 0.8 });
    expect(ratioOverSchoolDays(null, five).value).toBeNull();
  });

  it("snapshot emitido é imutável e preserva knownAt/calendarId de proveniência", () => {
    const { summary } = institutionalCalendarDependency({ start: "2026-03-01", end: "2026-03-02" }, K);
    const b = calendarBasisSnapshot(summary, { calendarId: null, knownAt: K, start: "2026-03-01", end: "2026-03-02" });
    expect(Object.isFrozen(b)).toBe(true);
    expect(() => { (b as { schoolDays: number | null }).schoolDays = 10; }).toThrow();
    expect(b.knownAt).toBe(K);
  });

  it("data de fato não é deslocada (feriado/domingo)", () => {
    expect(preserveFactDate("2026-12-25")).toBe("2026-12-25");
    expect(preserveFactDate("2026-03-01")).toBe("2026-03-01");
  });
});

describe("B4.6.3f documentos com sessão", () => {
  it("laboratório mantém o mapa demonstrativo", () => {
    expect(documentDependenciesForSession(false, null)).toBe(documentDependencies);
  });
  it("sessão: aulas previstas citam o motivo real e nada demonstrativo conta como existente", () => {
    const reason = institutionalCalendarDependency({ start: "2026-03-02", end: "2026-03-02" }, K).reason;
    const deps = documentDependenciesForSession(true, reason);
    const diario = deps.find((d) => d.document === "Diário de Classe")!;
    expect(diario.requires.find((r) => r.data.startsWith("Aulas previstas"))!.data).toMatch(/não há calendário institucional declarado/);
    for (const d of deps) {
      expect(d.requires.some((r) => r.state === "existe-demonstrativo")).toBe(false);
      expect(documentAvailability(d).satisfied).toBe(0);
    }
  });
});
