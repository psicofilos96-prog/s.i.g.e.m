import { describe, expect, it } from "vitest";
import { layoutEnrollmentForm, BOTTOM, PAGE, type Layout, type Prim } from "./layout";
import { createMeasure, pageSvg, printHtml, renderPdf } from "./render";
import { blankFormData, type EnrollmentFormData } from "./model";
import { guardianSlot, payloadToForm } from "./source";

const measure = createMeasure();
const header = { government: "Prefeitura Municipal de Itaperuna", department: "Secretaria Municipal de Educação", school: "E M Nossa Senhora das Graças", address: "Rua Aluísio Dias Moreira, 320 – Presidente Costa e Silva", phone: "(22) 98842-1495", email: "escola@exemplo.gov.br" };
const filled = (over: Partial<EnrollmentFormData["student"]> = {}): EnrollmentFormData => ({
  header, yearLabel: "2027",
  student: { name: "Maria Clara da Silva", birth: "10/03/2019", grade: "2º ano", ...over },
  mother: { name: "Ana da Silva", phone: "(22) 99999-0000" },
});
const opts = (o: Partial<{ mode: "preenchida" | "branco"; specialEdAnnex: boolean; renewal: boolean }> = {}) => ({ mode: "preenchida" as const, specialEdAnnex: false, renewal: false, ...o });

function bounds(p: Prim): [number, number, number, number] {
  switch (p.k) {
    case "rect": case "image": return [p.x, p.y, p.x + p.w, p.y + p.h];
    case "line": return [Math.min(p.x1, p.x2), Math.min(p.y1, p.y2), Math.max(p.x1, p.x2), Math.max(p.y1, p.y2)];
    case "circle": return [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r];
    case "poly": return [Math.min(...p.pts.map((q) => q[0])), Math.min(...p.pts.map((q) => q[1])), Math.max(...p.pts.map((q) => q[0])), Math.max(...p.pts.map((q) => q[1]))];
    case "text": {
      const w = measure(p.s, p.size, !!p.bold); const x0 = p.align === "center" ? p.x - w / 2 : p.align === "right" ? p.x - w : p.x;
      return [x0, p.y - p.size * 0.3528 * 0.75, x0 + w, p.y + p.size * 0.3528 * 0.22];
    }
  }
}
const allTexts = (l: Layout) => l.pages.flatMap((p) => p.prims.filter((x): x is Extract<Prim, { k: "text" }> => x.k === "text").map((x) => x.s));
function assertInside(l: Layout) {
  for (const pg of l.pages) for (const p of pg.prims) {
    const [x0, y0, x1, y1] = bounds(p);
    expect(x0).toBeGreaterThanOrEqual(PAGE.m - 0.01); expect(x1).toBeLessThanOrEqual(PAGE.w - PAGE.m + 0.01);
    expect(y0).toBeGreaterThanOrEqual(PAGE.m - 0.01); expect(y1).toBeLessThanOrEqual(PAGE.h - PAGE.m + 0.01);
  }
}
/** Retângulos das seções (borda) não se sobrepõem e terminam antes do rodapé. */
function assertSectionsStack(l: Layout) {
  for (const pg of l.pages) {
    const secs = pg.prims.filter((p): p is Extract<Prim, { k: "rect" }> => p.k === "rect" && p.stroke === "#B9D1E5" && p.w > 180 && p.fill === "#FFFFFF");
    secs.sort((a, b) => a.y - b.y).forEach((s, i, arr) => { expect(s.y + s.h).toBeLessThanOrEqual(BOTTOM + 0.01); if (i) expect(s.y).toBeGreaterThanOrEqual(arr[i - 1]!.y + arr[i - 1]!.h); });
  }
}

