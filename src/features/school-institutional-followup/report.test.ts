import { describe, expect, it } from "vitest";
import { schoolFollowupReport, visitFollowupReport, FOLLOWUP_SCHOOL_REPORT, FOLLOWUP_VISIT_REPORT } from "./report";
import { toCsv } from "@/features/reports/report-engine";
import type { SchoolSnapshot } from "./model";

const snapshot: SchoolSnapshot = {
  visits: [{
    id: "visit-v2", logical_id: "visit-original", version: 2, school_id: "s1",
    visit_date: "2026-11-02", diagnosis: "Situação retificada",
    strengths: "Boa equipe", weaknesses: "Acervo", summary: "Planejar ação",
    correction_reason: "Correção de descrição", supersedes_id: "visit-v1",
    created_at: "2026-11-03T09:00:00Z", author_name: "Servidor A", can_correct: true,
  }],
  visit_history: [{
    id: "visit-v1", logical_id: "visit-original", version: 1, school_id: "s1",
    visit_date: "2026-10-22", diagnosis: "Diagnóstico original",
    strengths: "", weaknesses: "", summary: null, correction_reason: null,
    supersedes_id: null, created_at: "2026-10-22T09:00:00Z", author_name: "Servidor A",
  }],
  actions: [{
    id: "measure-1", school_id: "s1", visit_logical_id: "visit-original",
    description: "=1+2", responsible_label: "Direção", due_on: null,
    created_at: "2026-10-23T10:00:00Z", author_name: "Servidor B",
  }],
  updates: [{
    id: "update-1", action_id: "measure-1", visit_logical_id: null,
    occurred_on: "2026-11-03", situation: "em andamento",
    done_text: "Separadas as pastas", not_done_text: "Não catalogadas",
    results: "Trabalho iniciado", referrals: null,
    created_at: "2026-11-03T13:00:00Z", author_name: "Servidor A",
  }],
};

