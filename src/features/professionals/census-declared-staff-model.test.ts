import { describe, expect, it } from "vitest";
import { censusSummary, groupCensusDeclarations, type CensusDeclRow } from "./census-declared-staff-model";

const r = (person_id: string, class_code: string, fn: string, class_id: string | null = "c"): CensusDeclRow =>
  ({ person_id, class_code, class_id, function_literal: fn, regime_literal: null, institutional_persons: { display_name: person_id } });

describe("L40 atuações do Educacenso", () => {
  it("preserva profissional com várias turmas e funções", () => {
    const [p] = groupCensusDeclarations([r("a", "1", "Docente"), r("a", "2", "Docente"), r("a", "2", "Auxiliar/assistente educacional")]);
    expect(p!.classes.map((c) => c.code)).toEqual(["1", "2"]);
    expect(p!.functions).toEqual(["Docente", "Auxiliar/assistente educacional"]);
  });
  it("turma sem correspondência é exibida, nunca inventada", () => {
    const s = censusSummary([r("a", "1", "Docente", null), r("b", "1", "Docente")]);
    expect(s).toEqual({ atuacoes: 2, pessoas: 2, turmas: 1, semTurma: 1 });
  });
});
