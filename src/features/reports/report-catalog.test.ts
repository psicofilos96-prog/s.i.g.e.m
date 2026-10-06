import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CATALOG, catalogEntry, emptyCatalogFilter, filterCatalog, OFFICIAL_DOCUMENTS } from "./report-catalog";
import { REPORTS } from "./report-registry";
import { runReport, ReportError, toCsv, type ReportDefinition } from "./report-engine";

describe("Central de relatórios (AR)", () => {
  it("todo relatório do registro único está catalogado, sem duplicata", () => {
    expect(CATALOG.map((c) => c.id)).toEqual(REPORTS.map((r) => r.id));
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
    expect(CATALOG.some((c) => c.id === "trilha-de-auditoria")).toBe(true);
  });
  it("cada entrada declara domínio, escopo, natureza, ACL e tela dona", () => {
    for (const c of CATALOG) for (const k of ["domain", "scope", "nature", "acl", "route", "source"] as const) expect(c[k]).toBeTruthy();
  });
  it("natureza oficial nunca é inferida; dinâmico sem reprodutibilidade", () => {
    for (const c of CATALOG) {
      expect(c.nature).not.toBe("oficial-emitido");
      if (c.nature === "snapshot") expect(REPORTS.find((r) => r.id === c.id)!.reproducible).toBe(true);
    }
    const def = { ...REPORTS[0]!, reproducible: false } as ReportDefinition;
    expect(catalogEntry(def).nature).toBe("dinamico");
    expect(OFFICIAL_DOCUMENTS.note).toMatch(/OFFICIAL_TEMPLATES_PENDING/);
  });
  it("indisponível explica a dependência e o motor recusa", () => {
    const def = { ...REPORTS[0]!, dependency: "fonte ausente" } as ReportDefinition;
    const e = catalogEntry(def);
    expect(e.available).toBe(false);
    expect(e.dependency).toBe("fonte ausente");
    expect(() => runReport(def, { params: {} }, [])).toThrow(ReportError);
  });
  it("filtros por domínio/disponibilidade/busca", () => {
    expect(filterCatalog(CATALOG, { ...emptyCatalogFilter, domain: "Quadro docente" }).every((c) => c.domain === "Quadro docente")).toBe(true);
    expect(filterCatalog(CATALOG, { ...emptyCatalogFilter, query: "supervisao" }).length).toBeGreaterThan(0);
    expect(filterCatalog(CATALOG, { ...emptyCatalogFilter, availability: "indisponivel" }).every((c) => !c.available)).toBe(true);
  });
  it("parâmetro adulterado, coluna desconhecida e unknown≠zero", () => {
    const sup = REPORTS.find((r) => r.id === "acompanhamento-supervisao-escolar")!;
    expect(() => runReport(sup, { params: { school: "x", outraEscola: "y" } }, [])).toThrow(/não previsto/);
    expect(() => runReport(sup, { params: { school: "x" }, columns: ["cpf"] }, [])).toThrow(/Coluna não prevista/);
    const res = runReport(sup, { params: { school: "x" } }, [{ school: "x", version: null }]);
    expect(res.columns.some((c) => c.id === "responsible")).toBe(false);
    expect(toCsv(res, { headerLines: ["SIGEM"], title: "t" })).not.toMatch(/;0;/);
  });
  it("nenhuma coluna de CPF em relatório e nenhuma exportação fora do motor comum", () => {
    for (const r of REPORTS) expect(r.columns.some((c) => /cpf/i.test(c.id + c.label))).toBe(false);
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const offenders = walk("src/features").filter((p) => /\.tsx?$/.test(p) && !p.includes(".test.") && !p.includes("report-engine"))
      .filter((p) => { const s = readFileSync(p, "utf8"); return /text\/csv/.test(s) && !/toCsv|reportCsv/.test(s); });
    expect(offenders).toEqual([]);
  });
});
