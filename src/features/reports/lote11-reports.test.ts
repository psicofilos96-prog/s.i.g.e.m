import { describe, expect, it } from "vitest";
import { classCountRows, infraValue, journeySchoolRows } from "./cross-reports";
import { BUILDER_SOURCES } from "./builder-sources";

const names = new Map([["s1", "Escola A"]]);
describe("LOTE 11 — relatórios 2026", () => {
  it("vínculos ≠ estudantes distintos; episódio substituído sai", () => {
    const r = classCountRows([
      { id: "e1", supersedes_id: null, student_id: "a", school_id: "s1", class_id: "c1", class_label_snapshot: "1A" },
      { id: "e2", supersedes_id: null, student_id: "a", school_id: "s1", class_id: "c1", class_label_snapshot: "1A" },
      { id: "e3", supersedes_id: null, student_id: "b", school_id: "s1", class_id: "c1", class_label_snapshot: "1A" },
      { id: "e4", supersedes_id: "e3", student_id: "b", school_id: "s1", class_id: "c1", class_label_snapshot: "1A" },
    ], names);
    expect(r).toEqual([{ school: "Escola A", class_label: "1A", bonds: 3, students: 2 }]);
  });
  it("jornada conta estudantes distintos por escola", () => {
    expect(journeySchoolRows([{ school_id: "s1", student_id: "a" }, { school_id: "s1", student_id: "a" }, { school_id: "s1", student_id: "b" }], names))
      .toEqual([{ school: "Escola A", declarations: 3, students: 2 }]);
  });
  it("infraestrutura: ausência continua null, falso é 'não'", () => {
    const e = { value_boolean: null, value_integer: null, value_decimal: null, value_text: null, value_catalog: null };
    expect(infraValue(e)).toBeNull();
    expect(infraValue({ ...e, value_boolean: false })).toBe("não");
    expect(infraValue({ ...e, value_integer: 0 })).toBe(0);
  });
  it("novos assuntos existem, sem nome de estudante e com CSV/XLSX/PDF", () => {
    for (const id of ["gerador-turma-contagens", "gerador-jornada-alunos", "gerador-infraestrutura"]) {
      const s = BUILDER_SOURCES.find((x) => x.id === id)!;
      expect(s.definition.formats).toEqual(["csv", "xlsx", "pdf"]);
      expect(s.definition.columns.map((c) => c.id)).not.toContain("name");
    }
    expect(BUILDER_SOURCES.filter((s) => s.id === "gerador-infraestrutura")).toHaveLength(1);
  });
});
