import { describe, expect, it } from "vitest";
import { act, deliveryState, guardianAllowed, openRequest, pickupAllowed, receipt, type GuardianAuth } from "./family-requests";

const auth: GuardianAuth = { personId: "g1", studentId: "s1", sections: ["comunicados", "frequencia", "retirada"], from: "2026-01-01", to: null, revokedOn: null, restricted: false };
const base = { id: "r1", kind: "retirada" as const, studentId: "s1", schoolId: "A", byPersonId: "g1", createdOn: "2026-10-11", attachments: [] };

describe("Secretaria ↔ Família", () => {
  it("guardião sem vínculo, revogado ou de outro educando recebem a mesma recusa", () => {
    expect(guardianAllowed([], "g9", "s1", "retirada", "2026-10-11")).toEqual({ ok: false, code: "family:not-authorized" });
    expect(guardianAllowed([{ ...auth, revokedOn: "2026-10-01" }], "g1", "s1", "retirada", "2026-10-11")).toEqual({ ok: false, code: "family:not-authorized" });
    expect(guardianAllowed([auth], "g1", "s2", "retirada", "2026-10-11")).toEqual({ ok: false, code: "family:not-authorized" });
  });
  it("anexo só em pasta privada; justificativa só tipo homologado", () => {
    expect(openRequest({ ...base, attachments: ["publico/x.pdf"] }, [auth], null)).toMatchObject({ code: "family:attachment-not-private" });
    expect(openRequest({ ...base, kind: "justificativa-ausencia" }, [auth], null, "atestado")).toMatchObject({ code: "family:justification-type-not-homologated" });
  });
  it("escola B não age em pedido da A; revogação exige motivo e encerra a retirada", () => {
    const o = openRequest(base, [auth], null);
    if (!o.ok) throw new Error();
    expect(act(o.request, { type: "deferida", by: "sec", on: "2026-10-12" }, "B")).toMatchObject({ code: "family:other-school" });
    const d = act(o.request, { type: "deferida", by: "sec", on: "2026-10-12" }, "A");
    if (!d.ok) throw new Error();
    expect(pickupAllowed(d.request, "tio", ["tio"])).toBe(true);
    expect(act(d.request, { type: "revogada", by: "sec", on: "2026-10-13" }, "A")).toMatchObject({ code: "family:reason-required" });
    const r = act(d.request, { type: "revogada", by: "sec", on: "2026-10-13", reason: "pedido da família" }, "A");
    if (!r.ok) throw new Error();
    expect(pickupAllowed(r.request, "tio", ["tio"])).toBe(false);
    expect(receipt(r.request, o.protocol)).toMatchObject({ protocol: "PRT-A-r1", status: "revogada" });
  });
  it("entrega nunca afirma leitura sem confirmação", () => {
    expect(deliveryState({ channel: "email", providerConfigured: false, delivered: true, readConfirmedOn: null, acknowledgedOn: null })).toBe("sem-provedor");
    expect(deliveryState({ channel: "portal", providerConfigured: false, delivered: true, readConfirmedOn: null, acknowledgedOn: null })).toBe("entregue-sem-confirmacao-de-leitura");
  });
});
