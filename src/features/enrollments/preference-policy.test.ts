import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { move, policyDraftProblems, preferenceProblems, rankedPreferences, type PreferencePolicy } from "./preference-policy";

const pol: PreferencePolicy = { version: 1, min: 1, max: 3, ordering: "ordenada", shifts: ["manha"], offers: [] };

describe("L08 preferências", () => {
  it("sem política aprovada nada é aceito", () => {
    expect(preferenceProblems(null, [{ schoolId: "a" }], ["a"])).toEqual(["sem-politica"]);
  });
  it("respeita mínimo/máximo configurados", () => {
    expect(preferenceProblems(pol, [], ["a"])).toContain("abaixo-do-minimo");
    const four = ["a", "b", "c", "d"].map((schoolId) => ({ schoolId }));
    expect(preferenceProblems(pol, four, ["a", "b", "c", "d"])).toContain("acima-do-maximo");
  });
  it("turno/oferta só se a política declarar; escola só da campanha; sem repetição", () => {
    const r = preferenceProblems(pol, [{ schoolId: "a", shiftId: "noite" }, { schoolId: "a", offerId: "x" }, { schoolId: "z" }], ["a"]);
    expect(r).toEqual(expect.arrayContaining(["turno-nao-admitido", "oferta-nao-admitida", "escola-fora-da-campanha"]));
    expect(preferenceProblems(pol, [{ schoolId: "a" }, { schoolId: "a" }], ["a"])).toContain("repetida");
  });
  it("ordem só quando a política é ordenada; nunca inventa prioridade", () => {
    expect(rankedPreferences(pol, [{ schoolId: "a" }, { schoolId: "b" }]).map((x) => x.rank)).toEqual([1, 2]);
    expect(rankedPreferences({ ...pol, ordering: "sem-ordem" }, [{ schoolId: "a" }]).map((x) => x.rank)).toEqual([null]);
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("política proposta: limite máximo 10 e justificativa", () => {
    expect(policyDraftProblems({ min: 2, max: 11, justification: "curta" })).toEqual(["maximo-invalido", "justificativa-curta"]);
  });
  it("banco: aprovador ≠ autor, trigger fail-closed, append-only, sem DML direta", () => {
    const sql = readFileSync("drizzle/migrations/0460_enr08_preference_policies.sql", "utf8");
    expect(sql).toContain("aprovador-igual-autor");
    expect(sql).toContain("preferencias-sem-politica");
    expect(sql).toContain("enr_pref_policies_append_only");
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_preference_policies/);
    expect(sql).not.toMatch(/vaga garantida/i);
  });
});
