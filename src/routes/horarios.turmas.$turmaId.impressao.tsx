import { createFileRoute } from "@tanstack/react-router";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";
export const Route = createFileRoute("/horarios/turmas/$turmaId/impressao")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  return <SchedulePrintView scope={{ kind: "class", id: turmaId }} />;
}
