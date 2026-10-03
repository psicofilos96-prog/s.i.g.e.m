import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useSessionUser } from "@/features/authority/session-authority";
import { InstitutionalSchedulesPage } from "@/features/schedules/institutional-schedules-page";

/** B4.4 — com sessão institucional nenhuma tela de horários demonstrativa é exibida. */
function HorariosLayout() {
  const session = useSessionUser();
  if (session.loading) return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando sessão…</p>;
  if (session.user) return <InstitutionalSchedulesPage />;
  return <Outlet />;
}
export const Route = createFileRoute("/horarios")({ component: HorariosLayout });
