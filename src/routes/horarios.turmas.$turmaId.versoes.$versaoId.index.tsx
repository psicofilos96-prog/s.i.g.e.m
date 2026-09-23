import { createFileRoute } from "@tanstack/react-router";
import { ScheduleVersionDetailPage } from "@/features/schedules/schedule-version-detail-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/versoes/$versaoId/")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId, versaoId } = Route.useParams();
  return <ScheduleVersionDetailPage classId={turmaId} versionId={versaoId} />;
}
