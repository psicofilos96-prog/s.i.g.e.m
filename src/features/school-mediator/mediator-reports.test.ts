import { describe, it, expect } from "vitest";
import { MEDIATOR_REPORTS, mediatorReportReadiness, summarize, validateGedDoc, canReadGed, exportPlan, downloadAllowed, pageFooter } from "./mediator-reports";

const all = { "registro-diario": "lida", participacao: "lida", ocorrencias: "lida", solicitacoes: "lida" } as const;
const header = { title: "Relatório mensal de mediação", schoolName: "E.M. Exemplo", lines: [], logoIds: [], coatOfArms: true };

describe("Mediador L15 — documentos e relatórios", () => {
  it("dez relatórios catalogados, cada um com fonte", () => {
    expect(MEDIATOR_REPORTS).toHaveLength(10);
    expect(MEDIATOR_REPORTS.every((r) => r.sources.length > 0)).toBe(true);
  });
  it("fonte não lida/negada e período errado bloqueiam por extenso", () => {
    expect(mediatorReportReadiness("mensal", all, { from: "2026-03-01", to: "2026-03-31", designationActiveInPeriod: true }).ok).toBe(true);
    const r = mediatorReportReadiness("semanal", { ...all, ocorrencias: "negada" }, { from: "2026-03-01", to: "2026-03-10", designationActiveInPeriod: true });
    expect(!r.ok && r.reasons).toEqual(["Sem permissão para ler ocorrencias.", "Relatório semanal cobre no máximo 7 dias."]);
    expect(mediatorReportReadiness("diario", all, { from: "2026-03-01", to: "2026-03-01", designationActiveInPeriod: false }).ok).toBe(false);
  });
  it("resumo só conta registros; não lido ≠ zero", () => {
    expect(summarize(null).state).toBe("nao-disponivel");
    const s = summarize([{ kind: "apoio", date: "d", category: "loc" }, { kind: "apoio", date: "d", category: "loc" }]);
    expect(s.state === "ok" && s.groups).toEqual([{ kind: "apoio", category: "loc", records: 2 }]);
  });
  it("GED restrita: classe, pasta da designação, sem laudo; leitura por autoria/designação/concessão", () => {
    const d = { cls: "relatorio", title: "Relatório mensal", path: "mediacao/sA/D1/x.pdf", schoolId: "sA", designationId: "D1", authorPersonId: "m1" };
    expect(validateGedDoc(d)).toEqual([]);
    expect(validateGedDoc({ ...d, cls: "laudo", title: "Laudo neurológico", path: "publico/x.pdf" })).toHaveLength(3);
    const doc = { schoolId: "sA", designationId: "D1", authorPersonId: "m1", sharedWith: [] };
    expect(canReadGed(doc, { personId: "m9", activeDesignationIds: [], capabilities: [] })).toBe(false);
    expect(canReadGed(doc, { personId: "m2", activeDesignationIds: ["D1"], capabilities: [] })).toBe(true);
  });
  it("exportação registra emissão antes do download; sem confirmação não baixa; mesmo hash não cria versão", () => {
    const p = exportPlan({ reportId: "mensal", format: "pdf", personId: "m1", purpose: "Envio ao NEI", header, hash: "h1", previous: [{ version: 1, hash: "h1" }] });
    expect(p.ok && p.steps[0]).toBe("registrar-emissao");
    expect(p.ok && p.emission).toMatchObject({ version: 1, newVersion: false, page: "A4" });
    expect(exportPlan({ reportId: "mensal", format: "pdf", personId: null, purpose: "", header: { ...header, logoIds: ["x"] }, hash: "h", previous: [] }).ok).toBe(false);
    expect(downloadAllowed(undefined, "h1")).toBe(false);
    expect(downloadAllowed({ hash: "h1", code: "ABC" }, "h1")).toBe(true);
    expect(pageFooter(1, 3, 2, "ABC")).toBe("Página 1 de 3 · versão 2 · verificação ABC");
  });
});
