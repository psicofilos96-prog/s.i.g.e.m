import { describe, expect, it } from "vitest";
import { canSubmit, listOpenCampaigns, manifestConfirmation, myNotices, myProtocols, trackProtocol, UNAVAILABLE, type ProtocolRecord } from "./family-enrollment-portal";

const camps = [
  { campaignId: "c1", title: "Matrícula 2027", kind: "inicial", period: { from: "2026-11-01", to: "2026-11-30" }, schools: ["E1"], status: "publicada" },
  { campaignId: "c2", title: "Rascunho", kind: "inicial", period: { from: "2026-11-01", to: "2026-11-30" }, schools: ["E1"], status: "autorizada" },
];
const p = (protocol: string, hmac: string, extra: Partial<ProtocolRecord> = {}): ProtocolRecord => ({ protocol, campaignId: "c1", requesterHmac: hmac, studentRef: null, stage: "analise",
  publicTrail: [{ at: "2026-11-02", stage: "recebido" }], internalNotes: "justificativa interna", waiting: { position: 3, total: 10, updatedAt: "2026-11-05" },
  confirmation: { deadline: "2026-11-20", manifested: false }, notices: [{ id: "n", at: "2026-11-06", text: "Documento conferido" }], ...extra });
const store = [p("P-A", "hA"), p("P-B", "hB", { studentRef: "st9" })];
const me = { accountId: "acc", requesterHmac: "hA", authorizedStudentRefs: [] };

describe("Família × matrículas L21", () => {
  it("só campanhas publicadas e abertas; inscrição só nelas e com conta", () => {
    expect(listOpenCampaigns(camps, "2026-11-10").map((c) => c.campaignId)).toEqual(["c1"]);
    expect(canSubmit(camps, "c2", "E1", "2026-11-10", me).ok).toBe(false);
    expect(canSubmit(camps, "c1", "E9", "2026-11-10", me).ok).toBe(false);
    expect(canSubmit(camps, "c1", "E1", "2026-11-10", { ...me, accountId: null }).ok).toBe(false);
    expect(canSubmit(camps, "c1", "E1", "2026-11-10", me).ok).toBe(true);
  });
  it("acompanha só o próprio protocolo; terceiro e inexistente respondem igual; sem notas internas", () => {
    const own = trackProtocol(store, "P-A", me);
    expect(own).toMatchObject({ status: "ok", waiting: { position: 3, total: 10 } });
    expect(JSON.stringify(own)).not.toContain("justificativa");
    expect(trackProtocol(store, "P-B", me)).toEqual(UNAVAILABLE);
    expect(trackProtocol(store, "P-X", me)).toEqual(UNAVAILABLE);
    expect(trackProtocol(store, "P-B", { ...me, requesterHmac: null, authorizedStudentRefs: ["st9"] }).status).toBe("ok");
    expect(myProtocols(store, me)).toEqual(["P-A"]);
    expect(myNotices(store, me).every((n) => n.protocol === "P-A")).toBe(true);
  });
  it("confirmação só pelo titular, no prazo homologado, idempotente", () => {
    expect(manifestConfirmation(store, "P-B", me, "2026-11-10")).toEqual(UNAVAILABLE);
    expect(manifestConfirmation(store, "P-A", me, "2026-11-21").status).toBe("recusado");
    expect(manifestConfirmation([p("P-A", "hA", { confirmation: { deadline: null, manifested: false } })], "P-A", me, "2026-11-10").status).toBe("recusado");
    expect(manifestConfirmation(store, "P-A", me, "2026-11-10")).toMatchObject({ status: "ok", replay: false });
    expect(manifestConfirmation([p("P-A", "hA", { confirmation: { deadline: "2026-11-20", manifested: true } })], "P-A", me, "2026-11-10")).toMatchObject({ replay: true });
  });
});
