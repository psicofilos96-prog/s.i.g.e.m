import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/features/simple/reports-page";

export const Route = createFileRoute("/numeros")({
  head: () => ({ meta: [
    { title: "Relatórios — SIGEM" },
    { name: "description", content: "Relatórios, gráficos e exportação em Excel e PDF." },
    { property: "og:title", content: "Relatórios — SIGEM" },
    { property: "og:description", content: "Relatórios, gráficos e exportação em Excel e PDF." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReportsPage,
});
