import { describe, expect, it } from "vitest";
import { schoolFollowupReport, FOLLOWUP_SCHOOL_REPORT } from "./report";
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