describe("Ficha de Matrícula — modelo de impressão", () => {
  it("A4 retrato: 2 páginas base, +anexo de Educação Especial, +Controle de Renovação", () => {
    expect(layoutEnrollmentForm(filled(), opts(), measure).pages).toHaveLength(2);
    expect(layoutEnrollmentForm(filled(), opts({ specialEdAnnex: true }), measure).pages).toHaveLength(3);
    expect(layoutEnrollmentForm(filled(), opts({ specialEdAnnex: true, renewal: true }), measure).pages).toHaveLength(4);
    const pdf = renderPdf(layoutEnrollmentForm(filled(), opts(), measure), {}, "t");
    const sz = pdf.internal.pageSize; expect(Math.round(sz.getWidth())).toBe(210); expect(Math.round(sz.getHeight())).toBe(297);
  });
  it("nenhum elemento sai das margens de 12 mm nem se sobrepõe, em todos os cenários", () => {
    const long = "X".repeat(40) + " " + "Nome Extremamente Longo de Teste ".repeat(9);
    for (const l of [
      layoutEnrollmentForm(filled(), opts({ specialEdAnnex: true, renewal: true }), measure),
      layoutEnrollmentForm(filled({ name: long, address: long }), opts({ specialEdAnnex: true, renewal: true }), measure),
      layoutEnrollmentForm(blankFormData(header, "2027"), opts({ mode: "branco", specialEdAnnex: true, renewal: true }), measure),
    ]) { assertInside(l); assertSectionsStack(l); }
  });
  it("texto longo (300 caracteres) é quebrado sem perder nenhum caractere", () => {
    const name = "Ana Beatriz ".repeat(25).trim();
    const l = layoutEnrollmentForm(filled({ name }), opts(), measure);
    expect(allTexts(l).join(" ").replace(/\s+/g, "")).toContain(name.replace(/\s+/g, ""));
  });
  it("conteúdo que não cabe vai para página de continuação, nunca cortado", () => {
    const huge = "Rua muito comprida ".repeat(40);
    const l = layoutEnrollmentForm({ ...filled({ address: huge }), father: { address: huge }, guardian: { address: huge } }, opts(), measure);
    expect(l.pages.length).toBeGreaterThan(2);
    expect(allTexts(l).some((t) => t.includes("(continuação)"))).toBe(true);
    assertInside(l); assertSectionsStack(l);
  });
  it("nunca escreve texto técnico nem 'não informado'", () => {
    const html = printHtml(layoutEnrollmentForm({ header, student: {} }, opts({ renewal: true }), measure), {}, "t");
    expect(html).not.toMatch(/null|undefined|NaN|não informado|indeterminado/i);
  });
  it("sem registro, nenhuma caixa vem marcada (consentimento, saúde, documentos)", () => {
    const l = layoutEnrollmentForm(filled(), opts({ renewal: true }), measure);
    // marcação = par de linhas cruzadas em azul-marinho de 0,45 mm
    expect(l.pages.flatMap((p) => p.prims).filter((p) => p.k === "line" && p.lw === 0.45)).toHaveLength(0);
    const marked = layoutEnrollmentForm({ ...filled(), imageConsent: true, documents: ["foto"] }, opts(), measure);
    expect(marked.pages.flatMap((p) => p.prims).filter((p) => p.k === "line" && p.lw === 0.45)).toHaveLength(4);
  });
  it("ficha em branco ignora dados de aluno e mantém a escola e o ano", () => {
    const l = layoutEnrollmentForm(filled(), opts({ mode: "branco" }), measure);
    const t = allTexts(l).join(" ");
    expect(t).not.toContain("Maria Clara"); expect(t).toContain("NOSSA SENHORA DAS GRAÇAS"); expect(t).toContain("2027");
  });
  it("Controle de Renovação traz as colunas do quadro original", () => {
    const t = allTexts(layoutEnrollmentForm(filled(), opts({ renewal: true }), measure)).join(" ");
    for (const c of ["ANO LETIVO", "SÉRIE/ANO", "AUTORIZA IMAGEM", "MUDANÇA DE ENDEREÇO", "ASSINATURA DO RESPONSÁVEL", "RUBRICA DO SERVIDOR"]) expect(t).toContain(c);
  });
  it("rodapé numera 'Página X de Y' e SVG/PDF descrevem as mesmas páginas", () => {
    const l = layoutEnrollmentForm(filled(), opts({ renewal: true }), measure);
    expect(allTexts(l)).toContain("Página 3 de 3");
    expect(pageSvg(l, 0, {})).toMatch(/viewBox="0 0 210 297"/);
    expect(renderPdf(l, {}, "t").getNumberOfPages()).toBe(3);
  });
  it("pai e mãe só pelo parentesco declarado; nada é presumido", () => {
    expect(guardianSlot("Mãe")).toBe("mother"); expect(guardianSlot("pai")).toBe("father");
    expect(guardianSlot("Avó")).toBeNull(); expect(guardianSlot(undefined)).toBeNull();
    expect(payloadToForm({ responsaveis: [{ nome: "Rosa", parentesco: "Avó" }] }).guardian).toBeUndefined();
  });
});
