import { describe, expect, it } from "vitest";
import { panoramaRows, panoramaTotals } from "./cross-reports";

const recon = [
  { school_id: "a", inep: "1", measure: "turmas", operational_value: 4, official_value: 4 },
  { school_id: "a", inep: "1", measure: "matriculas_total", operational_value: 100, official_value: 100 },
  { school_id: "a", inep: "1", measure: "alunos", operational_value: 95, official_value: 95 },
  { school_id: "b", inep: "2", measure: "turmas", operational_value: 2, official_value: 3 },
  { school_id: "b", inep: "2", measure: "matriculas_total", operational_value: 40, official_value: 40 },
  { school_id: "b", inep: "2", measure: "alunos", operational_value: null, official_value: 39 },
];
describe("panorama por escola", () => {
  const rows = panoramaRows(recon, new Map([["a", "Escola A"], ["b", "Escola B"]]), new Map([["a", 7]]));
  it("matrículas e alunos distintos ficam separados e média por turma é derivada", () => {
    expect(rows[0]).toMatchObject({ school: "Escola A", classes: 4, enrollments: 100, students: 95, enrollments_per_class: 25, staff_records: 7, census_match: "coincide" });
  });
  it("ausência nunca vira zero e torna o total indisponível", () => {
    expect(rows[1]!.students).toBeNull();
    expect(rows[1]!.census_match).toBe("incompleto");
    expect(panoramaTotals(rows)).toEqual({ schools: 2, classes: 6, enrollments: 140, students: null, staff_records: 7 });
  });
  it("sem leitura de pessoal a coluna fica indisponível, não zero", () => {
    expect(panoramaRows(recon, new Map(), null)[0]!.staff_records).toBeNull();
  });
});
