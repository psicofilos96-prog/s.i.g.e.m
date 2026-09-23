import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";

export const Route = createFileRoute("/horarios/unidades/$unidadeId/impressao")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { unidadeId } = Route.useParams();
  const { data } = Route.useSearch();
  return (
    <SchedulePrintView
      scope={{ kind: "unit", id: unidadeId }}
      {...(data ? { referenceDate: data } : {})}
    />
  );
}
