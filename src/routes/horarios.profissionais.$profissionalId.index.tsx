import { createFileRoute } from "@tanstack/react-router";
import { ProfessionalScheduleDetailPage } from "@/features/schedules/professional-schedule-detail-page";
export const Route = createFileRoute("/horarios/profissionais/$profissionalId/")({
  component: RouteComponent,
});
function RouteComponent() {
  const { profissionalId } = Route.useParams();
  return <ProfessionalScheduleDetailPage professionalId={profissionalId} />;
}
