import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOT_A_TECHNICAL_REPORT, checklistUsable, projectInspection, recommendationAttests, validateChecklist, validateRecord, type ChecklistVersion, type Inspection } from "./inspections";

const C = (x: Partial<ChecklistVersion> = {}): ChecklistVersion => ({
  id: "c1", checklistKey: "geral", version: 1, priorities: ["alta", "media"], authorPerson: "p1",
  approval: { approverPerson: "p2", decisionRef: "Ata 3" },
  items: [{ key: "telhado", label: "Telhado", answers: ["ok", "infiltracao"], nonConforming: ["infiltracao"] }, { key: "extintor", label: "Extintor", answers: ["ok", "vencido"], nonConforming: ["vencido"] }],
  ...x });
const I: Inspection = { id: "i1", kind: "programada", scheduledOn: "2026-10-01", checklistVersionId: "c1", responsibleEngagement: "e1", motive: null };
const SQL = readFileSync("drizzle/migrations/0406_ops04_inspections.sql", "utf8");

describe("Centro de Operações L04 — vistorias", () => {
  it("checklist só utilizável na última versão aprovada por outra pessoa; itens válidos", () => {
    expect(checklistUsable([C()], "c1")).not.toBeNull();
    expect(checklistUsable([C({ approval: { approverPerson: "p1", decisionRef: "x" } })], "c1")).toBeNull();
    expect(checklistUsable([C(), C({ id: "c2", version: 2, approval: null })], "c1")).toBeNull();
    expect(validateChecklist([{ key: "a", label: "A", answers: ["s"] }, { key: "a", label: "A", answers: ["s", "n"] }]).length).toBe(2);
  });
  it("respostas e prioridades só do checklist", () => {
    const p = validateRecord(C(), { kind: "realizada", performedOn: "2026-10-05", answers: { telhado: "otimo", janela: "ok" },
      recommendations: [{ text: "Trocar telhas quebradas", priority: "urgentissima" }], note: null }, "2026-10-12").join(" ");
    expect(p).toMatch(/não admitida em telhado/);
    expect(p).toMatch(/janela não pertence/);
    expect(p).toMatch(/não configurada/);
  });
  it("item sem resposta é não verificado; laudo vira rota própria; aviso sempre presente", () => {
    const v = projectInspection(I, C(), [{ seq: 1, kind: "realizada", performedOn: "2026-10-02", answers: { telhado: "infiltracao" },
      recommendations: [{ text: "Avaliar a laje por engenheiro", requiresTechnicalReport: true }, { text: "Limpar calhas do bloco A", priority: "media" }], note: null, inspectorPerson: "p3" }], "2026-10-12");
    expect(v.items.map((i) => i.status)).toEqual(["nao-conforme", "nao-verificado"]);
    expect(v.recommendations.map((r) => r.route)).toEqual(["laudo-tecnico", "manutencao"]);
    expect(v.notice).toBe(NOT_A_TECHNICAL_REPORT);
  });
  it("atraso, retificação e linguagem de atestado recusada", () => {
    expect(projectInspection(I, C(), [], "2026-10-12").state).toBe("atrasada");
    const v = projectInspection(I, C(), [
      { seq: 1, kind: "realizada", performedOn: "2026-10-02", answers: { telhado: "ok" }, recommendations: [], note: null, inspectorPerson: "p3" },
      { seq: 2, kind: "retificacao", performedOn: "2026-10-02", answers: { telhado: "infiltracao" }, recommendations: [], note: "Foto mostrava infiltração.", inspectorPerson: "p3" }], "2026-10-12");
    expect(v.rectifications).toBe(1);
    expect(v.items[0]!.answer).toBe("infiltracao");
    expect(recommendationAttests("Estrutura segura, apto para uso")).toBe(true);
  });
  it("banco: append-only, aprovação ≠ autor, responsável executa, respostas/prioridade/evidência validadas", () => {
    for (const t of ["opscl_immutable", "opscla_immutable", "opsin_immutable", "opsir_immutable"]) expect(SQL).toContain(`${t} BEFORE UPDATE OR DELETE`);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    for (const m of ["opscl:self-approval", "opsin:checklist-not-approved", "opsin:not-responsible", "opsin:answer-not-in-checklist",
      "opsin:priority-not-configured", "opsin:evidence-not-in-documents", "opsin:conflict", "opsin:responsible-not-active"]) expect(SQL).toContain(m);
    expect(SQL).toMatch(/kind <> 'extraordinaria' OR motive IS NOT NULL/);
    expect(SQL).not.toMatch(/GRANT SELECT \([^)]*evidence_refs/);
  });
});
