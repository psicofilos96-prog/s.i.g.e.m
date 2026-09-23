import { createFileRoute } from "@tanstack/react-router";
import { ScheduleDocumentPage } from "@/features/schedules/schedule-document-page";
export const Route = createFileRoute("/horarios/turmas/$turmaId/documentos/$tipo/$referenciaId")({
  component: RouteComponent,
});
function RouteComponent() {
  const { turmaId, tipo, referenciaId } = Route.useParams();
  return <ScheduleDocumentPage classId={turmaId} kind={tipo} referenceId={referenciaId} />;
}
