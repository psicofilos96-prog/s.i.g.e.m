import { createFileRoute } from "@tanstack/react-router";
import { OptimizerPage } from "@/features/timetable-optimizer/optimizer-page";

export const Route = createFileRoute("/sugestoes-de-horario")({
  head: () => ({
    meta: [
      { title: "Sugestões de horário — SIGEM" },
      { name: "description", content: "Alternativas de grade geradas só com restrições existentes; nenhuma é aplicada automaticamente." },
      { property: "og:title", content: "Sugestões de horário — SIGEM" },
      { property: "og:description", content: "Otimizador assistido com conflitos explicados e restrições não consideradas visíveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OptimizerPage,
});
