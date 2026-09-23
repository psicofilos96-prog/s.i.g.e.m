import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProfessionalScheduleDetailPage } from "@/features/schedules/professional-schedule-detail-page";

export const Route = createFileRoute("/horarios/profissionais/$profissionalId/")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { profissionalId } = Route.useParams();
  const { data } = Route.useSearch();
  return (
    <ProfessionalScheduleDetailPage
      professionalId={profissionalId}
      {...(data ? { referenceDate: data } : {})}
    />
  );
}
