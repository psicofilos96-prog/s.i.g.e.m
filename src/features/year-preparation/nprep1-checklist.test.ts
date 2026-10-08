import { describe, expect, it } from "vitest";
import { ITEMS, classify, evaluate } from "./readiness-model";

// Estado atual da base (2026-10-08): ano 2027 cadastrado, sem abertura, sem turmas,
// sem catálogos homologados, sem lotações; calendário 2027 homologado.
const current = {
  year2027: { kind: "count", n: 1 }, year2027State: { kind: "count", n: 0 }, calendarHomologations: { kind: "count", n: 3 },
  schools: { kind: "count", n: 55 }, students: { kind: "count", n: 9000 }, classes: { kind: "count", n: 0 },
  offerings: { kind: "count", n: 0 }, schedules: { kind: "count", n: 0 }, journeys: { kind: "count", n: 0 },
  matrixHomologations: { kind: "count", n: 0 }, engagements: { kind: "count", n: 2 }, homologatedPolicies: { kind: "count", n: 1 },
  catalogValues: { kind: "count", n: 0 }, postings: { kind: "count", n: 0 }, guardianAuthorizations: { kind: "not-read" },
} as const;
const c = () => { const st = evaluate(current); return Object.fromEntries(ITEMS.map((d, i) => [d.id, classify(d, st[i]!)])); };

describe("NPREP.1 checklist 2027", () => {
  it("cobre ano, catálogos, matriz, jornadas, turmas, lotações, regras, calendário e fontes", () => {
    for (const id of ["ano", "abertura", "catalogos", "matrizes", "jornadas", "turmas", "lotacoes", "regras", "calendario", "censo", "dp", "bncc", "modelos"]) expect(c()[id]).toBeDefined();
  });
  it("estado atual", () => {
    const r = c();
    expect(r["ano"]).toBe("pronto");
    expect(r["calendario"]).toBe("pronto");
    expect(r["abertura"]).toBe("pendente-decisao");
    expect(r["turmas"]).toBe("ausente");
    expect(r["catalogos"]).toBe("ausente");
    expect(r["lotacoes"]).toBe("ausente");
    expect(r["regras"]).toBe("pendente-decisao");
    expect(r["censo"]).toBe("pendente-dado");
    expect(r["dp"]).toBe("pendente-dado");
    expect(r["familia"]).toBe("nao-verificado");
  });
  it("leitura negada nunca vira ausente", () => {
    const st = evaluate({ ...current, postings: { kind: "denied" } });
    const i = ITEMS.findIndex((d) => d.id === "lotacoes");
    expect(classify(ITEMS[i]!, st[i]!)).toBe("nao-verificado");
  });
});
