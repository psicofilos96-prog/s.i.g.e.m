import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { lifeStage, lifecycleSummary, maintenanceHistory, LIFECYCLE_SOURCES } from "./equipment-lifecycle";

const ord = (id: string, closedAt: string | null, preventive = false) => ({ id, openedAt: "2026-03-01", closedAt, state: closedAt ? "concluida" : "execucao", preventive });

describe("L12 ciclo de vida técnico", () => {
  it("baixa encerra; ordem aberta = em manutenção; sem cadeia não presume", () => {
    expect(lifeStage([], [])).toBe("sem-cadeia");
    expect(lifeStage([{ seq: 1, kind: "localizacao", spaceId: "s" }], [ord("a", null)])).toBe("em-manutencao");
    expect(lifeStage([{ seq: 1, kind: "localizacao", spaceId: "s" }, { seq: 2, kind: "baixa" }], [ord("a", null)])).toBe("baixado");
    expect(lifeStage([{ seq: 1, kind: "localizacao", spaceId: "s" }], [ord("a", "2026-03-05")])).toBe("em-uso");
  });
  it("serviço não confirmado nunca conta como executado", () => {
    const s = lifecycleSummary({ orders: [ord("a", "x"), ord("b", null, true)], services: [{ id: "1", maintenanceOrderId: "a", state: "declarada", confirmedAt: null }], tickets: [], usefulLifeRule: null });
    expect(s.confirmedServices).toBe(0);
    expect(s.unconfirmedServices).toBe(1);
    expect(s.lastConfirmedService).toBeNull();
    expect(s.preventiveOrders).toBe(1);
  });
  it("sem regra de vida útil aprovada, fim de vida é indeterminado", () => {
    expect(lifecycleSummary({ orders: [], services: [], tickets: [], usefulLifeRule: { approved: false } }).endOfLife).toMatch(/indeterminado/);
  });
  it("histórico combina fontes em ordem cronológica", () => {
    const h = maintenanceHistory({ events: [{ seq: 1, kind: "localizacao", at: "2026-01-01" }], sheets: [], orders: [ord("o", null)], services: [], tickets: [{ requestId: "r", at: "2026-02-01", nature: "incidente", closedAt: null }] });
    expect(h.map((e) => e.source)).toEqual(["bem", "chamado", "manutencao"]);
  });
  it("fontes existem em migrations e nenhuma tabela paralela de manutenção de TI foi criada", () => {
    const sql = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");
    for (const t of LIFECYCLE_SOURCES) expect(sql).toMatch(new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${t}\\b`));
    expect(sql).not.toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.tech_(maintenance|equipment_history|lifecycle)/);
  });
});
