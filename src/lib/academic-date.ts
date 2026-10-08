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

/**
 * PADRÃO DE DATA DO SIGEM (convenção global)
 *   Interno ........ AAAA-MM-DD (domínio, URL, comparação, ordenação)
 *   Visual ......... DD/MM/AAAA
 *   Dia + mês ...... DD/MM
 *   Mês + ano ...... MM/AAAA
 *   Data + hora .... DD/MM/AAAA HH:mm
 *   Textual ........ D de <mês> de AAAA
 * Toda conversão passa por este módulo; nunca formatar datas nos componentes.
 */
function parts(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const iso = parseAcademicDate(value);
  return iso ? (iso.split("-") as [string, string, string]) : null;
}

/** "04/02/2027". Aceita ISO ou legado; texto não reconhecido é devolvido como está. */
export function formatAcademicDate(value: IsoDate | null | undefined, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return String(value);
  const p = parts(value);
  return p ? `${p[2]}/${p[1]}/${p[0]}` : value;
}

/** Alias histórico de {@link formatAcademicDate}. */
export function formatAcademicDateNumeric(value: IsoDate | null | undefined): string {
  return value && parts(value) ? formatAcademicDate(value) : "";
}

/** "04/02". */
export function formatDayMonth(value: IsoDate | null | undefined): string {
  const p = parts(value);
  return p ? `${p[2]}/${p[1]}` : "";
}

/** "02/2027". Aceita também "2027-02". */
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return "";
  const ym = /^(\d{4})-(\d{2})$/.exec(value);
  if (ym) return `${ym[2]}/${ym[1]}`;
  const p = parts(value);
  return p ? `${p[1]}/${p[0]}` : "";
}

/** "4 de fevereiro de 2027". */
export function formatLongDate(value: IsoDate | null | undefined): string {
  const p = parts(value);
  if (!p) return "";
  return `${Number(p[2])} de ${MONTH_NAMES[Number(p[1]) - 1]!.toLowerCase()} de ${p[0]}`;
}

/** "fevereiro de 2027". */
export function formatLongMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]!.toLowerCase()} de ${year}`;
}

/**
 * Data + hora "04/02/2027 08:30" (ou "04/02/2027 às 08:30").
 * Timestamps ISO são exibidos no horário local de Brasília (UTC-3),
 * sem depender do fuso da máquina.
 */
export function formatDateTime(value: string | null | undefined, opts: { textual?: boolean } = {}) {
  if (!value) return "";
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!m) return formatAcademicDate(value);
  let date = m[1]!;
  let hh = Number(m[2]);
  const mm = m[3]!;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    // NDATE.1: Intl com America/Sao_Paulo respeita o horário de verão histórico
    // (até 2019); deslocamento fixo de -3h errava a hora nesses períodos.
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) {
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
      const g = (k: string) => p.find((x) => x.type === k)!.value;
      return `${formatAcademicDate(`${g("year")}-${g("month")}-${g("day")}`)}${opts.textual ? " às " : " "}${g("hour")}:${g("minute")}`;
    }
  }
  return `${formatAcademicDate(date)}${opts.textual ? " às " : " "}${String(hh).padStart(2, "0")}:${mm}`;
}

/** Intervalo: "04/02/2027 a 21/05/2027"; compacto "04/02 a 21/05/2027" só no mesmo ano. */
export function formatDateRange(
  start: IsoDate | null | undefined,
  end: IsoDate | null | undefined,
  opts: { compact?: boolean } = {},
) {
  if (!start && !end) return "";
  if (!end) return `a partir de ${formatAcademicDate(start)}`;
  if (!start) return `até ${formatAcademicDate(end)}`;
  if (opts.compact && start.slice(0, 4) === end.slice(0, 4))
    return `${formatDayMonth(start)} a ${formatAcademicDate(end)}`;
  return `${formatAcademicDate(start)} a ${formatAcademicDate(end)}`;
}

/** Entrada textual "04/02/2027" → "2027-02-04" (null se inválida). */
export function parseBrazilianDate(value: string | null | undefined): IsoDate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value ?? "").trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isIsoDate(iso) ? iso : null;
}

/** Máscara de digitação: "04022027" → "04/02/2027". */
export function maskBrazilianDate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
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
  return `${WEEKDAY_NAMES[weekdayOf(date)]!.toLowerCase()}, ${formatLongDate(date)}`;
}

/**
 * NTEMP.1 — "hoje operacional" da rede (America/Sao_Paulo), em ISO.
 * `new Date().toISOString().slice(0,10)` é o dia em UTC: entre 21h e 24h
 * de Brasília devolvia o dia SEGUINTE, deslocando asOf/validOn/knownAt.
 */
export const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";
export function operationalToday(now: Date = new Date()): IsoDate {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: OPERATIONAL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}


/* ------------------------------ NDATE.2 ------------------------------ */

/** Mês operacional "AAAA-MM" da rede (America/Sao_Paulo). */
export function operationalMonthKey(now: Date = new Date()): string {
  return operationalToday(now).slice(0, 7);
}
/** Desloca uma competência "AAAA-MM" em n meses, com virada de ano. */
export function shiftMonthKey(key: string, n: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}
/** Primeiro e último dia civil (inclusivos) de "AAAA-MM". */
export function monthBounds(key: string): { from: IsoDate; to: IsoDate } {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return { from: isoOf(y, m, 1), to: isoOf(y, m, daysInMonth(y, m)) };
}
/** Hora e minuto operacionais (America/Sao_Paulo). */
export function operationalClock(now: Date = new Date()): { hour: number; minute: number; hhmm: string } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return { hour: Number(get("hour")), minute: Number(get("minute")), hhmm: `${get("hour")}:${get("minute")}` };
}
/**
 * Data civil de um valor que pode ser data (`AAAA-MM-DD`) ou instante
 * (timestamptz). Instante com fuso explícito vira o dia em America/Sao_Paulo —
 * `slice(0,10)` de "…T01:00:00+00:00" dava o dia seguinte após 21h.
 * Valor sem fuso é mantido como está (nunca reinterpretado).
 */
export function civilDateOf(value: string): IsoDate;
export function civilDateOf(value: string | null | undefined): IsoDate | undefined;
export function civilDateOf(value: string | null | undefined): IsoDate | undefined {
  if (value == null) return undefined;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s)) {
    const ms = Date.parse(s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
    if (!Number.isNaN(ms)) return operationalToday(new Date(ms));
  }
  return s.slice(0, 10);
}
