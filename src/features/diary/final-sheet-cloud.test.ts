import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applicableRule, cellsFrom, studentsFrom, type RuleRow } from "./final-sheet-cloud";
import { AWAITING_RULE, cellKey, projectFinalSheet, resultMinutes } from "./final-sheet";

const rule = (o: Partial<RuleRow> = {}): RuleRow => ({ id: "r1", logical_id: "fii", version: 2, label: "Fund. II", scope: { modality: "fundamental-anos-finais" }, params: { passMark: 60, minAttendance: null }, source_ref: "modelo", status: "homologada", ...o });

describe("Folha Final conectada (dados sintéticos)", () => {
  it("sem regra homologada não há resultado, mas médias aparecem; nada vira zero", () => {
    const { rule: r } = applicableRule([rule({ status: "rascunho" })], "fundamental-anos-finais");
    expect(r).toBeNull();
    const s = projectFinalSheet({ modality: "fundamental-anos-finais", periods: ["p1"], components: [{ id: "lp", label: "LP" }], students: [{ id: "a", name: "A", status: "Ativo" }],
      cells: { [cellKey("a", "lp")]: { periodGrades: [70], finalRecovery: null, lessonsGiven: null, absences: null } }, rule: r });
    expect(s.rows[0]!.overall).toBe(AWAITING_RULE);
    expect(s.rows[0]!.components[0]!.average).toBe(70);
    expect(resultMinutes(s.rows).canClose).toBe(false);
  });
  it("limiar vem da regra homologada, não fixo em 50", () => {
    const { rule: r } = applicableRule([rule()], "fundamental-anos-finais");
    const s = projectFinalSheet({ modality: "fundamental-anos-finais", periods: ["p1"], components: [{ id: "lp", label: "LP" }], students: [{ id: "a", name: "A", status: "Ativo" }],
      cells: { [cellKey("a", "lp")]: { periodGrades: [55], finalRecovery: null, lessonsGiven: 10, absences: 0 } }, rule: r });
    expect(s.rows[0]!.overall).toBe("REPROVADO"); // 55 < 60 da regra
  });
  it("duas regras homologadas para a mesma modalidade ⇒ nenhuma", () => {
    expect(applicableRule([rule(), rule({ id: "r2", logical_id: "outra" })], "fundamental-anos-finais").rule).toBeNull();
  });
  it("versão nova em rascunho suspende a homologada anterior (cabeça decide)", () => {
    expect(applicableRule([rule({ version: 1 }), rule({ id: "r3", version: 2, status: "rascunho" })], "fundamental-anos-finais").rule).toBeNull();
  });
  it("EJA sem frequência mínima configurada aguarda regra", () => {
    const r = applicableRule([rule({ scope: { modality: "eja" } })], "eja").rule;
    const s = projectFinalSheet({ modality: "eja", periods: ["s1"], components: [{ id: "lp", label: "LP" }], students: [{ id: "a", name: "A", status: "Ativo" }],
      cells: { [cellKey("a", "lp")]: { periodGrades: [80], finalRecovery: null, lessonsGiven: 10, absences: 0 } }, rule: r });
    expect(s.rows[0]!.overall).toBe(AWAITING_RULE);
  });
  it("transferência só pelo rótulo do encerramento; outro motivo = vínculo encerrado; substituído ignorado", () => {
    const st = studentsFrom(
      [{ id: "e1", student_id: "a", supersedes_id: null, valid_from: "2026-02-01" }, { id: "e2", student_id: "b", supersedes_id: null, valid_from: "2026-02-01" }, { id: "e3", student_id: "c", supersedes_id: null, valid_from: "2026-02-01" }, { id: "e4", student_id: "c", supersedes_id: "e3", valid_from: "2026-03-01" }],
      [{ episode_id: "e1", ended_on: "2026-05-01", reason_label: "Transferido" }, { episode_id: "e2", ended_on: "2026-05-01", reason_label: "Remanejado" }], new Map());
    expect(st.find((s) => s.id === "a")!.status).toBe("Transferido");
    expect(st.find((s) => s.id === "b")!.status).toBe("Encerrado");
    expect(st.find((s) => s.id === "c")!.status).toBe("Ativo");
  });
  it("vários instrumentos no período não são somados; versão vigente vence", () => {
    const ins = [{ id: "i1", period_id: "p1", definition: { curriculumRef: { componentId: "lp" } } }, { id: "i2", period_id: "p1", definition: { curriculumRef: { componentId: "lp" } } }];
    const multi = cellsFrom([{ id: "1", logical_entry_id: "x", version_number: 1, instrument_id: "i1", student_id: "a", period_id: "p1", value: { kind: "numerica", value: 30 } },
      { id: "2", logical_entry_id: "y", version_number: 1, instrument_id: "i2", student_id: "a", period_id: "p1", value: { kind: "numerica", value: 30 } }], ins, ["p1"]);
    expect(multi.cells[cellKey("a", "lp")]!.periodGrades[0]).toBeNull();
    expect(multi.notes.length).toBe(1);
    const one = cellsFrom([{ id: "1", logical_entry_id: "x", version_number: 1, instrument_id: "i1", student_id: "a", period_id: "p1", value: { kind: "numerica", value: 30 } },
      { id: "2", logical_entry_id: "x", version_number: 2, instrument_id: "i1", student_id: "a", period_id: "p1", value: { kind: "numerica", value: 45 } }], ins.slice(0, 1), ["p1"]);
    expect(one.cells[cellKey("a", "lp")]!.periodGrades[0]).toBe(45);
    const absent = cellsFrom([{ id: "1", logical_entry_id: "x", version_number: 1, instrument_id: "i1", student_id: "a", period_id: "p1", value: { kind: "nao-registrado", reason: "x" } }], ins.slice(0, 1), ["p1"]);
    expect(absent.cells[cellKey("a", "lp")]).toBeUndefined();
  });
  it("banco: append-only, homologação por pessoa distinta, regra homologada, sem pendência, motivo na reabertura", () => {
    const sql = readFileSync("drizzle/migrations/0289_final_sheet_rules_and_acts.sql", "utf8");
    for (const k of ["HOMOLOGATION_SAME_ACTOR", "RULE_NOT_HOMOLOGATED", "PENDING_ROWS", "REASON_REQUIRED", "SNAPSHOT_CHANGED_SINCE_CONFERENCE", "HOMOLOGATION_SAME_AUTHOR", "BEFORE UPDATE OR DELETE ON public.final_sheet_acts"]) expect(sql).toContain(k);
    expect(sql).toMatch(/record_final_sheet_act\(text,integer,text,uuid,jsonb,text,text\) FROM PUBLIC, anon/);
  });
});
