import { useMemo } from "react";
import { periodStructures } from "@/features/assessment/assessment-fixtures";
import type {
  AssessmentPeriod,
  AssessmentPeriodStructure,
} from "@/features/assessment/assessment-types";
import { addDays, formatAcademicDateLong, type IsoDate } from "@/lib/academic-date";
import {
  buildCalendarIndex,
  calendarForYear,
  validateCalendar,
  type CalendarState,
} from "./calendar-rules";
import { useCalendarEvents } from "./calendar-store";
import type { DayResolution } from "./calendar-types";

export const STATUS_TEXT: Record<DayResolution["status"], string> = {
  letivo: "Dia letivo",
  "nao-letivo": "Não letivo",
  "sem-classificacao": "Sem classificação",
  "fora-da-vigencia": "Fora da vigência",
};

export function periodMap(structure: AssessmentPeriodStructure | null) {
  const map = new Map<IsoDate, AssessmentPeriod>();
  const starts = new Set<IsoDate>();
  if (!structure) return { map, starts };
  for (const p of structure.periods) {
    starts.add(p.start);
    for (let d = p.start; d <= p.end; d = addDays(d, 1)) map.set(d, p);
  }
  return { map, starts };
}

export function dayDescription(day: DayResolution, period: AssessmentPeriod | undefined) {
  const parts = [formatAcademicDateLong(day.date), STATUS_TEXT[day.status]];
  if (day.classification && day.classification.id !== "cat-letivo")
    parts.push(day.classifyingEvent?.title ?? day.classification.label);
  for (const m of day.markers) parts.push(`${m.category.label}: ${m.event.title}`);
  if (period) parts.push(period.label);
  return parts.join(" — ");
}

export const CALENDAR_STATE_COPY: Record<CalendarState, { title: string; text: string }> = {
  "nao-cadastrado": {
    title: "Calendário não cadastrado",
    text: "Nenhuma organização de dias existe para este ano letivo.",
  },
  pendente: { title: "Calendário pendente", text: "Estrutura aguardando definição da rede." },
  demonstrativo: {
    title: "Calendário demonstrativo",
    text: "Datas fictícias para demonstrar a arquitetura. Não é o calendário oficial da rede.",
  },
  configurado: {
    title: "Calendário configurado",
    text: "Estruturado pela rede, ainda não homologado.",
  },
  homologado: { title: "Calendário homologado", text: "Calendário homologado pela rede." },
};

export function useCalendarIndex(yearId: string) {
  const resolved = calendarForYear(yearId);
  const events = useCalendarEvents(resolved?.calendar.id ?? "");
  return useMemo(() => {
    if (!resolved) return { resolved: null, index: null, issues: [] };
    if (resolved.calendar.state === "nao-cadastrado") return { resolved, index: null, issues: [] };
    const index = buildCalendarIndex({ ...resolved, events });
    return { resolved, index, issues: validateCalendar({ ...resolved, events }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.calendar.id, resolved?.calendar.state, events]);
}

export function structuresForYear(yearId: string) {
  return periodStructures.filter((s) => s.academicYearId === yearId);
}
