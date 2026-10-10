import { describe, expect, it } from "vitest";
import { buildResult, collectAll, loadTemplates, provenance, saveTemplate, validateChoice, HARD_ROW_CAP, type BuilderSource, type KV } from "./report-builder";
import { BUILDER_SOURCES, dedupeLatestSchools } from "./builder-sources";
import { toCsv } from "./report-engine";

const def = { id: "t", version: 1, title: "T", description: "", source: "fixture", params: [], formats: ["csv"] as const, reproducible: false, syncRowLimit: 1e6,
  columns: [{ id: "school", label: "Escola", kind: "text" as const }, { id: "n", label: "N", kind: "number" as const }, { id: "cpf", label: "CPF", kind: "text" as const, sensitive: true }] };
const fixture = (total: number, scopeSchool?: string): BuilderSource => ({
  id: "t", title: "T", sectors: ["secretaria"], definition: def, methodology: "m", acl: "a", period: false, pageSize: 100, filterable: ["school"],
  load: async ({ offset, limit }) => {
    const all = Array.from({ length: total }, (_, i) => ({ school: i % 2 ? "B" : "A", n: i, cpf: "000" }));
    const vis = scopeSchool ? all.filter((r) => r.school === scopeSchool) : all; // simula a RLS
    return { rows: vis.slice(offset, offset + limit), total: vis.length };
  },
});
const choice = { sourceId: "t", from: null, to: null, columns: ["school", "n"], filters: [], sort: [] };
const mem = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };

describe("NREL.2 gerador", () => {
  it("lê todas as páginas de uma tabela grande", async () => {
    const c = await collectAll(fixture(9763), null, null);
    expect(c.rows.length).toBe(9763); expect(c.pages).toBe(98); expect(c.truncated).toBe(false);
  });
  it("marca incompleto acima do teto", async () => {
    const c = await collectAll(fixture(HARD_ROW_CAP + 50), null, null);
    expect(c.truncated).toBe(true); expect(c.rows.length).toBe(HARD_ROW_CAP);
  });
  it("escopo vem da leitura: escola A nunca recebe linhas de B", async () => {
    const c = await collectAll(fixture(1000, "A"), null, null);
    const r = buildResult(fixture(1000, "A"), choice, c.rows);
    expect(r.rows.every((x) => x[0] === "A")).toBe(true);
  });
  it("coluna sensível ou não prevista é recusada; filtro só em coluna permitida", () => {
    const s = fixture(1);
    expect(validateChoice(s, { ...choice, columns: ["x"] })).toContain("Coluna não prevista: x.");
    expect(validateChoice(s, { ...choice, filters: [{ column: "n", equals: 1 }] })).toContain("Filtro não permitido: n.");
    expect(buildResult(s, { ...choice, columns: ["school", "cpf"] }, [{ school: "A", n: 1, cpf: "1" }]).columns.map((c) => c.id)).toEqual(["school"]);
  });
  it("export leva fonte, período e metodologia e neutraliza fórmula", async () => {
    const s = fixture(2); const c = await collectAll(s, null, null);
    const r = buildResult(s, choice, [{ school: "=HYPERLINK(1)", n: 1 }]);
    const csv = toCsv(r, { headerLines: ["x"], title: "T" }, provenance(s, choice, c, "Secretaria"));
    expect(csv).toContain("Fonte: fixture"); expect(csv).toContain("Período: não se aplica"); expect(csv).toContain("Metodologia: m");
    expect(csv).not.toMatch(/(^|[;,"])=HYPERLINK/m);
  });
  it("modelos são por conta e setor e só guardam escolhas válidas", () => {
    const kv = mem(); const s = [fixture(1)];
    saveTemplate(kv, "u1", { name: "Meu", sector: "secretaria", choice, savedAt: "x" }, s);
    expect(loadTemplates(kv, "u1", "secretaria", s)).toHaveLength(1);
    expect(loadTemplates(kv, "u2", "secretaria", s)).toHaveLength(0);
    expect(() => saveTemplate(kv, "u1", { name: "X", sector: "dp", choice, savedAt: "x" }, s)).toThrow();
  });
  it("assunto sem leitura recusa por extenso", async () => {
    const p = BUILDER_SOURCES.find((x) => x.id === "gerador-alunos")!;
    await expect(collectAll(p, null, null)).rejects.toThrow(/Dado nominal/);
  });
  it("cadastro de escolas mantém só a versão mais recente", () => {
    expect(dedupeLatestSchools([{ _sid: "a", _v: 1, name: "velho" }, { _sid: "a", _v: 2, name: "novo" }]).map((r) => r["name"])).toEqual(["novo"]);
  });
  it("nenhum assunto expõe SQL ou fonte livre", () => {
    for (const s of BUILDER_SOURCES) expect(s.definition.source).not.toMatch(/select\s|insert\s|;/i);
  });
});
