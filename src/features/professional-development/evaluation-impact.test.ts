import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aggregateVisible, observedChange, readingProblems, type Observation } from "./evaluation-impact";

const o = (moment: Observation["moment"], value: number, schoolId: string | null = null): Observation => ({ moment, observedOn: "2026-06-01", value, groupSize: 20, schoolId });

describe("L20 avaliação e impacto", () => {
  it("antes/depois no mesmo escopo, nunca causal", () => {
    expect(observedChange([o("antes", 60), o("depois", 70)], null)).toMatchObject({ comparable: true, difference: 10, causal: false });
  });
  it("sem par ou escopo diferente não compara", () => {
    expect(observedChange([o("antes", 60)], null).comparable).toBe(false);
    expect(observedChange([o("antes", 60, "e1"), o("depois", 70)], "e1").comparable).toBe(false);
  });
  it("leitura humana exige interpretação e limitações", () => expect(readingProblems({ interpretation: "x", limitations: "" })).toHaveLength(2));
  it("agregado só com limiar", () => expect([aggregateVisible(10, null), aggregateVisible(4, 5), aggregateVisible(5, 5)]).toEqual([false, false, true]));
  it("migration 0451: respostas sem leitura direta, indicador sem pessoa, limiar obrigatório", () => {
    const sql = readFileSync("drizzle/migrations/0451_dev20_evaluation_impact.sql", "utf8");
    expect(sql).toMatch(/REVOKE ALL ON public.dev_survey_responses FROM authenticated, anon/);
    const obs = sql.slice(sql.indexOf("CREATE TABLE public.dev_impact_observations"), sql.indexOf("CREATE TABLE public.dev_impact_readings"));
    expect(obs).not.toMatch(/person_id|enrollment_id/);
    expect(sql).toMatch(/dev:threshold-missing/);
    expect(sql).toMatch(/dev:below-threshold/);
    expect(sql).toMatch(/WHERE q->>'kind' = 'escala-1-5'/);
    expect(sql).not.toMatch(/causal|ranking|score/i);
  });
});
