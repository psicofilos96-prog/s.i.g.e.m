import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { brand } from "@/config/branding";
import { PedagogicalWorkspacePage } from "@/features/pedagogical/pedagogical-workspace-page";

const searchSchema = z.object({
  vinculo: z.string().optional(),
  turma: z.string().optional(),
  unidade: z.string().optional(),
});

export const Route = createFileRoute("/profissionais/$id/atuacoes/nova")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Nova atuação pedagógica do profissional — ${brand.name}` },
      {
        name: "description",
        content:
          "Criação demonstrativa de atuação pedagógica a partir do profissional, com seleção explícita do vínculo funcional pertinente.",
      },
      { property: "og:title", content: `Nova atuação pedagógica do profissional — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Nenhuma pessoa, profissional, vínculo, lotação ou função é criada nesta operação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewProfessionalPedagogicalRoute,
});

function NewProfessionalPedagogicalRoute() {
  const { id } = Route.useParams();
  const { vinculo, turma, unidade } = Route.useSearch();
  return (
    <PedagogicalWorkspacePage
      mode="nova"
      professionalId={id}
      {...(vinculo ? { presetLinkId: vinculo } : {})}
      {...(turma ? { presetClassId: turma } : {})}
      {...(unidade ? { presetUnitId: unidade } : {})}
    />
  );
}
