import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { brand } from "@/config/branding";
import { PedagogicalWorkspacePage } from "@/features/pedagogical/pedagogical-workspace-page";

const searchSchema = z.object({
  profissional: z.string().optional(),
  vinculo: z.string().optional(),
  turma: z.string().optional(),
});

export const Route = createFileRoute("/atuacoes-pedagogicas/nova")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Nova atuação pedagógica — ${brand.name}` },
      {
        name: "description",
        content:
          "Workspace demonstrativo de nova atuação pedagógica: profissional, vínculo funcional, unidade, período letivo, turma, componente ou campo, papel e vigência.",
      },
      { property: "og:title", content: `Nova atuação pedagógica — ${brand.name}` },
      {
        property: "og:description",
        content:
          "A operação cria somente uma atuação pedagógica demonstrativa, sem alterar vínculo, cargo, lotação ou função.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewPedagogicalRoute,
});

function NewPedagogicalRoute() {
  const { profissional, vinculo, turma } = Route.useSearch();
  return (
    <PedagogicalWorkspacePage
      mode="nova"
      {...(profissional ? { professionalId: profissional } : {})}
      {...(vinculo ? { presetLinkId: vinculo } : {})}
      {...(turma ? { presetClassId: turma } : {})}
    />
  );
}
