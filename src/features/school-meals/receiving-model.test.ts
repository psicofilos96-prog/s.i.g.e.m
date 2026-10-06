import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bucketOf, inventoryEntry, supplierFacts, validateReceipt, NONCONFORMITY_FLOW, type DeliveryRow } from "./receiving-model";

const sql = readFileSync("drizzle/migrations/0184_nae3_meal_delivery_receiving_nonconformity.sql", "utf8");
const row = (o: Partial<DeliveryRow>): DeliveryRow => ({
  schedule_logical_id: "s", action: "programacao", school_id: "e1", competence: "2027-03", item_ref: "i", unidade_ref: "u", contrato_ref: "c1",
  quantity: 10, expected_on: "2027-03-10", receipt_logical_id: null, receipt_version: null, receipt_status: null, received_at: null,
  delivered_qty: null, accepted_qty: null, rejected_qty: null, pending_qty: 10, late: false, open_nonconformities: 0, expected_brand: null, ...o,
});

describe("NAE.3 recebimento", () => {
  it("aceite 7 de 10 lança exatamente 7; rejeitado 3 não entra", () => {
    expect(validateReceipt({ delivered: 10, accepted: 7, rejected: 3, checklist: {} }, null)).toEqual([]);
    expect(inventoryEntry("confirmado", 7)).toBe(7);
  });
  it("rascunho não lança estoque", () => expect(inventoryEntry("rascunho", 7)).toBe(0));
  it("aceito + rejeitado deve igualar entregue", () => expect(validateReceipt({ delivered: 10, accepted: 7, rejected: 2, checklist: {} }, null).length).toBe(1));
  it("temperatura só é exigida quando o checklist homologado exige", () => {
    expect(validateReceipt({ delivered: 1, accepted: 1, rejected: 0, checklist: {} }, null)).toEqual([]);
    expect(validateReceipt({ delivered: 1, accepted: 1, rejected: 0, checklist: {} }, [{ id: "temperatura", rotulo: "Temperatura", obrigatorio: true }]).length).toBe(1);
  });
  it("atraso é relativo à data de referência explícita", () => {
    expect(bucketOf(row({}), "2027-03-11")).toBe("atrasadas");
    expect(bucketOf(row({}), "2027-03-10")).toBe("hoje");
    expect(bucketOf(row({ receipt_status: "confirmado" }), "2027-04-01")).toBe("recebidas");
  });
  it("fatos de fornecedor: parcial e saldo, sem nota", () => {
    const f = supplierFacts([row({ receipt_status: "confirmado", received_at: "2027-03-10T12:00:00Z", accepted_qty: 7, rejected_qty: 3, pending_qty: 3 }), row({ schedule_logical_id: "s2" })], "2027-03-20")[0]!;
    expect(f).toMatchObject({ scheduled: 2, onTime: 1, late: 1, partial: 1, rejectedQty: 3, pendingQty: 13 });
    expect(Object.keys(f)).not.toContain("score");
  });
  it("não conformidade encerrada não transita", () => expect(NONCONFORMITY_FLOW.encerrada).toEqual([]));
});

describe("NAE.3 invariantes do banco", () => {
  it("entrada de estoque ligada ao recebimento por chave única (idempotência)", () => expect(sql).toMatch(/UNIQUE INDEX meal_inventory_movements_source_receipt_uq/));
  it("data do movimento é a data real do aceite, não CURRENT_DATE", () => {
    expect(sql).toMatch(/d := \(_received_at AT TIME ZONE _tz\)::date/);
    const writer = sql.slice(sql.indexOf("FUNCTION public.record_meal_receipt"), sql.indexOf("FUNCTION public.record_meal_nonconformity"));
    expect(writer).not.toMatch(/CURRENT_DATE/);
  });
  it("só aceito > 0 gera entrada; recebimento só por conferir-recebimento", () => {
    expect(sql).toMatch(/IF _accepted > 0 THEN/);
    expect(sql).toMatch(/meal_grant_on\('conferir-recebimento-alimentar', sch\.school_id, d\)/);
  });
  it("documento fiscal não toca estoque", () => {
    const w = sql.slice(sql.indexOf("FUNCTION public.record_meal_fiscal_document"), sql.indexOf("FUNCTION public.record_meal_receipt"));
    expect(w).not.toMatch(/meal_inventory_movements/);
  });
  it("evidência de não conformidade é acumulada, nunca removida", () => expect(sql).toMatch(/_evidence := head\.evidence_refs \|\|/));
  it("programação exige pedido autorizado e não excede autorizado", () => {
    expect(sql).toMatch(/meal:order-not-authorized/);
    expect(sql).toMatch(/meal:schedule-exceeds-authorized/);
  });
});
