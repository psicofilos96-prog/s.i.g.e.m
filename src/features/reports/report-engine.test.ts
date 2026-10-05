import { describe, expect, it } from "vitest";
import { GenerationLog, ReportError, fingerprint, neutralize, runReport, toCsv, toPrintableHtml, toXlsx, type ReportDefinition } from "./report-engine";
import { INCLUSAO_MINIMIZADO, MAPA_ESTATISTICO, REPORTS, mapaRows } from "./report-registry";
import { projectSchool, monthWindow } from "@/features/statistical-map/network-projection";

const def: ReportDefinition = {
  id: "t", version: 1, title: "T", description: "", source: "x",
  params: [{ id: "on", label: "Data", type: "date", required: true }, { id: "n", label: "N", type: "integer", required: false, min: 1, max: 5 }],
  columns: [{ id: "nome", label: "Nome", kind: "text" }, { id: "v", label: "Valor", kind: "number" }, { id: "cpf", label: "CPF", kind: "text", sensitive: true }, { id: "esc", label: "Escola", kind: "text" }],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 3,
};
const B = { headerLines: ["Cab"], title: "T" };
const rows = [
  { nome: "Ana", v: 0, cpf: "111", esc: "A" }, { nome: "Bia", v: null, cpf: "222", esc: "B" },
  { nome: "=HYPERLINK(\"x\")", v: 2, cpf: "333", esc: "A" },
];
const P = { params: { on: "2027-03-01" } };

describe("motor de relatórios", () => {
  it("parâmetros inválidos/ausentes/desconhecidos", () => {
    expect(() => runReport(def, { params: {} }, rows)).toThrow(ReportError);
    expect(() => runReport(def, { params: { on: "2027-13-99x" } }, rows)).toThrow(/data válida/);
    expect(() => runReport(def, { params: { on: "2027-03-01", n: 9 } }, rows)).toThrow(/intervalo/);
    expect(() => runReport(def, { params: { on: "2027-03-01", sql: "drop" } }, rows)).toThrow(/não previsto/);
    expect(() => runReport(def, { ...P, columns: ["senha"] }, rows)).toThrow(/Coluna/);
  });
  it("PII sensível sai por padrão; filtros só restringem", () => {
    const r = runReport(def, { ...P, filters: [{ column: "esc", equals: "A" }] }, rows);
    expect(r.columns.map((c) => c.id)).not.toContain("cpf");
    expect(r.rows).toHaveLength(2);
    expect(runReport(def, { ...P, filters: [{ column: "esc", equals: "Z" }] }, rows).rows).toHaveLength(0);
  });
  it("zero ≠ ausência em CSV, XLSX e PDF; ordenação manda ausência ao fim", async () => {
    const r = runReport(def, { ...P, sort: [{ column: "v", dir: "asc" }] }, rows);
    expect(r.rows.map((x) => x[1])).toEqual([0, 2, null]);
    const csv = toCsv(r, B);
    expect(csv).toContain("Ana;0"); expect(csv).toContain("Bia;não disponível");
    expect(toPrintableHtml(r, B)).toContain("<td>não disponível</td>");
    const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toXlsx(r, B));
    const vals = wb.worksheets[0]!.getSheetValues().flat().map(String);
    expect(vals).toContain("0"); expect(vals).toContain("não disponível");
  });
  it("CSV/XLSX injection neutralizada; PDF escapa HTML", async () => {
    expect(neutralize("=1+1")).toBe("'=1+1"); expect(neutralize("@x")).toBe("'@x"); expect(neutralize("-3")).toBe("-3");
    const r = runReport(def, P, rows);
    expect(toCsv(r, B)).toContain("'=HYPERLINK");
    const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toXlsx(r, B));
    let formulas = 0; wb.worksheets[0]!.eachRow((row) => row.eachCell((c) => { if (c.type === ExcelJS.ValueType.Formula) formulas++; }));
    expect(formulas).toBe(0);
    const h = toPrintableHtml(runReport(def, P, [{ nome: "<script>x</script>", v: 1, cpf: "", esc: "" }]), { ...B, logoUrl: "javascript:alert(1)" });
    expect(h).not.toContain("<script>x"); expect(h).not.toContain("javascript:");
  });
  it("relatório grande vai para modo assíncrono", () => {
    const big = Array.from({ length: 10 }, (_, i) => ({ nome: `n${i}`, v: i, cpf: "", esc: "A" }));
    expect(runReport(def, P, big).mode).toBe("async"); expect(runReport(def, P, rows).mode).toBe("sync");
    const huge = Array.from({ length: 100_000 }, (_, i) => ({ nome: `n${i}`, v: i, cpf: "", esc: i % 2 ? "A" : "B" }));
    const t = performance.now(); const r = runReport(def, { ...P, groupBy: "esc" }, huge);
    expect(r.groups).toEqual([{ key: "B", count: 50000 }, { key: "A", count: 50000 }]); expect(performance.now() - t).toBeLessThan(2000);
  });
  it("snapshot/fingerprint determinístico e sensível ao dado", async () => {
    const a = await fingerprint(runReport(def, P, rows, new Date(1)));
    expect(await fingerprint(runReport(def, P, rows, new Date(2)))).toBe(a);
    expect(await fingerprint(runReport(def, P, [...rows, { nome: "x", v: 1, cpf: "", esc: "" }]))).not.toBe(a);
  });
  it("arquivo gerado expira; trilha permanece", () => {
    let now = 0; const log = new GenerationLog(1000, () => now);
    const e = log.record({ definitionId: "t", version: 1, format: "csv", rows: 3, fingerprint: null }, new Blob(["x"]));
    expect(log.hasFile(e.id)).toBe(true); now = 1001;
    expect(log.get(e.id)).toBeNull(); expect(log.list()).toHaveLength(1);
  });
  it("dependências pendentes recusam execução, sem fórmula inventada", () => {
    for (const r of REPORTS.filter((x) => x.dependency)) expect(() => runReport(r, { params: {} }, [])).toThrow(/indisponível/);
    expect(REPORTS.map((r) => r.id)).toEqual(expect.arrayContaining(["necessidade-de-professor", "total-aulas-ofertadas", "total-aulas-rede"]));
  });
  it("Mapa no motor: mesma projeção; fonte não lida = não disponível; escopo = só escolas devolvidas", () => {
    const w = monthWindow(2027, 3);
    const s = projectSchool({ schoolId: "e1", schoolName: "E1", district: null, enrollments: [], participations: null, allocations: [], movements: null, classes: [] }, w);
    const r = runReport(MAPA_ESTATISTICO, { params: { year: 2027, month: 3 } }, mapaRows([s]));
    expect(r.rows).toHaveLength(2);
    const csv = toCsv(r, { headerLines: [], title: "M" });
    expect(csv).toContain("E1;e1;não disponível;0;0;não disponível");
    expect(() => runReport(INCLUSAO_MINIMIZADO, { params: {} }, [])).toThrow(/Informe/);
  });
});
