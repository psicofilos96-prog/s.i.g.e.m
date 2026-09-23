import { createFileRoute } from "@tanstack/react-router";
import { ClassSchedulesPage } from "@/features/schedules/class-schedules-page";
export const Route = createFileRoute("/horarios/turmas/")({ component: ClassSchedulesPage });
