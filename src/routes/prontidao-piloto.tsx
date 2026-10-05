import { createFileRoute } from "@tanstack/react-router";
import { PilotReadinessPage } from "@/features/pilot/pilot-page";

export const Route = createFileRoute("/prontidao-piloto")({
  head: () => ({
    meta: [
      { title: "Prontidão para piloto — SIGEM" },
      { name: "description", content: "Checklist go/no-go da escola piloto, derivado dos registros oficiais." },
      { property: "og:title", content: "Prontidão para piloto — SIGEM" },
      { property: "og:description", content: "Concluído, pendente, não aplicável ou bloqueado, com link para corrigir cada item." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PilotReadinessPage,
});
