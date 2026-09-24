/**
 * Regras temporais puras do Calendário Escolar (12B.1).
 *
 * - A condição de dia letivo deriva SEMPRE dos eventos do calendário, nunca
 *   apenas do dia da semana. Sem evento classificador, o dia é
 *   "sem classificação" — não é presumido letivo nem não letivo.
 * - Nenhuma regra de frequência, carga horária ou avaliação é derivada aqui.
 */
import {
  academicYearOn,
  academicYears as defaultYears,
  getAcademicYear,
  schoolCalendars as defaultCalendars,
  type AcademicYear,
  type SchoolCalendar,
} from "@/features/academic/academic-structure";
import {
  validatePeriodStructure,
  periodOn,
  eligibilityInPeriod,
} from "@/features/assessment/assessment-rules";
import type {
  AcademicPlacement,
  AssessmentPeriod,
  AssessmentPeriodStructure,
} from "@/features/assessment/assessment-types";
import {
  addDays,
  daysInMonth,
  eachDate,
  isIsoDate,
  isoOf,
  monthsCovering,
  weekdayOf,
  type IsoDate,
} from "@/lib/academic-date";
import { dayCategories as defaultCategories } from "./calendar-fixtures";
import type { CalendarEvent, CalendarIssue, DayCategory, DayResolution } from "./calendar-types";

export type CalendarIndex = {
  calendar: SchoolCalendar;
  year: AcademicYear;
  /** Todos os dias dos meses civis que cobrem a vigência. */
  days: Map<IsoDate, DayResolution>;
  categories: Map<string, DayCategory>;
  events: CalendarEvent[];
};

function eventCovers(event: CalendarEvent, date: IsoDate) {
  if (date < event.start || date > event.end) return false;
  return !event.weekdays || event.weekdays.includes(weekdayOf(date));
}

/** Resolve o ano inteiro uma única vez; consultas posteriores são O(1). */
export function buildCalendarIndex(input: {
  calendar: SchoolCalendar;
  year: AcademicYear;
  events: CalendarEvent[];
  categories?: DayCategory[];
}): CalendarIndex {
  const categories = new Map((input.categories ?? defaultCategories).map((c) => [c.id, c]));
  const events = input.events.filter((e) => e.calendarId === input.calendar.id);
  const { start, end } = input.year.validity;
  const months = monthsCovering(start, end);
  const first = `${months[0]!.key}-01`;
  const lastMonth = months[months.length - 1]!;
  const last = isoOf(lastMonth.year, lastMonth.month, daysInMonth(lastMonth.year, lastMonth.month));
  const days = new Map<IsoDate, DayResolution>();
  for (const date of eachDate(first, last)) {
    const inValidity = date >= start && date <= end;
    let classification: DayCategory | null = null;
    let classifyingEvent: CalendarEvent | null = null;
    const markers: DayResolution["markers"] = [];
    if (inValidity)
      for (const event of events) {
        if (!eventCovers(event, date)) continue;
        const category = categories.get(event.categoryId);
        if (!category) continue;
        if (category.effect === "marcador") markers.push({ event, category });
        else if (
          !classification ||
          category.precedence > classification.precedence ||
          // ajuste local vence empate
          (category.precedence === classification.precedence && event.local)
        ) {
          classification = category;
          classifyingEvent = event;
        }
      }
    days.set(date, {
      date,
      weekday: weekdayOf(date),
      inValidity,
      status: !inValidity
        ? "fora-da-vigencia"
        : !classification
          ? "sem-classificacao"
          : classification.effect === "letivo"
            ? "letivo"
            : "nao-letivo",
      classification,
      classifyingEvent,
      markers,
      suspended: Boolean(classification?.suspendsActivities),
    });
  }
  return { calendar: input.calendar, year: input.year, days, categories, events };
}

// ------------------------------------------------------------- Consultas

