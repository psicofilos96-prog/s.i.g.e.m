import { createFileRoute } from "@tanstack/react-router";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";
export const Route = createFileRoute("/horarios/profissionais/$profissionalId/impressao")({
  component: RouteComponent,
});
function RouteComponent() {
  const { profissionalId } = Route.useParams();
  return <SchedulePrintView scope={{ kind: "professional", id: profissionalId }} />;
}
