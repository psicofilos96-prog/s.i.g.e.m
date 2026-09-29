/** 14.6 — Matrícula e movimentação no CIECE: capacidades do motor (definições de TESTE, não homologadas pela rede). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeIndicator, IndicatorRegistry, type IndicatorDefinition } from "./indicator-engine";
import { enrollmentFacts, episodeFacts, movementFacts } from "./fact-adapters";
import { ANALYTIC_CAPABILITIES as C, queryAnalytic, type AnalyticGrant, type DisclosurePolicy } from "./analytic-boundary";
import { movementTypeAdmissible, type EnrollmentRow, type MovementRow } from "@/features/student-life/institutional-enrollment";

const enr = (id: string, o: Partial<EnrollmentRow> = {}): EnrollmentRow => ({
  id, student_id: `s-${id}`, school_id: "e1", cycle_id: "c26", opened_on: "2026-02-02", institutional_number: null,
  originating_act_ref: null, supersedes_id: null, correction_reason: null, recorded_by: "u", created_at: "t", ...o,
});
const mov = (id: string, o: Partial<MovementRow> = {}): MovementRow => ({
  id, logical_id: id, version: 1, supersedes_id: null, student_id: `s-${id}`, enrollment_id: null, movement_type_id: "tipo-a",
  movement_type_version: 1, effective_on: "2026-05-01", origin: { schoolId: "e1", classId: "t1" }, destination: { schoolId: "e2" },
  reason_code: null, reason_text: null, originating_act_ref: null, correction_reason: null, recorded_by: "u", created_at: "t", ...o,
});
const def = (o: Partial<IndicatorDefinition>): IndicatorDefinition => ({
  id: "x", version: 1, label: "teste", status: "homologada", factTypeId: "vinculo-escolar", subjectKey: "enrollmentId",
  populationCriteria: {}, temporal: { kind: "fotografia" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "u", ...o,
});
const reg = () => {
  const r = new IndicatorRegistry();
  [
    def({ id: "vinculados-na-data" }),
    def({ id: "ingressos", temporal: { kind: "inicio-de-vigencia-no-intervalo" } }),
    def({ id: "encerramentos", temporal: { kind: "fim-de-vigencia-no-intervalo" } }),
    def({ id: "enturmados-na-data", factTypeId: "episodio-de-enturmacao", subjectKey: "studentId" }),
    def({ id: "movimentacoes", factTypeId: "evento-de-movimentacao", subjectKey: "movementId", temporal: { kind: "intervalo" } }),
    def({ id: "entradas", factTypeId: "evento-de-movimentacao", subjectKey: "movementId", temporal: { kind: "intervalo" }, populationCriteria: { poleId: "destino" } }),
    def({ id: "saidas", factTypeId: "evento-de-movimentacao", subjectKey: "movementId", temporal: { kind: "intervalo" }, populationCriteria: { poleId: "origem" } }),
    def({ id: "saldo", factTypeId: "evento-de-movimentacao", subjectKey: "movementId", temporal: { kind: "intervalo" },
      operation: { evaluatorId: "saldo-entre-selecoes", params: { entrada: { dimension: "poleId", value: "destino" }, saida: { dimension: "poleId", value: "origem" } } } }),
  ].forEach((d) => r.register(d));
  return r;
};
const R = reg();
const enrollments = enrollmentFacts(
  [enr("m1"), enr("m2", { opened_on: "2026-06-01" }), enr("m3"), enr("m4", { opened_on: null }), enr("m9", { school_id: "e2" })],
  [{ enrollment_id: "m3", ended_on: "2026-03-01", bond_status_id: "encerrado", reason_text: null, originating_act_ref: null }],
);
const run = (id: string, reference: object, filters: object = { schoolId: "e1" }, groupBy?: string, facts = enrollments) =>
  computeIndicator(R, facts, { definitionId: id, reference, filters, ...(groupBy ? { groupBy } : {}) } as never);
const g0 = (r: ReturnType<typeof run>) => (r.ok ? r.groups[0]! : null);

describe("14.6 estoque (fotografia)", () => {
  it("1–3, 8. vigente conta; encerrada antes e iniciada depois não; sem data ⇒ indeterminado (nunca vigente)", () => {
    const g = g0(run("vinculados-na-data", { at: "2026-04-01" }))!;
    expect(g.observedSubjects).toBe(1); // só m1
    expect(g.indeterminateSubjects).toBe(1); // m4 sem data
    expect(g.status).toBe("calculado");
    expect(g.value).toBe(1);
    expect(g.coverage.complete).toBe(false);
  });
  it("4. enturmação histórica: fora da vigência não conta", () => {
    const epi = episodeFacts([{ id: "ep1", enrollment_id: "m1", student_id: "s1", school_id: "e1", class_id: "t1", class_label_snapshot: null, cycle_id: "c26",
      valid_from: "2026-02-10", originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: "2026-03-20" } as never]);
    expect(g0(run("enturmados-na-data", { at: "2026-03-01" }, { classId: "t1" }, undefined, epi))!.value).toBe(1);
    expect(g0(run("enturmados-na-data", { at: "2026-04-01" }, { classId: "t1" }, undefined, epi))!.status).toBe("populacao-vazia");
  });
});

describe("14.6 fluxo (intervalo)", () => {
  it("ingressos e encerramentos usam a data oficial do próprio registro", () => {
    expect(g0(run("ingressos", { from: "2026-05-01", to: "2026-06-30" }))!.observedSubjects).toBe(1); // m2
    expect(g0(run("encerramentos", { from: "2026-01-01", to: "2026-12-31" }))!.observedSubjects).toBe(1); // m3
  });
  const moves = movementFacts([
    mov("a"), mov("b", { effective_on: "2026-09-01" }),
    mov("c1"), mov("c2", { logical_id: "c1", version: 2, supersedes_id: "c1" }), // correção
    mov("d", { origin: { schoolId: "e2" }, destination: { schoolId: "e1", classId: "t3" } }),
    mov("z", { effective_on: null }),
  ]);
  it("5–6. dentro/fora do intervalo; versão corrigida sem dupla contagem", () => {
    const g = g0(run("movimentacoes", { from: "2026-04-01", to: "2026-06-30" }, { schoolId: "e1" }, undefined, moves))!;
    expect(g.observedSubjects).toBe(3); // a, c1(v2), d
    expect(g.indeterminateSubjects).toBe(1); // z sem data
    expect(g.factRefs.some((f) => f.recordId === "c1")).toBe(false);
    expect(g.factRefs.find((f) => f.recordId === "c2")!.recordVersion).toBe(2); // 14. proveniência na versão oficial
  });
  it("11. entradas e saídas vêm do polo do evento; saldo só pela operação declarada", () => {
    const p = { from: "2026-04-01", to: "2026-06-30" };
    expect(g0(run("entradas", p, { schoolId: "e1" }, undefined, moves))!.observedSubjects).toBe(1);
    expect(g0(run("saidas", p, { schoolId: "e1" }, undefined, moves))!.observedSubjects).toBe(2);
    const s = g0(run("saldo", p, { schoolId: "e1" }, undefined, moves.filter((f) => f.availability === "disponivel")))!;
    expect([s.numerator, s.denominator, s.value]).toEqual([1, 2, -1]);
    expect(g0(run("entradas", p, { classId: "t3" }, undefined, moves))!.observedSubjects).toBe(1);
  });
  it("12. isolamento por escola", () => {
    expect(g0(run("vinculados-na-data", { at: "2026-04-01" }, { schoolId: "e2" }))!.value).toBe(1);
    expect(g0(run("saidas", { from: "2026-04-01", to: "2026-06-30" }, { schoolId: "e2" }, undefined, moves))!.observedSubjects).toBe(1);
  });
  it("discriminação pela natureza homologada", () => {
    const r = run("movimentacoes", { from: "2026-04-01", to: "2026-06-30" }, { schoolId: "e1" }, "movementTypeId", moves);
    expect(r.ok && r.groups.map((g) => g.groupKey)).toEqual(["tipo-a"]);
  });
});

describe("14.6 ausências, natureza e fronteira", () => {
  it("7. natureza não homologada recusada", () => {
    const defs = [{ id: "tipo-a", version: 1, label: "A", status: "rascunho", valid_from: null, homologation_act_ref: null }];
    expect(movementTypeAdmissible(defs, "tipo-a", 1, "2026-05-01").ok).toBe(false);
    expect(movementTypeAdmissible([], "tipo-a", 1, "2026-05-01").ok).toBe(false);
    expect(movementTypeAdmissible([{ ...defs[0]!, status: "homologada" }], "tipo-a", 1, "2026-05-01").ok).toBe(true);
  });
  it("9–10. população vazia e fato ausente ≠ zero", () => {
    const g = g0(run("vinculados-na-data", { at: "2026-04-01" }, { schoolId: "e7" }))!;
    expect(g.status).toBe("populacao-vazia");
    expect(g.value).toBeNull();
    const only = enrollmentFacts([enr("m4", { opened_on: null })], []);
    const h = g0(run("vinculados-na-data", { at: "2026-04-01" }, { schoolId: "e1" }, undefined, only))!;
    expect(h.status).toBe("sem-fatos-disponiveis");
    expect(h.value).toBeNull();
  });
  it("13. decomposição obedece à política da 14.3 (grupo pequeno suprimido, sem exceção)", () => {
    const grant = (capabilityId: string): AnalyticGrant => ({ capabilityId, engagementId: "g", policyId: "p", policyVersion: 1, schoolId: "e1", classId: null, componentId: null, periodId: null });
    const policy: DisclosurePolicy = { id: "div", version: 1, status: "homologada", decomposableDimensions: ["movementTypeId"], minimumGroupSize: 5,
      smallGroupTreatment: "suprimir-grupo", complementarySuppression: true, provenanceLevel: "referencias-institucionais" };
    const moves = movementFacts([mov("a"), mov("b", { movement_type_id: "tipo-b" })]);
    const r = queryAnalytic({ authority: { status: "signed-in", personId: "p", grants: [grant(C.aggregate), grant(C.decomposition)] },
      query: { definitionId: "movimentacoes", reference: { from: "2026-01-01", to: "2026-12-31" }, filters: { schoolId: "e1" }, groupBy: "movementTypeId" },
      registry: R, facts: moves, disclosurePolicy: policy });
    expect(r.state).toBe("nao-divulgavel"); // todos os grupos seriam pequenos: só a decomposição é recusada
  });
  it("auditoria: nenhuma contagem fora do motor nem bypass da fronteira", () => {
    const loader = readFileSync("src/features/ciece/fact-loader.ts", "utf8");
    expect(loader).not.toMatch(/\.length\s*[-+]/);
    const fn = readFileSync("src/features/ciece/ciece-query.functions.ts", "utf8");
    expect(fn).toMatch(/queryAnalytic/);
    expect(fn).not.toMatch(/computeIndicator\(/);
  });
});
