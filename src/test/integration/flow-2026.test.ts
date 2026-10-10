// LOTE 12 — fluxo 2026 (escola → turmas → turma → aluno → matrícula/jornada → profissionais/infra → relatório)
// sobre FIXTURES SINTÉTICAS (sem dado pessoal). Não é E2E autenticado: prova a cadeia de projeções puras
// e que cada etapa tem rota real. Leitura real agregada fica em scripts/audit2026/e2e-aggregate.sql.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { rosterCounts, currentEpisodes } from "@/features/classes/class-roster";
import { inYear } from "@/features/students/student-day-intervals";
import { groupInfra } from "@/features/units/infrastructure-groups";
import { classCountRows, infraValue, journeySchoolRows } from "@/features/reports/cross-reports";
import { BUILDER_SOURCES } from "@/features/reports/builder-sources";
import { runReport, toCsv } from "@/features/reports/report-engine";

const S = "fx-escola-a";
const eps = [
  { id: "e1", supersedes_id: null, student_id: "fx-al-1", enrollment_id: "m1", school_id: S, class_id: "fx-t1", class_label_snapshot: "FX 1A", ended: false },
  { id: "e2", supersedes_id: null, student_id: "fx-al-2", enrollment_id: "m2", school_id: S, class_id: "fx-t1", class_label_snapshot: "FX 1A", ended: true },
  { id: "e3", supersedes_id: "e2", student_id: "fx-al-2", enrollment_id: "m2", school_id: S, class_id: "fx-t1", class_label_snapshot: "FX 1A", ended: false },
  { id: "e4", supersedes_id: null, student_id: "fx-al-1", enrollment_id: "m3", school_id: S, class_id: "fx-t2", class_label_snapshot: "FX AEE", ended: false },
];
const names = new Map([[S, "Escola Fixture A"]]);

describe("LOTE 12 — fluxo 2026 com fixtures sintéticas", () => {
  it("cada etapa do fluxo tem rota real", () => {
    for (const r of ["unidades.$id", "turmas.index", "turmas.$id", "alunos.$id", "profissionais.index", "pessoal-2026", "relatorios"])
      expect(existsSync(`src/routes/${r}.tsx`), r).toBe(true);
  });
  it("turma: correção substitui episódio; vínculos e alunos distintos coerentes", () => {
    expect(currentEpisodes(eps).map((e) => e.id).sort()).toEqual(["e1", "e3", "e4"]);
    const t1 = eps.filter((e) => e.class_id === "fx-t1");
    const c = rosterCounts(t1) as unknown as Record<string, number>;
    expect(Object.values(c)).toContain(2);
    expect(classCountRows(eps, names)).toEqual([
      { school: "Escola Fixture A", class_label: "FX 1A", bonds: 2, students: 2 },
      { school: "Escola Fixture A", class_label: "FX AEE", bonds: 1, students: 1 },
    ]);
  });
  it("aluno: jornada só 2026", () => {
    expect(inYear("2026-03-01T00:00:00Z")).toBe(true);
    expect(inYear("2027-03-01T00:00:00Z")).toBe(false);
    expect(journeySchoolRows([{ school_id: S, student_id: "fx-al-1" }, { school_id: S, student_id: "fx-al-1" }], names)).toEqual([{ school: "Escola Fixture A", declarations: 2, students: 1 }]);
  });
  it("infraestrutura: ausência não vira 'não'; item novo não some", () => {
    const empty = { value_boolean: null, value_integer: null, value_decimal: null, value_text: null, value_catalog: null };
    expect(infraValue(empty)).toBeNull();
    const g = groupInfra([{ attributeId: "fx-item-desconhecido", label: "Item FX" }]);
    expect(g.flatMap((x) => x.items)).toHaveLength(1);
  });
  it("relatório: sai pelo motor comum, ausência = 'não disponível', sem nome", () => {
    const src = BUILDER_SOURCES.find((s) => s.id === "gerador-turma-contagens")!;
    const rows = classCountRows(eps, names).map((r) => ({ ...r }));
    const csv = toCsv(runReport(src.definition, { params: {} }, [...rows, { school: null, class_label: "FX X", bonds: 1, students: 1 }]), { headerLines: ["FX"], title: "t" });
    expect(csv).toContain("Escola Fixture A;FX 1A;2;2");
    expect(csv).toContain("não disponível;FX X");
    expect(csv).not.toMatch(/fx-al-/);
  });
  it("SQL agregado real: só contagens, nenhum DML", () => {
    const sql = readFileSync("scripts/audit2026/e2e-aggregate.sql", "utf8");
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|grant)\b/i);
    expect(sql).not.toMatch(/full_name|display_name|official_name/);
  });
});
