import { describe, expect, it } from "vitest";
import { buildFromDeclared, etapaColumn, PEOPLE_CATEGORIES } from "./map-official-model";
import { PAGE, renderOfficialMapPdf } from "./map-pdf";

const long = "Observação muito longa ".repeat(12);
const src = (n: number, people = 0) => buildFromDeclared({
  headerLines: ["Prefeitura"], schoolName: "Escola Municipal de Nome Muito Extenso Para Testar Quebra", inep: "1", year: 2026, month: 8,
  movement: { previous_month_enrollment: 10, transfers_in: null, new_students: 0, transfers_out: 0, dropouts: 0, withdrawn_cancelled: 0, total_ii: 10 },
  shifts: { turno1: 10, total: 10 },
  classes: Array.from({ length: n }, (_, i) => ({ modalidade: "ENSINO FUNDAMENTAL 1", etapa: `${(i % 5) + 1}º ANO`, turma: `T${i}`, alunos: 20, turno1: 20 })),
  projects: [], people: Array.from({ length: people }, (_, i) => ({ category: "B", cells: [`Pessoa ${i}`, "1", "Prof", "Prof", "100", "1º", "", long] })),
  signatures: ["Secretaria", "Direção"], generatedAt: "x",
});

describe("PDF do Mapa — paginação física A4 paisagem", () => {
  it("nada sai da área segura de 12 mm, em documento curto e longo", () => {
    for (const d of [src(3), src(120, 80)]) {
      const r = renderOfficialMapPdf(d, { cover: true });
      const out = r.boxes.filter((b) => b.x < PAGE.m - 0.01 || b.y < PAGE.m - 0.01 || b.x + b.w > PAGE.w - PAGE.m + 0.01 || b.y + b.h > PAGE.h - PAGE.m + 0.01);
      expect(out).toEqual([]);
    }
  });
  it("tabela longa continua na folha seguinte repetindo o título e o cabeçalho", () => {
    const r = renderOfficialMapPdf(src(120, 80), { cover: false });
    expect(r.pages).toBeGreaterThan(5);
    expect(r.text.filter((t) => t.includes("(continuação)")).length).toBeGreaterThan(2);
  });
  it("documento oficial não traz estado técnico nem coluna Origem; ausência é — e nunca 0", () => {
    const r = renderOfficialMapPdf(src(3), { cover: false });
    const all = r.text.join(" ");
    expect(all).not.toMatch(/Indeterminado|Origem|Sem regra homologada|Sem fonte no SIGEM/);
    const row = buildFromDeclared({ headerLines: [], schoolName: "E", inep: null, year: 2026, month: 8, movement: { previous_month_enrollment: null, transfers_in: null, new_students: null, transfers_out: null, dropouts: null, withdrawn_cancelled: null, total_ii: null }, shifts: null, classes: [], projects: [], signatures: [], generatedAt: "x" })
      .sections[1]!.blocks[0] as { rows: { cells: string[] }[] };
    expect(row.rows[0]!.cells.slice(1).every((c) => c === "—")).toBe(true);
  });
  it("seções fiéis ao modelo: IV em A–E, V em A–K, VI visitas", () => {
    const d = src(1);
    expect(d.sections.map((s) => s.id)).toEqual(["I", "II", "III", "IV", "V", "VI"]);
    expect(PEOPLE_CATEGORIES.map((c) => c.id).join("")).toBe("ABCDEFGHIJK");
    expect((d.sections[3]!.blocks as { caption?: string }[]).map((b) => b.caption?.[0])).toEqual(["A", "B", "C", "D", "E"]);
  });
  it("etapa só cai em coluna reconhecida", () => {
    expect(etapaColumn("MATERNAL II")).toBe(0); expect(etapaColumn("2º PERÍODO")).toBe(1); expect(etapaColumn("9º ANO")).toBe(10);
    expect(etapaColumn("FASE I", "EJA")).toBe(11); expect(etapaColumn("FASE VII", "EJA")).toBe(13); expect(etapaColumn("BANDA")).toBeNull();
  });
});
