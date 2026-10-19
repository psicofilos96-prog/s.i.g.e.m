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
export function distributionMapRows(cons: ConsRow[], ctx: { items: Named[]; units: Named[]; contracts: Named[]; suppliers: Named[]; schools: Map<string, string>; prices?: Named[] }): Record<string, CellValue>[] {
  const find = (l: Named[], id: string | null) => (id ? l.find((x) => x.logical_id === id) : undefined);
  const out: Record<string, CellValue>[] = [];
  for (const c of cons) {
    const ct = find(ctx.contracts, c.contrato_ref);
    const sup = find(ctx.suppliers, txt(ct?.payload["fornecedor_ref"]));
    const prices = ct?.payload["precos"] as Record<string, unknown> | undefined;
    const homologated = (ctx.prices ?? []).find((x) => x.payload["contrato_ref"] === c.contrato_ref && x.payload["item_ref"] === c.item_ref)?.payload["preco_unitario"];
    const p = typeof homologated === "number" && Number.isFinite(homologated) ? homologated : prices && typeof prices[c.item_ref] === "number" && Number.isFinite(prices[c.item_ref]) ? (prices[c.item_ref] as number) : null;
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
  return out.sort((a, b) => String(a["supplier"]).localeCompare(String(b["supplier"]), "pt-BR") || String(a["school"]).localeCompare(String(b["school"]), "pt-BR") || String(a["item"]).localeCompare(String(b["item"]), "pt-BR"));
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

/** Linha programada de entrega (subconjunto de meal_deliveries_at). */
export interface ScheduledDelivery { school_id: string; item_ref: string; unidade_ref: string; contrato_ref: string | null; quantity: number; expected_on: string; action?: string }

/**
 * Mapa por entrega: numera 1ª, 2ª, … entrega por escola × item × contrato pela data programada.
 * Usa só programações registradas; nada é dividido ou presumido (sem programação, não há linha).
 */
export function deliveryWaveRows(ds: ScheduledDelivery[], ctx: { items: Named[]; units: Named[]; contracts: Named[]; suppliers: Named[]; schools: Map<string, string> }): Record<string, CellValue>[] {
  const find = (l: Named[], id: string | null) => (id ? l.find((x) => x.logical_id === id) : undefined);
  const live = ds.filter((d) => d.action !== "cancelamento");
  const groups = new Map<string, ScheduledDelivery[]>();
  for (const d of live) { const k = `${d.school_id}|${d.item_ref}|${d.contrato_ref ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), d]); }
  const out: Record<string, CellValue>[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.expected_on.localeCompare(b.expected_on));
    g.forEach((d, i) => {
      const ct = find(ctx.contracts, d.contrato_ref);
      const sup = find(ctx.suppliers, txt(ct?.payload["fornecedor_ref"]));
      const qty = Number(d.quantity);
      out.push({
        supplier: txt(sup?.payload["nome"]) ?? MISSING,
        contract: ct ? `${txt(ct.payload["natureza"]) ?? ""} ${txt(ct.payload["numero"]) ?? ""}`.trim() || MISSING : MISSING,
        wave: `${i + 1}ª entrega`, date: d.expected_on.split("-").reverse().join("/"),
        school: ctx.schools.get(d.school_id) ?? d.school_id,
        item: txt(find(ctx.items, d.item_ref)?.payload["nome"]) ?? "item não identificado",
        unit: txt(find(ctx.units, d.unidade_ref)?.payload["simbolo"]) ?? txt(find(ctx.units, d.unidade_ref)?.payload["nome"]) ?? "unidade não identificada",
        quantity: Number.isFinite(qty) ? qty : null,
      });
    });
  }
  return out.sort((a, b) => String(a["supplier"]).localeCompare(String(b["supplier"]), "pt-BR") || String(a["wave"]).localeCompare(String(b["wave"]), "pt-BR", { numeric: true }) || String(a["school"]).localeCompare(String(b["school"]), "pt-BR") || String(a["item"]).localeCompare(String(b["item"]), "pt-BR"));
}

export const MAPA_ENTREGAS: ReportDefinition = {
  id: "mapa-entregas-fornecedor", version: 1, title: "Mapa de entregas por fornecedor — 1ª, 2ª… entrega",
  description: "Somente entregas programadas registradas, numeradas pela data prevista por escola e item. Não é ordem de compra nem empenho.",
  source: "meal_deliveries_at", params: [{ id: "competence", label: "Competência (AAAA-MM)", type: "text", required: true, maxLength: 7 }],
  columns: [
    { id: "supplier", label: "Fornecedor", kind: "text" }, { id: "contract", label: "Contrato/ata", kind: "text" },
    { id: "wave", label: "Entrega", kind: "text" }, { id: "date", label: "Data prevista", kind: "text" },
    { id: "school", label: "Escola", kind: "text" }, { id: "item", label: "Item", kind: "text" },
    { id: "unit", label: "Unidade", kind: "text" }, { id: "quantity", label: "Quantidade", kind: "number" },
  ],
  formats: ["xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};

/**
 * Saldo por contrato × item: quantidade contratada só quando o preço homologado a traz; programado = soma das
 * entregas programadas não canceladas no período lido. Sem quantidade contratada o saldo é "não informado", nunca zero.
 */
export function contractBalanceRows(prices: Named[], ds: ScheduledDelivery[], ctx: { items: Named[]; contracts: Named[]; suppliers: Named[] }): Record<string, CellValue>[] {
  const find = (l: Named[], id: string | null) => (id ? l.find((x) => x.logical_id === id) : undefined);
  return prices.map((p) => {
    const cref = txt(p.payload["contrato_ref"]), iref = txt(p.payload["item_ref"]);
    const ct = find(ctx.contracts, cref); const sup = find(ctx.suppliers, txt(ct?.payload["fornecedor_ref"]));
    const q = p.payload["quantidade_contratada"]; const contracted = typeof q === "number" && Number.isFinite(q) ? q : null;
    const scheduled = ds.filter((d) => d.action !== "cancelamento" && d.contrato_ref === cref && d.item_ref === iref).reduce((s, d) => s + (Number.isFinite(Number(d.quantity)) ? Number(d.quantity) : 0), 0);
    return {
      supplier: txt(sup?.payload["nome"]) ?? MISSING,
      contract: ct ? `${txt(ct.payload["natureza"]) ?? ""} ${txt(ct.payload["numero"]) ?? ""}`.trim() || MISSING : MISSING,
      commitment: txt(ct?.payload["empenho"]) ?? MISSING,
      item: txt(find(ctx.items, iref)?.payload["nome"]) ?? "item não identificado",
      contracted, scheduled, balance: contracted == null ? null : Math.round((contracted - scheduled) * 1000) / 1000,
      status: contracted == null ? "quantidade contratada não informada" : contracted - scheduled < 0 ? "programado acima do contratado" : "dentro do contratado",
    } satisfies Record<string, CellValue>;
  }).sort((a, b) => a.supplier.localeCompare(b.supplier, "pt-BR") || a.contract.localeCompare(b.contract, "pt-BR") || a.item.localeCompare(b.item, "pt-BR"));
}

export const SALDO_CONTRATOS: ReportDefinition = {
  id: "saldo-contratos-alimentacao", version: 1, title: "Saldo dos contratos — alimentação escolar",
  description: "Quantidade contratada (do preço homologado) menos entregas programadas não canceladas no ano. Sem quantidade contratada, saldo não informado. Não substitui o controle financeiro do empenho.",
  source: "meal_deliveries_at", params: [{ id: "competence", label: "Competência (AAAA-MM)", type: "text", required: true, maxLength: 7 }],
  columns: [
    { id: "supplier", label: "Fornecedor", kind: "text" }, { id: "contract", label: "Contrato/ata", kind: "text" },
    { id: "commitment", label: "Empenho", kind: "text" }, { id: "item", label: "Item", kind: "text" },
    { id: "contracted", label: "Contratado", kind: "number" }, { id: "scheduled", label: "Programado no ano", kind: "number" },
    { id: "balance", label: "Saldo", kind: "number" }, { id: "status", label: "Situação", kind: "text" },
  ],
  formats: ["xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
