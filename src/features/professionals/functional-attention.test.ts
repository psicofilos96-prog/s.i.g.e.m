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

import { pictureFacts } from "./functional-attention";
describe("home de atenção do DP", () => {
  it("só término declarado gera alerta; em aberto não", () => {
    const pic = [{ personId: "p", qualifications: [], engagements: [], exerciseWithoutPosting: [], links: [
      { link: { logical_id: "a", valid_from: "2020-01-01", valid_until: "2026-10-20" }, validity: "vigente", exercises: [], events: [], processes: [],
        postings: [{ posting: { logical_id: "b", valid_from: "2020-01-01", valid_until: null }, validity: "vigente" }] }] }] as never;
    const items = attentionItems(pictureFacts(pic), "2026-10-07", 30);
    expect(items).toHaveLength(1); expect(items[0]!.label).toBe("Término do vínculo");
  });
});
