import { describe, expect, it } from "vitest";
import { buildResult, collectAll, HARD_ROW_CAP, type BuilderSource } from "./report-builder";
import { BUILDER_SOURCES, dropSuperseded } from "./builder-sources";
import { SECTOR_PACKS } from "./sector-packs";
import { analyze, chartSvg, openPack, toStudioHtml, toStudioXlsx, withSpec, specOf, XLSX_SHEETS, type StudioSpec } from "./report-studio";
import { duplicateName, isFavorite, withFavorite } from "./report-templates-cloud";
import { latestTemplates } from "./report-templates-cloud";
import { DEFAULT_LAYOUT } from "./report-analytics";
import { toCsv } from "./report-engine";
import { BUILDER_STEPS } from "./report-builder-page";

const def = { id: "t", version: 1, title: "T", description: "", source: "fixture", params: [], formats: ["csv", "xlsx", "pdf"] as const, reproducible: false, syncRowLimit: 1e6,
  columns: [{ id: "school", label: "Escola", kind: "text" as const }, { id: "stage", label: "Etapa", kind: "text" as const }, { id: "n", label: "N", kind: "number" as const }] };
const fx = (total: number, only?: string): BuilderSource => ({
  id: "t", title: "T", sectors: ["secretaria", "admin"], definition: def, methodology: "m", acl: "a", period: false, pageSize: 1000, filterable: ["school", "stage"],
  load: async ({ offset, limit }) => {
    const all = Array.from({ length: total }, (_, i) => ({ school: i % 2 ? "B" : "A", stage: `E${i % 3}`, n: i % 7 === 0 ? null : i % 10 }));
    const vis = only ? all.filter((r) => r.school === only) : all;
    return { rows: vis.slice(offset, offset + limit), total: vis.length };
  },
});
const choice = { sourceId: "t", from: null, to: null, columns: ["school", "stage", "n"], filters: [], sort: [] };
const spec: StudioSpec = {
  organization: { groupBy: ["school", "stage"], measures: [{ id: "c", label: "Qtd", agg: "count", column: null }, { id: "s", label: "Soma", agg: "sum", column: "n" }], derived: [{ id: "p", label: "%", op: "razao", a: "s", b: "c" }], sort: [], subtotals: true, grandTotal: true },
  chart: { kind: "barras-empilhadas", category: "school", series: "stage", measures: ["c"], title: "Gráfico" },
  layout: { ...DEFAULT_LAYOUT, title: "Relatório X", paper: "A3", orientation: "paisagem", signatures: ["Direção"] },
};

