import { describe, expect, it } from "vitest";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { reportById } from "@/features/reports/report-registry";
import { applyScenario, classDemand, engagementLoads, needSummary } from "./teacher-need";
import { projectClass, type ClassInput } from "./staffing-model";
import { DYNAMIC_NATURE, NECESSIDADE_PROFESSOR, needRows, networkTotalRows, offeredRows, TOTAL_AULAS_OFERTADAS, TOTAL_AULAS_REDE } from "./teacher-need-reports";

const cls = (id: string, eng: string[] = ["e1"], vig = true): ClassInput => ({ classId: id, label: id,
  blocks: [{ blockKey: `${id}-b1`, componentId: "mat", minutes: 50, engagementIds: eng, usable: true }, { blockKey: `${id}-b2`, componentId: "mat", minutes: 50, engagementIds: eng, usable: true }],
  assignments: [{ assignmentId: `ta-${id}`, componentId: "mat", engagementId: "e1", personId: "p1", vigente: vig }] });
const ctx = { scope: "escola" as const, scopeLabel: "s1" };
const P = { asOf: "2027-03-01", knownAt: "2027-03-01T10:00:00.000Z", scope: "escola" };

describe("X.1 relatórios", () => {
  it("os três relatórios saem do catálogo existente, sem dependência", () => {
    for (const id of ["total-aulas-ofertadas", "total-aulas-rede", "necessidade-de-professor"]) expect(reportById(id)?.dependency ?? null).toBeNull();
  });
  it("sete grandezas, unknown nunca zero, saldo explica fonte ausente, natureza dinâmica", () => {
    const results = [projectClass(cls("t1"))];
    const demands = [classDemand("t1", { classId: "t1", matrixVersionIds: ["mv"], items: [{ matrixVersionId: "mv", itemKey: "k", componentId: "mat", quantity: 80, unitValueId: "u-hora" }] }, [])];
    const loads = engagementLoads([{ personId: "p1", engagementId: "e1", classId: "t1", componentKey: "mat", blockId: "b", minutes: 100, conflict: false },
      { personId: "p1", engagementId: "e2", classId: "t1", componentKey: "mat", blockId: "c", minutes: 50, conflict: true }]);
    const rows = needRows(ctx, needSummary(demands, results, loads), demands, results, loads);
    const g = (k: string) => rows.find((r) => r.grandeza === k)!;
    expect(["necessarias", "ofertadas", "cobertas", "descobertas", "carga-atribuida", "carga-contratual", "saldo"].every((k) => g(k))).toBe(true);
    expect(g("necessarias").valor).toBeNull(); expect(g("necessarias").estado).toBe("desconhecido");
    expect(g("ofertadas").valor).toBe(2); expect(g("saldo").valor).toBeNull(); expect(String(g("saldo").motivo)).toMatch(/contratual/);
    expect(rows.filter((r) => r.grandeza === "carga-atribuida:vinculo")).toHaveLength(2); // vínculos separados
    expect(String(rows.find((r) => r.grandeza === "necessarias:item")!.motivo)).toMatch(/literal da matriz: 80 u-hora/);
    expect(String(rows.find((r) => r.grandeza === "descobertas:componente")!.proveniencia)).toMatch(/bloco:t1-b1.*regencia:ta-t1/);
    expect(rows.every((r) => r.natureza === DYNAMIC_NATURE)).toBe(true);
    const csv = toCsv(runReport(NECESSIDADE_PROFESSOR, { params: P }, rows), { headerLines: [], title: "x" });
    expect(csv).toMatch(/não disponível/);
  });
  it("multietapa não duplica; matriz ambígua não calculável", () => {
    const d = classDemand("t", { classId: "t", matrixVersionIds: ["a", "b"], items: [] }, []);
    const rows = needRows(ctx, needSummary([d], [], []), [d], [], []);
    expect(rows.filter((r) => r.grandeza.toString().startsWith("necessarias:"))).toHaveLength(1);
    expect(rows.find((r) => r.grandeza === "necessarias")!.valor).toBeNull();
  });
  it("rede: escola ilegível deixa o total aberto, nunca soma parcial", () => {
    const ok = [projectClass(cls("t1"))];
    const rows = networkTotalRows({ scope: "rede", scopeLabel: "rede" }, [{ schoolId: "s1", results: ok }, { schoolId: "s2", results: null }]);
    expect(rows.at(-1)!.valor).toBeNull();
    expect(networkTotalRows({ scope: "rede", scopeLabel: "rede" }, [{ schoolId: "s1", results: ok }]).at(-1)!.valor).toBe(2);
    expect(runReport(TOTAL_AULAS_REDE, { params: { ...P, scope: "rede" } }, rows).rows.length).toBe(3);
  });
  it("ofertadas: turma sem leitura vira desconhecido; escopo inválido recusado", () => {
    const rows = offeredRows(ctx, [projectClass({ classId: "x", label: null, blocks: null, assignments: null })]);
    expect(rows[0]!.valor).toBeNull();
    expect(() => runReport(TOTAL_AULAS_OFERTADAS, { params: { ...P, scope: "pais" } }, rows)).toThrow();
  });
  it("simulação nunca entra em relatório", () => {
    const sim = applyScenario([cls("t1")], { label: "x", extraClasses: [cls("t9")] });
    expect(sim.simulated).toBe(true);
    expect(() => offeredRows({ ...ctx, simulated: true }, sim.inputs.map(projectClass))).toThrow(/simulation/);
  });
});
