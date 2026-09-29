/** 14.7 — Dimensões cadastrais: turno da turma e sexo administrativo por junção declarada. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeIndicator, IndicatorRegistry, type IndicatorDefinition } from "./indicator-engine";
import { classShiftFacts, enrollmentFacts, episodeFacts, studentIdentityFacts, type ClassShiftRow, type StudentIdentityRow } from "./fact-adapters";
import { FACT_CATALOG, validateFact } from "./fact-catalog";
import { isDimensionAvailable } from "./institutional-dimension-gaps";

const idn = (o: Partial<StudentIdentityRow>): StudentIdentityRow => ({ id: "i1", student_id: "s-m1", version: 1, supersedes_id: null, birth_date: "2014-03-02", sex_value_id: "f", sex_value_version: 1, originating_act_ref: null, ...o });
const shf = (o: Partial<ClassShiftRow>): ClassShiftRow => ({ id: "t1a", class_id: "t1", logical_id: "L", version: 1, supersedes_id: null, shift_value_id: "manha", shift_value_version: 1, valid_from: "2026-02-01", valid_until: "2026-06-30", originating_act_ref: null, ...o });
const enr = (id: string) => ({ id, student_id: `s-${id}`, school_id: "e1", cycle_id: "c26", opened_on: "2026-02-02", institutional_number: null, originating_act_ref: null, supersedes_id: null, correction_reason: null, recorded_by: "u", created_at: "t" });
const epi = (id: string, cls: string) => ({ id, enrollment_id: "m1", student_id: `s-${id}`, school_id: "e1", class_id: cls, class_label_snapshot: null, cycle_id: "c26", valid_from: "2026-02-10", originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: null });
const def = (o: Partial<IndicatorDefinition>): IndicatorDefinition => ({ id: "x", version: 1, label: "t", status: "homologada", factTypeId: "vinculo-escolar", subjectKey: "enrollmentId", populationCriteria: {}, temporal: { kind: "fotografia" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "u", ...o });
const R = new IndicatorRegistry();
R.register(def({ id: "vinc" }));
R.register(def({ id: "entu", factTypeId: "episodio-de-enturmacao", subjectKey: "studentId" }));

const identities = studentIdentityFacts([idn({}), idn({ id: "i2", supersedes_id: "i1", version: 2, sex_value_id: "m" }), idn({ id: "i3", student_id: "s-m2", sex_value_id: null, sex_value_version: null })]);
const facts = [...enrollmentFacts([enr("m1"), enr("m2"), enr("m3")] as never, []), ...identities];

describe("14.7 identidade cadastral", () => {
  it("usa só a versão vigente e cita a versão na proveniência", () => {
    const r = computeIndicator(R, facts, { definitionId: "vinc", reference: { at: "2026-04-01" }, groupBy: "student.administrativeSexId" });
    expect(r.ok && r.groups.map((g) => [g.groupKey, g.observedSubjects])).toEqual([["(sem valor declarado)", 2], ["m", 1]]);
    const m = r.ok ? r.groups.find((g) => g.groupKey === "m")! : null;
    expect(m!.factRefs[0]!.linkedRecordRefs).toEqual(["student_identity_versions:i2@2"]);
  });
  it("sexo ausente não vira valor; data de nascimento não entra no fato nem vira dimensão", () => {
    expect(identities.find((f) => f.subject["studentId"] === "s-m2")!.availability).toBe("ausente");
    expect(JSON.stringify(identities)).not.toMatch(/2014-03-02|birth/);
    expect(isDimensionAvailable("studentBirthDate")).toBe(false);
    const r = computeIndicator(R, facts, { definitionId: "vinc", reference: { at: "2026-04-01" }, groupBy: "studentBirthDate" });
    expect(r.ok).toBe(false);
  });
});

describe("14.7 turno da turma", () => {
  const shifts = classShiftFacts([shf({}), shf({ id: "t1b", logical_id: "L2", shift_value_id: "tarde", valid_from: "2026-07-01", valid_until: null }), shf({ id: "t9", class_id: "t9", valid_from: null })]);
  const f = [...episodeFacts([epi("a", "t1"), epi("b", "t9")] as never), ...shifts];
  it("turno vem da vigência na data de referência, sem cópia ao estudante", () => {
    const at = (d: string) => { const r = computeIndicator(R, f, { definitionId: "entu", reference: { at: d }, groupBy: "class.shiftId" }); return r.ok ? r.groups.map((g) => g.groupKey) : []; };
    expect(at("2026-04-01")).toEqual(["(sem valor declarado)", "manha"]);
    expect(at("2026-08-01")).toEqual(["(sem valor declarado)", "tarde"]);
    expect(episodeFacts([epi("a", "t1")] as never)[0]!.dimensions).not.toHaveProperty("shiftId");
  });
  it("turno sem data de vigência é indeterminado, nunca vigente", () => {
    expect(shifts.find((s) => s.subject["classId"] === "t9")!.availability).toBe("indeterminado");
  });
  it("versão corrigida não duplica turno", () => {
    const two = classShiftFacts([shf({}), shf({ id: "t1c", supersedes_id: "t1a", version: 2, shift_value_id: "integral" })]);
    expect(two.map((s) => s.payload && s.payload.kind === "categorico" ? s.payload.categoryId : null)).toEqual(["integral"]);
  });
});

describe("14.7 catálogo e fronteira", () => {
  it("uma fonte por fato e fatos válidos", () => {
    for (const t of ["identidade-cadastral-do-estudante", "turno-da-turma"]) expect(FACT_CATALOG.filter((c) => c.factTypeId === t)).toHaveLength(1);
    for (const x of [...identities, ...classShiftFacts([shf({})])]) expect(validateFact(x, x.provenance.sourceId)).toEqual([]);
  });
  it("AEE, transporte e alimentação continuam sem fonte; nenhum atributo copiado para o CIECE", () => {
    for (const d of ["studentDisabilityOrAee", "studentSchoolTransport", "studentSchoolMeals", "studentAddress"]) expect(isDimensionAvailable(d)).toBe(false);
    const eng = readFileSync("src/features/ciece/indicator-engine.ts", "utf8");
    expect(eng).not.toMatch(/student_identity_versions|class_shift_versions|\bage\b|idade/);
  });
});
