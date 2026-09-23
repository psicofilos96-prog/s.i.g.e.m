import { createFileRoute } from "@tanstack/react-router";
import { SchedulePublishPage } from "@/features/schedules/schedule-publish-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/publicar")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <SchedulePublishPage classId={turmaId} />;
}
