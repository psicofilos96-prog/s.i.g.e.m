import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { DiarySessionBoundary } from "@/features/diary/diary-session";

/**
 * B4.10.0c — a fronteira de sessão do Diário precede todos os consumidores (inclusive a Pauta).
 * B4.10.0d — a data `data` da URL (válida prevalece) define a referência de consulta do lote.
 */
export const Route = createFileRoute("/diario")({
  component: DiaryLayout,
});

function DiaryLayout() {
  const data = useRouterState({
    select: (s) => {
      const v = (s.location.search as Record<string, unknown>)["data"];
      return typeof v === "string" ? v : undefined;
    },
  });
  return (
    <DiarySessionBoundary referenceDate={data}>
      <Outlet />
    </DiarySessionBoundary>
  );
}
