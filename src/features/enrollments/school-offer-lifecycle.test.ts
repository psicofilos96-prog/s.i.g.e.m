import { describe, expect, it } from "vitest";
import { applyOfferAction, currentIdentity, offerAcceptsEnrollment, offerConflicts, offerState, offerStateKnownAt,
  type Actor, type OfferAction, type OfferEvent, type OfferIdentity, type OfferCompetenceConfig } from "./school-offer-lifecycle";

const base: OfferIdentity = { offerId: "of-1", schoolId: "esc-A", axes: { etapa: "v-ef", modalidade: "v-reg", ano: "v-1", turno: "v-man" }, periodFrom: "2027-02-01", periodTo: "2027-12-20" };
const cfg: OfferCompetenceConfig = { criar: "propor-oferta", propor: "propor-oferta", analisar: "analisar-oferta", devolver: "analisar-oferta",
  autorizar: "autorizar-oferta", indeferir: "autorizar-oferta", publicar: "publicar-oferta", iniciar: "publicar-oferta", encerrar: "autorizar-oferta", retificar: "autorizar-oferta" };
const escola: Actor = { personId: "p-sec", isHuman: true, capabilities: ["propor-oferta"], schoolIds: ["esc-A"] };
const rede: Actor = { personId: "p-rede", isHuman: true, capabilities: ["analisar-oferta", "autorizar-oferta", "publicar-oferta"], schoolIds: "rede" };

function run(events: OfferEvent[], action: OfferAction, actor: Actor, extra: { actRef?: string; identity?: OfferIdentity } = {}, at = "2026-10-12") {
  const d = applyOfferAction(base, events, action, actor, { reason: "motivo", at, expectedSeq: events.length, ...extra }, cfg);
  if (!d.ok) throw new Error(d.reason);
  return [...events, d.event];
}
const full = () => {
  let e = run([], "criar", escola); e = run(e, "propor", escola); e = run(e, "analisar", rede);
  e = run(e, "autorizar", rede, { actRef: "ato-1" }); e = run(e, "publicar", rede); return e;
};

describe("Oferta L02", () => {
  it("percorre rascunho→publicada→funcionamento→encerrada com histórico preservado", () => {
    let e = full(); e = run(e, "iniciar", rede); e = run(e, "encerrar", rede, { actRef: "ato-2" });
    expect(e.map((x) => x.to)).toEqual(["rascunho", "proposta", "analise", "autorizada", "publicada", "funcionamento", "encerrada"]);
    expect(e.map((x) => x.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("sem competência configurada, capacidade ou escopo ⇒ recusa", () => {
    const e = run(run(run([], "criar", escola), "propor", escola), "analisar", rede);
    expect(applyOfferAction(base, e, "autorizar", rede, { reason: "x", actRef: "a", at: "t", expectedSeq: 3 }, {}).ok).toBe(false);
    expect(applyOfferAction(base, e, "autorizar", escola, { reason: "x", actRef: "a", at: "t", expectedSeq: 3 }, cfg).ok).toBe(false);
    const outra: Actor = { ...escola, schoolIds: ["esc-B"] };
    expect(applyOfferAction(base, [], "criar", outra, { reason: "x", at: "t", expectedSeq: 0 }, cfg).ok).toBe(false);
  });
  it("autorização exige ato, pessoa natural e autor distinto do proponente", () => {
    const e = run(run(run([], "criar", escola), "propor", escola), "analisar", rede);
    const go = (a: Actor, actRef?: string) => applyOfferAction(base, e, "autorizar", a, { reason: "x", actRef, at: "t", expectedSeq: 3 }, cfg);
    expect(go(rede).ok).toBe(false);
    expect(go({ ...rede, personId: "p-sec" }, "ato").ok).toBe(false);
    expect(go({ ...rede, personId: null, isHuman: false }, "ato").ok).toBe(false);
    expect(go({ ...rede, isTechnicalExecutor: true }, "ato").ok).toBe(false);
    expect(go(rede, "ato").ok).toBe(true);
  });
  it("não pula etapa e recusa base desatualizada", () => {
    const e = run([], "criar", escola);
    expect(applyOfferAction(base, e, "publicar", rede, { reason: "x", at: "t", expectedSeq: 1 }, cfg).ok).toBe(false);
    expect(applyOfferAction(base, e, "propor", escola, { reason: "x", at: "t", expectedSeq: 0 }, cfg).ok).toBe(false);
  });
  it("devolução volta a rascunho; retificação cria versão sem apagar anterior", () => {
    let e = run(run(run([], "criar", escola), "propor", escola), "analisar", rede);
    e = run(e, "devolver", rede); expect(offerState(e)).toBe("rascunho");
    let p = full();
    p = run(p, "retificar", rede, { actRef: "ato-r", identity: { ...base, periodTo: "2027-12-10" } });
    expect(offerState(p)).toBe("publicada");
    expect(currentIdentity(base, p).periodTo).toBe("2027-12-10");
    expect(currentIdentity(base, p.slice(0, 5)).periodTo).toBe("2027-12-20");
  });
  it("aceita matrícula só publicada/funcionamento dentro do período; estado por data de conhecimento", () => {
    const e = full();
    expect(offerAcceptsEnrollment(base, e, "2027-03-01")).toBe(true);
    expect(offerAcceptsEnrollment(base, e, "2028-01-10")).toBe(false);
    expect(offerAcceptsEnrollment(base, e.slice(0, 4), "2027-03-01")).toBe(false);
    expect(offerStateKnownAt(e, "2026-01-01")).toBeNull();
  });
  it("detecta oferta duplicada sobreposta na mesma escola", () => {
    const b2 = { ...base, offerId: "of-2", periodFrom: "2027-06-01" };
    expect(offerConflicts([{ base, events: full() }, { base: b2, events: full().map((x) => ({ ...x, offerId: "of-2" })) }])).toEqual([["of-1", "of-2"]]);
  });
});
