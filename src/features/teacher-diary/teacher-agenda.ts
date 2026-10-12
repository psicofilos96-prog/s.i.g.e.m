/**
 * Docente LOTE 06 — Agenda do professor (projeção pura, sem calendário paralelo).
 *
 * Entradas já lidas das fontes donas: blocos da grade publicada (class_schedule_at),
 * atuações/atribuições vigentes, efeito do dia do calendário oficial
 * (institutional-calendar-days: letivo / nao-letivo / indeterminado) e eventos de
 * módulos donos (conselho, avaliação, reunião, prazo, formação). A agenda só compõe;
 * nada é gravado nem inferido de nome, cor ou dia da semana.
 */
export type DayEffect = "letivo" | "nao-letivo" | "indeterminado";
export type CalendarDay = { date: string; effect: DayEffect; label?: string; replacesDate?: string; suspended?: boolean };

export type ScheduleBlock = { classId: string; assignmentId: string; weekday: number; start: string; end: string; className: string };
export type AssignmentWindow = { assignmentId: string; start: string; end?: string | null };
export type OwnedEvent = { date: string; kind: "conselho" | "avaliacao" | "reuniao" | "prazo" | "formacao"; title: string; start?: string; end?: string; sourceRef: string };

export type AgendaItem =
  | { type: "aula"; date: string; start: string; end: string; className: string; assignmentId: string; status: "prevista" | "reposicao" }
  | { type: "evento"; date: string; kind: OwnedEvent["kind"]; title: string; start?: string; end?: string; sourceRef: string };

export type AgendaDay = { date: string; items: AgendaItem[]; messages: string[] };

export type AgendaView = "dia" | "semana" | "mes" | "periodo";

const weekdayOf = (date: string) => { const d = new Date(`${date}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function agendaRange(view: AgendaView, anchor: string, periodEnd?: string): { from: string; to: string } {
  if (view === "dia") return { from: anchor, to: anchor };
  if (view === "semana") { const from = addDays(anchor, 1 - weekdayOf(anchor)); return { from, to: addDays(from, 6) }; }
  if (view === "mes") { const from = `${anchor.slice(0, 7)}-01`; const d = new Date(`${from}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1, 0); return { from, to: d.toISOString().slice(0, 10) }; }
  if (!periodEnd) throw new Error("Período exige data final declarada.");
  return { from: anchor, to: periodEnd };
}

const active = (w: AssignmentWindow | undefined, date: string) => !!w && w.start <= date && (!w.end || w.end >= date);
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;

export function buildAgenda(input: {
  from: string; to: string;
  blocks: readonly ScheduleBlock[];
  assignments: readonly AssignmentWindow[];
  calendar: readonly CalendarDay[] | null; // null = calendário não lido
  events: readonly OwnedEvent[];
}): AgendaDay[] {
  const cal = new Map((input.calendar ?? []).map((d) => [d.date, d]));
  const asg = new Map(input.assignments.map((a) => [a.assignmentId, a]));
  const days: AgendaDay[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    const messages: string[] = [];
    const items: AgendaItem[] = [];
    const day = cal.get(date);
    // Reposição: o dia substitui a grade de outro dia da semana, só se declarado no calendário.
    const gridDate = day?.replacesDate ?? date;
    const status = day?.replacesDate ? "reposicao" : "prevista";
    let showLessons = true;
    if (input.calendar === null) { messages.push("Calendário oficial não lido: aulas exibidas sem confirmação de dia letivo."); }
    else if (!day || day.effect === "indeterminado") { messages.push("Dia sem efeito declarado no calendário oficial; nenhuma aula é confirmada."); showLessons = false; }
    else if (day.suspended) { messages.push(`Atividades suspensas${day.label ? `: ${day.label}` : ""}. As aulas deste dia não acontecem.`); showLessons = false; }
    else if (day.effect === "nao-letivo") { messages.push(`Dia não letivo${day.label ? ` (${day.label})` : ""}: não há aulas.`); showLessons = false; }
    if (day?.replacesDate && showLessons) messages.push(`Dia de reposição: segue o horário de ${day.replacesDate}.`);

    if (showLessons) {
      const wd = weekdayOf(gridDate);
      for (const b of input.blocks.filter((x) => x.weekday === wd)) {
        if (!active(asg.get(b.assignmentId), date)) {
          messages.push(`Horário ${b.start}–${b.end} em ${b.className} sem atribuição vigente nesta data; não aparece como aula sua.`);
          continue;
        }
        items.push({ type: "aula", date, start: b.start, end: b.end, className: b.className, assignmentId: b.assignmentId, status });
      }
    }
    for (const e of input.events.filter((x) => x.date === date)) items.push({ type: "evento", ...e });
    items.sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));

    const timed = items.filter((i): i is AgendaItem & { start: string; end: string } => !!i.start && !!i.end);
    for (let i = 0; i < timed.length; i++)
      for (let j = i + 1; j < timed.length; j++)
        if (overlaps(timed[i]!, timed[j]!))
          messages.push(`Conflito ${timed[i]!.start}–${timed[i]!.end}: ${label(timed[i]!)} e ${label(timed[j]!)} ao mesmo tempo. Procure a coordenação para ajustar.`);
    days.push({ date, items, messages });
  }
  return days;
}

const label = (i: AgendaItem) => (i.type === "aula" ? `aula em ${i.className}` : i.title);

export function noAssignmentMessage(assignments: readonly AssignmentWindow[], date: string): string | null {
  return assignments.some((a) => active(a, date)) ? null : "Você não tem atribuição vigente nesta data. Se isso estiver errado, procure a secretaria da escola.";
}
