import { createFileRoute } from "@tanstack/react-router";
import { SchedulesHomePage } from "@/features/schedules/schedules-home-page";
export const Route = createFileRoute("/horarios/")({ component: SchedulesHomePage });
