import { describe, expect, it } from "vitest";
import { canWritePlan, conflictLabel, offerNext, offerProblem, planProblem, EMPTY_PLAN } from "./nei-aee";

describe("NEI AEE e planos", () => {
  it("oferta sem registro começa planejada ou iniciada", () => expect(offerNext("sem-registro")).toEqual(["planejada", "iniciada"]));
  it("interrupção exige causa", () => {
    expect(offerProblem("iniciada", "interrompida", "")).not.toBeNull();
    expect(offerProblem("iniciada", "interrompida", "licença da professora")).toBeNull();
  });
  it("encerrada é terminal", () => expect(offerNext("encerrada")).toEqual([]));
  it("planejada não vai direto a interrompida", () => expect(offerProblem("planejada", "interrompida", "causa longa")).not.toBeNull());
  it("conflito nomeia a causa", () => expect(conflictLabel({ service_logical_id: "a", weekday: 2, starts_at: "08:00", ends_at: "09:00", conflict_professional: true, conflict_room: false })).toContain("profissional"));
  it("AEE não escreve PEI", () => { expect(canWritePlan("aee", "pei")).toBe(false); expect(canWritePlan("aee", "paee")).toBe(true); });
  it("meta sem texto ou com prazo inválido é recusada; prazo é opcional", () => {
    expect(planProblem({ ...EMPTY_PLAN, metas: [{ texto: "" }] })).not.toBeNull();
    expect(planProblem({ ...EMPTY_PLAN, metas: [{ texto: "ler sílabas", prazo: "12/10" }] })).not.toBeNull();
    expect(planProblem({ ...EMPTY_PLAN, metas: [{ texto: "ler sílabas" }] })).toBeNull();
  });
});
