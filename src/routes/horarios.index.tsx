import { createFileRoute } from "@tanstack/react-router";
import { SchedulesHomePage } from "@/features/schedules/schedules-home-page";
export const Route = createFileRoute("/horarios/")({
  head: () => ({
    meta: [
      { title: "Horários escolares — SIGEM" },
      {
        name: "description",
        content: "Consulta demonstrativa de jornadas, grades semanais e horários do SIGEM.",
      },
      { property: "og:title", content: "Horários escolares — SIGEM" },
      {
        property: "og:description",
        content: "Consulta demonstrativa de jornadas, grades semanais e horários do SIGEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulesHomePage,
});
