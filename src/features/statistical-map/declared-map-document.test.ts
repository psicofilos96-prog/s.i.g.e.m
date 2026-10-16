import { describe, expect, it } from "vitest";
import { renderDeclaredMapDocument, sumKnown } from "./declared-map-document";
const base = { headerLines: ["P"], schoolName: "E", inep: "1", year: 2026, month: 9, sourceFile: "f.xlsx", issues: [], signatures: ["A"], generatedAt: "x",
  movement: { previous_month_enrollment: 10, transfers_in: null, new_students: 1, transfers_out: 0, dropouts: 0, withdrawn_cancelled: 0, total_ii: 11 }, shifts: { turno1: 11, total: 11 } };
describe("Mapa declarado — documento", () => {
  it("ausência nunca vira zero na soma", () => { expect(sumKnown([null, null])).toBeNull(); expect(sumKnown([0, null, 2])).toBe(2); });
  it("projetos ficam fora do total geral", () => {
    const h = renderDeclaredMapDocument({ ...base, classes: [{ modalidade: "EF", etapa: "1º", turma: "101", alunos: 20, turno1: 20 }], projects: [{ modalidade: "PROJETOS", etapa: "AEE", turma: "CAEE", alunos: 33, turno1: 33 }] });
    expect(h).toMatch(/Soma das tabelas acima<\/td><td class="n">20<\/td>/);
    expect(h).toContain("Total em projetos (fora do total geral)");
    expect(h).toMatch(/@page\{size:A4 landscape/);
  });
});
