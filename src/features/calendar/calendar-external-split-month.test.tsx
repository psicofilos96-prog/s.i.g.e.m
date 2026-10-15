import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { richFixture } from "./calendar-external-rich-fixture";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { externalPresentation } from "./calendar-visual-resolver";
import { buildExternalViewModel, defaultProfile } from "./calendar-external-model";
import { FreeSheet } from "./calendar-external-sheets";

describe("EJA Semestral externo — mês dividido entre semestres", () => {
  it("julho: 1º semestre escurece a partir de 26; 2º semestre escurece 1–25; outubro intacto", () => {
    const f = richFixture(1);
    const pres = externalPresentation(f.presentation);
    const vm = buildExternalViewModel(buildPrintModel(pres, f.days, f.periods), pres, null);
    const base = defaultProfile("externo-livre", pres);
    const p = { ...base, free: { ...base.free, table: { ...base.free.table, semesters: true } } };
    const r = render(<FreeSheet vm={vm} p={p} presentation={pres} template={"externo-livre" as never} />);
    const jul = [...r.container.querySelectorAll('tr[data-month="2027-07"]')];
    expect(jul).toHaveLength(2);
    const dark = (tr: Element) => [...tr.querySelectorAll("td")].slice(0, 31).map((td, i) => td.classList.contains("cx-inexistente") ? i + 1 : 0).filter(Boolean);
    expect(dark(jul[0]!)).toEqual([26, 27, 28, 29, 30, 31]);
    expect(dark(jul[1]!)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    const oct = r.container.querySelector('tr[data-month="2027-10"]')!;
    expect(dark(oct)).toEqual([]);
  });
});