export function dayOn(index: CalendarIndex, date: IsoDate): DayResolution | null {
  return index.days.get(date) ?? null;
}
export function belongsToAcademicYear(index: CalendarIndex, date: IsoDate) {
  return date >= index.year.validity.start && date <= index.year.validity.end;
}
export function isSchoolDay(index: CalendarIndex, date: IsoDate) {
  return dayOn(index, date)?.status === "letivo";
}
/** Sábado letivo: derivado da condição letiva + dia da semana real. */
export function isSchoolSaturday(index: CalendarIndex, date: IsoDate) {
  return isSchoolDay(index, date) && weekdayOf(date) === 6;
}
export function eventsOn(index: CalendarIndex, date: IsoDate) {
  const day = dayOn(index, date);
  if (!day) return [];
  return [
    ...(day.classifyingEvent && day.classification
      ? [{ event: day.classifyingEvent, category: day.classification }]
      : []),
    ...day.markers,
  ];
}
export function hasInstitutionalEvent(index: CalendarIndex, date: IsoDate) {
  return (dayOn(index, date)?.markers.length ?? 0) > 0;
}
export function hasSuspension(index: CalendarIndex, date: IsoDate) {
  return Boolean(dayOn(index, date)?.suspended);
}
export function countSchoolDays(index: CalendarIndex, start: IsoDate, end: IsoDate) {
  let total = 0;
  for (const date of eachDate(start, end)) if (isSchoolDay(index, date)) total += 1;
  return total;
}
/** Próximo dia letivo estritamente após a data, dentro da vigência. */
export function nextSchoolDay(index: CalendarIndex, date: IsoDate): IsoDate | null {
  for (let d = addDays(date, 1); d <= index.year.validity.end; d = addDays(d, 1))
    if (isSchoolDay(index, d)) return d;
  return null;
}
export function periodForDate(structure: AssessmentPeriodStructure, date: IsoDate) {
  return periodOn(structure, date);
}
export function schoolDaysByPeriod(index: CalendarIndex, structure: AssessmentPeriodStructure) {
  return [...structure.periods]
    .sort((a, b) => a.sequence - b.sequence)
    .map((period) => ({ period, schoolDays: countSchoolDays(index, period.start, period.end) }));
}
export function categoryUsage(index: CalendarIndex) {
  const usage = new Map<string, number>();
  for (const day of index.days.values()) {
    if (day.classification)
      usage.set(day.classification.id, (usage.get(day.classification.id) ?? 0) + 1);
    for (const m of day.markers) usage.set(m.category.id, (usage.get(m.category.id) ?? 0) + 1);
  }
  return usage;
}

// ------------------------------------------------------------- Validação

