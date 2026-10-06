import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { DiaryOverviewPage } from "@/features/teacher-diary/diary-overview-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/acompanhamento-diarios")({
  head: () => ({
    meta: [
      { title: `Acompanhamento dos diários — ${brand.name}` },
      { name: "description", content: "Consulta somente leitura das aulas e chamadas registradas, conforme a autorização da sua atuação." },
      { property: "og:title", content: `Acompanhamento dos diários — ${brand.name}` },
      { property: "og:description", content: "Direção, Secretaria e rede acompanham o Diário sem registrar aulas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <DiaryOverviewPage />}
      laboratory={() => <EmptyState title="Entre para acompanhar os diários" description="A consulta só funciona com sua conta institucional." />}
    />
  ),
});
