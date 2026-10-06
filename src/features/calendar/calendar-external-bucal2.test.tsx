import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { richFixture } from "./calendar-external-rich-fixture";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { canonicalTypeMap, catalogCoverage, externalPresentation, resolveVisual } from "./calendar-visual-resolver";
import { buildExternalViewModel, defaultProfile } from "./calendar-external-model";
import { MosaicSheet, PanoramicSheet } from "./calendar-external-sheets";

const f = richFixture();
const pres = externalPresentation(f.presentation);
const model = buildPrintModel(pres, f.days, f.periods);
const vm = buildExternalViewModel(model, pres, { versionId: "ver-rica", config: f.council, days: f.days });

describe("BU.CAL.2 — resolvedor visual único e folhas de uma página", () => {
  it("causa raiz: typeMap gravado código→versão é normalizado por identidade; período ignorado", () => {
    const m = canonicalTypeMap(f.presentation);
    expect(m["tv-FERIADO"]).toBe("FERIADO");
    expect(Object.keys(m).some((k) => k.startsWith("period:"))).toBe(false);
  });
  it("Lote 3 — o Interno (apresentação gravada, sem normalizar antes) já resolve todos os tipos e é idêntico ao externo dia a dia", () => {
    expect(f.rawModel.unmappedTypes).toEqual([]);
    expect(f.rawModel.days.map((d) => [d.on, d.symbolCode, d.effect])).toEqual(model.days.map((d) => [d.on, d.symbolCode, d.effect]));
    expect(f.rawModel.days.filter((d) => d.symbolCode !== null).length).toBeGreaterThan(300);
  });
  it("cobertura 100%: todo código do catálogo tem token visual conhecido", () => {
    const c = catalogCoverage(pres);
    expect(c.missing).toEqual([]);
    for (const code of c.codes) expect(resolveVisual(pres, code).known).toBe(true);
    expect(f.usedCodes.length).toBeGreaterThan(8);
  });
  it("zero 'Tipo sem mapeamento' e zero '?' nas duas folhas", () => {
    expect(model.unmappedTypes).toEqual([]);
    for (const El of [PanoramicSheet, MosaicSheet]) {
      const r = render(<El vm={vm} p={defaultProfile("externo-panoramico", pres)} presentation={pres} />);
      expect(r.queryAllByTestId("cx-unmapped")).toEqual([]);
      const cells = [...r.container.querySelectorAll("td[data-date]")];
      expect(cells.length).toBe(365);
      expect(cells.filter((c) => c.textContent!.includes("?"))).toEqual([]);
      expect(cells.filter((c) => !(c as HTMLElement).style.backgroundColor)).toEqual([]);
      r.unmount();
    }
  });
  it("totais idênticos entre Interno (modelo bruto) e externos; feriados, períodos e conselhos puxados", () => {
    expect(model.total).toEqual(f.rawModel.total);
    expect(model.periods).toEqual(f.rawModel.periods);
    expect(model.months.map((m) => m.total)).toEqual(f.rawModel.months.map((m) => m.total));
    expect(model.total.schoolDays).toBeGreaterThan(150);
    expect(model.holidays.length).toBeGreaterThan(5);
    expect(model.periods.every((p) => p.schoolDays !== null)).toBe(true);
    expect(vm.councils.state).toBe("configurada");
    expect(vm.councils.state === "configurada" && vm.councils.items.length).toBeGreaterThan(0);
  });
});
