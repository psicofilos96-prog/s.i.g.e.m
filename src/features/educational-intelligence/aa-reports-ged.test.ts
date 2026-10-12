import { describe, it, expect } from "vitest";
import { validateTemplate, canGenerate, sign, addVersion, canRead, type ReportTemplate } from "./aa-reports-ged";
import { INSTITUTIONAL_LOGOS } from "@/features/reports/report-analytics";

const logo = INSTITUTIONAL_LOGOS[0]!.id;
const tpl: ReportTemplate = { id: "t", version: 1, subject: "turma", formats: ["pdf", "xlsx"], blocks: [{ kind: "cabecalho", logoId: logo, title: "Turma" }, { kind: "tabela", queryRef: "q1" }, { kind: "grafico", queryRef: "q1", tableRef: "q1" }, { kind: "nota-metodologica", text: "acerto bruto" }] };
const h = (c: string) => c.repeat(64);

describe("A&A L17 relatórios e GED", () => {
  it("modelo exige brasão institucional, tabela do gráfico e nota metodológica", () => {
    expect(validateTemplate(tpl)).toEqual([]);
    const bad = { ...tpl, blocks: [{ kind: "cabecalho", logoId: "x", title: "" }, { kind: "grafico", queryRef: "q", tableRef: "q" }, { kind: "texto", text: "<script>" }] } as ReportTemplate;
    expect(validateTemplate(bad)).toEqual(expect.arrayContaining(["brasão fora da lista institucional", "gráfico sem tabela equivalente", "texto com HTML recusado", "nota metodológica obrigatória"]));
  });
  it("nominal exige capability e finalidade; assinatura só do responsável real", () => {
    expect(canGenerate("estudante", { capability: true, nominalCapability: false, purpose: "x" }).ok).toBe(false);
    expect(canGenerate("rede", { capability: true, nominalCapability: false, purpose: null }).ok).toBe(true);
    const sig = { kind: "simples" as const, personId: "p1", icpEvidence: null };
    expect(sign({ signer: { personId: "p1", technical: false }, responsibleIds: ["p1"], signature: sig }).ok).toBe(true);
    expect(sign({ signer: { personId: "p1", technical: true }, responsibleIds: ["p1"], signature: sig }).ok).toBe(false);
    expect(sign({ signer: { personId: "p2", technical: false }, responsibleIds: ["p1"], signature: { ...sig, personId: "p2" } }).ok).toBe(false);
  });
  it("GED versionado, privado e com gabarito restrito", () => {
    const v1 = addVersion([], { docId: "d1", kind: "gabarito", sha256: h("a"), path: "aa/gabarito/d1/v1.pdf", by: "p1", at: "x", reason: null }, 0);
    if (!v1.ok) throw new Error(v1.reason);
    expect(addVersion([v1.version], { docId: "d1", kind: "gabarito", sha256: h("b"), path: "aa/gabarito/d1/v2.pdf", by: "p1", at: "y", reason: null }, 1).ok).toBe(false);
    expect(addVersion([v1.version], { docId: "d1", kind: "gabarito", sha256: h("a"), path: "aa/gabarito/d1/v2.pdf", by: "p1", at: "y", reason: "r" }, 1).ok).toBe(false);
    expect(addVersion([v1.version], { docId: "d1", kind: "gabarito", sha256: h("b"), path: "https://x/y", by: "p1", at: "y", reason: "r" }, 1).ok).toBe(false);
    expect(addVersion([v1.version], { docId: "d1", kind: "gabarito", sha256: h("b"), path: "aa/gabarito/d1/v2.pdf", by: "p1", at: "y", reason: "errata" }, 1).ok).toBe(true);
    expect(canRead("gabarito", { capability: true, keyCapability: false, isAuthor: false })).toBe(false);
    expect(canRead("ata", { capability: true, keyCapability: false, isAuthor: false })).toBe(true);
  });
});
