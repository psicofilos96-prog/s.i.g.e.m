// LOTE 14 — Mapa de compras: só sobre meal_demand_consolidation_at (versões autorizadas vigentes).
// Agrupa por fornecedor/contrato/empenho quando a referência contratual homologada os traz; ausência fica explícita.
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export const MISSING = "não informado";
export interface ConsRow { item_ref: string; unidade_ref: string; apresentacao_ref: string | null; contrato_ref: string | null; total: number; by_school: Record<string, number> }
export interface Named { logical_id: string; payload: Record<string, unknown> }

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function purchaseMapRows(cons: ConsRow[], ctx: { items: Named[]; units: Named[]; contracts: Named[]; suppliers: Named[]; schools: Map<string, string> }): Record<string, CellValue>[] {
  const find = (l: Named[], id: string | null) => (id ? l.find((x) => x.logical_id === id) : undefined);
  const rows = cons.map((c) => {
    const ct = find(ctx.contracts, c.contrato_ref);
    const sup = find(ctx.suppliers, txt(ct?.payload["fornecedor_ref"]));
    return {
      supplier: txt(sup?.payload["nome"]) ?? MISSING,
      contract: ct ? `${txt(ct.payload["natureza"]) ?? ""} ${txt(ct.payload["numero"]) ?? ""}`.trim() || MISSING : MISSING,
      commitment: txt(ct?.payload["empenho"]) ?? MISSING,
      item: txt(find(ctx.items, c.item_ref)?.payload["nome"]) ?? "item não identificado",
      unit: txt(find(ctx.units, c.unidade_ref)?.payload["simbolo"]) ?? txt(find(ctx.units, c.unidade_ref)?.payload["nome"]) ?? "unidade não identificada",
      total: Number.isFinite(c.total) ? c.total : null,
      destinations: Object.entries(c.by_school).map(([s, q]) => `${ctx.schools.get(s) ?? s}: ${q}`).join("; "),
    } satisfies Record<string, CellValue>;
  });
  return rows.sort((a, b) => a.supplier.localeCompare(b.supplier, "pt-BR") || a.contract.localeCompare(b.contract, "pt-BR") || a.item.localeCompare(b.item, "pt-BR"));
}

export const MAPA_COMPRAS: ReportDefinition = {
  id: "mapa-compras-alimentacao", version: 1, title: "Mapa de compras — alimentação escolar",
  description: "Somente pedidos autorizados vigentes, por fornecedor/contrato/empenho. Dado ausente aparece como não informado. Não é ordem de compra nem empenho.",
  source: "meal_demand_consolidation_at", params: [{ id: "competence", label: "Competência (AAAA-MM)", type: "text", required: true, maxLength: 7 }],
  columns: [
    { id: "supplier", label: "Fornecedor", kind: "text" }, { id: "contract", label: "Contrato/ata", kind: "text" },
    { id: "commitment", label: "Empenho", kind: "text" }, { id: "item", label: "Item", kind: "text" },
    { id: "unit", label: "Unidade", kind: "text" }, { id: "total", label: "Total autorizado", kind: "number" },
    { id: "destinations", label: "Destinos", kind: "text" },
  ],
  formats: ["xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};

/**
 * Mapa de Distribuição por Fornecedor: uma linha por escola × item, com preço unitário só quando a
 * referência contratual homologada traz `precos[item_ref]`; sem preço o valor fica "não informado", nunca zero.
 */
export function distributionMapRows(cons: ConsRow[], ctx: { items: Named[]; units: Named[]; contracts: Named[]; suppliers: Named[]; schools: Map<string, string> }): Record<string, CellValue>[] {
  const find = (l: Named[], id: string | null) => (id ? l.find((x) => x.logical_id === id) : undefined);
  const out: Record<string, CellValue>[] = [];
  for (const c of cons) {
    const ct = find(ctx.contracts, c.contrato_ref);
    const sup = find(ctx.suppliers, txt(ct?.payload["fornecedor_ref"]));
    const prices = ct?.payload["precos"] as Record<string, unknown> | undefined;
    const p = prices && typeof prices[c.item_ref] === "number" && Number.isFinite(prices[c.item_ref]) ? (prices[c.item_ref] as number) : null;
    const item = txt(find(ctx.items, c.item_ref)?.payload["nome"]) ?? "item não identificado";
    const unit = txt(find(ctx.units, c.unidade_ref)?.payload["simbolo"]) ?? txt(find(ctx.units, c.unidade_ref)?.payload["nome"]) ?? "unidade não identificada";
    for (const [s, q] of Object.entries(c.by_school)) {
      const qty = Number(q);
      out.push({
        supplier: txt(sup?.payload["nome"]) ?? MISSING,
        contract: ct ? `${txt(ct.payload["natureza"]) ?? ""} ${txt(ct.payload["numero"]) ?? ""}`.trim() || MISSING : MISSING,
        commitment: txt(ct?.payload["empenho"]) ?? MISSING,
        school: ctx.schools.get(s) ?? s, item, unit,
        quantity: Number.isFinite(qty) ? qty : null,
        price: p, value: p != null && Number.isFinite(qty) ? Math.round(p * qty * 100) / 100 : null,
      });
    }
  }
  return out.sort((a, b) => String(a.supplier).localeCompare(String(b.supplier), "pt-BR") || String(a.school).localeCompare(String(b.school), "pt-BR") || String(a.item).localeCompare(String(b.item), "pt-BR"));
}

/** Total por fornecedor só soma linhas com valor; se alguma não tem preço, o total é marcado incompleto. */
export function distributionTotals(rows: Record<string, CellValue>[]): { supplier: string; total: number; complete: boolean }[] {
  const m = new Map<string, { total: number; complete: boolean }>();
  for (const r of rows) {
    const k = String(r["supplier"]); const t = m.get(k) ?? { total: 0, complete: true };
    if (typeof r["value"] === "number") t.total = Math.round((t.total + r["value"]) * 100) / 100; else t.complete = false;
    m.set(k, t);
  }
  return [...m].map(([supplier, t]) => ({ supplier, ...t }));
}

export const MAPA_DISTRIBUICAO: ReportDefinition = {
  id: "mapa-distribuicao-fornecedor", version: 1, title: "Mapa de distribuição por fornecedor — alimentação escolar",
  description: "Escolas × itens dos pedidos autorizados vigentes, com preço do contrato homologado. Sem preço, o valor é não informado. Não é ordem de compra nem empenho.",
  source: "meal_demand_consolidation_at", params: [{ id: "competence", label: "Competência (AAAA-MM)", type: "text", required: true, maxLength: 7 }],
  columns: [
    { id: "supplier", label: "Fornecedor", kind: "text" }, { id: "contract", label: "Contrato/ata", kind: "text" },
    { id: "commitment", label: "Empenho", kind: "text" }, { id: "school", label: "Escola", kind: "text" },
    { id: "item", label: "Item", kind: "text" }, { id: "unit", label: "Unidade", kind: "text" },
    { id: "quantity", label: "Quantidade", kind: "number" }, { id: "price", label: "Preço unitário (R$)", kind: "number" },
    { id: "value", label: "Valor (R$)", kind: "number" },
  ],
  formats: ["xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
