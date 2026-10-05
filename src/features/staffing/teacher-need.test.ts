import { describe, expect, it } from "vitest";
import { applyScenario, classDemand, engagementLoads, needSummary, type ScheduleRow } from "./teacher-need";
import { projectClass, type ClassInput } from "./staffing-model";

const item = (k: string, q: number | null, u: string | null = "u-aula-semanal") => ({ matrixVersionId: "mv1", itemKey: k, componentId: k, quantity: q, unitValueId: u });
const rule = [{ unitValueId: "u-aula-semanal", weeklyLessonsPerUnit: 1, ruleRef: "r1" }];

describe("demanda (X.1)", () => {
  it("matriz ausente/ilegível ⇒ não calculável", () => {
    expect(classDemand("t", null, rule).state).toBe("nao-calculavel");
    expect(classDemand("t", { classId: "t", matrixVersionIds: [], items: [] }, rule).reason).toMatch(/Nenhuma matriz/);
  });
  it("multietapa não soma matrizes", () => {
    const d = classDemand("t", { classId: "t", matrixVersionIds: ["a", "b"], items: [item("x", 4)] }, rule);
    expect(d.state).toBe("nao-calculavel"); expect(d.cells).toHaveLength(0);
  });
  it("unidade sem regra ⇒ desconhecido, nunca 0", () => {
    const d = classDemand("t", { classId: "t", matrixVersionIds: ["mv1"], items: [item("x", 80, "u-hora-relogio-anual")] }, rule);
    expect(d.cells[0]!.weeklyLessons.value).toBeNull(); expect(d.cells[0]!.literal).toBe("80 u-hora-relogio-anual");
  });
  it("regra declarada converte e cita a regra", () => {
    const d = classDemand("t", { classId: "t", matrixVersionIds: ["mv1"], items: [item("x", 4)] }, rule);
    expect(d.state).toBe("calculavel"); expect(d.cells[0]!.weeklyLessons.value).toBe(4); expect(d.cells[0]!.refs).toContain("regra:r1");
  });
});

const row = (e: string, cls: string, b: string, conflict = false): ScheduleRow => ({ personId: "p1", engagementId: e, classId: cls, componentKey: "mat", blockId: b, minutes: 50, conflict });

describe("carga e saldo (X.3–X.5)", () => {
  it("vínculos da mesma pessoa ficam separados; conflito contado", () => {
    const l = engagementLoads([row("e1", "A", "b1"), row("e1", "B", "b2", true), row("e2", "C", "b3")]);
    expect(l).toHaveLength(2);
    const e1 = l.find((x) => x.engagementId === "e1")!;
    expect(e1.classes).toBe(2); expect(e1.minutes).toBe(100); expect(e1.conflicts).toBe(1);
    expect(e1.balanceMinutes.value).toBeNull(); expect(e1.contractual.state).toBe("unknown");
  });
  it("carga conhecida calcula saldo", () => {
    const l = engagementLoads([row("e1", "A", "b1")], () => ({ state: "known", minutes: 1200, sourceRef: "rh" }));
    expect(l[0]!.balanceMinutes.value).toBe(1150);
  });
  it("unidade incompatível ⇒ saldo não calculável", () => {
    const l = engagementLoads([row("e1", "A", "b1")], () => ({ state: "incompatible-unit", unit: "hora-aula", reason: "unidade" }));
    expect(l[0]!.balanceMinutes.value).toBeNull();
  });
});

const cls = (id: string, blocks: ClassInput["blocks"], assignments: ClassInput["assignments"]): ClassInput => ({ classId: id, label: id, blocks, assignments });

describe("resumo (X.5)", () => {
  it("cobertura conhecida com contratual desconhecida: déficit de cobertura ≠ saldo", () => {
    const off = [projectClass(cls("A", [{ blockKey: "b1", componentId: "mat", minutes: 50, engagementIds: ["e1"], usable: true }, { blockKey: "b2", componentId: "mat", minutes: 50, engagementIds: [], usable: true }],
      [{ assignmentId: "a1", componentId: "mat", engagementId: "e1", personId: "p1", vigente: true }]))];
    const s = needSummary([classDemand("A", null, [])], off, engagementLoads([row("e1", "A", "b1")]));
    expect(s.ofertadas.value).toBe(2); expect(s.cobertas.value).toBe(1); expect(s.descobertas.value).toBe(1);
    expect(s.necessarias.value).toBeNull(); expect(s.saldoMin.value).toBeNull(); expect(s.cargaContratualMin.reason).toMatch(/desconhecida/);
  });
  it("zero real distinto de desconhecido", () => {
    const off = [projectClass(cls("A", [{ blockKey: "b1", componentId: "mat", minutes: 50, engagementIds: ["e1"], usable: true }],
      [{ assignmentId: "a1", componentId: "mat", engagementId: "e1", personId: "p1", vigente: true }]))];
    const s = needSummary([], off, []);
    expect(s.descobertas.value).toBe(0); expect(s.descobertas.reason).toBeNull();
    const bad = needSummary([], [projectClass(cls("B", null, null))], []);
    expect(bad.descobertas.value).toBeNull();
  });
  it("grade/regência ausente ⇒ grandezas desconhecidas", () => {
    const s = needSummary([], [projectClass(cls("A", [{ blockKey: "b", componentId: "m", minutes: 50, engagementIds: [], usable: true }], null))], []);
    expect(s.ofertadas.value).toBeNull();
  });
});

describe("cenário (X.7)", () => {
  it("não contamina os fatos reais", () => {
    const real = [cls("A", [], [])]; const snap = JSON.stringify(real);
    const sc = applyScenario(real, { label: "nova turma", extraClasses: [cls("Z", [], [])] });
    expect(sc.inputs).toHaveLength(2); expect(sc.label).toMatch(/^SIMULAÇÃO/); expect(JSON.stringify(real)).toBe(snap);
  });
});
