import { describe, expect, it } from "vitest";
import { exportRows, monthWindow, networkTotal, projectSchool, reconciles, toCsv, MEASURE_KEYS, type SchoolSources } from "./network-projection";

const w = monthWindow(2027, 3);
const enr = (id: string, student: string, opened: string, ended: string | null = null) => ({
  id, logical_id: id, student_id: student, school_id: "e1", academic_year_id: "a", opened_on: opened, institutional_number: null,
  originating_act_ref: null, created_at: "", ending_version_id: null, ended_on: ended, bond_status_value_id: null, bond_status_version: null, ending_reason: null,
});
const alloc = (id: string, student: string, cls: string, from: string, ended: string | null = null) => ({
  id, logical_id: id, participation_logical_id: null, enrollment_id: "x", student_id: student, school_id: "e1", class_id: cls,
  valid_from: from, ended_on: ended, ending_version_id: null, ending_reason: null, originating_act_ref: null, class_label_snapshot: null, created_at: "",
});
const src = (o: Partial<SchoolSources> = {}): SchoolSources => ({
  schoolId: "e1", schoolName: "Escola 1", district: null, participations: [],
  enrollments: [enr("m1", "a1", "2027-02-01"), enr("m2", "a2", "2027-03-10"), enr("m3", "a3", "2027-02-01", "2027-03-15")],
  allocations: [alloc("t1", "a1", "c1", "2027-02-01"), alloc("t2", "a3", "c1", "2027-02-01", "2027-03-15"), alloc("t3", "a3", "c2", "2027-03-16")],
  movements: [{ id: "mv", logical_id: "mv", version: 1, student_id: "a3", enrollment_id: "m3", movement_type_id: "transferencia", effective_on: "2027-03-15", school_scope_ids: ["e1", "e2"] }],
  classes: [{ id: "c1", name: "1A" }, { id: "c2", name: "1B" }], ...o,
});

describe("projeção mensal da rede", () => {
  it("totais reconciliam até os registros de origem", () => {
    const p = projectSchool(src(), w);
    for (const k of MEASURE_KEYS) expect(reconciles(p[k])).toBe(true);
    expect(p.enrollments.records).toEqual(["school_enrollments:m1", "school_enrollments:m2"]);
  });
  it("aluno movimentado/transferido no mês: origem encerrada preservada, entrada e saída contadas", () => {
    const p = projectSchool(src(), w);
    expect(p.enrollmentsEndedInMonth.value).toBe(1);
    expect(p.enrollmentsOpenedInMonth.value).toBe(1);
    expect(p.movementsInMonth.value).toBe(1);
    const c1 = p.classRows!.find((c) => c.classId === "c1")!;
    expect([c1.allocated.value, c1.leftInMonth.value]).toEqual([1, 1]);
    expect(p.classRows!.find((c) => c.classId === "c2")!.enteredInMonth.value).toBe(1);
    expect(p.withoutClass.records).toEqual(["school_enrollments:m2"]);
  });
  it("data de referência no meio do mês muda a fotografia (validOn)", () => {
    const p = projectSchool(src(), monthWindow(2027, 3, null, "2027-03-12"));
    expect(p.allocated.value).toBe(2);
  });
  it("ausência ≠ zero; escola sem dado não vira zero na rede", () => {
    const none = projectSchool(src({ schoolId: "e2", enrollments: null, allocations: null, movements: null, classes: null }), w);
    expect(none.enrollments).toEqual({ value: null, records: [], state: "nao-disponivel" });
    expect(none.withoutClass.value).toBeNull();
    const empty = projectSchool(src({ schoolId: "e3", enrollments: [], allocations: [] }), w);
    expect(empty.enrollments.value).toBe(0);
    const t = networkTotal([projectSchool(src(), w), none], "enrollments");
    expect(t).toMatchObject({ value: 2, coveredSchools: 1, missingSchools: ["e2"] });
    expect(networkTotal([none], "enrollments").value).toBeNull();
  });
  it("exportação usa a mesma projeção", () => {
    const ps = [projectSchool(src(), w), projectSchool(src({ schoolId: "e2", enrollments: null }), w)];
    const rows = exportRows(ps);
    const col = rows[0]!.indexOf("Matrículas vigentes");
    expect(rows[1]![col]).toBe(String(ps[0]!.enrollments.value));
    expect(rows[2]![col]).toBe("não disponível");
    expect(rows[3]![col]).toBe("2 (faltam 1)");
    const csv = toCsv(w, rows);
    expect(csv.split("\n").slice(0, 5)).toEqual(["Prefeitura Municipal de Itaperuna", "Secretaria Municipal de Educação", "Núcleo de Informação e Estatística", "MAPA ESTATÍSTICO", "março/2027"]);
  });
});
