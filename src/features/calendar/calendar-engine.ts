/**
 * Motor temporal puro do calendário da rede (porta de motor.ts,
 * preparar-grade.ts e validacoes.ts da especificação 2027). Sem React.
 * Tela, impressão e demais módulos consomem o mesmo resultado.
 *
 * Precedência: sobrescrita > evento pontual > feriado letivo > feriado da
 * modalidade > feriado herdado > recesso > férias > fim de semana > letivo.
 */
import type { IsoDate } from "@/lib/academic-date";
import { DAY_TYPES, INEXISTENT_GRAY, INHERITED_PRIORITY, KIND_PRIORITY } from "./calendar-catalog";
import type {
  CalendarPeriod,
  CalendarPeriodGroup,
  CalendarRange,
  CalendarRule,
  DayTypeCode,
  NetworkCalendar,
  ResolvedCalendar,
  ReviewItem,
} from "./calendar-types";

export const MONTHS = [
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

export const daysIn = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();
export const iso = (y: number, m: number, d: number): IsoDate =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const parse = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
};
export const weekday = (date: string) => {
  const { y, m, d } = parse(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
export const isWeekend = (date: string) => [0, 6].includes(weekday(date));
export const shiftDays = (date: string, n: number): IsoDate => {
  const { y, m, d } = parse(date);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
};
export const brDate = (date: string) => {
  const { y, m, d } = parse(date);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};
export const shortDate = (date: string) => date.slice(8, 10) + "/" + date.slice(5, 7);

export function eachDay(start: string, end: string): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = shiftDays(d, 1)) out.push(d);
  return out;
}

// ------------------------------------------------------------------ Resolução

export function resolveCalendar(cal: NetworkCalendar): ResolvedCalendar {
  const candidate = new Map<string, DayTypeCode>();
  const prio = new Map<string, number>();
  const vote = (date: string, type: DayTypeCode, p: number) => {
    const cur = prio.get(date);
    if (cur === undefined || p < cur) {
      candidate.set(date, type);
      prio.set(date, p);
    }
  };
  for (const r of cal.ranges) {
    if (r.end < r.start) continue;
    for (const d of eachDay(r.start, r.end)) vote(d, r.type, KIND_PRIORITY[DAY_TYPES[r.type].kind]);
  }
  const eventsByDate = new Map<IsoDate, NetworkCalendar["events"][number]>();
  for (const e of cal.events) {
    vote(e.date, e.type, KIND_PRIORITY[DAY_TYPES[e.type].kind]);
    eventsByDate.set(e.date, e);
  }
  for (const h of cal.inheritedHolidays) vote(h.date, h.type, INHERITED_PRIORITY);
  const overrides = new Map(cal.overrides.map((o) => [o.date, o.type]));

  const byDate = new Map<IsoDate, DayTypeCode>();
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= daysIn(cal.year, m); d++) {
      const key = iso(cal.year, m, d);
      byDate.set(
        key,
        overrides.get(key) ?? candidate.get(key) ?? (isWeekend(key) ? "FDS" : "VAZIO"),
      );
    }
  }
  return { year: cal.year, byDate, eventsByDate };
}

export const dayType = (r: ResolvedCalendar, date: string): DayTypeCode | null =>
  r.byDate.get(date) ?? null;
export const isSchoolDay = (r: ResolvedCalendar, date: string) => {
  const t = dayType(r, date);
  return t ? DAY_TYPES[t].countsAsSchoolDay : false;
};
export function countSchoolDays(r: ResolvedCalendar, start: string, end: string) {
  let n = 0;
  for (let d = start; d <= end; d = shiftDays(d, 1)) if (isSchoolDay(r, d)) n++;
  return n;
}
export function totalSchoolDays(r: ResolvedCalendar) {
  let n = 0;
  for (const t of r.byDate.values()) if (DAY_TYPES[t].countsAsSchoolDay) n++;
  return n;
}
export function schoolDaysPerMonth(r: ResolvedCalendar) {
  return MONTHS.map((_, i) =>
    countSchoolDays(r, iso(r.year, i + 1, 1), iso(r.year, i + 1, daysIn(r.year, i + 1))),
  );
}
export function nextSchoolDay(r: ResolvedCalendar, after: string): IsoDate | null {
  for (let d = shiftDays(after, 1); r.byDate.has(d); d = shiftDays(d, 1))
    if (isSchoolDay(r, d)) return d;
  return null;
}
export function periodForDate(cal: NetworkCalendar, date: string): CalendarPeriod | null {
  return cal.periods.find((p) => p.start <= date && p.end >= date) ?? null;
}
export const periodSchoolDays = (r: ResolvedCalendar, p: CalendarPeriod) =>
  countSchoolDays(r, p.start, p.end);

