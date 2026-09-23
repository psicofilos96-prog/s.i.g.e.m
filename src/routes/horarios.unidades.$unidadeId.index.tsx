import { createFileRoute } from "@tanstack/react-router";
import { UnitSchedulePage } from "@/features/schedules/unit-schedule-page";
export const Route = createFileRoute("/horarios/unidades/$unidadeId/")({
  component: RouteComponent,
});
function RouteComponent() {
  const { unidadeId } = Route.useParams();
  return <UnitSchedulePage unitId={unidadeId} />;
}
