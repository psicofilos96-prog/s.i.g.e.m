import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";

export const Route = createFileRoute("/horarios/profissionais/$profissionalId/impressao")({
  validateSearch: z.object({ data: z.string().optional() }),
  component: RouteComponent,
});
function RouteComponent() {
  const { profissionalId } = Route.useParams();
  const { data } = Route.useSearch();
  return (
    <SchedulePrintView
      scope={{ kind: "professional", id: profissionalId }}
      {...(data ? { referenceDate: data } : {})}
    />
  );
}
