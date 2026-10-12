import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLOSURE_CRITERIA, CLOSURE_SECTIONS, closureProblems, closureSummary } from "./people-closure";

describe("GP L24 — matriz de fechamento", () => {
  it("cobre 37 seções e 18 critérios, numerados sem lacuna", () => {
    expect(CLOSURE_SECTIONS.map((r) => r.n)).toEqual(Array.from({ length: 37 }, (_, i) => i + 1));
    expect(CLOSURE_CRITERIA.map((r) => r.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
  it("toda fonte, tela e teste citados existem em disco", () => {
    expect(closureProblems((p) => existsSync(p))).toEqual([]);
  });
  it("resultado institucional e homologação permanecem bloqueados", () => {
    expect(CLOSURE_SECTIONS[36].status).toBe("bloqueado");
    expect(CLOSURE_CRITERIA[17].status).toBe("bloqueado");
    expect(JSON.stringify([...CLOSURE_SECTIONS, ...CLOSURE_CRITERIA])).not.toMatch(/"status":"homologad/);
  });
  it("resumo soma o total", () => {
    const s = closureSummary(CLOSURE_SECTIONS);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(37);
  });
});
