import { createFileRoute } from "@tanstack/react-router";
import { AttendancePage } from "@/features/simple/attendance-page";

export const Route = createFileRoute("/chamada")({
  head: () => ({ meta: [
    { title: "Chamada — SIGEM" },
    { name: "description", content: "Marque presença e falta da turma." },
    { property: "og:title", content: "Chamada — SIGEM" },
    { property: "og:description", content: "Marque presença e falta da turma." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AttendancePage,
});
