import { describe, it, expect } from "vitest";
import { validateOccurrence, act, status, urgentGuidance, URGENT_FALLBACK, type Occurrence, type OccEvent } from "./mediator-occurrences";

const des = { logicalId: "D1", personId: "m1", schoolId: "sA", studentId: "e1", from: "2026-02-01", to: null };
const ctx = { personId: "m1", technical: false, today: "2026-03-10", designation: des };
const occ: Occurrence = { id: "O1", schoolId: "sA", studentId: "e1", designationId: "D1", type: "falta-recurso", date: "2026-03-10", place: "Sala 5",
  fact: "Prancha de comunicação não estava na sala às 8h", actions: "Usei cartões impressos", recipients: [{ kind: "nei", schoolId: null }], urgent: false, authorPersonId: "m1" };
const med = { personId: "m1", technical: false, recipientOf: [] as const };
const nei = { personId: "n1", technical: false, recipientOf: ["nei" as const] };
const step = (ev: OccEvent[], a: Parameters<typeof act>[2], who: Parameters<typeof act>[3]) => {
  const r = act(ev, occ, { ...a, expectedSeq: Math.max(0, ...ev.map((e) => e.seq)) }, who); if (!r.ok) throw new Error(r.reasons.join()); return [...ev, r.event];
};

describe("Mediador L11 — ocorrências e urgências", () => {
  it("formulário válido; campos obrigatórios, designação e destinatário fora da escola", () => {
    expect(validateOccurrence(occ, ctx).reasons).toEqual([]);
    expect(validateOccurrence({ ...occ, place: "", fact: "x", recipients: [] }, ctx).reasons).toHaveLength(3);
    expect(validateOccurrence(occ, { ...ctx, designation: null }).reasons).toHaveLength(1);
    expect(validateOccurrence({ ...occ, recipients: [{ kind: "direcao", schoolId: "sB" }] }, ctx).reasons).toHaveLength(1);
    expect(validateOccurrence({ ...occ, fact: "ficou agressivo de propósito" }, ctx).advise).toHaveLength(1);
  });
  it("fluxo registrar→receber→encaminhar→concluir só pelo lado competente", () => {
    let ev = step([], { act: "registrar", text: "", at: "t" } as never, med);
    expect(act(ev, occ, { act: "receber", expectedSeq: 1, text: "", at: "t" }, med).ok).toBe(false);
    ev = step(ev, { act: "receber", text: "", at: "t" } as never, nei);
    expect(act(ev, occ, { act: "encaminhar", expectedSeq: 2, text: "enviar prancha", at: "t" }, nei).ok).toBe(false); // sem destino
    ev = step(ev, { act: "encaminhar", text: "repor prancha", referral: "Almoxarifado NEI", at: "t" } as never, nei);
    ev = step(ev, { act: "complementar", text: "prancha chegou às 10h", at: "t" } as never, med);
    ev = step(ev, { act: "concluir", text: "recurso reposto", at: "t" } as never, nei);
    expect(status(ev, "O1")).toBe("concluida");
    expect(act(ev, occ, { act: "complementar", expectedSeq: 5, text: "mais um", at: "t" }, med).ok).toBe(false);
  });
  it("seq desatualizado e executor técnico recusados; chave idempotente estável", () => {
    expect(act([], occ, { act: "registrar", expectedSeq: 3, text: "", at: "t" }, med).ok).toBe(false);
    expect(act([], occ, { act: "registrar", expectedSeq: 0, text: "", at: "t" }, { personId: null, technical: true, recipientOf: [] }).ok).toBe(false);
    const a = act([], occ, { act: "registrar", expectedSeq: 0, text: "", at: "t1" }, med), b = act([], occ, { act: "registrar", expectedSeq: 0, text: "", at: "t2" }, med);
    expect(a.ok && b.ok && a.event.idem === b.event.idem).toBe(true);
  });
  it("urgência mostra só protocolos homologados vigentes do tipo e sempre o aviso de acionamento", () => {
    const g = urgentGuidance("seguranca", [
      { id: "P1", version: 2, types: ["seguranca"], title: "Queda", steps: ["Não mover", "Chamar Direção"], homologated: true, validFrom: "2026-01-01", validTo: null },
      { id: "P2", version: 1, types: ["seguranca"], title: "Rascunho", steps: [], homologated: false, validFrom: "2026-01-01", validTo: null },
    ], "2026-03-10");
    expect(g.protocols.map((p) => p.id)).toEqual(["P1"]);
    expect(g.notice).toBe(URGENT_FALLBACK);
    expect(urgentGuidance("seguranca", null, "2026-03-10")).toMatchObject({ protocols: [], protocolsRead: false, notice: URGENT_FALLBACK });
  });
});
