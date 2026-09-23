import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UnitSchedulePage } from "@/features/schedules/unit-schedule-page";

export const Route = createFileRoute("/horarios/unidades/$unidadeId/")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { unidadeId } = Route.useParams();
  const { data } = Route.useSearch();
  return <UnitSchedulePage unitId={unidadeId} {...(data ? { referenceDate: data } : {})} />;
}
