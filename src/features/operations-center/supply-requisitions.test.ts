import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canReq, forecast, FORECAST_WRITES, lineStatus, reqState, stockAlerts, type ReqEvent } from "./supply-requisitions";

const SQL = readFileSync("drizzle/migrations/0422_ops15_supply_requisitions.sql", "utf8");
const R = { requesterPerson: "req", requested: { papel: 10 }, events: [] as ReqEvent[] };

describe("Centro de Operações L15 — requisições", () => {
  it("fluxo completo com atendimento parcial", () => {
    expect(canReq(R, "autorizacao", "req", { lines: { papel: 5 } }).ok).toBe(false);
    expect(canReq(R, "autorizacao", "dir", { lines: { papel: 12 } }).ok).toBe(false);
    R.events.push({ seq: 1, kind: "autorizacao", actorPerson: "dir", lines: { papel: 8 } });
    expect(canReq(R, "separacao", "alm", { lines: { papel: 9 } }).ok).toBe(false);
    R.events.push({ seq: 2, kind: "separacao", actorPerson: "alm", lines: { papel: 5 } }, { seq: 3, kind: "expedicao", actorPerson: "alm", lines: { papel: 5 } });
    expect(canReq(R, "recebimento", "alm", { hasDoc: true, lines: { papel: 5 } }).ok).toBe(false);
    expect(canReq(R, "recebimento", "esc", { hasDoc: true, lines: { papel: 6 } }).ok).toBe(false);
    R.events.push({ seq: 4, kind: "recebimento", actorPerson: "esc", lines: { papel: 4 } });
    expect(reqState(R.events)).toBe("autorizada");
    expect(lineStatus(R.requested, R.events)[0]).toMatchObject({ authorized: 8, shipped: 5, received: 4, pendingShipment: 3, divergence: 1, attendance: "parcial" });
    expect(canReq(R, "encerramento", "dir").ok).toBe(false);
    expect(canReq(R, "encerramento", "dir", { note: "Sem saldo para o restante" }).ok).toBe(true);
  });
  it("mínimo, alertas e previsão sem compra", () => {
    expect(forecast(30, 0, 30)).toEqual({ daily: null, coverageDays: null });
    expect(forecast(30, 60, 30)).toEqual({ daily: 2, coverageDays: 15 });
    expect(stockAlerts([{ itemKey: "papel", balance: 5, approvedMin: 10, coverageDays: 3, leadDays: 7 }, { itemKey: "giz", balance: 1, approvedMin: null, coverageDays: null, leadDays: null }]).map((a) => a.kind))
      .toEqual(["abaixo-do-minimo", "ruptura-prevista", "sem-minimo-aprovado"]);
    expect(FORECAST_WRITES).toEqual([]);
  });
  it("banco: recusas, movimentos reais na expedição/recebimento, sem compra", () => {
    for (const r of ["opsreq:self-authorization", "opsreq:above-requested", "opsreq:above-authorized", "opsreq:above-shipped", "opsreq:self-receipt", "opsreq:receipt-doc-required", "opsreq:partial-requires-justification", "opsmin:self-approval"]) expect(SQL).toContain(r);
    expect(SQL).toMatch(/ops_supply_insert\(_q\.supplier_warehouse[^;]*'saida'/);
    expect(SQL).not.toMatch(/purchase|compra_|empenho/i);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
