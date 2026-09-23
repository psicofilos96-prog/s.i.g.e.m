import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ScheduleVersionsPage } from "@/features/schedules/schedule-versions-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/versoes/")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  const { data } = Route.useSearch();
  return <ScheduleVersionsPage classId={turmaId} {...(data ? { referenceDate: data } : {})} />;
}
