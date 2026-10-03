/**
 * B4.6.2a — Fronteira de sessão compartilhada pelas TRÊS rotas do calendário.
 *
 * - sessão incerta ⇒ só "Verificando sessão…": o laboratório NÃO é montado (sem hydrate/list/get/localStorage);
 * - sem sessão confirmada ⇒ laboratório existente, e só aqui vale o perfil demonstrativo da URL;
 * - com sessão ⇒ só a página institucional somente leitura (sem lista/workspace/impressão demo, ignorando ?perfil).
 *
 * Cache: chave = userId + modo + calendarId + validOn + knownAt, com um knownAt por carga. Dados de outra
 * chave nunca são exibidos durante carga ou erro.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSessionUser } from "@/features/authority/session-authority";
import { CalendarListPage, CalendarPrintPage, CalendarWorkspacePage, type CalendarProfile } from "./calendar-pages";
import {
  CALENDAR_ACCESS_DENIED_TEXT, calendarErrorMessage, captureCalendarKnownAt, isIsoDate, readCalendarAt,
} from "./institutional-calendar-source";

export type CalendarRouteMode = "lista" | "detalhe" | "documento";
const today = () => new Date().toISOString().slice(0, 10);

const TITLES: Record<CalendarRouteMode, string> = {
  lista: "Calendários escolares",
  detalhe: "Calendário escolar",
  documento: "Documento do calendário escolar",
};

export function InstitutionalCalendarPage({ userId, mode, calendarId }: { userId: string; mode: CalendarRouteMode; calendarId: string | null }) {
  const [validOn, setValidOn] = useState(today());
  const knownAt = useMemo(() => captureCalendarKnownAt(), [userId, mode, calendarId, validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({
    queryKey: ["b462-calendar", userId, mode, calendarId, validOn, knownAt],
    queryFn: () => readCalendarAt({ calendarId, validOn, knownAt }),
    retry: false,
  });
  const fresh = q.data && q.data.validOn === validOn && q.data.knownAt === knownAt ? q.data : undefined;
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">{TITLES[mode]}</h1>
      <p className="text-sm text-muted-foreground">Consulta institucional somente leitura.</p>
      <div className="space-y-1">
        <label htmlFor="b462-date" className="text-sm font-medium">Data de referência</label>
        <input id="b462-date" type="date" className="block rounded border border-input bg-background px-2 py-1 text-sm"
          value={validOn} onChange={(e) => isIsoDate(e.target.value) && setValidOn(e.target.value)} />
      </div>
      {q.isFetching && !fresh && !q.error && <p role="status" className="text-sm text-muted-foreground">Consultando o calendário institucional…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{calendarErrorMessage(q.error)}</p>}
      {fresh && !q.error && <p role="note" className="rounded border border-border bg-muted p-3 text-sm">{CALENDAR_ACCESS_DENIED_TEXT}</p>}
    </div>
  );
}

function CalendarSessionBoundary({ mode, calendarId, lab }: { mode: CalendarRouteMode; calendarId: string | null; lab: () => ReactNode }) {
  const session = useSessionUser();
  if (session.loading) return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando sessão…</p>;
  if (session.user) return <InstitutionalCalendarPage key={session.user.id} userId={session.user.id} mode={mode} calendarId={calendarId} />;
  return <>{lab()}</>;
}

export const CalendarListRoute = ({ perfil }: { perfil?: CalendarProfile }) => (
  <CalendarSessionBoundary mode="lista" calendarId={null} lab={() => <CalendarListPage profile={perfil ?? "supervisao"} />} />
);
export const CalendarDetailRoute = ({ calendarId, perfil }: { calendarId: string; perfil?: CalendarProfile }) => (
  <CalendarSessionBoundary mode="detalhe" calendarId={calendarId}
    lab={() => <CalendarWorkspacePage calendarId={calendarId} profile={perfil ?? "supervisao"} />} />
);
export const CalendarDocumentRoute = ({ calendarId, perfil }: { calendarId: string; perfil?: CalendarProfile }) => (
  <CalendarSessionBoundary mode="documento" calendarId={calendarId}
    lab={() => <CalendarPrintPage calendarId={calendarId} profile={perfil ?? "supervisao"} />} />
);
