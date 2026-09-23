import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ClassScheduleDetailPage } from "@/features/schedules/class-schedule-detail-page";

export const Route = createFileRoute("/horarios/turmas/$turmaId/")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  const { data } = Route.useSearch();
  return <ClassScheduleDetailPage classId={turmaId} {...(data ? { referenceDate: data } : {})} />;
}
