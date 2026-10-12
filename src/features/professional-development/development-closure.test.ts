import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { DEV_SCENARIOS, devClosureMatrix, devClosureProblems } from "./development-closure";

describe("L24 fechamento SIGEM Desenvolvimento", () => {
  it("lotes, evidências e cenários existem em disco", () => {
    expect(devClosureProblems(existsSync, (p) => readFileSync(p, "utf8"))).toEqual([]);
  });
  it("matriz 47 + 18 sem status homologado e bloqueios com motivo", () => {
    const m = devClosureMatrix();
    expect(m.sections).toHaveLength(47);
    expect(m.criteria).toHaveLength(18);
    for (const r of [...m.sections, ...m.criteria]) {
      expect(r.status).not.toMatch(/homolog/);
      expect(r.reason.length).toBeGreaterThan(10);
    }
    expect(m.sections.find((s) => s.n === 32)?.status).toBe("bloqueado");
  });
  it("E2E autenticado é declarado pendente, nunca simulado", () => {
    // e2e-pendente: nenhuma conta foi usada; a camada declarada impede alegar prova de navegador.
    expect(DEV_SCENARIOS.find((s) => s.layer === "e2e-pendente")).toBeTruthy();
  });
});
