import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { divergences, groupClasses, schoolCells, sliceTotals, type MapClassRow, type MapSchoolRow } from "./census-map-2026";

const school = (o: Partial<MapSchoolRow>): MapSchoolRow => ({
  school_id: "s1", inep: "33000001", school_name: "E", classes: 2, school_enrollments: 3, distinct_students: 3, bonds: 4, aee_bonds: 1,
  aee_students: 1, aee_only_students: 0, teachers: 2, professionals: 3, infra_items: 54, infra_informed: 50,
  receipt_students: 3, receipt_bonds: 4, receipt_aee: 1, receipt_classes: 2, receipt_teachers: 2, ...o,
});
const cls = (o: Partial<MapClassRow>): MapClassRow => ({
  school_id: "s1", class_id: "c", class_code: null, class_name: "T", stage: "EF", stage_group: null, class_type: "Curricular",
  mediation: null, organization: null, schedule_literal: null, declared_students: 2, bonds: 2, distinct_students: 2, is_aee: false, professionals: 1, ...o,
});

describe("Mapa do Censo 2026", () => {
  it("AEE não soma como aluno novo: alunos vêm das matrículas, vínculos AEE ficam à parte", () => {
    const t = sliceTotals([school({})]);
    expect(t.bonds).toBe(4);
    expect(schoolCells([school({})])[0]!["students"]).toBe(3);
  });
  it("coincide com o recibo ⇒ sem divergência; diferença ou recibo ausente vira divergência, nunca zero", () => {
    expect(divergences([school({})])).toEqual([]);
    const d = divergences([school({ receipt_aee: 2 }), school({ school_id: "s2", receipt_classes: null })]);
    expect(d.find((x) => x.school_id === "s1")).toMatchObject({ measure: "matrículas AEE", base: 1, receipt: 2 });
    expect(d.filter((x) => x.school_id === "s2" && x.measure === "turmas")[0]!.receipt).toBeNull();
  });
  it("agrupa por etapa e qtd. declarada ausente torna o grupo ausente", () => {
    const g = groupClasses([cls({}), cls({ class_id: "d", declared_students: null }), cls({ class_id: "e", stage: null })], "stage");
    expect(g.find((x) => x.label === "EF")).toMatchObject({ classes: 2, bonds: 4, declared: null });
    expect(g.find((x) => x.label === "não informado")?.classes).toBe(1);
  });
  it("readers são SECURITY INVOKER, só 2026, sem grant anon e sem gravação", () => {
    const sql = readFileSync("drizzle/migrations/0282_lote15_census_map_2026_readers.sql", "utf8");
    expect(sql.match(/LANGUAGE sql STABLE SECURITY INVOKER/g)?.length).toBe(3);
    expect(sql).not.toMatch(/SECURITY DEFINER|\bINSERT\b|\bUPDATE\b|\bDELETE\b|TO anon/);
    expect(sql).toMatch(/Ano letivo 2026/);
  });
  it("tela não tem números fixos da rede", () => {
    const page = readFileSync("src/features/statistical-map/census-map-2026-page.tsx", "utf8");
    for (const n of ["9763", "9.763", "10295", "10.295", "9811", "698"]) expect(page).not.toContain(n);
  });
});
