/**
 * Alimentação Lote 02 — painel rede/escola e ficha operacional (projeção pura).
 * Fontes já existentes: matrícula/enturmação canônicas, calendário aplicável resolvido,
 * meal_kitchens/meal_kitchen_school_links, meal_reporting_summary, meal_stock_lines,
 * meal_delivery_schedule, meal_execution. Nada aqui grava nem cria escola/cozinha.
 * Toda célula diz se é zero lido, não registrado, estimado (previsão declarada) ou confirmado.
 */
export type Nature = "confirmado" | "estimado" | "zero" | "nao-registrado" | "sem-permissao";
export interface Cell { nature: Nature; value: number | null; source: string; asOf: string | null; reason?: string }

export function cell(value: number | null | undefined, source: string, asOf: string | null, opts: { estimated?: boolean; denied?: boolean } = {}): Cell {
  if (opts.denied) return { nature: "sem-permissao", value: null, source, asOf, reason: "leitura negada" };
  if (value == null) return { nature: "nao-registrado", value: null, source, asOf, reason: "fonte sem registro" };
  if (value === 0) return { nature: "zero", value: 0, source, asOf };
  return { nature: opts.estimated ? "estimado" : "confirmado", value, source, asOf };
}

// ---------- Atendimento por etapa/modalidade/jornada ----------
export interface AttendRow { schoolId: string; stage: string | null; modality: string | null; journey: string | null; enrolled: number | null }
export function attendance(rows: AttendRow[], schools: string[], by: "stage" | "modality" | "journey", asOf: string) {
  const ok = new Set(schools); const m = new Map<string, AttendRow[]>();
  for (const r of rows.filter((x) => ok.has(x.schoolId))) { const k = r[by] ?? "não declarado"; m.set(k, [...(m.get(k) ?? []), r]); }
  return [...m].map(([key, l]) => ({ key, enrolled: cell(l.some((r) => r.enrolled == null) ? null : l.reduce((a, r) => a + r.enrolled!, 0), "matrícula canônica", asOf) }));
}

// ---------- Estimadas × servidas ----------
export function estimatedVsServed(forecast: number | null, served: number | null, schoolDays: number | null, asOf: string) {
  return {
    estimated: cell(forecast, "meal_forecasts (previsão declarada)", asOf, { estimated: true }),
    served: cell(served, "meal_execution (confirmado pela cozinha)", asOf),
    days: schoolDays == null ? cell(null, "calendário aplicável", asOf) : cell(schoolDays, "calendário aplicável", asOf),
    difference: forecast != null && served != null ? served - forecast : null,
  };
}

// ---------- Alertas com fonte e data ----------
export interface StockLine { itemId: string; label: string; balance: number | null; minimum: number | null; lotExpiry: string | null }
export interface Delivery { id: string; plannedOn: string; received: boolean | null }
export interface Alert { kind: "estoque-critico" | "validade-proxima" | "validade-vencida" | "entrega-atrasada" | "perda-registrada" | "cardapio-nao-publicado"; ref: string; text: string; source: string; asOf: string }

export function alerts(input: { stock: StockLine[]; deliveries: Delivery[]; losses: { id: string; qty: number; on: string }[]; menuPublished: boolean | null; expiryWindowDays: number | null }, today: string): { alerts: Alert[]; unverifiable: string[] } {
  const out: Alert[] = []; const nv: string[] = [];
  for (const s of input.stock) {
    if (s.minimum == null) nv.push(`mínimo não configurado: ${s.label}`);
    else if (s.balance == null) nv.push(`saldo indeterminado: ${s.label}`);
    else if (s.balance < s.minimum) out.push({ kind: "estoque-critico", ref: s.itemId, text: `${s.label}: saldo ${s.balance} abaixo do mínimo ${s.minimum}`, source: "meal_stock_lines + política homologada", asOf: today });
    if (s.lotExpiry) {
      if (s.lotExpiry < today) out.push({ kind: "validade-vencida", ref: s.itemId, text: `${s.label}: lote vencido em ${s.lotExpiry}`, source: "meal_inventory_movements (lote)", asOf: today });
      else if (input.expiryWindowDays != null) {
        const lim = new Date(Date.parse(today) + input.expiryWindowDays * 864e5).toISOString().slice(0, 10);
        if (s.lotExpiry <= lim) out.push({ kind: "validade-proxima", ref: s.itemId, text: `${s.label}: vence em ${s.lotExpiry}`, source: "meal_inventory_movements (lote)", asOf: today });
      }
    }
  }
  if (input.expiryWindowDays == null && input.stock.some((s) => s.lotExpiry)) nv.push("janela de validade próxima não configurada");
  for (const d of input.deliveries) {
    if (d.received === null) nv.push(`recebimento não lido: ${d.id}`);
    else if (!d.received && d.plannedOn < today) out.push({ kind: "entrega-atrasada", ref: d.id, text: `entrega prevista em ${d.plannedOn} sem recebimento confirmado`, source: "programação × recebimento", asOf: today });
  }
  for (const l of input.losses) out.push({ kind: "perda-registrada", ref: l.id, text: `perda de ${l.qty} registrada em ${l.on}`, source: "meal_inventory_movements (perda)", asOf: l.on });
  if (input.menuPublished === false) out.push({ kind: "cardapio-nao-publicado", ref: "cardapio", text: "cardápio vigente sem publicação", source: "meal_menu_publications", asOf: today });
  if (input.menuPublished === null) nv.push("publicação do cardápio não lida");
  return { alerts: out, unverifiable: nv };
}

// ---------- Ficha operacional da escola ----------
export interface KitchenLink { kitchenId: string; kitchenName: string; kind: "propria" | "centralizada" | null; from: string; to: string | null }
export function operationalSheet(schoolId: string, links: KitchenLink[], on: string, extra: { equipment: string[] | null; staff: { role: string; count: number | null }[] | null; shifts: string[] | null }) {
  const live = links.filter((l) => l.from <= on && (l.to == null || on <= l.to));
  return {
    schoolId, // identidade só do cadastro canônico; nenhuma cópia
    kitchen: live.length === 1 ? live[0]! : null,
    kitchenState: live.length === 0 ? "sem unidade de preparo vigente" : live.length > 1 ? "mais de uma unidade vigente (verificar)" : null,
    kitchenKind: live[0]?.kind ?? null,
    equipment: extra.equipment ?? "não registrado",
    staff: extra.staff ?? "não registrado",
    shifts: extra.shifts ?? "não registrado",
    history: [...links].sort((a, b) => a.from.localeCompare(b.from)),
  };
}
