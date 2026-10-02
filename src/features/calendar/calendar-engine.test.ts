import { describe, it, expect } from "vitest";
import { deriveCalendarProjection } from "./calendar-engine";
import { createCalendarFixtures } from "./calendar-fixtures";

describe("alternância de exibição das férias (texto vs marcador)", () => {
  it("modo padrão (ausente) exibe faixa contínua FÉRIAS mesclada", () => {
    const [regular] = createCalendarFixtures();
    const proj = deriveCalendarProjection(regular!);
    const monthRows = proj.grid.filter((r) => r.kind === "mes") as Array<{ segments: Array<{ kind: string }> }>;
    const hasFeriasBand = monthRows.some((r) => r.segments.some((s) => s.kind === "ferias"));
    expect(hasFeriasBand).toBe(true);
  });

  it("modo marcador não mescla férias: cada dia aparece como célula individual", () => {
    const [regular] = createCalendarFixtures();
    const cal = { ...regular!, document: { ...regular!.document, vacationDisplay: "marcador" as const } };
    const proj = deriveCalendarProjection(cal);
    const monthRows = proj.grid.filter((r) => r.kind === "mes") as Array<{ segments: Array<{ kind: string }> }>;
    const hasFeriasBand = monthRows.some((r) => r.segments.some((s) => s.kind === "ferias"));
    expect(hasFeriasBand).toBe(false);
  });

  it("invariante crítico: o total de dias letivos anual é idêntico em ambos os modos", () => {
    const [regular] = createCalendarFixtures();
    const textoCal = regular!;
    const marcadorCal = { ...regular!, document: { ...regular!.document, vacationDisplay: "marcador" as const } };
    const textoProj = deriveCalendarProjection(textoCal);
    const marcadorProj = deriveCalendarProjection(marcadorCal);
    expect(marcadorProj.annualSchoolDays).toBe(textoProj.annualSchoolDays);
    expect(marcadorProj.calendarSchoolDays).toBe(textoProj.calendarSchoolDays);
    expect(marcadorProj.schoolDaysOutsidePeriods).toBe(textoProj.schoolDaysOutsidePeriods);
  });

  it("invariante crítico: a validação (ex.: mínimo de dias de férias) não varia entre os modos", () => {
    const [regular] = createCalendarFixtures();
    const textoCal = regular!;
    const marcadorCal = { ...regular!, document: { ...regular!.document, vacationDisplay: "marcador" as const } };
    const textoProj = deriveCalendarProjection(textoCal);
    const marcadorProj = deriveCalendarProjection(marcadorCal);
    expect(marcadorProj.validation.length).toBe(textoProj.validation.length);
  });
});
