/**
 * B4.6.3e — apresentação do calendário institucional para a chamada por data e a agenda de conselhos.
 *
 * - Só lê pelo adaptador central (`institutional-calendar-days.ts`); sem calendarId aplicável declarado
 *   (D5 inexistente) nenhuma RPC é feita e nenhum ID é inferido ou escolhido.
 * - Chamada: o estado do calendário na data do registro é INFORMATIVO. Nunca apaga a aula, nunca cria
 *   presença/falta e nunca bloqueia o lançamento (nenhuma regra homologada exige isso).
 * - Agenda de conselhos: só por `councilAgenda` com tipos de dia declarados por ID explícito; nome,
 *   sigla ("CC") ou cor jamais identificam conselho. Sem categoria configurada ⇒ "não configurada",
 *   nunca "zero conselhos". Evento do calendário não reescreve data de sessão/pauta/ata.
 */
import { calendarRangeExplanation, calendarRangeWithoutApplicableCalendar, summarizeCalendarRange, type CalendarRangeSummary } from "./institutional-calendar-days";
import { councilAgenda, type CouncilAgendaConfig, type DayResolution } from "./institutional-calendar-effects";

export type CalendarConsumerPhase = "sem-fronteira" | "incerto" | "laboratorio" | "carregando" | "pronto" | "erro";

export const ATTENDANCE_CALENDAR_PRESERVATION =
  "A aula e a frequência registradas são preservadas; o calendário não cria presença nem falta e não bloqueia este lançamento.";

export type AttendanceCalendarNotice =
  | { kind: "laboratorio" }
  | { kind: "pendente"; text: string }
  | { kind: "estado"; date: string; summary: CalendarRangeSummary; text: string; preservation: string };

/** Estado do calendário para a data em que a aula foi efetivamente registrada. */
export function attendanceCalendarNotice(input: {
  phase: CalendarConsumerPhase;
  date: string;
  knownAt: string | null | undefined;
  /** Dias já lidos pelo adaptador (testes/injeção); ausente ⇒ sem calendário aplicável declarado. */
  days?: readonly DayResolution[];
}): AttendanceCalendarNotice {
  if (input.phase === "laboratorio") return { kind: "laboratorio" };
  if (input.phase !== "pronto")
    return { kind: "pendente", text: "Contexto institucional ainda não confirmado: o estado do calendário não é exibido." };
  const days = input.days ?? calendarRangeWithoutApplicableCalendar(input.date, input.date, input.knownAt ?? "");
  const summary = summarizeCalendarRange(days);
  const d = summary.days[0];
  const text = summary.kind === "determinado"
    ? `Calendário institucional em ${input.date}: ${d?.state === "letivo" ? "dia letivo" : "dia não letivo"}.`
    : `Calendário institucional em ${input.date} não determinado — ${calendarRangeExplanation(summary)}`;
  return { kind: "estado", date: input.date, summary, text, preservation: ATTENDANCE_CALENDAR_PRESERVATION };
}

export type CouncilAgendaView =
  | { kind: "laboratorio" }
  | { kind: "pendente"; text: string }
  | { kind: "indisponivel"; reasons: string[] }
  | { kind: "agenda"; completeness: "parcial" | "completa"; items: { date: string; dayTypeId: string; label: string | null; versionId: string | null }[]; pendingReason: string | null };

export const COUNCIL_CATEGORY_NOT_CONFIGURED =
  "Nenhum tipo de dia foi declarado como conselho em configuração homologada; isto não significa que não haja conselhos.";

/** Origem: só o calendário. Sessões/pautas/atas existentes não são alteradas nem datadas por ele. */
export function councilAgendaView(input: {
  phase: CalendarConsumerPhase;
  range: { start: string; end: string } | null;
  knownAt: string | null | undefined;
  config: CouncilAgendaConfig;
  days?: readonly DayResolution[];
}): CouncilAgendaView {
  if (input.phase === "laboratorio") return { kind: "laboratorio" };
  if (input.phase !== "pronto")
    return { kind: "pendente", text: "Contexto institucional ainda não confirmado: a agenda do calendário não é exibida." };
  const days = input.days ?? (input.range ? calendarRangeWithoutApplicableCalendar(input.range.start, input.range.end, input.knownAt ?? "") : []);
  const summary = summarizeCalendarRange(days);
  const sourceReason = input.range ? calendarRangeExplanation(summary) : "Intervalo da agenda não definido: nenhuma leitura foi feita.";
  const agenda = councilAgenda(days, input.config);
  if (agenda.kind === "nao-configurada")
    return { kind: "indisponivel", reasons: [COUNCIL_CATEGORY_NOT_CONFIGURED, ...(sourceReason ? [sourceReason] : [])] };
  if (!input.range) return { kind: "indisponivel", reasons: [sourceReason!] };
  if (summary.kind === "indeterminado" && agenda.items.length === 0)
    return { kind: "indisponivel", reasons: [sourceReason!] };
  return {
    kind: "agenda",
    completeness: agenda.kind,
    items: agenda.items.map((i) => ({ date: i.date, dayTypeId: i.declaration.dayTypeId, label: i.declaration.label, versionId: i.versionId })),
    pendingReason: agenda.kind === "parcial" ? sourceReason : null,
  };
}
