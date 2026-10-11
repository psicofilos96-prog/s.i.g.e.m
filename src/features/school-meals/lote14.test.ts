import { describe, expect, it } from "vitest";
import { MISSING, purchaseMapRows, MAPA_COMPRAS } from "./purchase-map";
import { buildMasterPayload, masterActions } from "./master-form-model";
import { consolidate } from "./order-model";
import { runReport } from "@/features/reports/report-engine";

const n = (id: string, payload: Record<string, unknown>) => ({ logical_id: id, payload });
const ctx = {
  items: [n("i1", { nome: "Arroz" }), n("i2", { nome: "Feijão" })],
  units: [n("u1", { nome: "Quilograma", simbolo: "kg" })],
  contracts: [n("c1", { natureza: "contrato", numero: "12/2026", fornecedor_ref: "f1", empenho: "2026NE0001" })],
  suppliers: [n("f1", { nome: "Fornecedor Sintético" })],
  schools: new Map([["s1", "Escola A"]]),
};

describe("mapa de compras", () => {
  it("agrupa por fornecedor/contrato/empenho quando a referência existe", () => {
    const [r] = purchaseMapRows([{ item_ref: "i1", unidade_ref: "u1", apresentacao_ref: null, contrato_ref: "c1", total: 30, by_school: { s1: 30 } }], ctx);
    expect(r).toMatchObject({ supplier: "Fornecedor Sintético", contract: "contrato 12/2026", commitment: "2026NE0001", item: "Arroz", unit: "kg", total: 30, destinations: "Escola A: 30" });
  });
  it("sem referência contratual: fornecedor, contrato e empenho ficam 'não informado', nunca inventados", () => {
    const [r] = purchaseMapRows([{ item_ref: "i2", unidade_ref: "u1", apresentacao_ref: null, contrato_ref: null, total: 5, by_school: { s1: 5 } }], ctx);
    expect([r!.supplier, r!.contract, r!.commitment]).toEqual([MISSING, MISSING, MISSING]);
  });
  it("só pedidos autorizados entram na consolidação", () => {
    const line = { item_ref: "i1", unidade_ref: "u1", quantidade: 10 };
    const out = consolidate([
      { id: "a", school: "s1", status: "autorizado-total", lines: [line] },
      { id: "b", school: "s1", status: "submetido", lines: [line] },
      { id: "c", school: "s1", status: "rejeitado", lines: [line] },
    ] as never);
    expect(out).toHaveLength(1); expect(out[0]!.total).toBe(10);
  });
  it("relatório roda pelo report-engine com as colunas declaradas", () => {
    const res = runReport(MAPA_COMPRAS, { params: { competence: "2026-11" } }, purchaseMapRows([], ctx));
    expect(res.rows).toHaveLength(0);
  });
});

describe("formulário de cadastro técnico", () => {
  it("designação de inspetor exige identificador válido de pessoa", () => {
    expect(buildMasterPayload("designacao-inspetor", { pessoa_id: "x" })).toHaveProperty("error");
    expect(buildMasterPayload("designacao-inspetor", { pessoa_id: "6f1c2a1e-1111-4222-8333-944455556666" })).toEqual({ payload: { pessoa_id: "6f1c2a1e-1111-4222-8333-944455556666" } });
  });
  it("contrato exige natureza, número e fornecedor; empenho opcional é omitido quando vazio", () => {
    expect(buildMasterPayload("referencia-contratual", { natureza: "ata", numero: "1" })).toHaveProperty("error");
    expect(buildMasterPayload("referencia-contratual", { natureza: "ata", numero: "1", fornecedor_ref: "6f1c2a1e-1111-4222-8333-944455556666", empenho: " " }))
      .toEqual({ payload: { natureza: "ata", numero: "1", fornecedor_ref: "6f1c2a1e-1111-4222-8333-944455556666" } });
  });
  it("rascunho → conferência → homologação; retirado não tem ação", () => {
    expect(masterActions("rascunho")).toContain("conferencia");
    expect(masterActions("conferida")).toContain("homologacao");
    expect(masterActions("rascunho")).not.toContain("homologacao");
    expect(masterActions("retirada")).toEqual([]);
  });
});
