import { describe, expect, it } from "vitest";
import { actOnRequest, overdue, requestState, requesterTrail, sendMessage, type RActor, type RequestAction, type RequestEvent, type RequestPolicy } from "./vacancy-requests";

const caps = ["receber", "conferir", "analisar", "distribuir", "colocar-em-espera", "contemplar", "confirmar", "encerrar", "atribuir-responsavel"] as const;
const pol: RequestPolicy = { competence: Object.fromEntries(caps.map((c) => [c, "gerir-solicitacoes-vaga"])), dueDaysByState: { conferencia: 3 }, closureKinds: ["desistencia", "nao-confirmacao"], confirmationWindowDays: 5 };
const a: RActor = { personId: "p-a", isHuman: true, capabilities: ["gerir-solicitacoes-vaga"], schoolIds: ["A"], engagementIds: ["eng-a"] };
const b: RActor = { ...a, personId: "p-b", engagementIds: ["eng-a"] };
const P = "INS-1";
function go(e: RequestEvent[], act: RequestAction, who: RActor, x: Record<string, unknown> = {}, at = "2026-11-10T10:00:00Z") {
  const r = actOnRequest(P, "A", e, act, who, { reason: "j", at, expectedSeq: e.length, ...x }, pol); if (!r.ok) throw new Error(r.reason); return [...e, r.event];
}
const toDist = () => { let e = go([], "receber", a); e = go(e, "atribuir-responsavel", a, { responsibleEngagementId: "eng-a" }); e = go(e, "conferir", a); e = go(e, "analisar", a); return go(e, "distribuir", a, { cellKey: "K1" }); };

describe("Solicitações de vaga L08", () => {
  it("fluxo completo com prazo declarado só onde há política", () => {
    let e = toDist(); e = go(e, "contemplar", b, { cellKey: "K1", availableInCell: 3 }); e = go(e, "confirmar", a, { confirmedByGuardianChannel: true }, "2026-11-12T09:00:00Z");
    expect(e.map((x) => x.to)).toEqual(["recebido", "recebido", "conferencia", "analise", "distribuicao", "contemplado", "confirmado"]);
    expect(e[2]?.dueOn).toBe("2026-11-13"); expect(e[3]?.dueOn).toBeNull();
  });
  it("contemplar relê vaga no ato, mesma linha distribuída e pessoa ≠ distribuidor; sem vaga ⇒ espera", () => {
    const e = toDist();
    const c = (who: RActor, x: object) => actOnRequest(P, "A", e, "contemplar", who, { reason: "j", at: "t", expectedSeq: e.length, cellKey: "K1", ...x }, pol);
    expect(c(b, { availableInCell: null }).ok).toBe(false);
    expect(c(b, { availableInCell: 0 }).ok).toBe(false);
    expect(c(b, { availableInCell: 2, cellKey: "K2" }).ok).toBe(false);
    expect(c(a, { availableInCell: 2 }).ok).toBe(false);
    const w = go(e, "colocar-em-espera", a); expect(requestState(go(w, "distribuir", a, { cellKey: "K1" }))).toBe("distribuicao");
  });
  it("responsável, competência, escopo, anexo protegido e executor técnico", () => {
    const e = toDist();
    const outro: RActor = { ...b, engagementIds: ["eng-x"] };
    expect(actOnRequest(P, "A", e, "colocar-em-espera", outro, { reason: "j", at: "t", expectedSeq: e.length }, pol).ok).toBe(false);
    expect(actOnRequest(P, "A", [], "receber", { ...a, isTechnicalExecutor: true }, { reason: "j", at: "t", expectedSeq: 0 }, pol).ok).toBe(false);
    expect(actOnRequest(P, "A", [], "receber", a, { reason: "j", at: "t", expectedSeq: 0 }, { ...pol, competence: {} }).ok).toBe(false);
    expect(actOnRequest(P, "B", [], "receber", a, { reason: "j", at: "t", expectedSeq: 0 }, pol).ok).toBe(false);
    expect(actOnRequest(P, "A", [], "receber", a, { reason: "j", at: "t", expectedSeq: 0, attachmentRefs: ["https://x"] }, pol).ok).toBe(false);
    expect(actOnRequest(P, "A", [], "receber", a, { reason: "j", at: "t", expectedSeq: 0, attachmentRefs: [`solicitacoes/A/${P}/doc.pdf`] }, pol).ok).toBe(true);
  });
  it("confirmação exige manifestação no prazo homologado; encerramento só por motivo do catálogo", () => {
    const e = go(toDist(), "contemplar", b, { cellKey: "K1", availableInCell: 1 });
    const conf = (x: object, at: string, p = pol) => actOnRequest(P, "A", e, "confirmar", a, { reason: "j", at, expectedSeq: e.length, ...x }, p).ok;
    expect(conf({}, "2026-11-11T00:00:00Z")).toBe(false);
    expect(conf({ confirmedByGuardianChannel: true }, "2026-11-20T00:00:00Z")).toBe(false);
    expect(conf({ confirmedByGuardianChannel: true }, "2026-11-11T00:00:00Z", { ...pol, confirmationWindowDays: null })).toBe(false);
    expect(actOnRequest(P, "A", e, "encerrar", a, { reason: "j", at: "t", expectedSeq: e.length, closureKind: "sumiu" }, pol).ok).toBe(false);
    expect(requestState(go(e, "encerrar", a, { closureKind: "nao-confirmacao" }))).toBe("encerrado");
  });
  it("atraso só com prazo declarado; trilha do requerente sem justificativa interna", () => {
    const e = go(go(go([], "receber", a), "atribuir-responsavel", a, { responsibleEngagementId: "eng-a" }), "conferir", a);
    expect(overdue(e, "2026-11-14")).toBe(true);
    expect(overdue(go(e, "analisar", a), "2027-01-01")).toBeNull();
    expect(Object.keys(requesterTrail(e)[0]!)).toEqual(["seq", "to", "at", "dueOn"]);
  });
  it("comunicação individual: modelo homologado, sem acusação nem dado sensível, sem provedor ≠ enviado", () => {
    const m = (t: string, prov = true, tpl = "tpl-contemplado") => sendMessage(P, [], a, { channel: "sms", templateId: tpl, templateText: t, at: "t", providerConfigured: prov, allowedTemplates: ["tpl-contemplado"] });
    expect(m("Sua vaga foi contemplada.", false)).toMatchObject({ ok: true, event: { status: "sem-provedor" } });
    expect(m("Sua vaga foi contemplada.").ok && true).toBe(true);
    expect(m("Houve fraude no pedido").ok).toBe(false);
    expect(m("CPF 123.456.789-00").ok).toBe(false);
    expect(m("ok", true, "tpl-livre").ok).toBe(false);
  });
});
