import { describe, expect, it } from "vitest";
import { buildStudentRecord, heads } from "./student-record";

const base = {
  student: { id: "s", display_name: "Aluno Sintético", institutional_identifier: null },
  enrollments: [{ id: "m1", school_id: "e1", opened_on: null, institutional_number: "123", technical_operation_id: "op", supersedes_id: null }],
  episodes: [
    { id: "p1", enrollment_id: "m1", school_id: "e1", class_id: "t1", class_label_snapshot: null, valid_from: null, supersedes_id: null, ending: null },
    { id: "p2", enrollment_id: "m1", school_id: "e1", class_id: "t2", class_label_snapshot: null, valid_from: "2026-02-01", supersedes_id: null, ending: { ended_on: "2026-06-30", reason_label: "Remanejado" } },
  ],
  classes: [{ id: "t1", name: "1º A", code: null, school_label_snapshot: "Escola X", academic_year_label: "2026", stage_label_snapshot: null }],
  decls: [{ class_id: "t2", field: "Tipo de turma", value_text: "Atendimento educacional especializado (AEE)" }, { class_id: "t1", field: "Etapa de ensino", value_text: "1º Ano" }],
  days: [],
};

describe("Ficha escolar do aluno (LOTE 2/14)", () => {
  it("ausência fica null, nunca inventada", () => {
    const r = buildStudentRecord(base);
    const t2 = r.enrollments[0]!.classes[1]!;
    expect(t2.stage).toBeNull();
    expect(t2.year).toBeNull();
    expect(r.enrollments[0]!.openedOn).toBeNull();
    expect(r.missing).toContain("Código institucional");
  });
  it("AEE só pelo tipo de turma declarado", () => {
    const [a, b] = buildStudentRecord(base).enrollments[0]!.classes;
    expect(a!.aee).toBe(false);
    expect(b!.aee).toBe(true);
  });
  it("situação: vigente sem encerramento; encerrado com data e motivo registrados", () => {
    const [a, b] = buildStudentRecord(base).enrollments[0]!.classes;
    expect(a!.situation).toEqual({ kind: "vigente" });
    expect(b!.situation).toEqual({ kind: "encerrado", on: "2026-06-30", reason: "Remanejado" });
  });
  it("fonte da matrícula: carga técnica do Censo vs registro no SIGEM", () => {
    expect(buildStudentRecord(base).enrollments[0]!.source).toBe("carga-educacenso-2026");
  });
  it("só a versão vigente de cada cadeia aparece", () => {
    expect(heads([{ id: "a", supersedes_id: null }, { id: "b", supersedes_id: "a" }]).map((r) => r.id)).toEqual(["b"]);
  });
});
