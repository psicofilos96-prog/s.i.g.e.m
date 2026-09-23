import { createFileRoute } from "@tanstack/react-router";
import { ScheduleReviewPage } from "@/features/schedules/schedule-review-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/revisar")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <ScheduleReviewPage classId={turmaId} />;
}
