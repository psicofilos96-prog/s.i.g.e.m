/**
 * B4.6.2a — Fronteira de sessão compartilhada pelas TRÊS rotas do calendário.
 *
 * - sessão incerta ⇒ só "Verificando sessão…": o laboratório NÃO é montado (sem hydrate/list/get/localStorage);
 * - sem sessão confirmada ⇒ laboratório existente, e só aqui vale o perfil demonstrativo da URL;
 * - com sessão ⇒ só a consulta institucional (B4.6.7: lista/detalhe positivos; sem workspace/impressão demo, ignorando ?perfil).
 *
 * Cache: chave = userId + modo + calendarId + validOn + knownAt, com um knownAt por carga. Dados de outra
 * chave nunca são exibidos durante carga ou erro.
 */
import type { ReactNode } from "react";
import { useSessionUser } from "@/features/authority/session-authority";
import { CalendarListPage, CalendarPrintPage, CalendarWorkspacePage, type CalendarProfile } from "./calendar-pages";
import { InstitutionalCalendarDetailView, InstitutionalCalendarListView } from "./institutional-calendar-pages";

export type CalendarRouteMode = "lista" | "detalhe" | "documento";

/** B4.6.7: consulta positiva. Chave de contexto = userId#sessionRevision (nunca usada como filtro de banco). */
export function InstitutionalCalendarPage({ userId, revision = 0, mode, calendarId }: { userId: string; revision?: number; mode: CalendarRouteMode; calendarId: string | null }) {
  const contextKey = `${userId}#${revision}`;
  if (mode === "lista" || calendarId === null) return <InstitutionalCalendarListView contextKey={contextKey} />;
  return <InstitutionalCalendarDetailView contextKey={contextKey} calendarId={calendarId} />;
}

function CalendarSessionBoundary({ mode, calendarId, lab }: { mode: CalendarRouteMode; calendarId: string | null; lab: () => ReactNode }) {
  const session = useSessionUser();
  if (session.loading) return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando sessão…</p>;
  if (session.user) return <InstitutionalCalendarPage key={`${session.user.id}#${session.revision}`} userId={session.user.id} revision={session.revision} mode={mode} calendarId={calendarId} />;
  return <>{lab()}</>;
}

export const CalendarListRoute = ({ perfil }: { perfil?: CalendarProfile | undefined }) => (
  <CalendarSessionBoundary mode="lista" calendarId={null} lab={() => <CalendarListPage profile={perfil ?? "supervisao"} />} />
);
export const CalendarDetailRoute = ({ calendarId, perfil }: { calendarId: string; perfil?: CalendarProfile | undefined }) => (
  <CalendarSessionBoundary mode="detalhe" calendarId={calendarId}
    lab={() => <CalendarWorkspacePage calendarId={calendarId} profile={perfil ?? "supervisao"} />} />
);
export const CalendarDocumentRoute = ({ calendarId, perfil }: { calendarId: string; perfil?: CalendarProfile | undefined }) => (
  <CalendarSessionBoundary mode="documento" calendarId={calendarId}
    lab={() => <CalendarPrintPage calendarId={calendarId} profile={perfil ?? "supervisao"} />} />
);
