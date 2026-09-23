import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ProfessionalPedagogicalPage } from "@/features/pedagogical/professional-pedagogical-page";

export const Route = createFileRoute("/profissionais/$id/atuacoes/")({
  head: () => ({
    meta: [
      { title: `Atuações pedagógicas do profissional — ${brand.name}` },
      {
        name: "description",
        content:
          "Atuações vigentes e históricas de um profissional, com vínculos funcionais, unidades, turmas, componentes ou campos, papéis e vigências.",
      },
      { property: "og:title", content: `Atuações pedagógicas do profissional — ${brand.name}` },
      {
        property: "og:description",
        content: "Vínculo funcional e atuação pedagógica permanecem conceitos distintos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfessionalPedagogicalRoute,
});

function ProfessionalPedagogicalRoute() {
  const { id } = Route.useParams();
  return <ProfessionalPedagogicalPage professionalId={id} />;
}
