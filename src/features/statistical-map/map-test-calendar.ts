/** Auxiliar de testes: calendário oficial sintético de UM mês (letivo até `lastSchoolDay`, não letivo depois). */
import { competenceWindow, type CalendarDayEffectKind, type MonthCalendarEvidence } from "./map-domain";

export function monthDays(c: { year: number; month: number }, effectOf: (iso: string) => CalendarDayEffectKind) {
  const { from, to } = competenceWindow(c);
  const out: { date: string; effect: CalendarDayEffectKind }[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, effect: effectOf(iso) });
  }
  return out;
}

export function officialCalendar(c: { year: number; month: number }, lastSchoolDay: string, calendarId = "cal-rede", versionId: string | null = "v1"): MonthCalendarEvidence {
  return { kind: "lido", knownAt: "2027-01-01T00:00:00.000Z", calendars: [{ calendarId, versionId, days: monthDays(c, (iso) => (iso <= lastSchoolDay ? "letivo" : "nao-letivo")) }] };
}
