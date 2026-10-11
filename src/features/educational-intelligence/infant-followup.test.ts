import { describe, expect, it } from "vitest";
import { currentFollowups, developmentByField, validateFollowup, type EiFollowup } from "./infant-followup";

const f = (o: Partial<EiFollowup>): EiFollowup => ({ id: "a", logical_id: "l1", version: 1, school_id: "e", class_id: "t", student_id: "s", modality: "regular", field_key: "corpo-gestos",
  objective_code: null, observed_on: "2026-03-01", observation: "Explorou materiais com autonomia.", evidence: [], adaptation_note: null, family_visible: false, reason: null, recorded_at: "", ...o });

describe("acompanhamento da Educação Infantil", () => {
  it("recusa nota, promoção, retenção e dado clínico", () => {
    expect(validateFollowup({ field_key: "corpo-gestos", observation: "Criança será retida no ano.", observed_on: "2026-03-01" })).not.toEqual([]);
    expect(validateFollowup({ field_key: "corpo-gestos", observation: "Participou bem da roda.", adaptation_note: "conforme laudo", observed_on: "2026-03-01" })).not.toEqual([]);
    expect(validateFollowup({ field_key: "corpo-gestos", observation: "Participou bem da roda de conversa.", observed_on: "2026-03-01" })).toEqual([]);
  });
  it("código BNCC só no formato oficial", () => {
    expect(validateFollowup({ field_key: "eu-outro-nos", observation: "Interagiu com colegas.", objective_code: "EI02EO01", observed_on: "2026-03-01" })).toEqual([]);
    expect(validateFollowup({ field_key: "eu-outro-nos", observation: "Interagiu com colegas.", objective_code: "EO1", observed_on: "2026-03-01" })).not.toEqual([]);
  });
  it("retificação mantém histórico e usa só a vigente", () => {
    const rows = [f({}), f({ id: "b", version: 2, observation: "Versão corrigida da observação." })];
    expect(currentFollowups(rows).map((r) => r.id)).toEqual(["b"]);
  });
  it("campo sem observação é lacuna, nunca zero", () => {
    const d = developmentByField([f({})], "s");
    expect(d.find((x) => x.key === "corpo-gestos")?.observations).toBe(1);
    expect(d.find((x) => x.key === "escuta-fala")?.gap).toBe(true);
  });
});
