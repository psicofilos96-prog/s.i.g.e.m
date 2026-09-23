import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";

export const Route = createFileRoute("/horarios/turmas/$turmaId/impressao")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId } = Route.useParams();
  const { data } = Route.useSearch();
  return (
    <SchedulePrintView
      scope={{ kind: "class", id: turmaId }}
      {...(data ? { referenceDate: data } : {})}
    />
  );
}
