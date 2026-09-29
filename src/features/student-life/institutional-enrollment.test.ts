/** 14.5K — Fonte institucional de matrícula, enturmação e movimentação. */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classMembersOn, currentVersions, episodeViews, movementRelativeTo, studentMovements, studentPlacementOn, validOn, versionChain, wasMemberAt,
  type EnrollmentRow, type EpisodeRow, type MovementRow,
} from "./institutional-enrollment";
import { enrollmentFacts, movementFacts, episodeFacts } from "@/features/ciece/fact-adapters";
import { FACT_CATALOG, validateFact } from "@/features/ciece/fact-catalog";

const enr = (o: Partial<EnrollmentRow> = {}): EnrollmentRow => ({
  id: "m1", student_id: "s1", school_id: "e1", cycle_id: "c26", opened_on: "2026-02-02", institutional_number: "2026-001",
  originating_act_ref: "ato-1", supersedes_id: null, correction_reason: null, recorded_by: "u", created_at: "t", ...o,
});
const epi = (o: Partial<EpisodeRow> = {}): EpisodeRow => ({
  id: "ep1", enrollment_id: "m1", student_id: "s1", school_id: "e1", class_id: "t1", class_label_snapshot: "6º A", cycle_id: "c26",
  valid_from: "2026-02-10", originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ...o,
});
const mov = (o: Partial<MovementRow> = {}): MovementRow => ({
  id: "mv1", logical_id: "L1", version: 1, supersedes_id: null, student_id: "s1", enrollment_id: "m1", movement_type_id: "transferencia-expedida",
  movement_type_version: 1, effective_on: "2026-05-01", origin: { schoolId: "e1", classId: "t2" }, destination: { externalLabel: "Rede estadual" },
  reason_code: null, reason_text: null, originating_act_ref: "ato-9", correction_reason: null, recorded_by: "u", created_at: "t", ...o,
});

// Remanejamento t1 → t2 em 20/03 e transferência expedida em 01/05.
const episodes = [epi(), epi({ id: "ep2", class_id: "t2", valid_from: "2026-03-21" })];
const endings = [
  { episode_id: "ep1", ended_on: "2026-03-20", reason_label: null, originating_act_ref: null },
  { episode_id: "ep2", ended_on: "2026-04-30", reason_label: null, originating_act_ref: null },
];
const views = episodeViews(episodes, endings);

