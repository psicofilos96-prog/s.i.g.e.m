import { describe, expect, it } from "vitest";
import { comparableMeasures, localHits, projectBatches, rowResolution, type ImportBatch, type ImportRow } from "./result-import";

const B: ImportBatch = { id: "b", adapter_key: "a", adapter_version: 1, file_name: "f", sha256: "0".repeat(64), sheet: "S", program_key: "simula-saeb",
  edition_year: 2026, cycle: null, round: "3", school_label: "E. M. X", measure_kind: "acertos-locais", formula_note: "=SUM()", executor_label: "x", recorded_at: "" };
const R = (id: string, m: ImportRow["match_state"], o: Partial<ImportRow> = {}): ImportRow => ({ id, batch_id: "b", row_no: 1, class_label: null, student_name: "n",
  match_state: m, candidate_student_ids: ["s1", "s2"], matched_student_id: null, payload: {}, ...o });
const prep = [{ batch_id: "b", seq: 1, event: "preparado" as const, reason: null, recorded_at: "" }];

describe("importação confiável", () => {
  it("nome nunca vincula sozinho: linha por nome fica pendente", () => {
    expect(rowResolution(R("r", "revisao-nome"), []).status).toBe("pendente");
  });
  it("revisão humana vincula ou rejeita; a última decisão vale", () => {
    const rv = [{ row_id: "r", seq: 1, decision: "vincular" as const, student_id: "s1", reason: "conferido", recorded_at: "" },
      { row_id: "r", seq: 2, decision: "rejeitar" as const, student_id: null, reason: "homônimo", recorded_at: "" }];
    expect(rowResolution(R("r", "revisao-nome"), rv).status).toBe("rejeitado");
  });
  it("confirmação bloqueada enquanto houver revisão pendente", () => {
    const v = projectBatches([B], [R("r", "revisao-nome"), R("q", "sem-dado")], [], prep)[0]!;
    expect(v.canConfirm).toBe(false); expect(v.pendingReview).toBe(1); expect(v.counts["sem-dado"]).toBe(1);
  });
  it("lote revertido não confirma", () => {
    const v = projectBatches([B], [], [], [...prep, { batch_id: "b", seq: 2, event: "revertido", reason: "erro de arquivo", recorded_at: "" }])[0]!;
    expect(v.state).toBe("revertido"); expect(v.canConfirm).toBe(false);
  });
  it("acertos locais e TRI nunca são comparáveis", () => {
    expect(comparableMeasures(B, { ...B, measure_kind: "proficiencia-tri" }).ok).toBe(false);
    expect(comparableMeasures(B, { ...B, formula_note: "=OUTRA()" }).ok).toBe(false);
    expect(comparableMeasures(B, B).ok).toBe(true);
  });
  it("sem gabarito não há número de acertos", () => {
    expect(localHits(["A", "B"], null).hits).toBeNull();
    expect(localHits(["A", null, "c"], ["A", "B", "C"]).hits).toBe(2);
  });
});
