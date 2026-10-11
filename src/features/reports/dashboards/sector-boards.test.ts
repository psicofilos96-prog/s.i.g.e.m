import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECTOR_BOARDS, boardProblems, drillSpec } from "./sector-boards";
import type { Catalog } from "../custom/custom-report";

// Catálogo real (migration 0316): os painéis só podem citar o que ele declara.
const sql = readFileSync("drizzle/migrations/0316_custom_report_catalog_attendance_assessments.sql", "utf8");
const json = sql.slice(sql.indexOf("{", sql.indexOf("'")), sql.lastIndexOf("}") + 1);
const cat = JSON.parse(json.slice(0, json.lastIndexOf("}") + 1).replace(/'::jsonb[\s\S]*$/, "")) as Catalog;

describe("painéis por setor", () => {
  it("cobre os 10 setores pedidos", () => {
    expect(SECTOR_BOARDS.map((b) => b.id)).toEqual(["secretaria", "ciece", "direcao", "docente", "mediador", "diario", "mapa", "alimentacao", "acompanhamento", "supervisao"]);
  });
  it("toda declaração existe no catálogo real e nenhuma usa dado pessoal", () => {
    for (const b of SECTOR_BOARDS) expect(boardProblems(b, cat), b.id).toEqual([]);
  });
  it("setor sem fonte livre declara lacuna em vez de número", () => {
    for (const id of ["mediador", "alimentacao"]) { const b = SECTOR_BOARDS.find((x) => x.id === id)!; expect(b.indicators).toEqual([]); expect(b.gaps.length).toBeGreaterThan(0); }
  });
  it("drill mantém filtros do indicador e acrescenta a categoria (ausente = is_null)", () => {
    const i = SECTOR_BOARDS[0]!.indicators[1]!;
    const s = drillSpec(i.spec, i.detail!, { field: "turmas.turma", operator: "is_null" });
    expect(s.filter.items).toEqual([...i.spec.filter.items, { field: "turmas.turma", operator: "is_null" }]);
    expect(s.measures).toEqual([]); expect(s.groupBy).toEqual([]);
  });
});
