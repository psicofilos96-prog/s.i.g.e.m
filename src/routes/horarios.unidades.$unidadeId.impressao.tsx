import { createFileRoute } from "@tanstack/react-router";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";
export const Route = createFileRoute("/horarios/unidades/$unidadeId/impressao")({ component: RouteComponent });
function RouteComponent() { const { unidadeId } = Route.useParams(); return <SchedulePrintView scope={{ kind: "unit", id: unidadeId }} />; }