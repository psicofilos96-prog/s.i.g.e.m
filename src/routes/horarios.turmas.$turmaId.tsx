import { createFileRoute } from "@tanstack/react-router";
import { ClassScheduleDetailPage } from "@/features/schedules/class-schedule-detail-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId")({ component: RouteComponent });
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <ClassScheduleDetailPage classId={turmaId} />;
}