/** Cortes da coluna "Total" (layout anual): período que termina no meio do mês. */
export function totalColumnCuts(periods: CalendarPeriod[], year: number) {
  const sorted = [...periods].sort((a, b) => a.order - b.order);
  const cuts = new Map<number, number>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const { m, d } = parse(sorted[i]!.end);
    if (d < daysIn(year, m)) cuts.set(m, d);
  }
  return cuts;
}

// ------------------------------------------------------------ Lista FERIADOS

/** Faixa de pausa (férias/recesso) — pela natureza do tipo, não pela sigla. */
const isPause = (t: DayTypeCode) =>
  DAY_TYPES[t].kind === "ferias" || DAY_TYPES[t].kind === "recesso";
const isHolidayKind = (t: DayTypeCode) =>
  DAY_TYPES[t].kind === "feriado" || DAY_TYPES[t].kind === "feriado-letivo";

function eligibleForDisplay(date: string, ranges: CalendarRange[]) {
  if (isWeekend(date)) return false;
  return !ranges.some((r) => isPause(r.type) && date >= r.start && date <= r.end);
}
export function holidaysForDisplay(cal: NetworkCalendar) {
  const items: Array<{ date: IsoDate; name: string }> = [];
  const own = new Set(cal.events.map((e) => e.date));
  for (const e of cal.events) {
    const holiday = isHolidayKind(e.type);
    if (!(holiday || e.showInHolidays) || !e.name) continue;
    if (holiday && !eligibleForDisplay(e.date, cal.ranges)) continue;
    items.push({ date: e.displayDate ?? e.date, name: e.name });
  }
  for (const h of cal.inheritedHolidays) {
    if (own.has(h.date) || !eligibleForDisplay(h.date, cal.ranges)) continue;
    items.push({ date: h.date, name: h.name });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ------------------------------------------------------------ Grade documental

export type GridCell = {
  day: number;
  active: boolean;
  date?: IsoDate;
  code?: DayTypeCode;
  text: string;
  background: string;
  foreground: string;
  tooltip: string;
};
export type GridSegment =
  { kind: "dia"; cell: GridCell } | { kind: "ferias"; colSpan: number; startDay: number };
export type GridMonthRow = {
  kind: "mes";
  month: number;
  monthName: string;
  cells: GridCell[];
  segments: GridSegment[];
  total?: number;
  splitTotal?: [number, number];
};
export type GridTotalRow = { kind: "total"; label: string; total: number; groupId?: string };
export type GridRow = GridMonthRow | GridTotalRow;

const isVacation = (c?: DayTypeCode) => !!c && DAY_TYPES[c].kind === "ferias";
const neutralInBand = (c: DayTypeCode) =>
  (DAY_TYPES[c].kind === "automatico" && !DAY_TYPES[c].countsAsSchoolDay) ||
  DAY_TYPES[c].kind === "feriado";

export function buildSegments(cells: GridCell[]): GridSegment[] {
  const active = cells.filter((c) => c.active);
  if (active.length > 0 && active.every((c) => c.code && !DAY_TYPES[c.code].countsAsSchoolDay)) {
    const pause = (c: GridCell) => !!c.code && isPause(c.code);
    let a = 0;
    while (a < active.length && !pause(active[a]!)) a++;
    let b = active.length;
    while (b > a && !pause(active[b - 1]!)) b--;
    if (b - a >= 2) {
      const days = new Set(active.slice(a, b).map((c) => c.day));
      const first = active[a]!.day;
      const segs: GridSegment[] = [];
      for (const c of cells) {
        if (days.has(c.day)) {
          if (c.day === first) segs.push({ kind: "ferias", colSpan: b - a, startDay: first });
        } else segs.push({ kind: "dia", cell: c });
      }
      return segs;
    }
    return [
      { kind: "ferias", colSpan: active.length, startDay: active[0]!.day },
      ...cells.filter((c) => !c.active).map((cell): GridSegment => ({ kind: "dia", cell })),
    ];
  }
  const segs: GridSegment[] = [];
  for (let i = 0; i < cells.length;) {
    const c = cells[i]!;
    if (c.active && isVacation(c.code)) {
      let end = i;
      for (let j = i + 1; j < cells.length; j++) {
        const n = cells[j]!;
        if (n.active && isVacation(n.code)) end = j;
        else if (n.active && n.code && neutralInBand(n.code)) continue;
        else break;
      }
      if (end - i + 1 >= 2) {
        segs.push({ kind: "ferias", colSpan: end - i + 1, startDay: c.day });
        i = end + 1;
        continue;
      }
    }
    segs.push({ kind: "dia", cell: c });
    i++;
  }
  return segs;
}

function monthRow(
  r: ResolvedCalendar,
  month: number,
  from: number,
  to: number,
  cut?: number,
): GridMonthRow {
  const nd = daysIn(r.year, month);
  const cells: GridCell[] = [];
  for (let day = 1; day <= 31; day++) {
    if (!(day >= from && day <= to && day <= nd)) {
      cells.push({
        day,
        active: false,
        text: "",
        background: INEXISTENT_GRAY,
        foreground: "#000000",
        tooltip: "",
      });
      continue;
    }
    const date = iso(r.year, month, day);
    const code = dayType(r, date)!;
    const info = DAY_TYPES[code];
    const text = code === "FDS" ? (weekday(date) === 6 ? "S" : "D") : info.mark;
    cells.push({
      day,
      active: true,
      date,
      code,
      text,
      background: info.background,
      foreground: info.foreground,
      tooltip: `${day}/${month} — ${info.label}`,
    });
  }
  const sub = (a: number, b: number) =>
    b < a ? 0 : countSchoolDays(r, iso(r.year, month, a), iso(r.year, month, b));
  const row: GridMonthRow = {
    kind: "mes",
    month,
    monthName: MONTHS[month - 1]!,
    cells,
    segments: buildSegments(cells),
  };
  if (cut !== undefined) row.splitTotal = [sub(from, cut), sub(cut + 1, to)];
  else row.total = sub(from, to);
  return row;
}

/**
 * Grade documental. A forma vem da ESTRUTURA configurada (agrupamentos e
 * períodos), nunca da modalidade nem de um corte fixo:
 * - com agrupamentos: um trecho por agrupamento (o mês da fronteira é
 *   dividido) seguido da linha de total do agrupamento — o MESMO total dos
 *   blocos de períodos;
 * - sem agrupamentos: 12 meses com divisão da coluna Total nas fronteiras
 *   dos períodos e a linha de total anual.
 */
export function buildGrid(
  cal: NetworkCalendar,
  r: ResolvedCalendar = resolveCalendar(cal),
  blocks: PeriodBlock[] = periodBlocks(cal, r),
): GridRow[] {
  const rows: GridRow[] = [];
  const named = blocks.filter((b) => b.group && b.periods.length && b.start && b.end);
  if (named.length === 0) {
    const cuts = totalColumnCuts(cal.periods, cal.year);
    for (let m = 1; m <= 12; m++) rows.push(monthRow(r, m, 1, daysIn(cal.year, m), cuts.get(m)));
    rows.push({
      kind: "total",
      label: "TOTAL DE DIAS LETIVOS",
      total: annualSchoolDays(cal, r, blocks),
    });
    return rows;
  }
  const yearStart = iso(cal.year, 1, 1);
  const yearEnd = iso(cal.year, 12, 31);
  let from = yearStart;
  named.forEach((b, i) => {
    const nextStart = named[i + 1]?.start;
    let to = nextStart ? shiftDays(nextStart, -1) : yearEnd;
    if (to < from) to = from;
    if (to > yearEnd) to = yearEnd;
    const a = parse(from);
    const z = parse(to);
    for (let m = a.m; m <= z.m; m++)
      rows.push(monthRow(r, m, m === a.m ? a.d : 1, m === z.m ? z.d : daysIn(cal.year, m)));
    rows.push({
      kind: "total",
      label: b.group!.totalLabel ?? `TOTAL DE DIAS LETIVOS — ${b.group!.name}`,
      total: b.total,
      groupId: b.group!.id,
    });
    from = to < yearEnd ? shiftDays(to, 1) : yearEnd;
  });
  return rows;
}

/**
 * Blocos de períodos para exibição. Sem agrupamentos configurados → um único
 * bloco sem nome. Totais sempre derivados do motor.
 */
export type PeriodBlock = {
  group: CalendarPeriodGroup | null;
  block: string;
  periods: CalendarPeriod[];
  total: number;
  start: IsoDate | null;
  end: IsoDate | null;
};
export function periodBlocks(cal: NetworkCalendar, r: ResolvedCalendar): PeriodBlock[] {
  const sorted = [...cal.periods].sort((a, b) => a.order - b.order);
  const groups = [...(cal.periodGroups ?? [])].sort((a, b) => a.order - b.order);
  const known = new Set(groups.map((g) => g.id));
  const make = (group: CalendarPeriodGroup | null, periods: CalendarPeriod[]): PeriodBlock => ({
    group,
    block: group?.name ?? "",
    periods,
    total: periods.reduce((s, p) => s + periodSchoolDays(r, p), 0),
    start: periods[0]
      ? periods.reduce((m, p) => (p.start < m ? p.start : m), periods[0].start)
      : null,
    end: periods[0] ? periods.reduce((m, p) => (p.end > m ? p.end : m), periods[0].end) : null,
  });
  const out = groups.map((g) =>
    make(
      g,
      sorted.filter((p) => p.groupId === g.id),
    ),
  );
  const loose = sorted.filter((p) => !p.groupId || !known.has(p.groupId));
  if (loose.length || out.length === 0) out.push(make(null, loose));
  return out;
}

/**
 * Total anual apresentado: soma dos dias letivos dos períodos configurados
 * (mesma fonte dos blocos). Sem períodos, o total do calendário.
 * Dias letivos fora de período aparecem como aviso, nunca somados em silêncio.
 */
export function annualSchoolDays(
  cal: NetworkCalendar,
  r: ResolvedCalendar,
  blocks: PeriodBlock[] = periodBlocks(cal, r),
) {
  return cal.periods.length ? blocks.reduce((s, b) => s + b.total, 0) : totalSchoolDays(r);
}

/** Dias letivos do calendário que não pertencem a nenhum período. */
export function schoolDaysOutsidePeriods(cal: NetworkCalendar, r: ResolvedCalendar) {
  if (!cal.periods.length) return 0;
  let n = 0;
  for (const [d, t] of r.byDate)
    if (DAY_TYPES[t].countsAsSchoolDay && !cal.periods.some((p) => p.start <= d && p.end >= d)) n++;
  return n;
}

/** Conselho do período = último dia resolvido como CC dentro do intervalo (fonte única). */
export function councilForPeriod(r: ResolvedCalendar, p: CalendarPeriod): IsoDate | null {
  let found: IsoDate | null = null;
  if (p.end < p.start) return null;
  for (let d = p.start; d <= p.end && r.byDate.has(d); d = shiftDays(d, 1))
    if (r.byDate.get(d) === "CC") found = d;
  return found;
}

// ------------------------------------------------------------------ Validação

export const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/**
 * Estruturais ("erro") bloqueiam homologação. "critico" exige confirmação
 * explícita. "atencao" apenas informa. Regras configuradas (`rules`) são do calendário,
 * não do sistema. Nada aqui altera o calendário.
 */
export function validateCalendar(
  cal: NetworkCalendar,
  r: ResolvedCalendar = resolveCalendar(cal),
): ReviewItem[] {
  const out: ReviewItem[] = [];
  const inYear = (d: string) => d.startsWith(`${cal.year}-`) && r.byDate.has(d);
  const ids = new Set<string>();
  for (const item of [...cal.ranges, ...cal.events, ...cal.periods, ...(cal.periodGroups ?? [])]) {
    if (ids.has(item.id))
      out.push({
        severity: "erro",
        code: "ID_DUPLICADO",
        message: `Identificador duplicado: ${item.id}.`,
      });
    ids.add(item.id);
  }
  for (const x of cal.ranges) {
    if (x.end < x.start)
      out.push({
        severity: "erro",
        code: "INTERVALO_INVERTIDO",
        message: `Faixa ${DAY_TYPES[x.type].label} termina antes de começar (${brDate(x.start)} a ${brDate(x.end)}).`,
      });
    if (!inYear(x.start) || !inYear(x.end))
      out.push({
        severity: "erro",
        code: "FORA_DO_ANO",
        message: `Faixa ${DAY_TYPES[x.type].label} fora do ano ${cal.year}.`,
      });
    if (!DAY_TYPES[x.type])
      out.push({
        severity: "erro",
        code: "TIPO_INVALIDO",
        message: `Tipo de dia inválido: ${x.type}.`,
      });
  }
  const eventDates = new Set<string>();
  for (const e of cal.events) {
    if (!inYear(e.date))
      out.push({
        severity: "erro",
        code: "FORA_DO_ANO",
        message: `Evento em ${e.date} fora do ano ${cal.year}.`,
        date: e.date,
      });
    if (eventDates.has(e.date))
      out.push({
        severity: "erro",
        code: "EVENTOS_NA_MESMA_DATA",
        message: `Mais de um evento em ${brDate(e.date)}.`,
        date: e.date,
      });
    eventDates.add(e.date);
  }
  const groupIds = new Set((cal.periodGroups ?? []).map((g) => g.id));
  const orders = new Map<number, string>();
  const sortedByOrder = [...cal.periods].sort((a, b) => a.order - b.order);
  sortedByOrder.forEach((p, i) => {
    if (i > 0 && sortedByOrder[i - 1]!.start > p.start)
      out.push({
        severity: "atencao",
        code: "ORDEM_INCONSISTENTE",
        message: `"${p.name}" está depois de "${sortedByOrder[i - 1]!.name}" na ordem, mas começa antes.`,
      });
  });
  for (const g of cal.periodGroups ?? []) {
    if (!g.name.trim())
      out.push({
        severity: "erro",
        code: "GRUPO_SEM_NOME",
        message: `Agrupamento ${g.id} sem nome.`,
      });
    if (!cal.periods.some((p) => p.groupId === g.id))
      out.push({
        severity: "atencao",
        code: "GRUPO_VAZIO",
        message: `Agrupamento "${g.name}" não possui períodos.`,
      });
  }
  for (const p of cal.periods) {
    if (!p.name.trim())
      out.push({
        severity: "erro",
        code: "PERIODO_SEM_NOME",
        message: `Período ${p.id} sem nome.`,
      });
    if (orders.has(p.order))
      out.push({
        severity: "erro",
        code: "ORDEM_DUPLICADA",
        message: `"${p.name}" e "${orders.get(p.order)}" têm a mesma posição (${p.order}).`,
      });
    orders.set(p.order, p.name);
    if (p.groupId && !groupIds.has(p.groupId))
      out.push({
        severity: "erro",
        code: "GRUPO_INEXISTENTE",
        message: `"${p.name}" aponta para um agrupamento inexistente (${p.groupId}).`,
      });
    if (p.end < p.start)
      out.push({
        severity: "erro",
        code: "PERIODO_INVERTIDO",
        message: `"${p.name}" termina antes de começar.`,
      });
    if (!inYear(p.start) || !inYear(p.end))
      out.push({
        severity: "erro",
        code: "PERIODO_FORA_DO_ANO",
        message: `"${p.name}" está fora do ano ${cal.year}.`,
      });
  }

  const total = totalSchoolDays(r);
  const blocks = periodBlocks(cal, r);
  const annual = annualSchoolDays(cal, r, blocks);
  out.push(...validateRules(cal, r, blocks, annual));

  for (const e of cal.events) {
    if (DAY_TYPES[e.type].kind !== "evento") continue;
    if (isWeekend(e.date))
      out.push({
        severity: "atencao",
        code: "EVENTO_EM_FIM_DE_SEMANA",
        message: `${DAY_TYPES[e.type].label} em ${brDate(e.date)} cai num fim de semana.`,
        date: e.date,
      });
    const band = cal.ranges.find((x) => isPause(x.type) && e.date >= x.start && e.date <= x.end);
    if (band)
      out.push({
        severity: "atencao",
        code: "EVENTO_EM_FERIAS_RECESSO",
        message: `${DAY_TYPES[e.type].label} em ${brDate(e.date)} cai dentro de ${DAY_TYPES[band.type].label.toLowerCase()}.`,
        date: e.date,
      });
  }

  for (const b of blocks) {
    const sorted = [...b.periods].sort((x, y) => x.start.localeCompare(y.start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const n = sorted[i + 1]!;
      if (a.end >= n.start) {
        out.push({
          severity: "atencao",
          code: "PERIODOS_SOBREPOSTOS",
          message: `"${a.name}" se sobrepõe a "${n.name}".`,
        });
        continue;
      }
      const from = shiftDays(a.end, 1);
      const to = shiftDays(n.start, -1);
      if (from <= to) {
        const gap = countSchoolDays(r, from, to);
        if (gap > 0)
          out.push({
            severity: "atencao",
            code: "PERIODOS_COM_LACUNA",
            message: `Entre "${a.name}" e "${n.name}" há ${gap} dia(s) letivo(s) fora de período.`,
          });
      }
    }
  }

  const outside = schoolDaysOutsidePeriods(cal, r);
  if (cal.periods.length && (annual !== total || outside > 0))
    out.push({
      severity: "atencao",
      code: "SOMA_PERIODOS",
      message: `A soma dos períodos (${annual}) difere do total de dias letivos do calendário (${total})${outside ? `: ${outside} dia(s) letivo(s) fora de período` : ""}.`,
    });
  for (const [d, t] of r.byDate)
    if (t === "FL" && isWeekend(d))
      out.push({
        severity: "atencao",
        code: "FL_EM_FIM_DE_SEMANA",
        message: `Feriado letivo em ${brDate(d)} cai em fim de semana e está sendo contado como letivo.`,
        date: d,
      });

  schoolDaysPerMonth(r).forEach((n, i) => {
    if (i > 0 && n === 0)
      out.push({
        severity: "atencao",
        code: "MES_SEM_LETIVO",
        message: `${MONTHS[i]} não tem nenhum dia letivo.`,
      });
  });
  return out;
}

/** Datas de início/término das aulas derivadas dos eventos do calendário. */
export function classesStart(cal: NetworkCalendar) {
  return cal.events.find((e) => e.type === "INICIO")?.date ?? null;
}
export function classesEnd(cal: NetworkCalendar) {
  return (
    cal.overrides.find((o) => o.type === "TERMINO")?.date ??
    cal.events.find((e) => e.type === "TERMINO")?.date ??
    null
  );
}
export function councilDates(cal: NetworkCalendar, r: ResolvedCalendar = resolveCalendar(cal)) {
  return [...cal.periods]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ period: p, date: councilForPeriod(r, p) }))
    .filter((x): x is { period: CalendarPeriod; date: IsoDate } => x.date !== null)
    .map(({ period, date }) => ({
      periodId: period.id,
      date,
      label: `Conselho de Classe do ${period.name}`,
    }));
}

