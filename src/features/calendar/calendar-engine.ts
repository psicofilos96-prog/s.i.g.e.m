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

function eligibleForDisplay(date: string, ranges: CalendarRange[]) {
  if (isWeekend(date)) return false;
  return !ranges.some(
    (r) => (r.type === "FERIAS" || r.type === "RECESSO") && date >= r.start && date <= r.end,
  );
}
export function holidaysForDisplay(cal: NetworkCalendar) {
  const items: Array<{ date: IsoDate; name: string }> = [];
  const own = new Set(cal.events.map((e) => e.date));
  for (const e of cal.events) {
    const holiday = e.type === "FERIADO" || e.type === "FL";
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
export type GridTotalRow = { kind: "total"; label: string; total: number };
export type GridRow = GridMonthRow | GridTotalRow;

const NEUTRAL_IN_BAND = new Set<DayTypeCode>(["FDS", "FERIADO"]);

export function buildSegments(cells: GridCell[]): GridSegment[] {
  const active = cells.filter((c) => c.active);
  if (active.length > 0 && active.every((c) => c.code && !DAY_TYPES[c.code].countsAsSchoolDay)) {
    const pause = (c: GridCell) => c.code === "FERIAS" || c.code === "RECESSO";
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
    if (c.active && c.code === "FERIAS") {
      let end = i;
      for (let j = i + 1; j < cells.length; j++) {
        const n = cells[j]!;
        if (n.active && n.code === "FERIAS") end = j;
        else if (n.active && n.code && NEUTRAL_IN_BAND.has(n.code)) continue;
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

export function buildGrid(
  cal: NetworkCalendar,
  r: ResolvedCalendar = resolveCalendar(cal),
): GridRow[] {
  const rows: GridRow[] = [];
  if (cal.layout === "anual" || !cal.semesterCut) {
    const cuts = totalColumnCuts(cal.periods, cal.year);
    for (let m = 1; m <= 12; m++) rows.push(monthRow(r, m, 1, daysIn(cal.year, m), cuts.get(m)));
    rows.push({ kind: "total", label: "TOTAL DE DIAS LETIVOS", total: totalSchoolDays(r) });
    return rows;
  }
  const { month: cm, day: cd } = cal.semesterCut;
  let first = 0;
  for (let m = 1; m <= cm; m++) {
    const row = monthRow(r, m, 1, m === cm ? cd : daysIn(cal.year, m));
    first += row.total!;
    rows.push(row);
  }
  rows.push({ kind: "total", label: "TOTAL DE DIAS LETIVOS DO 1° SEMESTRE", total: first });
  for (let m = cm; m <= 12; m++)
    rows.push(monthRow(r, m, m === cm ? cd + 1 : 1, daysIn(cal.year, m)));
  rows.push({
    kind: "total",
    label: "TOTAL DE DIAS LETIVOS DO 2° SEMESTRE",
    total: totalSchoolDays(r) - first,
  });
  return rows;
}

/**
 * Blocos de períodos para exibição. Sem agrupamentos configurados → um único
 * bloco sem nome. Totais sempre derivados do motor.
 */
export function periodBlocks(cal: NetworkCalendar, r: ResolvedCalendar) {
  const sorted = [...cal.periods].sort((a, b) => a.order - b.order);
  const groups = [...(cal.periodGroups ?? [])].sort((a, b) => a.order - b.order);
  const known = new Set(groups.map((g) => g.id));
  const make = (group: CalendarPeriodGroup | null, periods: CalendarPeriod[]) => ({
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

/** Conselho do período = último dia resolvido como CC dentro do intervalo (fonte única). */
export function councilForPeriod(r: ResolvedCalendar, p: CalendarPeriod): IsoDate | null {
  let found: IsoDate | null = null;
  if (p.end < p.start) return null;
  for (let d = p.start; d <= p.end && r.byDate.has(d); d = shiftDays(d, 1))
    if (r.byDate.get(d) === "CC") found = d;
  return found;
}

// ------------------------------------------------------------------ Validação

const POINT_EVENTS = new Set<DayTypeCode>([
  "INICIO",
  "RETORNO",
  "TERMINO",
  "CC",
  "CF",
  "CENSO",
  "MESTRE",
  "ENCONTRO",
]);
const WEEKDAY_NAMES = [
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
 * explícita. "atencao" apenas informa. Regras da `policy` são do calendário,
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
  const min = cal.policy.minSchoolDays;
  if (min && total < min.value)
    out.push({
      severity: "critico",
      code: "MINIMO_LEGAL",
      message: `Total de dias letivos (${total}) abaixo do mínimo de ${min.value} (${min.basis}).`,
    });

  const cw = cal.policy.councilWeekday;
  if (cw !== undefined)
    for (const e of cal.events)
      if (e.type === "CC" && weekday(e.date) !== cw)
        out.push({
          severity: "atencao",
          code: "CC_FORA_DO_DIA",
          message: `Conselho de Classe em ${brDate(e.date)} não cai em ${WEEKDAY_NAMES[cw]} (dia configurado neste calendário).`,
          date: e.date,
        });

  if (cal.policy.minDaysPerBlock !== undefined)
    for (const b of periodBlocks(cal, r))
      if (b.block && b.total < cal.policy.minDaysPerBlock)
        out.push({
          severity: "atencao",
          code: "BLOCO_ABAIXO_DO_MINIMO",
          message: `${b.block} tem ${b.total} dias letivos — mínimo configurado de ${cal.policy.minDaysPerBlock}.`,
        });

  if (cal.policy.januaryVacationDays !== undefined)
    for (const x of cal.ranges) {
      if (x.type !== "FERIAS" || parse(x.start).m !== 1) continue;
      const n = eachDay(x.start, x.end).length;
      if (n !== cal.policy.januaryVacationDays)
        out.push({
          severity: "atencao",
          code: "FERIAS_JANEIRO",
          message: `Férias de ${brDate(x.start)} a ${brDate(x.end)} somam ${n} dias — configurado: ${cal.policy.januaryVacationDays}.`,
        });
    }

  for (const e of cal.events) {
    if (!POINT_EVENTS.has(e.type)) continue;
    if (isWeekend(e.date))
      out.push({
        severity: "atencao",
        code: "EVENTO_EM_FIM_DE_SEMANA",
        message: `${DAY_TYPES[e.type].label} em ${brDate(e.date)} cai num fim de semana.`,
        date: e.date,
      });
    const band = cal.ranges.find(
      (x) => (x.type === "FERIAS" || x.type === "RECESSO") && e.date >= x.start && e.date <= x.end,
    );
    if (band)
      out.push({
        severity: "atencao",
        code: "EVENTO_EM_FERIAS_RECESSO",
        message: `${DAY_TYPES[e.type].label} em ${brDate(e.date)} cai dentro de ${band.type === "FERIAS" ? "férias" : "recesso"}.`,
        date: e.date,
      });
  }

  for (const b of periodBlocks(cal, r)) {
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

  const sum = cal.periods.reduce((s, p) => s + periodSchoolDays(r, p), 0);
  if (cal.periods.length && sum !== total)
    out.push({
      severity: "atencao",
      code: "SOMA_PERIODOS",
      message: `A soma dos períodos (${sum}) difere do total do ano (${total}).`,
    });

  for (const h of cal.policy.expectedLocalHolidays ?? []) {
    const d = `${cal.year}-${h.monthDay}`;
    if (dayType(r, d) !== h.type)
      out.push({
        severity: "atencao",
        code: "FERIADO_LOCAL_AUSENTE",
        message: `${h.name} (${brDate(d)}) não está cadastrado.`,
        date: d,
      });
  }
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
      label: period.councilLabel ?? `Conselho de Classe — ${period.name}`,
    }));
}
