import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildCentral, pendingFeedback, drillDown, counterText, BLOCKS } from "./op-central";

const ok = (n: number) => ({ status: "ok" as const, readAt: "2026-05-10T10:00:00Z", rows: Array.from({ length: n }, (_, i) => ({ id: `i${i}`, label: `Item ${i}` })) });
const c = buildCentral({
  schoolId: "sA", date: "2026-05-10", alertRuleHomologated: false,
  reads: { professores: ok(3), turmas: ok(0), planejamentos: { status: "denied", rows: [], readAt: null }, intervencoes: { status: "ok", rows: [], readAt: null } },
});
const st = (id: string) => c.blocks.find((b) => b.id === id)!;

describe("OP L03 — Central Pedagógica", () => {
  it("oito blocos com fonte declarada", () => {
    expect(c.blocks.map((b) => b.id)).toEqual(Object.keys(BLOCKS));
    for (const b of c.blocks) expect(b.source.length).toBeGreaterThan(0);
  });
  it("estados: disponível, zero observado, sem permissão, não lido, sem data", () => {
    expect(st("professores")).toMatchObject({ state: "disponivel", count: 3 });
    expect(st("turmas")).toMatchObject({ state: "zero", count: 0 });
    expect(st("planejamentos").state).toBe("sem-permissao");
    expect(st("reunioes")).toMatchObject({ state: "nao-lido", count: null });
    expect(st("intervencoes").state).toBe("nao-lido");
  });
  it("alerta sem regra homologada fica bloqueado", () => expect(st("alertas").state).toBe("bloqueado"));
  it("contador nunca mostra zero para ausência", () => {
    expect(counterText(st("turmas"))).toBe("0");
    expect(counterText(st("reunioes"))).toBe("Não disponível");
  });
  it("devolutiva pendente derivada, mais antiga primeiro", () => {
    const p = pendingFeedback([{ planId: "p2", version: 1, label: "B", sharedAt: "2026-05-02" }, { planId: "p1", version: 3, label: "A", sharedAt: "2026-05-01" }, { planId: "p3", version: 1, label: "C", sharedAt: "2026-04-01" }], new Set(["p3:1"]));
    expect(p.map((x) => x.id)).toEqual(["p1:3", "p2:1"]);
  });
  it("drill-down permanece na Central", () => expect(drillDown("devolutivas", "p1:3")).toEqual({ to: "/orientacao", search: { bloco: "devolutivas", item: "p1:3" } }));
  it("nenhum número fixo no módulo", () => {
    const src = readFileSync("src/features/pedagogical-guidance/op-central.ts", "utf8");
    expect(src).not.toMatch(/count:\s*\d/);
  });
});
