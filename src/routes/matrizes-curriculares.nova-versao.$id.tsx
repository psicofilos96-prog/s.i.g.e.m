import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { createFileRoute } from "@tanstack/react-router";
import { MatrixWorkspacePage } from "@/features/curriculum/matrix-workspace-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/matrizes-curriculares/nova-versao/$id")({
  head: () => ({
    meta: [
      { title: `Nova versão de matriz curricular — ${brand.name}` },
      {
        name: "description",
        content:
          "Elaboração demonstrativa de nova versão a partir de matriz existente, preservando a versão anterior.",
      },
      { property: "og:title", content: `Nova versão de matriz — ${brand.name}` },
      {
        property: "og:description",
        content: "Nova versão em rascunho: a versão de origem permanece inalterada e consultável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <DemoOnlyRoute what="O editor desta tela trabalha sobre matrizes de demonstração." real="/matrizes-curriculares" realLabel="Abrir as matrizes curriculares da rede">{() => <NewVersionRoute />}</DemoOnlyRoute>,
});

function NewVersionRoute() {
  const { id } = Route.useParams();
  return <MatrixWorkspacePage mode="nova-versao" originId={id} />;
}
