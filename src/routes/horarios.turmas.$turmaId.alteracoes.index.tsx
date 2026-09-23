import { createFileRoute } from "@tanstack/react-router";
import { ScheduleChangesPage } from "@/features/schedules/schedule-changes-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/alteracoes/")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <ScheduleChangesPage classId={turmaId} />;
}
