import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DiarySessionBoundary } from "@/features/diary/diary-session";

/** B4.10.0c — a fronteira de sessão do Diário precede todos os consumidores (inclusive a Pauta). */
export const Route = createFileRoute("/diario")({
  component: () => (
    <DiarySessionBoundary>
      <Outlet />
    </DiarySessionBoundary>
  ),
});
