import { createFileRoute } from "@tanstack/react-router";
import { PersonWorkspacePage } from "@/features/students/person-workspace-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/alunos/editar/$id")({
  head: () => ({
    meta: [
      { title: `Editar cadastro do aluno — ${brand.name}` },
      {
        name: "description",
        content:
          "Edição demonstrativa dos dados cadastrais da pessoa, distinguindo correção cadastral de alteração histórica relevante.",
      },
      { property: "og:title", content: `Editar cadastro do aluno — ${brand.name}` },
      {
        property: "og:description",
        content: "Alterações cadastrais demonstrativas, sem afetar matrícula, vínculo ou turma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditPersonRoute,
});

function EditPersonRoute() {
  const { id } = Route.useParams();
  return <PersonWorkspacePage mode="edicao" originId={id} />;
}
