import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CalendarDocument } from "./calendar-document";
import { createCalendarFixtures } from "./calendar-fixtures";
import { deriveCalendarProjection } from "./calendar-engine";
import {
  LAYOUT_BLOCKS,
  adoptLegacyTypography,
  applySpacingPreset,
  cleanLayout,
  layoutCss,
  presetOf,
  resolveBlock,
  validateLayout,
} from "./calendar-layout";
import { MarkerGlyph, SHAPE_GEOMETRY, shapeFits } from "./calendar-mark";
import type { NetworkCalendar } from "./calendar-types";

const cal = createCalendarFixtures()[0]!;
const withLayout = (layout: NetworkCalendar["document"]["layout"]): NetworkCalendar => ({
  ...cal,
  document: { ...cal.document, layout },
});

describe("diagramação configurável do calendário", () => {
  it("herança: calendário → bloco → elemento", () => {
    const doc = withLayout({
      global: { text: { sizePt: 9, family: "Arial" }, rows: { gapPt: 3 } },
      blocks: { legenda: { rows: { gapPt: 1.5 } }, feriados: { content: { sizePt: 8 } } },
    }).document;
    expect(resolveBlock(doc, "legenda").content.sizePt).toBe(9);
    expect(resolveBlock(doc, "legenda").rows.gapPt).toBe(1.5);
    expect(resolveBlock(doc, "feriados").rows.gapPt).toBe(3);
    expect(resolveBlock(doc, "feriados").content.sizePt).toBe(8);
    expect(resolveBlock(doc, "feriados").title.family).toBe("Arial");
  });

  it("sem configuração não gera regra (modelo intacto)", () => {
    expect(layoutCss(cal.id, cal.document)).toBe("");
  });

  it("gera CSS escopado para linhas, colunas, blocos e página", () => {
    const css = layoutCss(
      "x",
      withLayout({
        global: { pageMarginMm: { top: 10 }, footerGapPt: 4 },
        blocks: {
          feriados: { rows: { gapPt: 2, columnGapPt: 1, columnsPt: { data: 30 } }, box: { marginTopPt: 5 } },
        },
      }).document,
    );
    expect(css).toContain('[data-cd-bloco="feriados"] .cd-feriado-linha + .cd-feriado-linha{margin-top:2pt}');
    expect(css).toContain("--cd-col-data:30pt");
    expect(css).toContain("column-gap:1pt");
    expect(css).toContain("margin-top:5pt");
    expect(css).toContain(".cd-a4:has(>");
    expect(css).toContain("column-gap:4pt");
  });

  it("preset só preenche os mesmos campos do modo personalizado", () => {
    const r = applySpacingPreset({ gapPt: 7 }, "compacto");
    expect(r).toEqual({ gapPt: 0, heightPt: 9 });
    expect(presetOf(r)).toBe("compacto");
    expect(presetOf(applySpacingPreset(r, "padrao"))).toBe("padrao");
    expect(presetOf({ gapPt: 1 })).toBe("personalizado");
  });

  it("fora do limite é apontado e não aplicado", () => {
    const l = { blocks: { legenda: { rows: { gapPt: 99 } } } };
    expect(validateLayout(l)).toHaveLength(1);
    expect(layoutCss("x", withLayout(l).document)).not.toContain("99pt");
  });

  it("formatação antiga vira herança e é adotada pelo editor", () => {
    const doc = { ...cal.document, typography: { feriados: { sizePt: 7, bold: true } } };
    expect(resolveBlock(doc, "feriados").content).toMatchObject({ sizePt: 7, weight: 700 });
    expect(adoptLegacyTypography(doc).blocks?.["feriados"]?.content).toMatchObject({ sizePt: 7 });
    expect(cleanLayout({ global: {}, blocks: { a: {} } })).toBeUndefined();
  });

  it("todo bloco registrado existe no documento e a aparência não muda a projeção", () => {
    const styled = withLayout({ blocks: { legenda: { rows: { gapPt: 5 } } } });
    const { container } = render(<CalendarDocument cal={styled} />);
    for (const b of LAYOUT_BLOCKS.filter((x) => x.root.startsWith("[")))
      if (!["conselhos", "informacoes"].includes(b.id) || container.querySelector(b.root))
        expect(container.querySelector(b.root), b.id).toBeTruthy();
    expect(deriveCalendarProjection(styled)).toEqual(deriveCalendarProjection(cal));
  });
});

