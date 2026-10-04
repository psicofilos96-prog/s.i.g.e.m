import { useDiarySession } from "@/features/diary/diary-session";
import { attendanceCalendarNotice, councilAgendaView } from "./institutional-calendar-consumers";
import type { CouncilAgendaConfig } from "./institutional-calendar-effects";

/** Nenhuma configuração homologada declara tipos de dia de conselho (categoria inexistente no esquema). */
export const INSTITUTIONAL_COUNCIL_CONFIG: CouncilAgendaConfig = { kind: "nao-configurada" };

export function AttendanceCalendarNoticePanel({ date }: { date: string }) {
  const s = useDiarySession();
  const n = attendanceCalendarNotice({ phase: s.phase, date, knownAt: s.reference?.knownAt });
  if (n.kind === "laboratorio") return null;
  return (
    <div role="note" data-testid="attendance-calendar-notice" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
      <p>{n.text}</p>
      {n.kind === "estado" && <p>{n.preservation}</p>}
    </div>
  );
}

/** Janela de exibição: ano civil da data de referência do Diário (só consulta; não define ciclo). */
export function CouncilCalendarAgendaPanel() {
  const s = useDiarySession();
  const ref = s.reference?.validOn;
  const range = ref ? { start: `${ref.slice(0, 4)}-01-01`, end: `${ref.slice(0, 4)}-12-31` } : null;
  const v = councilAgendaView({ phase: s.phase, range, knownAt: s.reference?.knownAt, config: INSTITUTIONAL_COUNCIL_CONFIG });
  if (v.kind === "laboratorio") return null;
  return (
    <section data-testid="council-calendar-agenda" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
      <p className="font-medium text-foreground">Agenda de conselhos do calendário institucional</p>
      {v.kind === "pendente" && <p>{v.text}</p>}
      {v.kind === "indisponivel" && (
        <>
          <p>Agenda indisponível. Nenhum evento foi criado; as sessões abaixo seguem como registros próprios.</p>
          <ul className="list-disc pl-5">{v.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </>
      )}
      {v.kind === "agenda" && (
        <ul className="list-disc pl-5">
          {v.items.map((i) => <li key={`${i.date}-${i.dayTypeId}`}>{i.date} · {i.label ?? "evento sem rótulo declarado"}</li>)}
          {v.pendingReason && <li>{v.pendingReason}</li>}
        </ul>
      )}
    </section>
  );
}
