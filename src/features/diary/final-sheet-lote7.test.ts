import { describe, expect, it } from "vitest";
import { applicableRule, attendanceFrom, withAttendance, type RuleRow } from "./final-sheet-cloud";
import { printBulletins, printIndividualSheets, projectFinalSheet, type SheetInput } from "./final-sheet";

const rule = (o: Partial<RuleRow> & { scope: RuleRow["scope"] }): RuleRow => ({ id: "r1", logical_id: "l", version: 1, label: "R", params: { passMark: 50, minAttendance: 0.75 }, source_ref: "doc", status: "homologada", ...o });
const base = (min: number | null): SheetInput => ({ modality: "fundamental-anos-finais", periods: ["1º"], components: [{ id: "lp", label: "LP" }], students: [{ id: "a", name: "Ana", status: "Ativo" }],
  cells: { "a:lp": { periodGrades: [80], finalRecovery: null, lessonsGiven: null, absences: null } }, rule: { id: "r1", label: "R", passMark: 50, minAttendance: min, sourceRef: "doc" } });

describe("LOTE 7 — regra, frequência, boletim", () => {
  it("regra só vale dentro da vigência e do ano", () => {
    const r = [rule({ scope: { modality: "eja", valid_from: "2026-01-01", valid_to: "2026-12-31", year: "2026" } })];
    expect(applicableRule(r, "eja", { year: "2026", on: "2026-06-01" }).rule?.id).toBe("r1");
    expect(applicableRule(r, "eja", { year: "2026", on: "2027-01-02" }).rule).toBeNull();
    expect(applicableRule(r, "eja", { year: "2027", on: "2026-06-01" }).rule).toBeNull();
    expect(applicableRule([rule({ scope: { modality: "eja" } })], "eja", { on: "2026-06-01" }).rule).toBeNull();
  });
  it("frequência real: Presente/Ausente contam; elegível sem marcação = desconhecida", () => {
    const att = attendanceFrom([
      { logical_attendance_id: "c1", version_number: 1, component_id: "lp", marks: { aula: { a: "Ausente" } }, eligible_student_ids: ["a", "b"] },
      { logical_attendance_id: "c1", version_number: 2, component_id: "lp", marks: { aula: { a: "Presente" } }, eligible_student_ids: ["a", "b"] },
      { logical_attendance_id: "c2", version_number: 1, component_id: "lp", marks: { aula: { a: "Ausente", b: "Presente" } }, eligible_student_ids: ["a", "b"] },
    ]);
    expect(att.get("a:lp")).toEqual({ given: 2, absences: 1, unknown: false });
    expect(att.get("b:lp")?.unknown).toBe(true);
    const cells = withAttendance({}, att, ["1º"]);
    expect(cells["b:lp"]?.lessonsGiven).toBeNull();
    expect(cells["a:lp"]?.absences).toBe(1);
  });
  it("regra com frequência mínima: sem frequência ⇒ PENDENTE; abaixo ⇒ REPROVADO; sem exigência ⇒ só nota", () => {
    expect(projectFinalSheet(base(0.75)).rows[0]!.overall).toBe("PENDENTE");
    const low = base(0.75); low.cells["a:lp"] = { periodGrades: [80], finalRecovery: null, lessonsGiven: 10, absences: 5 };
    expect(projectFinalSheet(low).rows[0]!.overall).toBe("REPROVADO");
    expect(projectFinalSheet(base(null)).rows[0]!.overall).toBe("APROVADO");
  });
  it("Boletim e Ficha saem das mesmas linhas da Folha Final", () => {
    const i = base(null); const rows = projectFinalSheet(i).rows;
    const h = { school: "E", className: "T", year: "2026", state: "Homologada (ato 3)", source: "Folha Final, impressão abc" };
    for (const doc of [printBulletins(i, rows, h), printIndividualSheets(i, rows, h)]) {
      expect(doc).toContain("A4 portrait"); expect(doc).toContain("Ana"); expect(doc).toContain("APROVADO"); expect(doc).toContain("impressão abc");
    }
  });
});