// ------------------------------------------------------ Regras configuradas

const ruleItem = (
  rule: CalendarRule,
  code: string,
  message: string,
  date?: IsoDate,
): ReviewItem => ({
  severity: rule.severity,
  code,
  message,
  ...(date ? { date } : {}),
});

/**
 * Aplica SOMENTE as regras configuradas e ativas do calendário. Regra ausente
 * não gera validação. O valor calculado nunca é substituído pela regra.
 */
export function validateRules(
  cal: NetworkCalendar,
  r: ResolvedCalendar,
  blocks: PeriodBlock[],
  annual: number,
): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const rule of cal.rules) {
    if (!rule.enabled) continue;
    const v = rule.value;
    switch (rule.kind) {
      case "minimo-anual":
        if (v !== undefined && annual < v)
          out.push(
            ruleItem(
              rule,
              "MINIMO_LEGAL",
              `Total atual: ${annual} dias letivos. Mínimo configurado: ${v}${rule.basis ? ` (${rule.basis})` : ""}.`,
            ),
          );
        break;
      case "minimo-agrupamento": {
        const b = blocks.find((x) => x.group?.id === rule.targetId);
        if (!b) {
          out.push({
            severity: "erro",
            code: "REGRA_ALVO_INEXISTENTE",
            message: `Regra de mínimo aponta para agrupamento inexistente (${rule.targetId ?? "—"}).`,
          });
          break;
        }
        if (v !== undefined && b.total < v)
          out.push(
            ruleItem(
              rule,
              "BLOCO_ABAIXO_DO_MINIMO",
              `${b.block} tem ${b.total} dias letivos — mínimo configurado de ${v}.`,
            ),
          );
        break;
      }
      case "minimo-periodo": {
        const targets = rule.targetId
          ? cal.periods.filter((p) => p.id === rule.targetId)
          : cal.periods;
        if (rule.targetId && !targets.length) {
          out.push({
            severity: "erro",
            code: "REGRA_ALVO_INEXISTENTE",
            message: `Regra de mínimo aponta para período inexistente (${rule.targetId}).`,
          });
          break;
        }
        for (const p of targets) {
          const n = periodSchoolDays(r, p);
          if (v !== undefined && n < v)
            out.push(
              ruleItem(
                rule,
                "PERIODO_ABAIXO_DO_MINIMO",
                `"${p.name}" tem ${n} dias letivos — mínimo configurado de ${v}.`,
              ),
            );
        }
        break;
      }
      case "minimo-ferias": {
        let n = 0;
        for (const t of r.byDate.values()) if (DAY_TYPES[t].kind === "ferias") n++;
        if (v !== undefined && n < v)
          out.push(
            ruleItem(
              rule,
              "FERIAS_ABAIXO_DO_MINIMO",
              `Férias somam ${n} dias — mínimo configurado de ${v}.`,
            ),
          );
        break;
      }
      case "conselho-por-periodo":
        for (const p of cal.periods)
          if (!councilForPeriod(r, p))
            out.push(
              ruleItem(
                rule,
                "PERIODO_SEM_CONSELHO",
                `"${p.name}" não possui Conselho de Classe marcado.`,
              ),
            );
        break;
      case "conselho-dia-semana":
        if (v === undefined) break;
        for (const [d, t] of r.byDate)
          if (t === "CC" && weekday(d) !== v)
            out.push(
              ruleItem(
                rule,
                "CC_FORA_DO_DIA",
                `Conselho de Classe em ${brDate(d)} não cai em ${WEEKDAY_NAMES[v]} (dia configurado neste calendário).`,
                d,
              ),
            );
        break;
      case "feriado-local-esperado": {
        if (!rule.monthDay || !rule.dayType) break;
        const d = `${cal.year}-${rule.monthDay}`;
        if (dayType(r, d) !== rule.dayType)
          out.push(
            ruleItem(
              rule,
              "FERIADO_LOCAL_AUSENTE",
              `${rule.name ?? "Feriado esperado"} (${brDate(d)}) não está cadastrado.`,
              d,
            ),
          );
        break;
      }
    }
  }
  return out;
}

