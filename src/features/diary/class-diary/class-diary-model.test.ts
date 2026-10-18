import { describe, expect, it } from "vitest";
import { bnccCodes, dayResume, resolveTab, share, weekDays, weekRangeLabel } from "./class-diary-model";

describe("Diário de Classe — projeções", () => {
  it("aba desconhecida volta para Lançamento de Aulas", () => {
    expect(resolveTab("xyz")).toBe("aulas");
    expect(resolveTab("frequencia")).toBe("frequencia");
  });
  it("semana vai de segunda a sexta da data escolhida", () => {
    expect(weekDays("2027-05-29")).toEqual(["2027-05-24", "2027-05-25", "2027-05-26", "2027-05-27", "2027-05-28"]);
    expect(weekDays("2027-05-30")[0]).toBe("2027-05-24"); // domingo pertence à semana anterior
    expect(weekDays("data-ruim")).toEqual([]);
    expect(weekRangeLabel(weekDays("2027-05-26"))).toBe("Semana de 24/05 a 28/05");
  });
  it("sem chamada registrada não vira zero", () => {
    expect(dayResume([{ marks: null, slotKeys: ["a"] }], ["s1"])).toEqual({ present: null, absent: null, unmarked: null });
  });
  it("aluno sem marcação não vira presença nem falta", () => {
    const r = dayResume([{ marks: { a: { s1: "Presente", s2: "Ausente" } }, slotKeys: ["a"] }], ["s1", "s2", "s3"]);
    expect(r).toEqual({ present: 1, absent: 1, unmarked: 1 });
  });
  it("percentual só com denominador observado", () => {
    expect(share(1, null)).toBeNull();
    expect(share(1, 0)).toBeNull();
    expect(share(24, 28)).toBe("85,7%");
  });
  it("habilidades BNCC só as citadas no registro", () => {
    expect(bnccCodes("Formação EF07HI01 e ef07hi02; EF07HI01")).toEqual(["EF07HI01", "EF07HI02"]);
    expect(bnccCodes(undefined)).toEqual([]);
  });
});

import { fillPendingAsPresent, inlinePending, nextInlineMark, toggleInlineMark } from "./class-diary-model";
describe("chamada direta na tabela", () => {
  it("ciclo vazio → Presente → Ausente → vazio", () => {
    expect(nextInlineMark(undefined)).toBe("Presente");
    expect(nextInlineMark("Presente")).toBe("Ausente");
    expect(nextInlineMark("Ausente")).toBeUndefined();
  });
  it("conta pendências por aula × estudante e não presume presença", () => {
    let d = toggleInlineMark({}, "b1", "a");
    expect(inlinePending(d, ["b1", "b2"], ["a", "b"])).toBe(3);
    d = toggleInlineMark(d, "b1", "b"); d = toggleInlineMark(d, "b1", "b");
    expect(d["b1"]).toEqual({ a: "Presente", b: "Ausente" });
  });
  it("marcar pendentes como presentes não altera quem já foi marcado", () => {
    const d = fillPendingAsPresent({ b1: { a: "Ausente" } }, ["b1"], ["a", "b"]);
    expect(d["b1"]).toEqual({ a: "Ausente", b: "Presente" });
  });
});