describe("ficha de acompanhamento por unidade", () => {
  it("inclui visitas atuais, retificações antigas, medidas e evoluções", () => {
    const r = schoolFollowupReport(snapshot, "s1");
    expect(r.definitionId).toBe(FOLLOWUP_SCHOOL_REPORT.id);
    expect(r.rows).toHaveLength(4);
    const fields = r.columns.map((c) => c.id);
    const col = (id: string) => fields.indexOf(id);
    expect(r.rows.map((x) => x[col("event_type")])).toContain("Visita substituída (v1)");
    expect(r.rows.map((x) => x[col("event_type")])).toContain("Visita vigente (v2)");
    expect(r.rows.map((x) => x[col("event_type")])).toContain("Medida proposta");
    expect(r.rows.map((x) => x[col("event_type")])).toContain("Evolução de medida");
    expect(r.rows[0]?.[col("event_date")]).toBe("2026-11-03");
    const measure = r.rows.find((x) => x[col("event_type")] === "Medida proposta")!;
    expect(measure[col("situation")]).toBe("em andamento");
    expect(measure[col("deadline")]).toBeNull();
    const old = r.rows.find((x) => x[col("event_type")] === "Visita substituída (v1)")!;
    expect(String(old[col("description")])).toContain("Diagnóstico original");
  });
  it("separa data efetiva de registro e converte instantes UTC ao dia de Itaperuna", () => {
    const altered: SchoolSnapshot = {
      ...snapshot,
      actions: [{
        ...snapshot.actions[0]!,
        created_at: "2026-11-04T01:30:00Z",
      }],
      updates: [{
        ...snapshot.updates[0]!,
        occurred_on: "2026-11-02",
        created_at: "2026-11-04T01:30:00Z",
      }],
    };
    const r = schoolFollowupReport(altered, "s1");
    const idx = (col: string) => r.columns.findIndex((c) => c.id === col);
    const action = r.rows.find((x) => x[idx("event_type")] === "Medida proposta")!;
    const update = r.rows.find((x) => x[idx("event_type")] === "Evolução de medida")!;
    expect(FOLLOWUP_SCHOOL_REPORT.version).toBe(2);
    expect(action[idx("event_date")]).toBe("2026-11-03");
    expect(action[idx("recorded_at")]).toBe("03/11/2026 22:30");
    expect(update[idx("event_date")]).toBe("2026-11-02");
    expect(update[idx("recorded_at")]).toBe("03/11/2026 22:30");
    const currentVisit = r.rows.find((x) => x[idx("event_type")] === "Visita vigente (v2)")!;
    expect(currentVisit[idx("event_date")]).toBe("2026-11-02");
    expect(currentVisit[idx("recorded_at")]).toBe("03/11/2026 06:00");
  });
  it("relatório de visita isola seu plano e conserva todas as retificações", () => {
    const otherVisit: SchoolSnapshot["visits"][number] = {
      ...snapshot.visits[0]!, id: "other-v1", logical_id: "other-logical",
      version: 1, visit_date: "2026-11-03", supersedes_id: null, diagnosis: "Outra visita",
    };
    const otherAction: SchoolSnapshot["actions"][number] = {
      ...snapshot.actions[0]!, id: "other-action", visit_logical_id: "other-logical",
      description: "Medida de outra visita",
    };
    const expanded: SchoolSnapshot = {
      ...snapshot, visits: [...snapshot.visits, otherVisit],
      actions: [...snapshot.actions, otherAction],
      updates: [...snapshot.updates, { ...snapshot.updates[0]!, id: "other-update", action_id: "other-action",
        done_text: "Não incluir" }],
    };
    const r = visitFollowupReport(expanded, "s1", "visit-v2");
    expect(r.definitionId).toBe(FOLLOWUP_VISIT_REPORT.id);
    expect(r.rows).toHaveLength(4);
    const joined = r.rows.map((line) => line.join(" ")).join(" ");
    expect(joined).toContain("Situação retificada");
    expect(joined).toContain("Diagnóstico original");
    expect(joined).toContain("=1+2");
    expect(joined).toContain("Separadas as pastas");
    expect(joined).not.toContain("Medida de outra visita");
    expect(joined).not.toContain("Não incluir");
    expect(joined).not.toContain("Outra visita");
  });
  it("exporta o vínculo da evolução à visita de retorno, sem misturar medidas de outras visitas", () => {
    const returnVisit: SchoolSnapshot["visits"][number] = {
      ...snapshot.visits[0]!, id: "return-v1", logical_id: "return-logical",
      version: 1, visit_date: "2026-11-03", supersedes_id: null,
      diagnosis: "Visita de retorno", correction_reason: null,
    };
    const expanded: SchoolSnapshot = {
      ...snapshot, visits: [...snapshot.visits, returnVisit],
      updates: [{ ...snapshot.updates[0]!, visit_logical_id: "return-logical" }],
    };
    const school = schoolFollowupReport(expanded, "s1");
    const visit = visitFollowupReport(expanded, "s1", "visit-v2");
    const d = (report: typeof visit) => report.columns.findIndex((c) => c.id === "detail");
    const t = (report: typeof visit) => report.columns.findIndex((c) => c.id === "event_type");
    const event = (report: typeof visit) => report.rows.find((r) => r[t(report)] === "Evolução de medida");
    expect(String(event(school)?.[d(school)])).toContain("Visita associada: Visita de 2026-11-03");
    expect(String(event(visit)?.[d(visit)])).toContain("Visita associada: Visita de 2026-11-03");
    expect(visit.rows).toHaveLength(4);
    expect(visit.rows.map((r) => r[t(visit)])).not.toContain("Visita de retorno");
    const without = schoolFollowupReport({ ...expanded, updates: snapshot.updates }, "s1");
    expect(String(event(without)?.[d(without)])).not.toContain("Visita associada:");
  });
  it("recusa pedido para visita de outra escola ou não disponível", () => {
    expect(() => visitFollowupReport(snapshot, "outra-escola", "visit-v2")).toThrow("não está disponível");
    expect(() => visitFollowupReport(snapshot, "s1", "id-desconhecido")).toThrow("não está disponível");
  });
  it("usa a neutralização do motor para fórmulas fornecidas pelo usuário", () => {
    const r = schoolFollowupReport(snapshot, "s1");
    const csv = toCsv(r, { headerLines: [], title: "Ficha da escola" });
    expect(csv).toContain("'=1+2");
  });
  it("não inventa evolução nem conclusão quando não houve atualização", () => {
    const r = schoolFollowupReport({ ...snapshot, updates: [] }, "s1");
    const idx = r.columns.findIndex((c) => c.id === "situation");
    const typeIdx = r.columns.findIndex((c) => c.id === "event_type");
    expect(r.rows.find((x) => x[typeIdx] === "Medida proposta")?.[idx]).toBe("sem atualização");
  });
});
