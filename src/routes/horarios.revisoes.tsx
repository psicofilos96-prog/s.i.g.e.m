import { createFileRoute } from "@tanstack/react-router";
import { ScheduleReviewsPage } from "@/features/schedules/schedule-reviews-page";
export const Route = createFileRoute("/horarios/revisoes")({ component: ScheduleReviewsPage });
