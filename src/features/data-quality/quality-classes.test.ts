import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { QUALITY_RULES, classifyFinding, detect, filterByClass, inbox, unverifiableSignals, type QualityInputs } from "./quality-model";

const base: QualityInputs = { schoolId: "esc-a", validOn: "2026-10-07", classes: [], calendars: 1, enrollments: [], allocations: [], positions: [], assignments: [], engagementFacts: [], documents: [], imports: [] };

describe("NDATA.2 — classes de sinal", () => {
  it("matriz ausente é configuração ausente; ambígua é dado a revisar", () => {
    expect(classifyFinding({ ruleId: "turma-sem-matriz", evidence: { matriz: "ausente" } })).toBe("AUSENCIA_CONFIGURACAO");
    expect(classifyFinding({ ruleId: "turma-sem-matriz", evidence: { matriz: "ambigua" } })).toBe("DADO_A_REVISAR");
  });
  it("zero calendários é configuração ausente; dois é dado a revisar", () => {
    expect(classifyFinding({ ruleId: "calendario-ausente", evidence: { calendariosAplicaveis: 0 } })).toBe("AUSENCIA_CONFIGURACAO");
    expect(classifyFinding({ ruleId: "calendario-ausente", evidence: { calendariosAplicaveis: 2 } })).toBe("DADO_A_REVISAR");
  });
  it("documento sobre fato retificado é esperado", () => expect(classifyFinding({ ruleId: "documento-de-fato-retificado", evidence: {} })).toBe("ESPERADO"));
  it("matrícula concorrente é dado a revisar", () => expect(classifyFinding({ ruleId: "matricula-concorrente", evidence: {} })).toBe("DADO_A_REVISAR"));
  it("fonte não lida vira erro técnico, sem tela de correção", () => {
    const d = detect({ ...base, enrollments: null }, "t");
    expect(unverifiableSignals(d.unverifiable)).toEqual([expect.objectContaining({ ruleId: "matricula-concorrente", signalClass: "ERRO_TECNICO", fix: null })]);
  });
  it("toda regra aponta uma tela de correção", () => { for (const r of QUALITY_RULES) expect(r.fix({ classId: "c1" })).toMatch(/^\//); });
});

describe("NDATA.2 — escopo, somente leitura e desempenho", () => {
  it("detecção não altera a entrada", () => {
    const input = { ...base, imports: [{ batchId: "l1", conflictRows: 2, closed: false }] };
    const snap = JSON.stringify(input); detect(input, "t"); expect(JSON.stringify(input)).toBe(snap);
  });
  it("achados carregam a escola da consulta; filtro por classe não mistura", () => {
    const d = detect({ ...base, calendars: 0, classes: [{ classId: "c1", record: true, matrix: "ambigua", journey: true, schedule: false }] }, "t");
    expect(d.findings.every((f) => f.schoolId === "esc-a")).toBe(true);
    const items = inbox(d.findings, new Map(), []);
    expect(filterByClass(items, ["AUSENCIA_CONFIGURACAO"]).map((i) => i.ruleId)).toEqual(["calendario-ausente"]);
    expect(filterByClass(items, ["DADO_A_REVISAR"]).map((i) => i.ruleId)).toEqual(["turma-sem-matriz"]);
  });
  it("fonte da central só lê e grava só a revisão pelo writer", () => {
    const src = readFileSync("src/features/data-quality/quality-source.ts", "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect([...src.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]).filter((n) => /^record_|^register_/.test(n!))).toEqual(["record_data_quality_review"]);
  });
  it("escala de rede (9.763 matrículas, 698 turmas) detecta em menos de 1 s", () => {
    const enrollments = Array.from({ length: 9763 }, (_, k) => ({ enrollmentId: `m${k}`, studentId: `s${k}`, validFrom: "2026-02-01", validUntil: null }));
    const classes = Array.from({ length: 698 }, (_, k) => ({ classId: `c${k}`, record: true, matrix: "resolvida" as const, journey: true, schedule: true }));
    const t = performance.now(); const d = detect({ ...base, enrollments, classes }, "t");
    expect(performance.now() - t).toBeLessThan(1000); expect(d.findings).toEqual([]);
  });
});
