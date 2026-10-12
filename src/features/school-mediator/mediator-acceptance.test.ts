import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ACCEPTANCE_MATRIX, ACCEPTANCE_CRITERIA } from "./mediator-acceptance";
import { MEDIATOR_SECTIONS } from "./mediator-architecture";

describe("Mediador L20 — aceite técnico", () => {
  it("matriz cobre as 30 seções na ordem do mapa L01", () => {
    expect(ACCEPTANCE_MATRIX.map((r) => r.n)).toEqual(MEDIATOR_SECTIONS.map((s) => s.n));
  });
  it("todo módulo e teste citado existe", () => {
    for (const r of ACCEPTANCE_MATRIX) for (const f of [...r.modules, ...r.tests]) expect(existsSync(f), `${r.n}:${f}`).toBe(true);
    for (const c of ACCEPTANCE_CRITERIA) for (const f of c.evidence) expect(existsSync(f), `C${c.id}:${f}`).toBe(true);
  });
  it("14 critérios; não comprovado sempre declara lacuna", () => {
    expect(ACCEPTANCE_CRITERIA).toHaveLength(14);
    for (const c of ACCEPTANCE_CRITERIA.filter((x) => x.status !== "comprovado-tecnico")) expect(c.gap, `C${c.id}`).toBeTruthy();
    for (const r of ACCEPTANCE_MATRIX.filter((x) => x.status === "bloqueado")) expect(r.blocker, `${r.n}`).toBeTruthy();
  });
  it("nada se declara homologado institucionalmente", () => {
    const src = readFileSync("src/features/school-mediator/mediator-acceptance.ts", "utf8");
    expect(src).not.toMatch(/status:\s*"homologad/);
  });
  it("tela citada está registrada como rota", () => {
    expect(existsSync("src/routes/mediador.tsx") || existsSync("src/routes/mediador.index.tsx")).toBe(true);
  });
});
