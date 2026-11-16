import { describe, expect, it } from "vitest";
import { buildLiveDoc, type LiveMapData } from "./map-live";
import { enrollmentSummary, movementSummary } from "./map-dashboard";
const base: LiveMapData = { schoolName: "Teste", inep: "99999901", year: 2026, month: 11, referenceDate: "2026-11-30", identification: {}, classes: [], previousTotal: null, movements: [], staff: [], visits: [], failed: [] };
const doc = (data: LiveMapData) => buildLiveDoc(data, { headerLines: [], signatures: [], generatedAt: "teste" });
describe("resumos do documento do PDF", () => {
  it("entradas somam novos e transferências; saídas somam transferências e evasão sem remanejamento ou cancelamento", () => {
    const movements = ["A", "A", "B", "C", "D", "R"].map((grp, i) => ({ grp, student_name: `Teste ${i}`, census_id: null, kind: i === 1 ? "Transferência recebida" : "Aluno novo", happened_on: "2026-11-01", class_label: "1º ano" }));
    expect(movementSummary(doc({ ...base, previousTotal: 15, movements, classes: [{ class_id: "a", class_name: "1º ano", stage_label: "1º ano", shift_label: "Manhã", students: 12 }] }))).toEqual({ previous: 15, entries: 2, exits: 2, current: 12 });
  });
  it("total e turnos reproduzem os valores do documento", () => {
    expect(enrollmentSummary(doc({ ...base, classes: [{ class_id: "a", class_name: "1º ano", stage_label: "1º ano", shift_label: "Manhã", students: 7 }, { class_id: "b", class_name: "2º ano", stage_label: "2º ano", shift_label: "Tarde", students: 5 }] }))).toEqual({ total: 12, shifts: [{ label: "1º turno", value: 7 }, { label: "2º turno", value: 5 }, { label: "3º turno", value: null }, { label: "Integral", value: null }] });
  });
  it("matrícula ausente nunca vira zero", () => {
    expect(movementSummary(doc(base)).previous).toBeNull();
    expect(enrollmentSummary(doc(base)).total).toBeNull();
  });
});