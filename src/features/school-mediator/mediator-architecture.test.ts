import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { MEDIATOR_SECTIONS, effectiveCompetences, sharedWithoutConfig, type FunctionConfig } from "./mediator-architecture";

const dirs = ["supabase/migrations", "drizzle/migrations"].filter((d) => existsSync(d));
const sql = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
const routeFile = (r: string) => `src/routes/${r.slice(1).replace(/\//g, "_.").replace(/^inclusao_\./, "inclusao_.")}.tsx`;

describe("Mediador L01 — mapa das 30 seções", () => {
  it("tem exatamente as 30 seções em ordem", () => {
    expect(MEDIATOR_SECTIONS.map((s) => s.n)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });
  it("toda tabela/função citada existe nas migrations", () => {
    for (const s of MEDIATOR_SECTIONS) for (const t of [...s.tables, ...s.functions]) expect(sql, `${s.n}:${t}`).toMatch(new RegExp(`\\b${t}\\b`));
  });
  it("toda rota citada existe", () => {
    for (const s of MEDIATOR_SECTIONS) for (const r of s.routes) expect(existsSync(routeFile(r)), `${s.n}:${r}`).toBe(true);
  });
  it("seção existente sem referência real é proibida", () => {
    for (const s of MEDIATOR_SECTIONS.filter((x) => x.status === "existente" && x.n !== 2 && x.n !== 28))
      expect(s.tables.length + s.functions.length + s.routes.length, `${s.n}`).toBeGreaterThan(0);
  });
});

const cfg = (functionId: string, competences: string[], homologated = true): FunctionConfig =>
  ({ functionId, label: functionId, competences, homologated, source: "decisão", validFrom: "2026-01-01", validTo: null });
const des = [{ personId: "m1", functionId: "mediador-escolar", engagementId: "g1", schoolId: "s1", studentIds: ["e1"], from: "2026-02-01", to: "2026-06-30" }];
const base = { designations: des, personId: "m1", schoolId: "s1", studentId: "e1", date: "2026-03-01" };

describe("Mediador L01 — funções parametrizáveis", () => {
  it("sem configuração homologada não há competência", () => {
    expect(effectiveCompetences({ ...base, configs: [] }).competences).toEqual([]);
    expect(effectiveCompetences({ ...base, configs: [cfg("mediador-escolar", ["registro-diario"], false)] }).competences).toEqual([]);
  });
  it("competência só da própria função, estudante, escola e período", () => {
    const configs = [cfg("mediador-escolar", ["registro-diario"]), cfg("profissional-de-apoio-escolar", ["apoio-higiene"])];
    expect(effectiveCompetences({ ...base, configs }).competences).toEqual(["registro-diario"]);
    expect(effectiveCompetences({ ...base, configs, studentId: "e2" }).competences).toEqual([]);
    expect(effectiveCompetences({ ...base, configs, date: "2026-07-01" }).competences).toEqual([]);
    expect(effectiveCompetences({ ...base, configs, schoolId: "s2" }).competences).toEqual([]);
  });
  it("configuração ambígua falha fechada e funções não herdam competências", () => {
    const r = effectiveCompetences({ ...base, configs: [cfg("mediador-escolar", ["a"]), cfg("mediador-escolar", ["b"])] });
    expect(r.competences).toEqual([]); expect(r.blockers[0]).toMatch(/ambígua/);
    expect(sharedWithoutConfig(cfg("mediador-escolar", ["a"]), cfg("acompanhante-especializado", ["b"]))).toEqual([]);
  });
});
