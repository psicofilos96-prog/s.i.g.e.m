/**
 * Data acadêmica canônica (Etapa 12B).
 *
 * Fonte de verdade interna: ISO `aaaa-mm-dd`, independente de fuso e de
 * apresentação. A formatação brasileira pertence apenas à camada de exibição.
 * Rótulos legados ("09 fev 2026") são aceitos somente na entrada, por
 * compatibilidade, e nunca devem ser gravados como fonte primária.
 */
export type IsoDate = string;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Converte ISO, "dd/mm/aaaa" ou rótulo legado "09 fev 2026" em ISO. */
export function parseAcademicDate(value: string | null | undefined): IsoDate | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (isIsoDate(text)) return text;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    return isIsoDate(iso) ? iso : null;
  }
  const label = /^(\d{1,2}) ([a-zç]{3})[a-zç]* (\d{4})$/.exec(text);
  if (label) {
    const month = MONTHS.indexOf(label[2]!);
    if (month < 0) return null;
    const iso = `${label[3]}-${String(month + 1).padStart(2, "0")}-${label[1]!.padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}

/** Exibição institucional curta: "09 fev 2026". */
export function formatAcademicDate(value: IsoDate | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const match = ISO.exec(value);
  if (!match) return value;
  return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Exibição numérica: "09/02/2026". */
export function formatAcademicDateNumeric(value: IsoDate | null | undefined): string {
  const match = value ? ISO.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function compareAcademicDates(a: IsoDate, b: IsoDate) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Diferença inclusiva em dias. */
export function daysBetween(start: IsoDate, end: IsoDate) {
  return (
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 864e5) + 1
  );
}

// ------------------------------------------------ Aritmética de calendário (12B.1)
// Tudo em UTC para não depender de fuso; nenhuma quantidade de dias é fixada.

function toUtc(date: IsoDate) {
  return Date.parse(`${date}T00:00:00Z`);
}
function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}
export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
/** Dias do mês (month 1–12), calculado — sem tabela fixa nem fevereiro especial. */
export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** Dia da semana: 0 = domingo … 6 = sábado. */
export function weekdayOf(date: IsoDate) {
  return new Date(toUtc(date)).getUTCDay();
}
export function addDays(date: IsoDate, amount: number): IsoDate {
  return fromUtc(toUtc(date) + amount * 864e5);
}
export function isoOf(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
/** Datas inclusivas entre start e end (vazio se invertido). */
export function eachDate(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
export type MonthRef = { year: number; month: number; key: string };
/** Meses civis que cobrem o intervalo (sem assumir 12). */
export function monthsCovering(start: IsoDate, end: IsoDate): MonthRef[] {
  const out: MonthRef[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const endKey = end.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > endKey) break;
    out.push({ year: y, month: m, key });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
/** Grade de um mês: células nulas antes do dia 1 conforme o dia da semana real. */
export function monthGrid(year: number, month: number): Array<IsoDate | null> {
  const first = isoOf(year, month, 1);
  const lead = weekdayOf(first);
  const cells: Array<IsoDate | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(year, month); d += 1) cells.push(isoOf(year, month, d));
  return cells;
}
export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
/** "terça-feira, 10 de junho de 2026" — apresentação apenas. */
export function formatAcademicDateLong(date: IsoDate) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${WEEKDAY_NAMES[weekdayOf(date)]!.toLowerCase()}, ${d} de ${MONTH_NAMES[m - 1]!.toLowerCase()} de ${y}`;
}
