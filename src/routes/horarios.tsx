import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useSessionUser } from "@/features/authority/session-authority";
import { InstitutionalSchedulesPage } from "@/features/schedules/institutional-schedules-page";
import { MySchedulePage } from "@/features/schedules/my-schedule-page";

/**
 * B4.4/B4.5 — com sessão institucional nenhuma tela de horários demonstrativa é exibida.
 * /horarios/profissionais mostra só "Meu horário" (própria pessoa); demais caminhos, a grade da turma.
 */
function HorariosLayout() {
  const session = useSessionUser();
  const { pathname } = useLocation();
  if (session.loading) return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando sessão…</p>;
  if (session.user) return pathname.startsWith("/horarios/profissionais") ? <MySchedulePage /> : <InstitutionalSchedulesPage />;
  return <Outlet />;
}
export const Route = createFileRoute("/horarios")({ component: HorariosLayout });
