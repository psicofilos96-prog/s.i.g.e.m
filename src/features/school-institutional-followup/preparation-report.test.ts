import { describe, expect, it } from "vitest";
import { toCsv } from "@/features/reports/report-engine";
import { FOLLOWUP_PREPARATION_REPORT, preparationFollowupReport } from "./preparation-report";
import type { SchoolSnapshot } from "./model";

const snapshot: SchoolSnapshot = {
  visits: [{
    id: "v1", logical_id: "visit-1", version: 1, school_id: "s1",
    visit_date: "2026-10-01", diagnosis: "", strengths: "", weaknesses: "", summary: null,
    correction_reason: null, supersedes_id: null, created_at: "2026-10-01T15:00:00Z", author_name: "Servidor",
  }],
  visit_history: [],
  actions: [
    { id: "a1", school_id: "s1", visit_logical_id: "visit-1",
      description: "=1+2", responsible_label: "Direção", due_on: "2026-11-01",
      created_at: "2026-10-01T15:00:00Z", author_name: "Servidor" },
    { id: "a2", school_id: "s1", visit_logical_id: "visit-1",
      description: "Revisar mobiliário", responsible_label: null, due_on: null,
      created_at: "2026-10-01T15:00:00Z", author_name: "Servidor" },
    { id: "a3", school_id: "s1", visit_logical_id: "visit-1",
      description: "Medida já concluída", responsible_label: null, due_on: "2026-10-03",
      created_at: "2026-10-01T15:00:00Z", author_name: "Servidor" },
    { id: "outside", school_id: "s2", visit_logical_id: "visit-2",
      description: "Outra escola", responsible_label: null, due_on: null,
      created_at: "2026-10-01T15:00:00Z", author_name: "Servidor" },
  ],
  updates: [
    { id: "u1", action_id: "a1", visit_logical_id: null, occurred_on: "2026-11-02",
      situation: "prevista", done_text: null, not_done_text: "Material aguardado",
      results: null, referrals: null, created_at: "2026-11-02T15:00:00Z", author_name: "Servidor" },
    { id: "u2", action_id: "a1", visit_logical_id: null, occurred_on: "2026-11-03",
      situation: "em andamento", done_text: "Separadas pastas", not_done_text: null,
      results: "Iniciado", referrals: "Prosseguir", created_at: "2026-11-03T15:00:00Z", author_name: "Servidor" },
    { id: "u3", action_id: "a3", visit_logical_id: null, occurred_on: "2026-10-02",
      situation: "concluída", done_text: "Concluído", not_done_text: null,
      results: null, referrals: null, created_at: "2026-10-02T15:00:00Z", author_name: "Servidor" },
  ],
};

describe("roteiro da próxima visita a partir de snapshot autorizado", () => {
  it("inclui todas as pendentes da escola, por prazo, mas exclui conclusões e outras unidades", () => {
    const r = preparationFollowupReport(snapshot, "s1", "2026-11-04");
    expect(r.definitionId).toBe(FOLLOWUP_PREPARATION_REPORT.id);
    expect(r.rows).toHaveLength(2);
    const col = (id: string) => r.columns.findIndex((c) => c.id === id);
    expect(r.rows.map((row) => row[col("description")])).toEqual(["=1+2", "Revisar mobiliário"]);
    expect(r.rows[0]?.[col("origin")]).toBe("2026-10-01");
    expect(r.rows[0]?.[col("situation")]).toBe("em andamento");
    expect(r.rows[0]?.[col("last_update")]).toBe("2026-11-03");
    expect(String(r.rows[0]?.[col("last_notes")])).toContain("Separadas pastas");
    expect(String(r.rows[0]?.[col("last_notes")])).toContain("Encaminhamentos: Prosseguir");
    expect(String(r.rows[0]?.[col("last_notes")])).not.toContain("Material aguardado");
  });

  it("gera roteiro de foco apenas com pendências escolhidas, preservando a ordem do prazo", () => {
    const onlySecond = preparationFollowupReport(snapshot, "s1", "2026-11-04", ["a2"]);
    const c = onlySecond.columns.findIndex((v) => v.id === "description");
    expect(onlySecond.rows.map((row) => row[c])).toEqual(["Revisar mobiliário"]);
    const ordered = preparationFollowupReport(snapshot, "s1", "2026-11-04", ["a2", "a1"]);
    expect(ordered.rows.map((row) => row[c])).toEqual(["=1+2", "Revisar mobiliário"]);
    expect(preparationFollowupReport(snapshot, "s1", "2026-11-04").rows).toHaveLength(2);
  });

  it("falha fechado para seleção vazia, obsoleta, duplicada ou de outra unidade", () => {
    for (const ids of [[], ["a1", "a1"], ["a3"], ["outside"], ["missing"], ["a1", "missing"]]) {
      expect(() => preparationFollowupReport(snapshot, "s1", "2026-11-04", ids))
        .toThrow(/seleção do roteiro/);
    }
    const changed = { ...snapshot, updates: [...snapshot.updates, {
      id: "u4", action_id: "a2", visit_logical_id: null, occurred_on: "2026-11-04",
      situation: "concluída", done_text: "Concluído", not_done_text: null,
      results: null, referrals: null, created_at: "2026-11-04T15:00:00Z", author_name: "Servidor",
    }] };
    expect(() => preparationFollowupReport(changed, "s1", "2026-11-04", ["a2"]))
      .toThrow(/seleção do roteiro/);
  });

  it("preserva ausência de prazo, atualização, responsável e visita de origem", () => {
    const r = preparationFollowupReport({ ...snapshot, visits: [] }, "s1", "2026-11-04");
    const c = (id: string) => r.columns.findIndex((v) => v.id === id);
    const without = r.rows.find((row) => row[c("description")] === "Revisar mobiliário")!;
    expect(without[c("origin")]).toBeNull();
    expect(without[c("responsible")]).toBeNull();
    expect(without[c("deadline")]).toBeNull();
    expect(without[c("last_update")]).toBeNull();
    expect(without[c("last_notes")]).toBeNull();
    expect(without[c("situation")]).toBe("sem atualização");
  });

  it("não gera registros nem inventa conclusão quando só há medidas concluídas", () => {
    const data = { ...snapshot, actions: snapshot.actions.filter((a) => a.id === "a3") };
    expect(preparationFollowupReport(data, "s1", "2026-11-04").rows).toEqual([]);
  });

  it("neutraliza fórmulas CSV de descrições fornecidas pelos servidores", () => {
    const csv = toCsv(preparationFollowupReport(snapshot, "s1", "2026-11-04"),
      { headerLines: [], title: "Roteiro" });
    expect(csv).toContain("'=1+2");
    expect(csv).not.toContain("Outra escola");
    expect(csv).not.toContain("Medida já concluída");
  });
});
