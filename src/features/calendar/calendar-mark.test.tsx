import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { CalendarDocument } from "./calendar-document";
import { createCalendarFixtures } from "./calendar-fixtures";
import { DAY_TYPES } from "./calendar-catalog";
import { DayMark, MarkerGlyph } from "./calendar-mark";
import { deriveCalendarProjection } from "./calendar-engine";
import {
  DEFAULT_SYMBOLOGY,
  markTextFor,
  symbologyFor,
  validateSymbology,
  type MarkerSymbology,
} from "./calendar-symbology";

const shapes = (el: ParentNode) =>
  [...el.querySelectorAll(".cd-marcador")].map((e) => [e.getAttribute("data-shape"), e.textContent]);

describe("sistema de simbologia do calendário", () => {
  it("EBV só texto; CC, CF e C em retângulo, na grade e na legenda", () => {
    expect(markTextFor("ENCONTRO", "grade")).toBe("EBV");
    expect(symbologyFor("ENCONTRO").shape).toBe("nenhuma");
    for (const code of ["CC", "CF", "CENSO"] as const) expect(symbologyFor(code).shape).toBe("retangulo");
    for (const cal of createCalendarFixtures()) {
      const { container, unmount } = render(<CalendarDocument cal={cal} />);
      const found = shapes(container);
      expect(found.every(([s, t]) => s === "retangulo" && ["CC", "CF", "C"].includes(t!))).toBe(true);
      const legend = shapes(container.querySelector(".cd-rodape")!);
      const grid = shapes(container.querySelector(".cd-grade")!);
      // legenda e célula saem da mesma configuração
      for (const [s, t] of legend) if (grid.some(([, gt]) => gt === t)) expect(grid).toContainEqual([s, t]);
      expect(container.textContent).not.toContain("*");
      unmount();
    }
  });

  it("forma, fundo, borda, cor e tamanho de fonte são independentes", () => {
    const s: MarkerSymbology = {
      shape: "triangulo",
      fillColor: "#FFFF00",
      borderColor: "#0000FF",
      textColor: "#000000",
      fontSizePt: 7,
      borderWidthPx: 2,
    };
    expect(validateSymbology(s)).toEqual([]);
    const { container } = render(<MarkerGlyph symbology={s} text="ABC" />);
    expect(container.querySelector(".cd-marcador")?.getAttribute("data-shape")).toBe("triangulo");
    const poly = container.querySelector("polygon")!;
    expect(poly.getAttribute("fill")).toBe("#FFFF00");
    expect(poly.getAttribute("stroke")).toBe("#0000FF");
    const txt = container.querySelector(".cd-marcador > span") as HTMLElement;
    expect(txt.style.color).toBe("rgb(0, 0, 0)");
    expect(txt.style.fontSize).toBe("7pt");
  });

  it("forma diferente é renderizada pelo mesmo componente, sem unicode fingindo forma", () => {
    const { container } = render(
      <DayMark code="CC" text="CC" symbology={{ shape: "circulo", borderColor: "#FF0000" }} />,
    );
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.textContent).toBe("CC");
  });

  it("valida limites sem corrigir silenciosamente", () => {
    const bad: MarkerSymbology = { shape: "retangulo", fontSizePt: 40, fillColor: "vermelho" };
    expect(validateSymbology(bad).map((i) => i.field).sort()).toEqual(["fillColor", "fontSizePt"]);
    const { container } = render(<MarkerGlyph symbology={bad} text="CC" />);
    expect(container.querySelector("[data-symbology-invalid]")).not.toBeNull();
    expect(bad.fontSizePt).toBe(40);
    for (const s of Object.values(DEFAULT_SYMBOLOGY)) expect(validateSymbology(s!)).toEqual([]);
  });

  it("aparência não altera identidade nem contagem de dias letivos", () => {
    const cal = createCalendarFixtures()[0]!;
    const before = deriveCalendarProjection(cal);
    const saved = DEFAULT_SYMBOLOGY.CC!;
    DEFAULT_SYMBOLOGY.CC = { shape: "elipse", fillColor: "#000000", textColor: "#FFFFFF" };
    try {
      const after = deriveCalendarProjection(cal);
      expect(after.annualSchoolDays).toBe(before.annualSchoolDays);
      expect(DAY_TYPES["CC"]!.code).toBe("CC");
      expect(DAY_TYPES["CC"]!.countsAsSchoolDay).toBe(true);
    } finally {
      DEFAULT_SYMBOLOGY.CC = saved;
    }
    // Nenhum módulo de regra lê a simbologia além da sigla textual.
    for (const f of ["calendar-governance.ts", "calendar-assessment-link.ts"])
      expect(readFileSync(`src/features/calendar/${f}`, "utf8")).not.toContain("calendar-symbology");
    expect(readFileSync("src/features/calendar/calendar-engine.ts", "utf8")).not.toMatch(
      /symbologyFor|shape|fillColor/,
    );
  });

  it("dia com dois eventos: CF mantém o retângulo e T sua própria aparência", () => {
    const { container } = render(<DayMark code="TERMINO" text="CF T" />);
    expect(shapes(container)).toEqual([["retangulo", "CF"]]);
    expect(container.textContent).toBe("CFT");
  });

  it("personalização do calendário vence o padrão e chega à legenda e à célula", () => {
    const cal = {
      ...createCalendarFixtures()[0]!,
      symbology: { CC: { shape: "triangulo", borderColor: "#0000FF", borderWidthPx: 2 } as MarkerSymbology },
    };
    const { container } = render(<CalendarDocument cal={cal} />);
    const tri = [...container.querySelectorAll('.cd-marcador[data-shape="triangulo"]')];
    expect(tri.some((e) => e.closest(".cd-grade"))).toBe(true);
    expect(tri.some((e) => e.closest(".cd-rodape"))).toBe(true);
    expect(deriveCalendarProjection(cal).annualSchoolDays).toBe(
      deriveCalendarProjection(createCalendarFixtures()[0]!).annualSchoolDays,
    );
  });
});