export function validateCalendar(input: {
  calendar: SchoolCalendar;
  year: AcademicYear | undefined;
  events: CalendarEvent[];
  categories?: DayCategory[];
}): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  const categories = new Map((input.categories ?? defaultCategories).map((c) => [c.id, c]));
  if (!input.year || input.year.id !== input.calendar.academicYearId) {
    issues.push({
      severity: "erro",
      code: "ano-incompativel",
      message: "Calendário referencia um ano letivo inexistente ou diferente.",
    });
    return issues;
  }
  const { start, end } = input.year.validity;
  const ids = new Set<string>();
  for (const event of input.events) {
    const base = { eventId: event.id };
    if (ids.has(event.id))
      issues.push({
        ...base,
        severity: "erro",
        code: "id-duplicado",
        message: `Identificador repetido: ${event.id}.`,
      });
    ids.add(event.id);
    if (event.calendarId !== input.calendar.id)
      issues.push({
        ...base,
        severity: "erro",
        code: "calendario-incompativel",
        message: `“${event.title}” pertence a outro calendário.`,
      });
    if (!categories.has(event.categoryId))
      issues.push({
        ...base,
        severity: "erro",
        code: "categoria-invalida",
        message: `“${event.title}” usa classificação inexistente.`,
      });
    if (!isIsoDate(event.start) || !isIsoDate(event.end) || event.start > event.end)
      issues.push({
        ...base,
        severity: "erro",
        code: "intervalo-invertido",
        message: `“${event.title}” tem intervalo inválido.`,
      });
    else if (event.start < start || event.end > end)
      issues.push({
        ...base,
        severity: "erro",
        code: "fora-da-vigencia",
        message: `“${event.title}” está fora da vigência do ano letivo.`,
      });
  }
  // Conflito estrutural: mesma precedência, efeitos opostos, mesmo dia — impossível decidir.
  const classifying = input.events.filter((e) => {
    const c = categories.get(e.categoryId);
    return c && c.effect !== "marcador" && e.start <= e.end;
  });
  const seen = new Set<string>();
  for (let i = 0; i < classifying.length; i += 1)
    for (let j = i + 1; j < classifying.length; j += 1) {
      const a = classifying[i]!;
      const b = classifying[j]!;
      const ca = categories.get(a.categoryId)!;
      const cb = categories.get(b.categoryId)!;
      if (ca.precedence !== cb.precedence || ca.effect === cb.effect || a.local || b.local)
        continue;
      const from = a.start > b.start ? a.start : b.start;
      const to = a.end < b.end ? a.end : b.end;
      const clash = eachDate(from, to).find((d) => eventCovers(a, d) && eventCovers(b, d));
      const key = `${a.id}|${b.id}`;
      if (clash && !seen.has(key)) {
        seen.add(key);
        issues.push({
          severity: "erro",
          code: "conflito",
          eventId: a.id,
          message: `“${a.title}” e “${b.title}” classificam ${clash} de forma oposta com a mesma precedência.`,
        });
      }
    }
  return issues;
}

/** Relação calendário × períodos avaliativos. Não exige que todo dia pertença a um período. */
export function validateCalendarPeriods(
  index: CalendarIndex,
  structure: AssessmentPeriodStructure,
): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  if (structure.academicYearId !== index.year.id)
    issues.push({
      severity: "erro",
      code: "periodo-ano-incompativel",
      message: "A estrutura de períodos pertence a outro ano letivo.",
    });
  for (const period of structure.periods)
    if (period.academicYearId !== index.year.id)
      issues.push({
        severity: "erro",
        code: "periodo-ano-incompativel",
        periodId: period.id,
        message: `“${period.label}” pertence a outro ano letivo.`,
      });
  for (const issue of validatePeriodStructure(structure, index.year.validity)) {
    const code = issue.message.startsWith("Fora")
      ? "periodo-fora-da-vigencia"
      : issue.message.startsWith("Sobreposição")
        ? "periodo-sobreposto"
        : "intervalo-invertido";
    const label = structure.periods.find((p) => p.id === issue.periodId)?.label ?? "Estrutura";
    issues.push({
      severity: "erro",
      code,
      ...(issue.periodId ? { periodId: issue.periodId } : {}),
      message: `${label}: ${issue.message}`,
    });
  }
  // Lacunas com dia letivo entre períodos consecutivos — observação, não erro normativo.
  const sorted = [...structure.periods].sort((a, b) => a.sequence - b.sequence);
  sorted.forEach((period, i) => {
    const next = sorted[i + 1];
    if (!next) return;
    const gapStart = addDays(period.end, 1);
    const gapEnd = addDays(next.start, -1);
    if (gapStart > gapEnd) return;
    const letivos = eachDate(gapStart, gapEnd).filter((d) => isSchoolDay(index, d));
    if (letivos.length)
      issues.push({
        severity: "observacao",
        code: "lacuna-com-dia-letivo",
        periodId: next.id,
        message: `${letivos.length} dia(s) letivo(s) entre “${period.label}” e “${next.label}” não pertencem a nenhum período.`,
      });
  });
  return issues;
}

// ----------------------------------------------------------- Homologação

export type CalendarState =
  "nao-cadastrado" | "pendente" | "demonstrativo" | "configurado" | "homologado";