// ------------------------------------------------------ Projeção canônica

export type ProjectedPeriod = {
  period: CalendarPeriod;
  schoolDays: number;
  council: IsoDate | null;
};
export type ProjectedGroup = Omit<PeriodBlock, "periods"> & { periods: ProjectedPeriod[] };

export type CalendarProjection = {
  calendarId: string;
  resolved: ResolvedCalendar;
  grid: GridRow[];
  periods: ProjectedPeriod[];
  groups: ProjectedGroup[];
  grouped: boolean;
  annualSchoolDays: number;
  calendarSchoolDays: number;
  schoolDaysOutsidePeriods: number;
  councils: ReturnType<typeof councilDates>;
  holidays: ReturnType<typeof holidaysForDisplay>;
  legend: DayTypeCode[];
  validation: ReviewItem[];
};

/**
 * FONTE ÚNICA das informações derivadas do calendário. Tela, editor,
 * resumos, validação, documento, impressão e consultas consomem esta
 * projeção — nenhum total é armazenado ou recalculado por outro caminho.
 */
export function deriveCalendarProjection(cal: NetworkCalendar): CalendarProjection {
  const r = resolveCalendar(cal);
  const blocks = periodBlocks(cal, r);
  const project = (p: CalendarPeriod): ProjectedPeriod => ({
    period: p,
    schoolDays: periodSchoolDays(r, p),
    council: councilForPeriod(r, p),
  });
  const groups = blocks.map((b) => ({ ...b, periods: b.periods.map(project) }));
  return {
    calendarId: cal.id,
    resolved: r,
    grid: buildGrid(cal, r, blocks),
    periods: [...cal.periods].sort((a, b) => a.order - b.order).map(project),
    groups,
    grouped: blocks.some((b) => b.group),
    annualSchoolDays: annualSchoolDays(cal, r, blocks),
    calendarSchoolDays: totalSchoolDays(r),
    schoolDaysOutsidePeriods: schoolDaysOutsidePeriods(cal, r),
    councils: councilDates(cal, r),
    holidays: holidaysForDisplay(cal),
    legend: (Object.values(DAY_TYPES) as Array<(typeof DAY_TYPES)[DayTypeCode]>)
      .filter((t) => t.showInLegend && !cal.legendHidden.includes(t.code))
      .sort((a, b) => a.legendOrder - b.legendOrder)
      .map((t) => t.code),
    validation: validateCalendar(cal, r),
  };
}
