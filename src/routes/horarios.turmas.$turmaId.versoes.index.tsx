import { createFileRoute } from "@tanstack/react-router";
import { ScheduleVersionsPage } from "@/features/schedules/schedule-versions-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/versoes/")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <ScheduleVersionsPage classId={turmaId} />;
}
