/**
 * NFORMAT.1 — formatação pt-BR única para telas e PDFs.
 * Só apresenta: nunca arredonda, converte nem grava valor armazenado.
 * Datas e horas continuam em `academic-date.ts` (fuso America/Sao_Paulo).
 */
import { MONTH_NAMES } from "./academic-date";

export { MONTH_NAMES };
/** Meses em minúsculas ("janeiro"), para uso no meio da frase. */
export const MONTH_NAMES_LOWER: readonly string[] = MONTH_NAMES.map((m) => m.toLowerCase());

const nf = new Map<string, Intl.NumberFormat>();
function fmt(min: number, max: number): Intl.NumberFormat {
  const k = `${min}:${max}`;
  let f = nf.get(k);
  if (!f) { f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max }); nf.set(k, f); }
  return f;
}

/** Número com separador de milhar "." e decimal ",". Ausente/não finito ⇒ "—" (nunca "0"). */
export function formatNumber(value: number | null | undefined, opts: { maxDecimals?: number; minDecimals?: number } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const max = opts.maxDecimals ?? 2;
  const out = fmt(Math.min(opts.minDecimals ?? 0, max), max).format(value);
  return out === "-0" ? "0" : out;
}

/** Percentual a partir de uma razão (0,25 ⇒ "25%"). Ausente ⇒ "—". */
export function formatRatioPercent(ratio: number | null | undefined, maxDecimals = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${formatNumber(ratio * 100, { maxDecimals })}%`;
}

/** Percentual de um valor já em pontos percentuais (25 ⇒ "25%"). */
export function formatPercent(points: number | null | undefined, maxDecimals = 1): string {
  if (points === null || points === undefined || !Number.isFinite(points)) return "—";
  return `${formatNumber(points, { maxDecimals })}%`;
}

/** Escolhe singular/plural: 1 (e -1) singular; 0 e demais plural, como no português. */
export function plural(n: number, singular: string, pluralForm: string): string {
  return Math.abs(n) === 1 ? singular : pluralForm;
}

/** "1 aviso", "2 avisos", "1.234 linhas". */
export function countLabel(n: number, singular: string, pluralForm: string): string {
  return `${formatNumber(n, { maxDecimals: 0 })} ${plural(n, singular, pluralForm)}`;
}

/** Lista legível: "a", "a e b", "a, b e c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Competência "março/2027" ou "Março de 2027". Mês fora de 1–12 ⇒ "—". */
export function formatCompetence(month: number, year: number, style: "slash" | "long" = "slash"): string {
  const name = MONTH_NAMES_LOWER[month - 1];
  if (!name || !Number.isInteger(year)) return "—";
  return style === "slash" ? `${name}/${year}` : `${name} de ${year}`;
}