describe("centralização geométrica do marcador", () => {
  const shapes = ["retangulo", "retangulo-arredondado", "circulo", "elipse", "triangulo"] as const;
  it("sigla posicionada no centro visual da forma (triângulo = incentro)", () => {
    for (const shape of shapes)
      for (const text of ["C", "CC", "CF", "ABC"]) {
        const { container, unmount } = render(<MarkerGlyph symbology={{ shape, borderWidthPx: 1 }} text={text} />);
        const s = container.querySelector<HTMLElement>(".cd-marcador-sigla")!;
        const g = SHAPE_GEOMETRY[shape].center;
        expect(s.style.left).toBe(`${g.x * 100}%`);
        expect(s.style.top).toBe(`${g.y * 100}%`);
        expect(container.textContent).toBe(text);
        unmount();
      }
    expect(SHAPE_GEOMETRY.triangulo.center.y).toBeGreaterThan(0.6);
  });

  it("molde automático sempre cabe; dimensão pequena é apontada, não comprimida", () => {
    for (const shape of shapes) {
      const k = SHAPE_GEOMETRY[shape].scale;
      const sq = SHAPE_GEOMETRY[shape].square;
      expect(shapeFits(shape, { width: 20 * k, height: (sq ? 20 : 10) * k }, { width: 20, height: 10 })).toBe(true);
      expect(shapeFits(shape, { width: 12, height: 8 }, { width: 20, height: 10 })).toBe(false);
    }
  });
});

describe("personalização separada da impressão", () => {
  const base = { blocks: { feriados: { rows: { gapPt: 6 } } } };
  it("desligada: A4 herda a camada geral e nenhuma regra .cd-a4 extra é gerada", async () => {
    const { printLayout } = await import("./calendar-layout");
    const l = { ...base, print: { separate: false, blocks: { feriados: { rows: { gapPt: 4 } } } } };
    expect(printLayout(l).blocks?.["feriados"]?.rows?.gapPt).toBe(6);
    expect(layoutCss("x", { ...cal.document, layout: l })).not.toContain(".cd-a4 .cd-folha");
  });
  it("ligada: só a sobrescrita (4 pt) muda na impressão; o resto herda", async () => {
    const { printLayout } = await import("./calendar-layout");
    const l = {
      blocks: { feriados: { rows: { gapPt: 6 }, content: { family: "Times New Roman", sizePt: 11 } } },
      print: { separate: true, blocks: { feriados: { rows: { gapPt: 4 } } } },
    };
    const p = printLayout(l);
    expect(p.blocks?.["feriados"]?.rows?.gapPt).toBe(4);
    expect(p.blocks?.["feriados"]?.content?.sizePt).toBe(11);
    const css = layoutCss("x", { ...cal.document, layout: l });
    expect(css).toMatch(/margin-top:6pt/);
    expect(css).toMatch(/\.cd-a4 \.cd-folha\[data-calendar-id="x"\][^{]*\{margin-top:4pt/);
    // a sobrescrita não é cópia: a camada de impressão guarda só o valor diferente
    expect(Object.keys(l.print.blocks.feriados)).toEqual(["rows"]);
  });
  it("valor fora do limite na impressão é apontado com caminho próprio", () => {
    const issues = validateLayout({ print: { separate: true, blocks: { feriados: { rows: { gapPt: 99 } } } } });
    expect(issues[0]?.path).toBe("print.blocks.feriados.rows.gapPt");
  });
});

describe("folha A4 nunca corta nem esconde", () => {
  it("CSS da folha não usa overflow hidden nem altura fixa do documento", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles.css", "utf8");
    const a4 = css.slice(css.indexOf("  .cd-a4 {"), css.indexOf("  .cd-a4 .cd-cabecalho"));
    expect(a4).not.toMatch(/overflow:\s*hidden/);
    expect(a4).toMatch(/min-height:\s*100%/);
  });
});

describe("centralização geométrica — sem folga fixa", () => {
  it("C, CC e CF no retângulo: folgas laterais iguais (centro em 50%)", () => {
    for (const text of ["C", "CC", "CF"]) {
      const { container, unmount } = render(<MarkerGlyph symbology={{ shape: "retangulo" }} text={text} />);
      const s = container.querySelector<HTMLElement>(".cd-marcador-sigla")!;
      expect([s.style.left, s.style.top]).toEqual(["50%", "50%"]);
      unmount();
    }
  });
  it("círculo, elipse e triângulo com C, CC, CF e ABC: caber depende da geometria, não de 2 px", () => {
    for (const shape of ["circulo", "elipse", "triangulo"] as const)
      for (const [text, w] of [["C", 6], ["CC", 12], ["CF", 12], ["ABC", 18]] as const) {
        const k = SHAPE_GEOMETRY[shape].scale;
        const sq = SHAPE_GEOMETRY[shape].square;
        const box = { width: (sq ? Math.max(w, 8) : w) * k, height: (sq ? Math.max(w, 8) : 8) * k };
        expect(shapeFits(shape, box, { width: w, height: 8 }), `${shape}/${text}`).toBe(true);
        // caixa justa à sigla cabe no retângulo, mas não numa forma curva/triangular:
        // a folga necessária varia com forma e sigla — não existe "2 px" universal
        expect(shapeFits("retangulo", { width: w, height: 8 }, { width: w, height: 8 })).toBe(true);
        expect(shapeFits(shape, { width: w, height: 8 }, { width: w, height: 8 })).toBe(false);
      }
  });
});
