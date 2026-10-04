import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { buildImportPlan, referenceCalendars2027 } from "./calendar-browser-import";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { InstitutionalPrintSheet } from "./institutional-calendar-print";
import type { CalendarDayRead, DayDeclarationRow } from "./institutional-calendar-readers";

const row = (o: Partial<DayDeclarationRow>): DayDeclarationRow => ({
  declarationId: "d", declarationKind: "intervalo", dayState: "declarado", startsOn: null, endsOn: null, eventLabel: null, dayTypeId: "t",
  dayTypeVersionId: "tv-letivo", dayTypeVersion: 1, dayTypeLabel: "Letivo", schoolDayEffect: true, ...o,
} as DayDeclarationRow);
const day = (on: string, rows: DayDeclarationRow[] | null, state = "homologada"): CalendarDayRead => ({ on, state, rows });
const dates = (from: string, to: string) => { const o: string[] = []; for (let c = from; c <= to;) { o.push(c); const d = new Date(`${c}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); c = d.toISOString().slice(0, 10); } return o; };

describe("folha institucional com fonte REAL 2027", () => {
  const ref = referenceCalendars2027()[0]!;
  const plan = buildImportPlan(ref);
  const letivo = plan.types.find((t) => t.countsAsSchoolDay === true)!.code;
  const feriado = Object.values(plan.presentation["dayTypeCatalog"] as Record<string, { code: string; kind: string }>).find((t) => t.kind === "feriado")!.code;
  const presentation = {
    ...plan.presentation, title: "Calendário Regular 2027",
    document: { ...(plan.presentation["document"] as object), headerLines: ["PREFEITURA MUNICIPAL", "SECRETARIA DE EDUCAÇÃO"], showHolidays: true,
      layout: { global: {}, blocks: { legenda: { title: { sizePt: 13 } } }, print: { separate: true, blocks: { legenda: { title: { sizePt: 9 } } } },
        logos: [{ id: "lg", label: "Brasão", position: "esquerda", visible: true, source: { kind: "asset", assetId: "https://x/brasao.png" } }] } },
    symbology: { [feriado]: { shape: "circulo", text: "FX" } },
    observations: "Linha de observação 1\nLinha 2",
    typeMap: { "tv-letivo": letivo, "tv-fer": feriado, "tv-ev": "RP" },
    coexistingEvents: { "2027-04-21": ["RP"] },
  };
  const days = [
    ...dates("2027-04-01", "2027-04-20").map((d) => day(d, [row({})])),
    day("2027-04-21", [row({}), row({ declarationId: "e", declarationKind: "evento", dayTypeVersionId: "tv-fer", dayTypeLabel: "Feriado", schoolDayEffect: false, eventLabel: "Tiradentes" })]),
    ...dates("2027-04-22", "2027-04-29").map((d) => day(d, [row({})])),
    day("2027-04-30", null, "nao-homologado-na-data"),
  ];
  // conflito real: 21/04 tem letivo + feriado ⇒ conflito pelo efeito; usar só feriado para o caso compatível
  days[20] = day("2027-04-21", [row({ declarationId: "e", declarationKind: "evento", dayTypeVersionId: "tv-fer", dayTypeLabel: "Feriado", schoolDayEffect: false, eventLabel: "Tiradentes" })]);

  it("cobertura integral: período maior que o lido, ou com dia indeterminado, nunca é contado", () => {
    const m = buildPrintModel(presentation, days, [
      { name: "A", startsOn: "2027-04-01", endsOn: "2027-04-29" },
      { name: "Antes", startsOn: "2027-03-30", endsOn: "2027-04-10" },
      { name: "Depois", startsOn: "2027-04-20", endsOn: "2027-05-03" },
    ]);
    expect(m.periods[0]!.schoolDays).toBe(28);
    expect(m.periods[1]!.schoolDays).toBeNull(); expect(m.periods[1]!.reason).toMatch(/2027-03-30: fora do intervalo lido/);
    expect(m.periods[2]!.schoolDays).toBeNull();
    expect(m.total.schoolDays).toBeNull();
    expect(m.months[0]!.total.schoolDays).toBeNull();
    expect(m.holidays).toEqual([{ on: "2027-04-21", name: "Tiradentes" }]);
  });

  it("renderiza cabeçalho, logo, layout/print CSS, simbologia, companheiro, legenda, observações, assinaturas; indeterminado ≠ 0", () => {
    const m = buildPrintModel(presentation, days, [{ name: "1º Bimestre", startsOn: "2027-04-01", endsOn: "2027-05-10" }]);
    const { container, getByTestId } = render(<InstitutionalPrintSheet model={m} presentation={presentation} versionId="ver-1" />);
    const sheet = getByTestId("institutional-print-sheet");
    expect(within(sheet).getByText("PREFEITURA MUNICIPAL")).toBeTruthy();
    expect(within(sheet).getByText(/CALENDÁRIO ESCOLAR 2027 – Calendário Regular 2027/)).toBeTruthy();
    expect(container.querySelector('img[src="https://x/brasao.png"]')).toBeTruthy();
    const css = container.querySelector("style")!.textContent!;
    expect(css).toContain('.cd-folha[data-calendar-id="ver-1"]'); expect(css).toContain(".cd-a4 .cd-folha");
    const cell = container.querySelector('[data-date="2027-04-21"]')!;
    expect(cell.textContent).toContain("FX");
    expect(cell.querySelector(".cd-marcadores")).toBeTruthy();
    expect(within(sheet).getByText("Tiradentes")).toBeTruthy();
    expect(within(sheet).getByText("Linha de observação 1")).toBeTruthy();
    expect(within(sheet).getByText("Legenda:")).toBeTruthy();
    expect(getByTestId("total-anual").textContent).toBe("indeterminado");
    expect(container.querySelector('[data-date="2027-04-30"]')!.textContent).toBe("?");
    for (const s of plan.presentation["signatures"] as string[]) expect(within(sheet).getAllByText(s).length).toBeGreaterThan(0);
  });
});
