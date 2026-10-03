import { describe, expect, it, vi } from "vitest";
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => { rpc(...a); return Promise.resolve({ data: [], error: null }); }, from: vi.fn() } }));
import { isCivilDate, resolveAcademicReferenceDate } from "./academic-reference-date";
import { loadOfficialTimelineForClass } from "./institutional-period-source";
import { DIARY_REFERENCE_DATE } from "@/features/diary/diary-data";
import { resolveCyclesForOrigin, INSTITUTIONAL_CYCLES_UNAVAILABLE } from "@/features/assessment/cycle-configuration";
import { assessmentConfigurations } from "@/features/assessment/assessment-fixtures";

describe("B4.6.2b.2 — data acadêmica de referência", () => {
  it("valida data civil estrita", () => {
    expect(isCivilDate("2026-02-28")).toBe(true);
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("2026-13-01")).toBe(false);
    expect(isCivilDate("26-01-01")).toBe(false);
  });
  it("informada prevalece; institucional sem data usa hoje operacional; nunca a do laboratório", () => {
    expect(resolveAcademicReferenceDate({ provided: "2026-05-10", institutional: true, today: "2026-10-03" })).toEqual({ kind: "ready", date: "2026-05-10", source: "informada" });
    const r = resolveAcademicReferenceDate({ provided: undefined, institutional: true, today: "2026-10-03" });
    expect(r).toEqual({ kind: "ready", date: "2026-10-03", source: "hoje-operacional" });
    expect(resolveAcademicReferenceDate({ provided: "2026-02-30", institutional: true, today: "2026-10-03" }).kind).toBe("invalid");
    expect(resolveAcademicReferenceDate({ provided: undefined, institutional: false, today: "2026-10-03" })).toEqual({ kind: "ready", date: DIARY_REFERENCE_DATE, source: "laboratorio" });
  });
  it("timeline B2.4 real: sem data não consulta; com data envia _valid_on exata", async () => {
    expect((await loadOfficialTimelineForClass("c", "ay", undefined)).kind).toBe("unavailable");
    expect(rpc).not.toHaveBeenCalled();
    await loadOfficialTimelineForClass("c", "ay", "2026-05-10");
    expect(rpc).toHaveBeenCalledWith("class_period_organization_at", expect.objectContaining({ _class_id: "c", _valid_on: "2026-05-10" }));
  });
});

describe("B4.6.2b.2 (A6) — fronteira de ciclos", () => {
  const configuration = assessmentConfigurations[0]!;
  const structure = { id: "s", academicYearId: "ay", calendarId: "cal-x", periods: [{ id: "p1", sequence: 1, label: "P1", start: "2026-01-01", end: "2026-06-30" }] } as never;
  it("institucional: indisponível por extenso, sem ciclo anual nem todos-os-períodos", () => {
    const r = resolveCyclesForOrigin("institucional", { configuration, structure });
    expect(r).toEqual({ kind: "unavailable", origin: "institucional", reason: INSTITUTIONAL_CYCLES_UNAVAILABLE });
    expect(JSON.stringify(r)).not.toMatch(/Consolidação Anual|todos-os-periodos/);
  });
  it("laboratório: legado preservado (fallback demonstrativo)", () => {
    const r = resolveCyclesForOrigin("laboratorio", { configuration, structure });
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") expect(r.cycles[0]!.label).toBe("Consolidação Anual");
  });
});
