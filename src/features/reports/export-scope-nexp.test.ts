import { describe, expect, it } from "vitest";
import { collectAll, buildResult, type BuilderSource } from "./report-builder";
import { exportIncomplete, runReport, toCsv, toXlsx, toPrintableHtml, type ReportDefinition, type CellValue } from "./report-engine";
import { toCsv as inclusionCsv } from "@/features/inclusion/inclusion-model";

const DEF: ReportDefinition = {
  id: "t", version: 1, title: "Teste", description: "", source: "t", params: [],
  columns: [
    { id: "escola", label: "Escola", kind: "text" },
    { id: "nome", label: "Nome", kind: "text" },
    { id: "cpf", label: "CPF", kind: "text", sensitive: true },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 100_000,
};

/** Reader simulado com RLS: só devolve linhas da escola da conta, paginado. */
function rlsSource(all: Record<string, CellValue>[], school: string, pageSize = 1000): BuilderSource {
  const visible = all.filter((r) => r["escola"] === school);
  return {
    id: "t", title: "t", sectors: [] as never, definition: DEF, methodology: "", acl: "", period: false, pageSize, filterable: ["nome"],
    load: async ({ offset, limit }) => ({ rows: visible.slice(offset, offset + limit), total: visible.length }),
  } as BuilderSource;
}

const N = 12_345;
const ALL = Array.from({ length: N * 2 }, (_, i) => ({ escola: i % 2 ? "B" : "A", nome: `Pessoa ${i}`, cpf: `000.000.000-${i}` }));

describe("NEXP — exportação = escopo da tela", () => {
  it("volume: 12.345 linhas em 13 páginas, nada perdido nem truncado", async () => {
    const c = await collectAll(rlsSource(ALL, "A"), null, null);
    expect(c.rows.length).toBe(N);
    expect(c.pages).toBe(13);
    expect(c.truncated).toBe(false);
  });
  it("volume acima do teto é declarado incompleto", async () => {
    const c = await collectAll(rlsSource(ALL, "A"), null, null, 5000);
    expect(c.rows.length).toBe(5000);
    expect(c.truncated).toBe(true);
  });
  it("isolamento: conta da escola A nunca exporta linha da escola B, em CSV/XLSX/PDF", async () => {
    const c = await collectAll(rlsSource(ALL, "A"), null, null);
    const r = buildResult(rlsSource(ALL, "A"), { sourceId: "t", from: null, to: null, columns: ["escola", "nome"], filters: [], sort: [] }, c.rows);
    expect(r.rows.every((x) => x[0] === "A")).toBe(true);
    const csv = toCsv(r, { headerLines: [], title: "t" });
    expect(csv).not.toMatch(/(^|;)B;/m);
    expect(toPrintableHtml(r, { headerLines: [], title: "t" })).not.toContain(">B<");
    expect((await toXlsx(r, { headerLines: [], title: "t" })).byteLength).toBeGreaterThan(0);
  });
  it("mesmo filtro da tela: exportação tem exatamente as linhas da prévia", async () => {
    const c = await collectAll(rlsSource(ALL, "A"), null, null);
    const r = buildResult(rlsSource(ALL, "A"), { sourceId: "t", from: null, to: null, columns: ["nome"], filters: [{ column: "nome", equals: "Pessoa 4" }], sort: [] }, c.rows);
    expect(r.rows).toEqual([["Pessoa 4"]]);
  });
  it("coluna sensível sai por padrão", () => {
    const r = runReport(DEF, { params: {} }, ALL.slice(0, 3));
    expect(r.columns.map((x) => x.id)).not.toContain("cpf");
  });
  it("paginação parada antes do fim é marcada incompleta", () => {
    expect(exportIncomplete(5000, 7000, false)).toBe(true);
    expect(exportIncomplete(7000, 7000, false)).toBe(false);
    expect(exportIncomplete(300, 300, true)).toBe(false);
  });
  it("CSV da inclusão: BOM, CRLF e fórmula neutralizada", () => {
    const s = inclusionCsv([{ a: "=1+1" }, { a: "ação" }]);
    expect(s.startsWith("\uFEFF")).toBe(true);
    expect(s).toContain("\r\n");
    expect(s).not.toMatch(/"=1\+1"/);
  });
});
