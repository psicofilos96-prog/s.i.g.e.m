import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionUser } from "@/features/authority/session-authority";
import { InstitutionalSchedulesPage } from "@/features/schedules/institutional-schedules-page";
import { MySchedulePage } from "@/features/schedules/my-schedule-page";
import { scheduleContextKey } from "@/features/schedules/schedule-session-context";

const SCHEDULE_KEYS = ["b44-classes", "b44-journey", "b44-schedule", "b44-resp", "b45-my", "b45-names", "b44-calendar-allocs", "nhor4-batch", "nhor4-persons", "nhor4-names"];

/**
 * B4.4/B4.5 — com sessão institucional nenhuma tela de horários demonstrativa é exibida.
 * /horarios/profissionais mostra só "Meu horário" (própria pessoa); demais caminhos, a grade da turma.
 * B4.10.0e — sessão carregando/erro nunca abre o laboratório; com conta, a tela é remontada por
 * `userId#revisão` e caches de outro contexto são descartados; a data `data` da URL é a referência.
 */
export function HorariosLayout() {
  const session = useSessionUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const data = useRouterState({
    select: (s) => {
      const v = (s.location.search as Record<string, unknown>)["data"];
      return typeof v === "string" ? v : v === undefined ? undefined : String(v);
    },
  });
  const ctx = session.user ? scheduleContextKey(session.user.id, session.revision) : null;
  useEffect(() => {
    // Nenhum resultado de outro contexto (outra conta, novo login, logout) permanece no cache.
    queryClient.removeQueries({ predicate: (q) => SCHEDULE_KEYS.includes(String(q.queryKey[0])) && q.queryKey[1] !== ctx });
  }, [ctx, queryClient]);
  if (session.loading)
    return <p role={session.error ? "alert" : "status"} className="p-4 text-sm text-muted-foreground">{session.error ? "Não foi possível confirmar a sessão; nenhum horário é exibido." : "Verificando sessão…"}</p>;
  if (ctx) {
    const onDateChange = (iso: string) => void navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, data: iso }) } as never);
    return pathname.startsWith("/horarios/profissionais")
      ? <MySchedulePage key={ctx} contextKey={ctx} referenceDate={data} onDateChange={onDateChange} />
      : <InstitutionalSchedulesPage key={ctx} contextKey={ctx} referenceDate={data} onDateChange={onDateChange} />;
  }
  return <Outlet />;
}
