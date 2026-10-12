import { describe, expect, it } from "vitest";
import { actOnCampaign, campaignAccepts, campaignState, contentIssues, missingDocuments, writeVersion,
  type CActor, type CampaignCompetence, type CampaignContent, type CampaignEvent, type CampaignVersion, type Catalogs, type CampaignPolicy, type CampaignAction } from "./enrollment-campaigns";

const cat: Catalogs = { kinds: ["matricula-inicial", "renovacao", "pre-matricula", "transferencia", "espera"], audiences: ["pub-ef1"], documents: ["doc-certidao", "doc-vacina"],
  criteria: [{ criterionId: "crit-espera", version: 2, homologated: true, kinds: ["espera"] }, { criterionId: "crit-rasc", version: 1, homologated: false, kinds: ["espera"] }], schoolsWithOffer: ["A", "B"] };
const pol: CampaignPolicy = { kindsRequiringCriteria: ["espera"], kindsRequiringEdital: ["matricula-inicial", "espera"] };
const comp: CampaignCompetence = { redigir: "redigir-campanha", "enviar-revisao": "redigir-campanha", devolver: "autorizar-campanha", autorizar: "autorizar-campanha", publicar: "publicar-campanha", encerrar: "publicar-campanha" };
const red: CActor = { personId: "p-red", isHuman: true, capabilities: ["redigir-campanha"] };
const aut: CActor = { personId: "p-aut", isHuman: true, capabilities: ["autorizar-campanha", "publicar-campanha"] };
const content: CampaignContent = { kind: "matricula-inicial", editalRef: "edital-2027-01", audience: ["pub-ef1"], periodFrom: "2026-11-01", periodTo: "2026-11-30", schoolIds: ["A"], criteria: null, documentIds: ["doc-certidao", "doc-vacina"] };

function draft(c = content) { const v = writeVersion("cp1", [], [], c, red, { reason: "m", at: "t", expectedVersion: 0 }, comp); if (!v.ok) throw new Error(v.reason); return [v.value]; }
function go(vs: CampaignVersion[], ev: CampaignEvent[], a: CampaignAction, who: CActor, actRef?: string) {
  const r = actOnCampaign("cp1", vs, ev, a, who, { reason: "m", at: "t", expectedSeq: ev.length, actRef }, comp, cat, pol);
  if (!r.ok) throw new Error(r.reason + (r.issues ?? []).join(";")); return [...ev, r.value];
}
const published = () => { const vs = draft(); let e = go(vs, [], "enviar-revisao", red); e = go(vs, e, "autorizar", aut, "ato-1"); e = go(vs, e, "publicar", aut); return { vs, e }; };

describe("Campanhas de matrícula L06", () => {
  it("fluxo rascunho→revisão→autorizada→publicada→encerrada", () => {
    const { vs, e } = published();
    expect(go(vs, e, "encerrar", aut).map((x) => x.to)).toEqual(["revisao", "autorizada", "publicada", "encerrada"]);
  });
  it("sem regra local: critério obrigatório e homologado, edital, público, documentos e escola com oferta", () => {
    const espera = { ...content, kind: "espera" };
    expect(contentIssues(espera, cat, pol)).toContain("Critério homologado obrigatório para este tipo.");
    expect(contentIssues({ ...espera, criteria: { criterionId: "crit-rasc", version: 1 } }, cat, pol)).toContain("Critério não homologado.");
    expect(contentIssues({ ...espera, criteria: { criterionId: "crit-espera", version: 2 } }, cat, pol)).toEqual([]);
    expect(contentIssues({ ...content, editalRef: null }, cat, pol)).toContain("Edital obrigatório para este tipo.");
    expect(contentIssues({ ...content, schoolIds: ["Z"], audience: [], documentIds: ["doc-x"], kind: "inventado" }, cat, pol).length).toBe(4);
  });
  it("autorização exige ato, pessoa ≠ redator, competência; executor técnico recusado", () => {
    const vs = draft(); const e = go(vs, [], "enviar-revisao", red);
    const a = (who: CActor, actRef?: string, c = comp) => actOnCampaign("cp1", vs, e, "autorizar", who, { reason: "m", at: "t", expectedSeq: 1, actRef }, c, cat, pol).ok;
    expect(a(aut)).toBe(false);
    expect(a({ ...aut, personId: "p-red" }, "x")).toBe(false);
    expect(a({ ...aut, isTechnicalExecutor: true }, "x")).toBe(false);
    expect(a(aut, "x", {})).toBe(false);
    expect(a(aut, "x")).toBe(true);
  });
  it("conteúdo só muda em rascunho; devolução reabre e exige nova autorização", () => {
    const { vs, e } = published();
    expect(writeVersion("cp1", vs, e, content, red, { reason: "m", at: "t", expectedVersion: 1 }, comp).ok).toBe(false);
    const v1 = draft(); let ev = go(v1, [], "enviar-revisao", red); ev = go(v1, ev, "devolver", aut);
    expect(campaignState(ev)).toBe("rascunho");
    const v2 = writeVersion("cp1", v1, ev, { ...content, periodTo: "2026-12-05" }, red, { reason: "prazo", at: "t", expectedVersion: 1 }, comp);
    expect(v2.ok && v2.value.version).toBe(2);
  });
  it("aceita pedido só publicada, no período, escola e tipo; documentos pendentes listados", () => {
    const { vs, e } = published();
    expect(campaignAccepts(vs, e, "matricula-inicial", "A", "2026-11-10")).toEqual({ ok: true, version: 1 });
    expect(campaignAccepts(vs, e, "matricula-inicial", "B", "2026-11-10").ok).toBe(false);
    expect(campaignAccepts(vs, e, "matricula-inicial", "A", "2026-12-10").ok).toBe(false);
    expect(campaignAccepts(vs, e.slice(0, 2), "matricula-inicial", "A", "2026-11-10").ok).toBe(false);
    expect(missingDocuments(vs, e, ["doc-certidao"])).toEqual(["doc-vacina"]);
    expect(missingDocuments(vs, [], [])).toBeNull();
  });
});
