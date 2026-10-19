import { describe, expect, it } from "vitest";
import { draftProblems, graveInMonth, occurrenceNumber, threads, type OccurrenceRow } from "./occurrences";

const row = (id: string, created: string, extra: Partial<OccurrenceRow> = {}): OccurrenceRow => ({
  id, number_year: 2027, number_seq: 1, addendum_of: null, occurred_at: "2027-03-10T10:00:00Z", severity: "Grave", kind: "Agressão",
  narrative: "Relato do fato ocorrido.", measures: [], witnesses: null, created_at: created, parties: [], ...extra });

describe("Caderno Negro", () => {
  it("adendo fica ligado à original, em ordem de registro", () => {
    const t = threads([row("a2", "2027-03-12", { addendum_of: "o" }), row("o", "2027-03-10"), row("a1", "2027-03-11", { addendum_of: "o" })]);
    expect(t).toHaveLength(1);
    expect(t[0]!.addenda.map((a) => a.id)).toEqual(["a1", "a2"]);
  });
  it("ocorrência original sem envolvido é recusada; adendo não exige", () => {
    const base = { occurredAt: "2027-03-10T10:00", severity: "Leve", kind: "x", narrative: "Fato descrito aqui.", parties: [] };
    expect(draftProblems({ ...base, addendumOf: null }, new Date("2027-04-01"))).toContain("Vincule ao menos um envolvido.");
    expect(draftProblems({ ...base, addendumOf: "o" }, new Date("2027-04-01"))).toEqual([]);
  });
  it("fato no futuro é recusado", () => {
    expect(draftProblems({ occurredAt: "2027-05-01T10:00", severity: "Leve", kind: "x", narrative: "Fato descrito aqui.", parties: [], addendumOf: "o" }, new Date("2027-04-01")))
      .toContain("A data do fato não pode estar no futuro.");
  });
  it("graves do mês contam só originais; leitura falha não vira zero", () => {
    expect(graveInMonth([row("o", "x"), row("a", "y", { addendum_of: "o" }), row("l", "z", { severity: "Leve" })], "2027-03")).toBe(1);
    expect(graveInMonth(null, "2027-03")).toBeNull();
  });
  it("número com três dígitos e ano", () => expect(occurrenceNumber({ number_seq: 7, number_year: 2027 })).toBe("007/2027"));
});
