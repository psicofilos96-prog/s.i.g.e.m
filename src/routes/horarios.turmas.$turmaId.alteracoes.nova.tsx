import { createFileRoute } from "@tanstack/react-router";
import { ScheduleChangeWorkspacePage } from "@/features/schedules/schedule-change-workspace-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/alteracoes/nova")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <ScheduleChangeWorkspacePage classId={turmaId} />;
}
