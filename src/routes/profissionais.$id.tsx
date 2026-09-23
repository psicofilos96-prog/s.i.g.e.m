import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ProfessionalDetailPage } from "@/features/professionals/professional-detail-page";

export const Route = createFileRoute("/profissionais/$id")({
  head: () => ({
    meta: [
      { title: `Profissional — ${brand.name}` },
      {
        name: "description",
        content:
          "Leitura demonstrativa de uma Pessoa no papel profissional, seus vínculos, lotações, funções e trajetória funcional.",
      },
      { property: "og:title", content: `Profissional — ${brand.name}` },
      {
        property: "og:description",
        content: "Trajetória funcional fictícia de um profissional no SIGEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfessionalDetailRoute,
});

function ProfessionalDetailRoute() {
  const { id } = Route.useParams();
  return <ProfessionalDetailPage id={id} />;
}