describe("REPORT.PRO.3 — Central de relatórios", () => {
  it("assistente tem as 10 etapas pedidas", () => {
    expect(BUILDER_STEPS).toEqual(["Assunto", "Filtros", "Colunas", "Agrupamentos", "Cálculos", "Gráficos", "Layout", "Prévia", "Salvar", "Exportar"]);
  });
  it("escola A não recebe B; rede/Admin recebe ambas", async () => {
    const a = buildResult(fx(500, "A"), choice, (await collectAll(fx(500, "A"), null, null)).rows);
    expect(analyze(a, spec, "f").summary!.rows.every((r) => r[1] === "" || r[1] === "A")).toBe(true);
    const net = buildResult(fx(500), choice, (await collectAll(fx(500), null, null)).rows);
    const schools = new Set(analyze(net, spec, "f").summary!.rows.map((r) => r[1]).filter(Boolean));
    expect(schools).toEqual(new Set(["A", "B"]));
  });
  it("50.000 linhas: agrupamento, pivot e gráfico; acima disso marca incompleto", async () => {
    const c = await collectAll(fx(HARD_ROW_CAP), null, null);
    expect(c.truncated).toBe(false); expect(c.rows).toHaveLength(HARD_ROW_CAP);
    const an = analyze(buildResult(fx(HARD_ROW_CAP), choice, c.rows), spec, "f");
    const total = an.summary!.rows.find((r) => r[0] === "Total geral")!;
    expect(total[3]).toBe(String(HARD_ROW_CAP));
    expect(an.pivot!.rows).toHaveLength(2); expect(an.pivot!.headers).toEqual(["Escola", "E0", "E1", "E2"]);
    expect(an.chart!.points.length).toBe(6);
    expect((await collectAll(fx(HARD_ROW_CAP + 1), null, null)).truncated).toBe(true);
  });
  it("filtro restringe; ausência não vira zero na soma", async () => {
    const rows = (await collectAll(fx(70), null, null)).rows;
    const r = buildResult(fx(70), { ...choice, filters: [{ column: "school", equals: "A" }] }, rows);
    expect(r.rows.every((x) => x[0] === "A")).toBe(true);
    const an = analyze(r, { ...spec, organization: { ...spec.organization!, groupBy: ["school"], subtotals: false } }, "f");
    const expected = rows.filter((x) => x["school"] === "A" && typeof x["n"] === "number").reduce((s, x) => s + (x["n"] as number), 0);
    expect(an.summary!.rows[0]![3]).toBe(String(expected));
  });
  it("gráfico inadequado é recusado com motivo; SVG escapa texto", () => {
    const r = buildResult(fx(10), choice, [{ school: "<script>", stage: "E", n: 1 }]);
    const an = analyze(r, { ...spec, chart: { kind: "linha", category: "school", measures: ["c"], title: "t" } }, "f");
    expect(an.issues.join(" ")).toMatch(/série temporal/);
    const ok = analyze(r, { ...spec, chart: { kind: "barras", category: "school", measures: ["c"], title: "<b>" } }, "f");
    const svg = chartSvg(ok.chart!);
    expect(svg).not.toMatch(/<script>|<b>/); expect(svg).toContain("&lt;script&gt;");
  });
  it("PDF: tamanho/orientação, gráfico, tabela equivalente, metodologia, assinatura, sem AppShell", () => {
    const r = buildResult(fx(10), choice, [{ school: "A", stage: "E", n: 1 }]);
    const html = toStudioHtml(r, spec, ["Filtro: x"], analyze(r, spec, "f"), ["Fonte: fixture"]);
    expect(html).toContain("size:A3 landscape"); expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("Tabela equivalente ao gráfico"); expect(html).toContain("Metodologia e fonte"); expect(html).toContain("Direção");
    expect(html).toContain('counter(pages)'); expect(html).not.toMatch(/<script|<nav|sidebar/i);
  });
  it("XLSX: workbook real com abas Relatório, Filtros, Metodologia, Resumo e Dados do gráfico", async () => {
    const r = buildResult(fx(10), choice, [{ school: "=HYPERLINK(1)", stage: "E", n: 1 }]);
    const buf = await toStudioXlsx(r, spec, ["Fonte: fixture", "Filtros: nenhum"], analyze(r, spec, "f"), ["Fonte: fixture"]);
    const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual([XLSX_SHEETS.report, XLSX_SHEETS.filters, XLSX_SHEETS.method, XLSX_SHEETS.summary, XLSX_SHEETS.chart]);
    const cell = String(wb.getWorksheet(XLSX_SHEETS.report)!.getRow(3).getCell(1).value);
    expect(cell.startsWith("=")).toBe(false);
  });
  it("CSV continua neutralizando fórmula", () => {
    const r = buildResult(fx(1), choice, [{ school: "=1+1", stage: "E", n: 1 }]);
    expect(toCsv(r, { headerLines: [], title: "t" })).not.toMatch(/(^|;)=1\+1/m);
  });
  it("modelo salvo guarda a especificação completa e favorito, e volta igual", () => {
    const c = withSpec(choice, spec);
    const src = { ...fx(1) };
    const rows = [{ sector: "secretaria", name: "M", version: 2, archived: false, choice: withFavorite({ name: "M", sector: "secretaria", choice: c, savedAt: "" }, true).choice, recorded_at: "x" }];
    const [t] = latestTemplates(rows, "secretaria", [src]);
    expect(specOf(t!.choice).layout.paper).toBe("A3"); expect(isFavorite(t!)).toBe(true); expect(t!.version).toBe(2);
    expect(duplicateName("M", [t!])).toBe("M (cópia)");
  });
  it("pacote pronto abre como cópia (original intacto); pacote indisponível recusa com motivo", () => {
    const p = SECTOR_PACKS.find((x) => x.id === "sec-turmas")!;
    const o = openPack(p); (o.spec.layout as { title: string }).title = "mudado";
    expect(p.layout!.title).not.toBe("mudado");
    const b = SECTOR_PACKS.find((x) => x.blockedBy)!;
    expect(() => openPack(b)).toThrow(/Pacote indisponível: .{10,}/);
  });
  it("54 pacotes; matrículas agora com assunto real", () => {
    expect(SECTOR_PACKS).toHaveLength(54);
    expect(SECTOR_PACKS.find((p) => p.id === "sec-matriculas")!.blockedBy).toBeUndefined();
    expect(BUILDER_SOURCES.find((s) => s.id === "gerador-matriculas")!.unavailable).toBeFalsy();
  });
  it("matrícula substituída por correção sai do relatório", () => {
    expect(dropSuperseded([{ _id: "a", _sup: null }, { _id: "b", _sup: "a" }]).map((r) => r["_id"])).toEqual(["b"]);
  });
});
