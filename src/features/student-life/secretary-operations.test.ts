import { describe, expect, it } from "vitest";
import { buildTrajectory, deriveAvailability, filterSecretaryRows, secretaryRows, type MovementRow } from "./secretary-operations";
import type { CapacityRow, ClassAllocationAtRow, CycleEnrollmentAtRow, CycleParticipationRow } from "./cycle-enrollment-source";

const enr = (o: Partial<CycleEnrollmentAtRow>): CycleEnrollmentAtRow => ({
  id: "e1v", logical_id: "e1", student_id: "s1", school_id: "esc", academic_year_id: "ano", opened_on: "2027-02-01",
  institutional_number: null, originating_act_ref: null, created_at: "2027-01-10T00:00:00Z", ending_version_id: null,
  ended_on: null, bond_status_value_id: null, bond_status_version: null, ending_reason: null, ...o,
});
const part = (o: Partial<CycleParticipationRow>): CycleParticipationRow => ({
  id: "p1v", logical_id: "p1", version: 1, supersedes_id: null, enrollment_logical_id: "e1", student_id: "s1", school_id: "esc",
  nature_scheme_id: "n", nature_value_id: "regular", nature_version: 1, valid_from: "2027-02-01", valid_until: null, annulled: false,
  change_reason: null, originating_act_ref: null, recorded_by: "u", created_at: "2027-01-10T00:00:00Z", ...o,
});
const alloc = (o: Partial<ClassAllocationAtRow>): ClassAllocationAtRow => ({
  id: "a1v", logical_id: "a1", participation_logical_id: "p1", enrollment_id: "e1v", student_id: "s1", school_id: "esc",
  class_id: "t1", valid_from: "2027-02-01", ended_on: null, ending_version_id: null, ending_reason: null,
  originating_act_ref: null, class_label_snapshot: "1º A", created_at: "2027-01-10T00:00:00Z", ...o,
});
const cap = (limit: number | null): CapacityRow => ({ id: "c", logical_id: "c", version: 1, class_id: "t1", school_id: "esc", reference_limit: limit, valid_from: "2027-01-01", valid_until: null, basis_text: null, originating_act_ref: null, created_at: "x" });

describe("Secretaria — disponibilidade", () => {
  it("sem capacidade registrada: vagas desconhecidas, nunca zero", () => {
    expect(deriveAvailability({ capacity: { status: "nao-registrada" }, occupancy: 3 })).toEqual({ kind: "desconhecida", occupancy: 3 });
  });
  it("capacidade registrada: vagas derivadas e excesso só factual", () => {
    expect(deriveAvailability({ capacity: { status: "registrada", referenceLimit: 2, record: cap(2) }, occupancy: 3 }))
      .toMatchObject({ kind: "derivada", remaining: 0, exceededBy: 1 });
  });
});

describe("Secretaria — situação projetada na data", () => {
  const src = (allocations: ClassAllocationAtRow[], e = enr({}), parts = [part({})]) => ({ enrollments: [e], participations: parts, allocations });
  it("aluno sem turma permanece sem turma (não herda turma)", () => {
    expect(secretaryRows("2027-03-01", src([]))[0]!.situation).toBe("vigente-sem-turma");
  });
  it("encerramento histórico: depois do fim fica encerrada, antes continua com turma", () => {
    const s = src([alloc({ ended_on: "2027-06-30" })], enr({ ended_on: "2027-06-30" }));
    expect(secretaryRows("2027-03-01", s)[0]!.situation).toBe("vigente-com-turma");
    expect(secretaryRows("2027-08-01", s)[0]!.situation).toBe("encerrada");
  });
  it("participação anulada não conta; sem participação é ausência explícita", () => {
    expect(secretaryRows("2027-03-01", src([], enr({}), [part({ annulled: true })]))[0]!.situation).toBe("vigente-sem-participacao");
  });
  it("filtros por turma, ano e situação", () => {
    const rows = secretaryRows("2027-03-01", src([alloc({})]));
    expect(filterSecretaryRows(rows, { classId: "t1" })).toHaveLength(1);
    expect(filterSecretaryRows(rows, { classId: "t2" })).toHaveLength(0);
    expect(filterSecretaryRows(rows, { academicYearId: "outro" })).toHaveLength(0);
    expect(filterSecretaryRows(rows, { text: "s1", situation: "vigente-com-turma" })).toHaveLength(1);
  });
});

describe("Secretaria — trajetória", () => {
  it("transferência não apaga a origem: origem encerrada e destino aparecem em ordem", () => {
    const mov: MovementRow = { id: "m", logical_id: "m", version: 1, supersedes_id: null, student_id: "s1", enrollment_id: "e1v", movement_type_id: "tipo-x", movement_type_version: 1, effective_on: "2027-06-30", origin: { schoolId: "esc" }, destination: { schoolId: "esc-b" }, reason_code: null, reason_text: null, originating_act_ref: null, correction_reason: null, created_at: "2027-06-30T10:00:00Z" };
    const t = buildTrajectory("s1", {
      enrollments: [enr({ ended_on: "2027-06-30" }), enr({ id: "e2v", logical_id: "e2", school_id: "esc-b", opened_on: "2027-07-01" })],
      participations: [part({})], allocations: [alloc({ ended_on: "2027-06-30" })], movements: [mov],
    });
    expect(t.map((e) => e.kind)).toEqual([
      "inscricao-aberta", "participacao-inicio", "alocacao-inicio", "inscricao-encerrada", "alocacao-fim", "movimentacao", "inscricao-aberta",
    ]);
  });
  it("abertura sem data não ganha data inventada", () => {
    expect(buildTrajectory("s1", { enrollments: [enr({ opened_on: null })], participations: [], allocations: [], movements: [] })).toEqual([]);
  });
});
