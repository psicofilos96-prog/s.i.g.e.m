import { describe, expect, it } from "vitest";
import { familyView, positionHistory, recordQueueVersion, type QueueVersion } from "./waiting-list";

const key = { processId: "pr", offerId: "of", regionId: "rg" };
const actor = { personId: "p-rev", isHuman: true, capabilities: ["ordenar-fila"] };
const pol = { reclassifyCapability: "ordenar-fila" };
const prop = (hash: string, order: string[]) => ({ hash, approvedBy: "p-rev", actRef: "ato-1", order });
const rec = (vs: QueueVersion[], exp: number, p: ReturnType<typeof prop> | null, reason = "", a = actor) =>
  recordQueueVersion(vs, { key, expectedVersion: exp, approvedProposal: p, reason, at: `2027-01-1${exp}T00:00:00Z`, validFrom: "2027-01-10" }, a, pol);

describe("Listas de espera L11", () => {
  it("ordem só de proposta aprovada; executor técnico e sem competência recusados", () => {
    expect(rec([], 0, null).ok).toBe(false);
    expect(rec([], 0, prop("h1", ["A"]), "", { ...actor, isTechnicalExecutor: true }).ok).toBe(false);
    expect(rec([], 0, prop("h1", ["A"]), "", { ...actor, capabilities: [] }).ok).toBe(false);
    expect(rec([], 0, { ...prop("h1", ["A"]), approvedBy: "outro" }).ok).toBe(false);
    expect(rec([], 0, prop("h1", ["A", "A"])).ok).toBe(false);
  });
  it("reclassificação exige justificativa, versão esperada e preserva histórico", () => {
    const v1 = rec([], 0, prop("h1", ["A", "B", "C"])); if (!v1.ok) throw 0;
    const vs = [v1.version];
    expect(rec(vs, 1, prop("h2", ["B", "A", "C"])).ok).toBe(false);
    expect(rec(vs, 0, prop("h2", ["B", "A", "C"]), "x").ok).toBe(false);
    expect(rec(vs, 1, prop("h1", ["A", "B", "C"]), "x").ok).toBe(false);
    const v2 = rec(vs, 1, prop("h2", ["B", "A", "C"]), "Fato de prioridade comprovado"); if (!v2.ok) throw 0;
    vs.push(v2.version);
    expect(positionHistory(vs, key, "A").map((h) => h.position)).toEqual([1, 2]);
  });
  it("família vê só a própria posição, nunca a ordem nem terceiros", () => {
    const v1 = rec([], 0, prop("h1", ["A", "B"])); if (!v1.ok) throw 0;
    const view = familyView([v1.version], key, "B", "2027-01-20", "2027-12-31T00:00:00Z");
    expect(view).toEqual({ situacao: "em-espera", posicao: 2, totalNaFila: 2, atualizadoEm: v1.version.at });
    expect(JSON.stringify(view)).not.toContain('"A"');
    expect(familyView([v1.version], key, "Z", "2027-01-20", "2027-12-31T00:00:00Z").situacao).toBe("nao-consta");
    expect(familyView([], key, "A", "2027-01-20", "2027-12-31T00:00:00Z").situacao).toBe("sem-ordem-publicada");
  });
  it("filas de região distinta são independentes", () => {
    const v1 = rec([], 0, prop("h1", ["A"])); if (!v1.ok) throw 0;
    expect(familyView([v1.version], { ...key, regionId: "outra" }, "A", "2027-01-20", "2027-12-31T00:00:00Z").situacao).toBe("sem-ordem-publicada");
  });
});
