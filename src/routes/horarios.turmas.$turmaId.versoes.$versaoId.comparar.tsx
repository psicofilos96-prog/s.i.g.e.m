import { createFileRoute } from "@tanstack/react-router";
import { ScheduleVersionComparePage } from "@/features/schedules/schedule-version-compare-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/versoes/$versaoId/comparar")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId, versaoId } = Route.useParams();
  return <ScheduleVersionComparePage classId={turmaId} versionId={versaoId} />;
}
