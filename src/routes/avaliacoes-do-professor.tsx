import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { AuthoringPage } from "@/features/teacher-assessment/authoring-page";

export const Route = createFileRoute("/avaliacoes-do-professor")({
  head: () => ({
    meta: [
      { title: "Avaliações do professor — SIGEM" },
      { name: "description", content: "Banco de itens e instrumentos avaliativos versionados do professor, com gabarito separado e impressão." },
      { property: "og:title", content: "Avaliações do professor — SIGEM" },
      { property: "og:description", content: "Itens, instrumentos congelados ao publicar e impressão; resultado continua na Pauta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <AuthoringPage />} laboratory={() => <EmptyState title="Entre para montar avaliações" description="A autoria de avaliações só existe com login e para regências suas." />} />;
}