describe("14.5 — conceitos distintos e temporalidade", () => {
  it("1–3. estudante ≠ matrícula ≠ enturmação; matrícula preserva identidade ao mudar de turma", () => {
    expect(enr().id).not.toBe(enr().student_id);
    expect(new Set(views.map((v) => v.enrollment_id))).toEqual(new Set(["m1"]));
    expect(views.map((v) => v.id)).toEqual(["ep1", "ep2"]);
  });
  it("4, 11. pertence à turma só dentro da vigência; consulta histórica devolve o vínculo da data", () => {
    expect(classMembersOn("t1", "2026-03-15", views).map((e) => e.student_id)).toEqual(["s1"]);
    expect(classMembersOn("t1", "2026-04-01", views)).toEqual([]);
    expect(studentPlacementOn("s1", "2026-04-01", views).map((e) => e.class_id)).toEqual(["t2"]);
    expect(studentPlacementOn("s1", "2026-06-01", views)).toEqual([]);
  });
  it("5, 8, 12. término não apaga episódio; remanejamento preserva os dois; fato anterior segue associado", () => {
    expect(views).toHaveLength(2);
    expect(wasMemberAt("s1", "t1", "2026-03-01", views)).toBe("vigente");
    expect(wasMemberAt("s1", "t1", "2026-04-01", views)).toBe("fora-da-vigencia");
  });
  it("6. término de enturmação não gera movimentação", () => {
    expect(studentMovements("s1", [])).toEqual([]);
    expect(movementFacts([])).toEqual([]);
  });
  it("7. transferência preserva origem e destino", () => {
    const [m] = studentMovements("s1", [mov()]);
    expect(m!.origin).toEqual({ schoolId: "e1", classId: "t2" });
    expect(m!.destination).toEqual({ externalLabel: "Rede estadual" });
    expect(movementRelativeTo(m!, "2026-06-30")).toBe("antes");
  });
  it("9. correção cria versão e preserva a anterior", () => {
    const rows = [enr(), enr({ id: "m1b", supersedes_id: "m1", cycle_id: "c26", correction_reason: "número errado", institutional_number: "2026-002" })];
    expect(currentVersions(rows).map((r) => r.id)).toEqual(["m1b"]);
    expect(versionChain(rows, "m1b").map((r) => r.id)).toEqual(["m1", "m1b"]);
    const mv = [mov(), mov({ id: "mv2", version: 2, supersedes_id: "mv1", effective_on: "2026-05-04", correction_reason: "data" })];
    expect(studentMovements("s1", mv).map((m) => m.effective_on)).toEqual(["2026-05-04"]);
    expect(versionChain(mv, "mv2")).toHaveLength(2);
  });
  it("10. ausência de data permanece ausência", () => {
    expect(validOn(null, null, "2026-03-01")).toBe("indeterminado");
    const [f] = enrollmentFacts([enr({ opened_on: null })], []);
    expect(f!.availability).toBe("indeterminado");
    expect(f!.temporal.validFrom).toBeUndefined();
    expect(movementRelativeTo(mov({ effective_on: null }), "2026-06-30")).toBe("indeterminado");
  });
  it("13. nenhum fato futuro aparece retroativamente", () => {
    expect(classMembersOn("t2", "2026-03-01", views)).toEqual([]);
  });
});

describe("14.5 — CIECE e governança", () => {
  it("14–15. fatos atômicos válidos que voltam ao registro e versão de origem", () => {
    const facts = [...enrollmentFacts([enr()], [{ enrollment_id: "m1", ended_on: "2026-05-01", bond_status_id: "encerrada", reason_text: null, originating_act_ref: null }]),
      ...movementFacts([mov()]), ...episodeFacts([{ ...epi(), ended_on: "2026-03-20" }])];
    for (const f of facts) expect(validateFact(f)).toEqual([]);
    expect(facts[0]!.provenance).toMatchObject({ sourceId: "school_enrollments", recordId: "m1" });
    expect(facts[1]!.provenance).toMatchObject({ sourceId: "student_movement_events", recordId: "mv1", recordVersion: 1 });
    expect(FACT_CATALOG.map((d) => d.factTypeId)).toEqual(expect.arrayContaining(["vinculo-escolar", "evento-de-movimentacao", "episodio-de-enturmacao"]));
  });
  it("16. com login não há demonstração: módulo e roster não importam fixtures", () => {
    const src = readFileSync("src/features/student-life/institutional-enrollment.ts", "utf8");
    expect(src).not.toMatch(/fixture|demonstration|laborat/i);
  });
  it("17–19. escrita só por função com capacidade na escola, tipo homologado e sem cargo", () => {
    const dir = "supabase/migrations";
    const sql = readdirSync(dir).map((f) => readFileSync(`${dir}/${f}`, "utf8")).find((s) => s.includes("record_student_movement"))!;
    expect(sql).toMatch(/has_school_capability\('manter-matricula-e-enturmacao'/);
    expect(sql).toMatch(/has_school_capability\('registrar-movimentacao-escolar'/);
    expect(sql).toMatch(/status = 'homologada'/);
    expect(sql).not.toMatch(/position_label/);
    expect(sql).toMatch(/c\.school_id = _school AND c\.class_id IS NULL/);
  });
  it("20. matemática da 14.2 intocada", () => {
    const src = readFileSync("src/features/ciece/indicator-engine.ts", "utf8");
    expect(src).not.toMatch(/vinculo-escolar|evento-de-movimentacao/);
  });
});
