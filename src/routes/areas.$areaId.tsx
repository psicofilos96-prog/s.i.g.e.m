import { createFileRoute } from "@tanstack/react-router";
import { AreaWorkspacePage } from "@/features/authority/area-workspace-page";

export const Route = createFileRoute("/areas/$areaId")({
  head: () => ({
    meta: [
      { title: "Área de trabalho — SIGEM" },
      { name: "description", content: "Atividades da área institucional, conforme a atuação vigente." },
      { property: "og:title", content: "Área de trabalho — SIGEM" },
      { property: "og:description", content: "Atividades por competência da área institucional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { areaId } = Route.useParams();
  return <AreaWorkspacePage areaId={areaId} />;
}
