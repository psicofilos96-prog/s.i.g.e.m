import { createFileRoute } from "@tanstack/react-router";
import { ProfessionalSchedulesPage } from "@/features/schedules/professional-schedules-page";
export const Route = createFileRoute("/horarios/profissionais/")({
  component: ProfessionalSchedulesPage,
});