/** Só é oficial se calendário e todas as categorias em uso forem homologados, sem erros. */
export function isCalendarHomologated(index: CalendarIndex, issues: CalendarIssue[] = []) {
  if (index.calendar.normativeStatus !== "homologado") return false;
  if (index.year.normativeStatus !== "homologado") return false;
  if (issues.some((i) => i.severity === "erro")) return false;
  for (const id of categoryUsage(index).keys())
    if (index.categories.get(id)?.normativeStatus !== "homologado") return false;
  return true;
}
export function calendarState(
  index: CalendarIndex | null,
  issues: CalendarIssue[] = [],
): CalendarState {
  if (!index || index.calendar.state === "nao-cadastrado") return "nao-cadastrado";
  if (isCalendarHomologated(index, issues)) return "homologado";
  const status = index.calendar.normativeStatus;
  return status === "homologado" ? "configurado" : status;
}

// ----------------------------------------------------------- Permissões

export type CalendarViewer = "professor" | "coordenacao" | "secretaria";
export function calendarPermissions(viewer: CalendarViewer) {
  return {
    consult: true,
    /** Ajuste apenas local e demonstrativo; nunca grava nem publica. */
    editLocal: viewer !== "professor",
    homologate: false as const,
    reason:
      viewer === "professor"
        ? "O professor consulta o calendário; não o administra."
        : "Ajustes ficam apenas nesta aba. Homologação depende de ato da rede e de autorização real.",
  };
}

// ---------------------------------------------- Preparação para o Diário

export type DiaryDateStatus = {
  status: "letivo" | "nao-letivo" | "sem-classificacao" | "fora-da-vigencia" | "sem-calendario";
  /** Aula prevista em data não letiva ou fora da vigência. */
  exceptional: boolean;
  events: Array<{ event: CalendarEvent; category: DayCategory }>;
};
/** Seletor puro. Ainda NÃO é usado pelo Diário — integração operacional será etapa própria. */
export function diaryDateStatus(
  index: CalendarIndex | null,
  date: IsoDate,
  options: { plannedLesson?: boolean } = {},
): DiaryDateStatus {
  if (!index) return { status: "sem-calendario", exceptional: false, events: [] };
  const day = dayOn(index, date);
  const status = !day || !belongsToAcademicYear(index, date) ? "fora-da-vigencia" : day.status;
  return {
    status,
    exceptional:
      Boolean(options.plannedLesson) && (status === "nao-letivo" || status === "fora-da-vigencia"),
    events: day ? eventsOn(index, date) : [],
  };
}

// ---------------------------------------------- Preparação para a 12C

export function activeAcademicYear(date: IsoDate, years: AcademicYear[] = defaultYears) {
  return academicYearOn(date, years) ?? null;
}
/** Coerência temporal de um instrumento com seu período — sem julgar valor pedagógico. */
export function instrumentTemporalCoherence(input: {
  date: IsoDate;
  period: Pick<AssessmentPeriod, "id" | "start" | "end" | "academicYearId">;
  index: CalendarIndex | null;
}) {
  const reasons: string[] = [];
  if (input.date < input.period.start || input.date > input.period.end)
    reasons.push("Data fora do período avaliativo.");
  if (input.index) {
    if (input.index.year.id !== input.period.academicYearId)
      reasons.push("Período e calendário pertencem a anos letivos diferentes.");
    else if (!isSchoolDay(input.index, input.date))
      reasons.push("Data não é dia letivo no calendário (apenas informativo).");
  } else reasons.push("Sem calendário cadastrado para verificar a data.");
  return { coherent: reasons.length === 0, reasons };
}
export function studentLinkedInInterval(
  placements: AcademicPlacement[],
  classId: string,
  interval: { start: IsoDate; end: IsoDate },
) {
  return eligibilityInPeriod(placements, classId, interval);
}

// ---------------------------------------------- Resolução por ano letivo

export function calendarForYear(yearId: string, calendars: SchoolCalendar[] = defaultCalendars) {
  const year = getAcademicYear(yearId);
  if (!year) return null;
  const calendar = calendars.find((c) => c.id === year.calendarId && c.academicYearId === year.id);
  return calendar ? { year, calendar } : null;
}
