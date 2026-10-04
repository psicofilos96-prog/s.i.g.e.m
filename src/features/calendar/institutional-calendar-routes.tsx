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
import { useEffect, useState, type ReactNode } from "react";
import { useSessionAuthority, useSessionUser } from "@/features/authority/session-authority";
import { CALENDAR_AUTHORITY_CAPABILITY, CalendarCentralContext, CalendarRepositoryContext, SupervisionModeContext } from "./calendar-supervision-context";
import { createInMemoryCalendarRepository, supervisionCalendarRepository, type CalendarRepository } from "./calendar-store";
import { CalendarListPage, CalendarPrintPage, CalendarWorkspacePage, type CalendarProfile } from "./calendar-pages";
import { InstitutionalCalendarDetailView, InstitutionalCalendarListView } from "./institutional-calendar-pages";

export type CalendarRouteMode = "lista" | "detalhe" | "documento";

/** B4.6.7: consulta positiva. Chave de contexto = userId#sessionRevision (nunca usada como filtro de banco). */
export function InstitutionalCalendarPage({ userId, revision = 0, mode, calendarId }: { userId: string; revision?: number; mode: CalendarRouteMode; calendarId: string | null }) {
  const contextKey = `${userId}#${revision}`;
  if (mode === "lista" || calendarId === null) return <InstitutionalCalendarListView contextKey={contextKey} />;
  return <InstitutionalCalendarDetailView contextKey={contextKey} calendarId={calendarId} />;
}

// Consulta das demais contas autenticadas: o MESMO calendário original, somente leitura, só com versões homologadas
// lidas do banco (repositório em memória por sessão; nunca lê nem grava o navegador).
const consultRepos = new Map<string, CalendarRepository>();
export const consultRepoFor = (key: string) => {
  let r = consultRepos.get(key);
  if (!r) { r = createInMemoryCalendarRepository([], undefined, { exact: true }); consultRepos.set(key, r); }
  return r;
};

function usePublishHash() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setOpen(window.location.hash === "#publicar");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return open;
}

function CalendarSessionBoundary({ mode, calendarId, lab }: { mode: CalendarRouteMode; calendarId: string | null; lab: (forced?: CalendarProfile) => ReactNode }) {
  const session = useSessionUser();
  const authority = useSessionAuthority();
  // Publicação só aparece quando pedida pelo botão "Publicar na rede" (fora da experiência principal).
  const publishOpen = usePublishHash();
  if (session.loading) return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando sessão…</p>;
  if (session.user) {
    if (authority.status === "loading") return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando autoridade do calendário…</p>;
    const isSupervision = authority.status === "signed-in"
      && authority.capabilities.some((c) => c.capabilityId === CALENDAR_AUTHORITY_CAPABILITY);
    if (isSupervision) {
      // Decisão do usuário: a Supervisão abre o SEU calendário (experiência original, dados do navegador).
      return (
        <CalendarCentralContext.Provider value={true}>
        <CalendarRepositoryContext.Provider value={supervisionCalendarRepository()}>
        <SupervisionModeContext.Provider value={{ authenticated: true, displayName: authority.person?.displayName ?? null }}>
          {/* Perfil vem da autoridade real; `?perfil` é ignorado. */}
          {lab("supervisao")}
          {mode === "lista" && publishOpen && (
            <details id="publicar" open className="mt-8 border-t border-border/70 pt-4">
              <summary className="cursor-pointer text-sm font-medium">Publicar na rede</summary>
              <div className="mt-4">
                <InstitutionalCalendarPage key={`${session.user.id}#${session.revision}`} userId={session.user.id} revision={session.revision} mode="lista" calendarId={null} />
              </div>
            </details>
          )}
        </SupervisionModeContext.Provider>
        </CalendarRepositoryContext.Provider>
        </CalendarCentralContext.Provider>
      );
    }
    return (
      <CalendarCentralContext.Provider value={true}>
        <CalendarRepositoryContext.Provider value={consultRepoFor(`${session.user.id}#${session.revision}`)}>
          {lab("professor")}
        </CalendarRepositoryContext.Provider>
      </CalendarCentralContext.Provider>
    );
  }
  return <>{lab()}</>;
}

export const CalendarListRoute = ({ perfil }: { perfil?: CalendarProfile | undefined }) => (
  <CalendarSessionBoundary mode="lista" calendarId={null} lab={(f) => <CalendarListPage profile={f ?? perfil ?? "supervisao"} />} />
);
export const CalendarDetailRoute = ({ calendarId, perfil }: { calendarId: string; perfil?: CalendarProfile | undefined }) => (
  <CalendarSessionBoundary mode="detalhe" calendarId={calendarId}
    lab={(f) => <CalendarWorkspacePage calendarId={calendarId} profile={f ?? perfil ?? "supervisao"} />} />
);
export const CalendarDocumentRoute = ({ calendarId, perfil }: { calendarId: string; perfil?: CalendarProfile | undefined }) => (
  <CalendarSessionBoundary mode="documento" calendarId={calendarId}
    lab={(f) => <CalendarPrintPage calendarId={calendarId} profile={f ?? perfil ?? "supervisao"} />} />
);
