/** Cardápio em ciclo de 4 semanas (Semana 1–4, segunda a sexta) por modalidade e condição, com cronograma anual de semanas.
 * Persistência: espécie `cardapio-planejado` (tipo "ciclo-4-semanas") em meal_master_records; vale só depois de homologado. */
export const MODALITIES = ["Creche < 6 meses", "Creche 7 meses a 3 anos", "Pré-escola", "Parcial", "Integral", "EJA"] as const;
export const CONDITIONS = ["Geral", "Diabetes", "Sem lactose / APLV", "Sem glúten / Celíaco"] as const;
export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;
export const CYCLE_TYPE = "ciclo-4-semanas";

export type Cell = { semana: number; dia: number; refeicao: string; preparacao: string; ingredientes: string[] };
export type WeekRange = { de: string; ate: string; semana: number };
export type CyclePayload = { competencia: string; tipo: typeof CYCLE_TYPE; modalidade: string; condicao: string; entradas: Cell[]; cronograma: WeekRange[] };

/** Semana do ciclo para a data, só pelo cronograma declarado; fora dele = null (nunca presumida). */
export function weekOf(cronograma: WeekRange[], date: string): number | null {
  return cronograma.find((r) => r.de <= date && date <= r.ate)?.semana ?? null;
}
/** 0 = segunda … 4 = sexta; fim de semana = null. */
export function weekdayIndex(date: string): number | null {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5 ? d - 1 : null;
}
export function menuOfDay(p: CyclePayload, date: string): { semana: number; cells: Cell[] } | null {
  const w = weekOf(p.cronograma, date); const i = weekdayIndex(date);
  if (w == null || i == null) return null;
  return { semana: w, cells: p.entradas.filter((c) => c.semana === w && c.dia === i && c.preparacao.trim()) };
}
export const splitIngredients = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

export function cycleProblems(p: CyclePayload): string[] {
  const out: string[] = [];
  if (!p.modalidade) out.push("Escolha a modalidade.");
  if (!p.condicao) out.push("Escolha a condição.");
  if (!p.entradas.some((c) => c.preparacao.trim())) out.push("Preencha ao menos um dia do cardápio.");
  for (const r of p.cronograma) {
    if (!r.de || !r.ate || r.de > r.ate) out.push("Há período do cronograma com datas inválidas.");
    if (r.semana < 1 || r.semana > 4) out.push("A semana do cronograma deve ser de 1 a 4.");
  }
  const sorted = [...p.cronograma].sort((a, b) => a.de.localeCompare(b.de));
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.de <= sorted[i - 1]!.ate) { out.push("Há períodos do cronograma sobrepostos."); break; }
  return [...new Set(out)];
}
