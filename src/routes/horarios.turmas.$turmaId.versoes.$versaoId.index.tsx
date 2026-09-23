import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ScheduleVersionDetailPage } from "@/features/schedules/schedule-version-detail-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/versoes/$versaoId/")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId, versaoId } = Route.useParams();
  const { data } = Route.useSearch();
  return (
    <ScheduleVersionDetailPage
      classId={turmaId}
      versionId={versaoId}
      {...(data ? { referenceDate: data } : {})}
    />
  );
}
