import { describe, expect, it } from "vitest";
import {
  checkReview, duplicateCandidates, linksOf, pairKey, registrationConflicts, reviewState,
  totalWeeklyHours, validateChain, type FunctionalLinkVersion, type PersonKeys,
} from "./functional-links";

const v = (o: Partial<FunctionalLinkVersion>): FunctionalLinkVersion => ({
  id: "v1", logicalId: "L1", version: 1, supersedesId: null, personId: "P1", functionalRegistration: "M-1",
  positionId: "c1", regime: "estatutario", weeklyHours: 20, validFrom: "2026-01-01", validUntil: null,
  documents: [{ kind: "posse", ref: "T-1" }], originatingActRef: "ato-1", correctionReason: null,
  authorUserId: "u1", technical: false, recordedAt: "2026-01-02", ...o,
});

describe("vínculos funcionais", () => {
  it("mesma pessoa com dois vínculos soma jornada só se ambas registradas", () => {
    const all = [v({}), v({ id: "w1", logicalId: "L2", functionalRegistration: "M-2", weeklyHours: 20 })];
    const { active } = linksOf("P1", all, "2026-05-01", "2026-12-31");
    expect(active).toHaveLength(2);
    expect(totalWeeklyHours(active)).toBe(40);
    expect(totalWeeklyHours([...active, v({ id: "x", logicalId: "L3", weeklyHours: null })])).toBeNull();
    expect(totalWeeklyHours([])).toBeNull();
  });
  it("correção exige motivo, autor humano e não troca a pessoa", () => {
    const p = validateChain([v({}), v({ id: "v2", version: 2, supersedesId: "v1", personId: "P2", technical: true })]);
    expect(p).toEqual(expect.arrayContaining(["correction-without-reason", "person-changed", "technical-author"]));
  });
  it("cadeia com lacuna fica ambígua e respeita knownAt", () => {
    const all = [v({}), v({ id: "v3", version: 3, supersedesId: "v1", correctionReason: "x" })];
    expect(linksOf("P1", all, "2026-05-01", "2026-12-31").ambiguous).toEqual(["L1"]);
    expect(linksOf("P1", [v({})], "2026-05-01", "2026-01-01").active).toHaveLength(0);
  });
  it("jornada zero ou intervalo invertido são inválidos", () => {
    expect(validateChain([v({ weeklyHours: 0, validUntil: "2025-01-01" })])).toEqual(
      expect.arrayContaining(["invalid-hours", "invalid-interval"]));
  });
  it("matrícula funcional de duas pessoas é conflito", () => {
    expect(registrationConflicts([v({}), v({ id: "z", personId: "P9" })])).toEqual(["M-1"]);
  });
});

const k = (o: Partial<PersonKeys>): PersonKeys => ({ personId: "A", cpf: null, qpMec: null, registrations: [], normalizedName: "maria silva", birthDate: null, ...o });

describe("conciliação de duplicidades", () => {
  it("nome igual sozinho nunca gera candidato", () => {
    expect(duplicateCandidates([k({}), k({ personId: "B" })])).toEqual([]);
  });
  it("CPF/matrícula é forte; nome+nascimento é fraca", () => {
    const c = duplicateCandidates([
      k({ cpf: "111.222.333-44" }), k({ personId: "B", cpf: "11122233344" }),
      k({ personId: "C", birthDate: "1980-01-01", normalizedName: "joao" }), k({ personId: "D", birthDate: "1980-01-01", normalizedName: "joao" }),
    ]);
    expect(c.find((x) => x.b === "B")?.strength).toBe("forte");
    expect(c.find((x) => x.b === "D")?.strength).toBe("fraca");
  });
  it("decisão exige humano, evidência, seq esperado e sobrevivente do par", () => {
    const cand = { a: "A", b: "B", basis: ["cpf"] as const, strength: "forte" as const };
    const base = { pairKey: pairKey("A", "B"), seq: 1, decision: "mesma-pessoa" as const, survivorPersonId: "A", evidence: "CPF conferido no documento", deciderUserId: "u1", technical: false };
    expect(checkReview({ ...cand, basis: [...cand.basis] }, [], base)).toBeNull();
    expect(checkReview({ ...cand, basis: [] }, [], { ...base, technical: true })).toBe("executor-tecnico");
    expect(checkReview({ ...cand, basis: [] }, [], { ...base, deciderUserId: null })).toBe("sem-autor");
    expect(checkReview({ ...cand, basis: [] }, [], { ...base, survivorPersonId: "Z" })).toBe("sobrevivente-invalido");
    expect(checkReview({ ...cand, basis: [] }, [base], base)).toBe("seq-inesperado");
    expect(checkReview(undefined, [], base)).toBe("nao-candidato");
    expect(reviewState(base.pairKey, [])).toBe("nao-revisado");
    expect(reviewState(base.pairKey, [base, { ...base, seq: 2, decision: "pessoas-distintas", survivorPersonId: null }])).toBe("pessoas-distintas");
  });
});
