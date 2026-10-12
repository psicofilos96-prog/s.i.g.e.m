import { describe, expect, it } from "vitest";
import { proposeDistribution, reviewProposal, type DistributionCriterion, type RequestInput } from "./distribution-engine";

const crit: DistributionCriterion = { criterionId: "crit-2027", version: 3, homologated: true,
  rules: [{ factKey: "irmaoNaEscola", primitive: "verdadeiro-primeiro", basis: "Resolução X art. 2" }, { factKey: "distanciaKm", primitive: "menor-primeiro", basis: "Resolução X art. 3" }],
  tiebreaks: [{ factKey: "dataInscricao", primitive: "menor-primeiro", basis: "Resolução X art. 4" }] };
const f = (v: boolean | number | string) => ({ value: v, evidenceRef: "ev" });
const req = (p: string, irm: boolean, km: number, dt: string, prefs = ["A"]): RequestInput => ({ protocol: p, preferences: prefs, facts: { irmaoNaEscola: f(irm), distanciaKm: f(km), dataInscricao: f(dt) } });
const meta = { generatedBy: "p-gen", generatedAt: "2026-12-01" };

describe("Distribuição L09", () => {
  it("ordena só pelas regras homologadas e explica cada posição", async () => {
    const r = await proposeDistribution(crit, [req("P3", false, 1, "2026-11-01"), req("P1", true, 5, "2026-11-02"), req("P2", true, 2, "2026-11-03")], [{ cellKey: "A", available: 2 }], meta);
    if (!r.ok) throw new Error(r.reason);
    expect(r.proposal.items.map((i) => [i.protocol, i.outcome])).toEqual([["P2", "contemplado"], ["P1", "contemplado"], ["P3", "espera"]]);
    expect(r.proposal.items[0]!.explanation.map((e) => e.basis)).toEqual(["Resolução X art. 2", "Resolução X art. 3", "Resolução X art. 4"]);
    expect(r.proposal.writes).toEqual([]);
  });
  it("sem critério homologado ou regra sem fundamento ⇒ nenhuma classificação", async () => {
    expect((await proposeDistribution({ ...crit, homologated: false }, [], [], meta)).ok).toBe(false);
    expect((await proposeDistribution({ ...crit, tiebreaks: [{ factKey: "x", primitive: "menor-primeiro", basis: "" }] }, [], [], meta)).ok).toBe(false);
    expect((await proposeDistribution(crit, [], [{ cellKey: "A", available: null }], meta)).ok).toBe(false);
  });
  it("fato sem evidência ⇒ indeterminado, fora da ordem", async () => {
    const bad: RequestInput = { protocol: "PX", preferences: ["A"], facts: { irmaoNaEscola: f(true), distanciaKm: { value: 1, evidenceRef: "" } } };
    const r = await proposeDistribution(crit, [bad, req("P1", false, 3, "2026-11-01")], [{ cellKey: "A", available: 5 }], meta); if (!r.ok) throw 0;
    expect(r.proposal.indeterminate).toEqual([{ protocol: "PX", missing: ["distanciaKm", "dataInscricao"] }]);
    expect(r.proposal.items.map((i) => i.protocol)).toEqual(["P1"]);
  });
  it("empate sem desempate disputando vaga não é decidido pelo motor", async () => {
    const r = await proposeDistribution(crit, [req("P1", true, 2, "2026-11-01"), req("P2", true, 2, "2026-11-01")], [{ cellKey: "A", available: 1 }], meta); if (!r.ok) throw 0;
    expect(r.proposal.unresolvedTies).toEqual([["P1", "P2"]]);
    expect(r.proposal.items.every((i) => i.outcome === "espera")).toBe(true);
    expect(r.proposal.conflicts[0]).toMatch(/Empate/);
    const ok = await proposeDistribution(crit, [req("P1", true, 2, "2026-11-01"), req("P2", true, 2, "2026-11-01")], [{ cellKey: "A", available: 2 }], meta); if (!ok.ok) throw 0;
    expect(ok.proposal.items.every((i) => i.outcome === "contemplado")).toBe(true);
  });
  it("respeita ordem de preferência entre escolas", async () => {
    const r = await proposeDistribution(crit, [req("P1", true, 1, "d", ["A", "B"]), req("P2", true, 2, "d", ["A", "B"])], [{ cellKey: "A", available: 1 }, { cellKey: "B", available: 1 }], meta); if (!r.ok) throw 0;
    expect(r.proposal.items.map((i) => [i.cellKey, i.preferenceIndex])).toEqual([["A", 0], ["B", 1]]);
  });
  it("revisão: pessoa ≠ gerador, competência, ato, hash atual e resolução de empates", async () => {
    const r = await proposeDistribution(crit, [req("P1", true, 2, "d"), req("P2", true, 2, "d")], [{ cellKey: "A", available: 1 }], meta); if (!r.ok) throw 0;
    const rev = { personId: "p-rev", isHuman: true, capabilities: ["revisar-distribuicao"] };
    const go = (x: object, who: object = rev, hash = r.proposal.inputHash) => reviewProposal(r.proposal, { ...rev, ...who }, { decision: "aprovada", actRef: "ato-d", reason: "m", at: "t", tieResolutions: {}, ...x }, "revisar-distribuicao", hash).ok;
    expect(go({})).toBe(false);
    expect(go({ tieResolutions: { g1: ["P2", "P1"] } })).toBe(true);
    expect(go({ tieResolutions: { g1: ["P2"] } }, { personId: "p-gen" })).toBe(false);
    expect(go({ tieResolutions: { g1: ["P2"] } }, {}, "outro")).toBe(false);
    expect(go({ tieResolutions: { g1: ["P2"] }, actRef: null })).toBe(false);
    expect(go({ tieResolutions: { g1: ["P2"] } }, { isTechnicalExecutor: true })).toBe(false);
  });
});
