import { useDiarySession } from "@/features/diary/diary-session";
import { useEffect, useState } from "react";
import { diaryCalendarScope, diaryClassCalendar, useComposedCalendarRefresh } from "@/features/diary/diary-calendar";
import { attendanceCalendarNotice } from "./institutional-calendar-consumers";
import { aggregateCouncilAgenda, COUNCIL_EFFECT_LABEL, readCouncilAgenda, type ClassCouncilAgenda } from "./institutional-calendar-councils";

export function AttendanceCalendarNoticePanel({ date, classId }: { date: string; classId?: string }) {
  const s = useDiarySession();
  useComposedCalendarRefresh();
  // Informativo: decisão do servidor para as alocações da turma na data registrada; nunca apaga/marca/bloqueia.
  const days = s.phase === "pronto" && classId ? diaryClassCalendar(classId, { start: date, end: date }).summary.days : undefined;
  const n = attendanceCalendarNotice({ phase: s.phase, date, knownAt: s.reference?.knownAt, ...(days ? { days } : {}) });
  if (n.kind === "laboratorio") return null;
  return (
    <div role="note" data-testid="attendance-calendar-notice" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
      <p>{n.text}</p>
      {n.kind === "estado" && <p>{n.preservation}</p>}
    </div>
  );
}

/**
 * Agenda de conselhos (B4.6.7f): decisão do servidor por alocação da turma, UM knownAt do Diário; tipos de
 * conselho são só os declarados na versão homologada. Janela: ano civil da data de referência (só consulta).
 * Sessões, pautas e atas não são alteradas nem datadas por esta agenda.
 */
export function CouncilCalendarAgendaPanel({ classId }: { classId?: string }) {
  const s = useDiarySession();
  const ref = s.reference?.validOn;
  const knownAt = s.reference?.knownAt ?? null;
  const range = ref ? { start: `${ref.slice(0, 4)}-01-01`, end: `${ref.slice(0, 4)}-12-31` } : null;
  const scope = s.phase === "pronto" ? diaryCalendarScope(classId, range) : null;
  const key = scope && range && knownAt ? `${scope.contextKey}|${scope.allocations.map((w) => `${w.id}@${w.from ?? ""}~${w.until ?? ""}`).join(",")}|${range.start}|${knownAt}` : null;
  const [state, setState] = useState<{ key: string; agenda: ClassCouncilAgenda } | null>(null);
  useEffect(() => {
    if (!key || !scope || !range || !knownAt) return;
    let live = true;
    const reads = scope.allocations.flatMap((w) => {
      const from = w.from && w.from > range.start ? w.from : range.start;
      const to = w.until && w.until < range.end ? w.until : range.end;
      return from <= to ? [readCouncilAgenda({ allocation: w.id, from, to, knownAt })] : [];
    });
    void Promise.all(reads).then((r) => { if (live) setState({ key, agenda: aggregateCouncilAgenda(r) }); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (s.phase === "laboratorio") return null;
  const agenda = state && state.key === key ? state.agenda : null;
  return (
    <section data-testid="council-calendar-agenda" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
      <p className="font-medium text-foreground">Agenda de conselhos do calendário institucional</p>
      {s.phase !== "pronto" ? <p>Contexto institucional ainda não confirmado: a agenda do calendário não é exibida.</p>
        : !classId ? <p>Escolha uma turma para ver a agenda; nenhuma agenda é presumida.</p>
        : !scope ? <p>A lista de estudantes da turma ainda não foi confirmada; a agenda não é exibida (isto não significa que não haja conselhos).</p>
        : !agenda ? <p role="status">Lendo a agenda decidida pelo servidor…</p>
        : <>
          {agenda.items.length > 0 && <ul className="list-disc pl-5">{agenda.items.map((i) => (
            <li key={`${i.on}|${i.role}|${i.label}|${String(i.schoolDayEffect)}`}>{i.on} · {i.role}{i.label && i.label !== i.role ? ` — ${i.label}` : ""} · {COUNCIL_EFFECT_LABEL(i.schoolDayEffect)}
              {i.allocations < scope.allocations.length ? ` · para ${i.allocations} de ${scope.allocations.length} estudantes` : ""}</li>))}</ul>}
          {agenda.items.length === 0 && agenda.complete && <p>Nenhum dia declarado como conselho no calendário homologado desta turma neste ano.</p>}
          {!agenda.complete && <div><p>Agenda {agenda.items.length ? "parcial" : "indisponível"} (isto não significa que não haja conselhos):</p>
            <ul className="list-disc pl-5">{agenda.gaps.map((g) => <li key={g}>{g}</li>)}</ul></div>}
        </>}
      <p className="text-xs">Sessões, pautas e atas abaixo seguem como registros próprios; a agenda não as altera.</p>
    </section>
  );
}
