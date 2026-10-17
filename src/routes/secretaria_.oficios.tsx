import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { OfficialLettersPage } from "@/features/school-secretariat/official-letters-page";

export const Route = createFileRoute("/secretaria_/oficios")({
  head: () => ({
    meta: [
      { title: "Ofícios — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Ofícios da escola com numeração anual automática e PDF A4." },
      { property: "og:title", content: "Ofícios — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Ofícios da escola com numeração anual automática e PDF A4." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <OfficialLettersPage />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="Os ofícios são da sua escola." />} />
  ),
});
