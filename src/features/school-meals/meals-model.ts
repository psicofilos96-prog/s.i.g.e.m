/**
 * Alimentação Escolar — projeções puras. Sem regra nutricional, PNAE, estoque ou compra.
 * Previsão é fato declarado (com base escrita), nunca calculado aqui; execução é fato próprio.
 * Ausência de registro = null ("não informado"), nunca zero.
 */

export type MenuEntry = Readonly<{ date: string; slot: string; preparations: readonly string[] }>;
export type Menu = Readonly<{ id: string; logical_id: string; version: number; event_kind: string; school_id: string; service_group_value_id: string | null; starts_on: string; ends_on: string; entries: readonly MenuEntry[]; reason: string | null; recorded_at: string }>;
export type Forecast = Readonly<{ id: string; logical_id: string; version: number; event_kind: string; served_on: string; meal_slot_value_id: string; forecast_count: number; basis: string }>;
export type Service = Readonly<{ id: string; logical_id: string; version: number; event_kind: string; served_on: string; meal_slot_value_id: string; offered_count: number | null; served_count: number | null; source_note: string | null }>;
export type DayKind = "letivo" | "nao-letivo" | "indeterminado";

const live = <T extends { event_kind: string }>(xs: readonly T[]) => xs.filter((x) => x.event_kind !== "revogacao");

export type DayRow = Readonly<{
  date: string; slot: string; planned: readonly string[] | null; forecast: number | null; offered: number | null; served: number | null;
  difference: number | null; calendar: DayKind | null; divergence: string | null;
}>;

/** Previsto × executado por dia/refeição. Diferença só quando os dois lados existem. */
export function compare(menus: readonly Menu[], forecasts: readonly Forecast[], services: readonly Service[], calendar: ReadonlyMap<string, DayKind> | null): DayRow[] {
  const keys = new Map<string, { date: string; slot: string }>();
  const k = (d: string, s: string) => `${d}|${s}`;
  const plan = new Map<string, string[]>();
  for (const m of live(menus)) for (const e of m.entries) { keys.set(k(e.date, e.slot), { date: e.date, slot: e.slot }); plan.set(k(e.date, e.slot), [...e.preparations]); }
  const fc = new Map(live(forecasts).map((f) => [k(f.served_on, f.meal_slot_value_id), f.forecast_count]));
  const sv = new Map(live(services).map((s) => [k(s.served_on, s.meal_slot_value_id), s]));
  for (const f of live(forecasts)) keys.set(k(f.served_on, f.meal_slot_value_id), { date: f.served_on, slot: f.meal_slot_value_id });
  for (const s of live(services)) keys.set(k(s.served_on, s.meal_slot_value_id), { date: s.served_on, slot: s.meal_slot_value_id });
  return [...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, { date, slot }]) => {
    const s = sv.get(key); const forecast = fc.get(key) ?? null; const served = s?.served_count ?? null;
    const cal = calendar ? calendar.get(date) ?? "indeterminado" : null;
    const divergence = cal === "nao-letivo" && plan.has(key) ? "Cardápio previsto em dia não letivo do calendário aplicável"
      : !plan.has(key) && s ? "Refeição registrada sem cardápio para o dia" : null;
    return { date, slot, planned: plan.get(key) ?? null, forecast, offered: s?.offered_count ?? null, served,
      difference: forecast !== null && served !== null ? served - forecast : null, calendar: cal, divergence };
  });
}

/** Cobertura do período: dias com cardápio / execução informada. Sem cardápio ⇒ null, nunca 0%. */
export function coverage(rows: readonly DayRow[]) {
  const planned = rows.filter((r) => r.planned);
  if (planned.length === 0) return { plannedSlots: null, withService: null, ratio: null } as const;
  const withService = planned.filter((r) => r.served !== null || r.offered !== null).length;
  return { plannedSlots: planned.length, withService, ratio: withService / planned.length } as const;
}

export const shown = (v: number | null) => (v === null ? "não informado" : String(v));

export function mealMessage(raw: string): string {
  if (raw.includes("ceiling-ack-required")) return "Autorizar sem teto calculado exige registrar a ciência (mínimo de 10 caracteres).";
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (raw.includes("capability:consultar-restricao-alimentar")) return "Restrições alimentares exigem permissão própria nesta escola.";
  if (raw.includes("capability:")) return "Sua atuação não tem permissão para esta ação nesta escola.";
  if (raw.includes("value-not-homologated")) return "Use apenas valores aprovados nos catálogos de alimentação.";
  if (raw.includes("entry-date-outside-period")) return "Há dia do cardápio fora do período informado.";
  if (raw.includes("preparations-required") || raw.includes("entries-required")) return "Informe ao menos um dia com refeição e preparação.";
  if (raw.includes("duplicate-use-rectification")) return "Já existe registro para este dia e refeição. Use Corrigir.";
  if (raw.includes("base-superseded")) return "Este registro já foi atualizado. Recarregue.";
  if (raw.includes("service-in-future")) return "Não é possível registrar refeição servida em data futura.";
  if (raw.includes("student-not-in-school")) return "Estudante sem matrícula nesta escola.";
  if (raw.includes("check constraint")) return "Preencha os campos obrigatórios (e o motivo, em correções).";
  return "Não foi possível concluir. Tente novamente.";
}
