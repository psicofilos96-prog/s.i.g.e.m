import { describe, expect, it } from "vitest";
import { compositionBreakdown, compositionPhrase } from "./class-composition-projection";
import { journeyProblems, journeySummary } from "./class-wizard-model";

const P = (v: string) => ({ scheme: "posicao", value: v, version: 1 });

describe("N5.3.2 — composição multisseriada (Mapa III / Diário)", () => {
  it("3 estudantes em posições distintas: total único 3, subtotais 1/1/1", () => {
    const b = compositionBreakdown([P("1"), P("2"), P("3")], [
      { studentId: "a", axes: [P("1")] }, { studentId: "b", axes: [P("2")] }, { studentId: "c", axes: [P("3")] },
    ]);
    expect(b.total).toBe(3);
    expect(b.rows.map((r) => r.count)).toEqual([1, 1, 1]);
    expect(b.notRecorded).toBe(0);
  });
  it("estudante repetido no reader conta uma vez", () => {
    const b = compositionBreakdown([P("1"), P("2")], [{ studentId: "a", axes: [P("1")] }, { studentId: "a", axes: [P("1")] }]);
    expect(b.total).toBe(1);
    expect(b.rows[0]!.count).toBe(1);
  });
  it("sem posição individual nunca herda o primeiro ano da turma", () => {
    const b = compositionBreakdown([P("1"), P("2")], [{ studentId: "a", axes: null }, { studentId: "b", axes: [P("9")] }]);
    expect(b.rows.map((r) => r.count)).toEqual([0, 0]);
    expect(b.notRecorded).toBe(2);
    expect(b.byStudent.get("a")).toBeNull();
  });
  it("frase legível a partir dos rótulos", () => {
    expect(compositionPhrase(["1º ano", "2º ano", "3º ano"])).toBe("1º ano, 2º ano e 3º ano");
    expect(compositionPhrase(["5º ano"])).toBe("5º ano");
  });
});

describe("N5.3.2 — jornada declarada", () => {
  it("fim antes do início é recusado", () => {
    expect(journeyProblems([{ weekday: 1, startsAt: "11:00", endsAt: "07:00" }])).toHaveLength(1);
  });
  it("resumo de segunda a sexta", () => {
    const j = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, startsAt: "07:00", endsAt: "11:30" }));
    expect(journeySummary(j)).toBe("Segunda a Sexta, 07:00–11:30");
    expect(journeySummary([])).toBe("Jornada ainda não configurada");
  });
});
