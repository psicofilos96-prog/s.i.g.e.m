import { describe, expect, it } from "vitest";
import { classChecks, editableCells, exportMap, gridCells, mapGrid, MAP_GRID_REPORT, sliceTotals, type MapClassRow, type MapSchoolRow } from "./census-map-2026";

const cls = (o: Partial<MapClassRow>): MapClassRow => ({
  school_id: "s1", class_id: Math.random().toString(36), class_code: null, class_name: "T", stage: "Ensino fundamental de 9 anos - 1º Ano",
  stage_group: "Ensino Fundamental", class_type: "Curricular (etapa de ensino)", mediation: "PRESENCIAL", organization: null, schedule_literal: null,
  declared_students: 10, bonds: 10, distinct_students: 10, is_aee: false, professionals: 1, ...o,
});
const rows = [
  cls({}), cls({ declared_students: 12, bonds: 12 }),
  cls({ stage_group: "Educação Infantil", stage: "Educação infantil - creche (0 a 3 anos)", declared_students: 8, bonds: 8 }),
  cls({ stage_group: "Educação de Jovens e Adultos (ensino fundamental, ensino médio e integrada)", stage: "EJA - Ensino fundamental - anos iniciais (1º segmento)", declared_students: 5, bonds: 5 }),
  cls({ stage_group: "Ensino Fundamental", class_type: "Atendimento educacional especializado (AEE)", stage: null, is_aee: true, declared_students: 3, bonds: 3 }),
];

describe("LOTE 16 — fidelidade do mapa 2026", () => {
  it("subtotais por modalidade e total geral somam as linhas", () => {
    const g = mapGrid(rows);
    const ef = g.find((r) => r.kind === "subtotal" && r.group === "Ensino Fundamental")!;
    expect(ef).toMatchObject({ classes: 3, bonds: 25, declared: 25, aee_bonds: 3 });
    expect(g.find((r) => r.kind === "subtotal" && r.group.startsWith("Educação Infantil"))).toMatchObject({ classes: 1, bonds: 8 });
    expect(g.find((r) => r.kind === "subtotal" && r.group.startsWith("Educação de Jovens"))).toMatchObject({ classes: 1, bonds: 5 });
    expect(g.at(-1)).toMatchObject({ kind: "total", classes: 5, bonds: 38, aee_bonds: 3 });
  });
  it("AEE aparece como vínculo, nunca como aluno: alunos vêm das matrículas escolares", () => {
    const s = { school_id: "s1", distinct_students: 35, school_enrollments: 35, bonds: 38, aee_bonds: 3 } as MapSchoolRow;
    expect(sliceTotals([s]).bonds - sliceTotals([s]).school_enrollments).toBe(3);
  });
  it("dupla matrícula: alunos distintos por escola não somam como alunos da rede", () => {
    const a = { school_id: "a", school_enrollments: 1, bonds: 1 } as MapSchoolRow, b = { school_id: "b", school_enrollments: 1, bonds: 1 } as MapSchoolRow;
    expect(sliceTotals([a, b]).school_enrollments).toBe(2);
    expect(Object.keys(sliceTotals([a, b]))).not.toContain("distinct_students");
  });
  it("etapa sem declaração vira 'não informado' e quantidade ausente deixa subtotal ausente, nunca zero", () => {
    const g = mapGrid([cls({ stage: null, declared_students: null })]);
    expect(g[0]!.stage).toBe("não informado");
    expect(g.find((r) => r.kind === "total")!.declared).toBeNull();
  });
  it("comparador por turma: coincide, diverge e sem declaração explícitos", () => {
    const c = classChecks([cls({}), cls({ declared_students: 9 }), cls({ declared_students: null }), cls({ declared_students: 0, bonds: 0 })]);
    expect(c.map((x) => x.status)).toEqual(["coincide", "diverge", "sem-declaracao", "coincide"]);
  });
  it("filtro por escola recorta a grade", () => {
    const g = mapGrid([...rows, cls({ school_id: "s2" })].filter((r) => r.school_id === "s2"));
    expect(g.at(-1)!.classes).toBe(1);
  });
  it("sem regra homologada nenhum campo é editável", () => {
    expect(editableCells(null)).toEqual([]);
  });
  it("impressão sai em A4 paisagem pelo motor comum, com ausência como 'não disponível'", async () => {
    const blob = await exportMap(MAP_GRID_REPORT, gridCells(mapGrid([cls({ declared_students: null })])), "pdf", { headerLines: ["Rede"], title: "Grade" }, ["Ano 2026"]);
    const html = await blob.text();
    expect(html).toContain("size:A4 landscape");
    expect(html).toContain("não disponível");
    expect(html).toContain("Ano 2026");
  });
});
