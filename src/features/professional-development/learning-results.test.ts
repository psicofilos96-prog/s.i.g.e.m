import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aggregateOutcomes, resultProblems, reviewDecisionProblems, rubricProblems, type Criterion } from "./learning-results";

const crit: Criterion[] = [{ key: "planejamento", description: "Planeja sequência didática coerente", levels: [
  { key: "inicial", label: "Inicial", description: "Plano sem objetivos claros" }, { key: "pleno", label: "Pleno", description: "Plano com objetivos e avaliação" }] }];
const ok = { ratings: { planejamento: { level: "pleno", justification: "Plano entregue com objetivos" } }, outcome: "atingiu" as const,
  justification: "Evidências das entregas atendem aos critérios", evaluator: "f", participant: "p" };

describe("L14 resultados formativos", () => {
  it("rubrica válida e inválida", () => {
    expect(rubricProblems(crit)).toEqual([]);
    expect(rubricProblems([{ key: "X", description: "", levels: [] }]).length).toBeGreaterThanOrEqual(3);
  });
  it("resultado completo passa; satisfação é recusada", () => {
    expect(resultProblems(crit, ok)).toEqual([]);
    expect(resultProblems(crit, { ...ok, satisfaction: 5 }).join()).toMatch(/Satisfação/);
  });
  it("autoavaliação, nível inexistente e falta de justificativa são recusados", () => {
    expect(resultProblems(crit, { ...ok, evaluator: "p" }).join()).toMatch(/si mesmo/);
    expect(resultProblems(crit, { ...ok, ratings: { planejamento: { level: "otimo", justification: "x" } } }).join()).toMatch(/nível inválido/);
  });
  it("revisão por terceiro; revisto exige nova versão", () => {
    expect(reviewDecisionProblems({ reviewer: "f", evaluator: "f", requester: "p", decision: "mantido", newResultId: null, reason: "Mantido após reanálise das entregas" }).join()).toMatch(/outra pessoa/);
    expect(reviewDecisionProblems({ reviewer: "r", evaluator: "f", requester: "p", decision: "revisto", newResultId: null, reason: "Reanálise mostrou evidência" }).join()).toMatch(/nova versão/);
  });
  it("agregado suprimido sem limiar ou abaixo dele", () => {
    expect(aggregateOutcomes(["atingiu"], null).suppressed).toBe(true);
    expect(aggregateOutcomes(["atingiu", "nao-atingiu"], 5).suppressed).toBe(true);
    expect(aggregateOutcomes(["atingiu", "atingiu", "nao-avaliavel"], 3)).toMatchObject({ suppressed: false, atingiu: 2, naoAvaliavel: 1 });
  });
  it("migration 0443: sem nota calculada, sem satisfação, revisão rastreável e RLS individual", () => {
    const sql = readFileSync("drizzle/migrations/0443_dev14_learning_results.sql", "utf8");
    expect(sql).not.toMatch(/dev_questionnaire_responses|score|avg\(/i);
    expect(sql).toMatch(/dev:self-evaluation/);
    expect(sql).toMatch(/dev:reviewer-conflict/);
    expect(sql).toMatch(/e.person_id = public.current_person_id\(\) OR public.dev_can_manage\(\) OR public.dev_is_active_trainer/);
    expect(sql).toMatch(/devlr_immutable BEFORE UPDATE OR DELETE/);
  });
});
