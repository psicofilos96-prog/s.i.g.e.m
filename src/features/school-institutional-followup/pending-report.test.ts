import { describe, expect, it } from "vitest";
import { FOLLOWUP_PENDING_REPORT, networkPendingReport } from "./report";
import { toCsv } from "@/features/reports/report-engine";
import type { NetworkPendingAction } from "./model";

const row: NetworkPendingAction = {
  action_id: "a1", school_id: "school-a", school_name: "Escola Centro",
  inep: null, description: "=1+2", responsible_label: null, due_on: null,
  situation: "sem atualização", last_update_on: null, created_at: "2026-11-04T12:00:00Z",
};
describe("quadro de providências autorizadas", () => {
  it("preserva ausência de prazo, responsável e evolução", () => {
    const result = networkPendingReport([row]);
    expect(result.definitionId).toBe(FOLLOWUP_PENDING_REPORT.id);
    expect(result.rows).toHaveLength(1);
    const col = (id: string) => result.columns.findIndex((c) => c.id === id);
    expect(result.rows[0]?.[col("inep")]).toBeNull();
    expect(result.rows[0]?.[col("responsible_label")]).toBeNull();
    expect(result.rows[0]?.[col("due_on")]).toBeNull();
    expect(result.rows[0]?.[col("last_update_on")]).toBeNull();
    expect(result.rows[0]?.[col("situation")]).toBe("sem atualização");
  });
  it("neutraliza fórmulas em exportação CSV e mantém texto de ausência", () => {
    const result = networkPendingReport([row]);
    const csv = toCsv(result, { headerLines: [], title: "Quadro" });
    expect(csv).toContain("'=1+2");
    expect(csv).toContain("não disponível");
  });
});
