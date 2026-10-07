import { describe, expect, it } from "vitest";
import { attentionItems, functionalTimeline } from "./functional-attention";
const f = (id: string, over: object) => ({ id, personId: "p", kind: "licenca", label: id, occurredOn: "2027-01-01", ...over });
describe("N11.2 DP atenção", () => {
  it("só prazo declarado gera alerta; encerrado e sem prazo não", () => {
    const out = attentionItems([f("a", { validUntil: "2027-02-01" }), f("b", { dueOn: "2027-03-10" }), f("c", {}), f("d", { validUntil: "2027-01-01", closed: true }), f("e", { validUntil: "2027-09-01" })], "2027-03-01", 30);
    expect(out.map((x) => [x.factId, x.state])).toEqual([["a", "vencido"], ["b", "vence-em-breve"]]);
  });
  it("linha do tempo da pessoa, mais recente primeiro", () => {
    expect(functionalTimeline([f("x", { occurredOn: "2026-01-01" }), f("y", { occurredOn: "2027-05-01" }), { ...f("z", {}), personId: "q" }], "p").map((x) => x.id)).toEqual(["y", "x"]);
  });
});
