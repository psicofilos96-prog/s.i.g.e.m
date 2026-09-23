import { createFileRoute } from "@tanstack/react-router";
import { ScheduleEditorPage } from "@/features/schedules/schedule-editor-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/nova")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <ScheduleEditorPage classId={turmaId} mode="nova" />;
}
