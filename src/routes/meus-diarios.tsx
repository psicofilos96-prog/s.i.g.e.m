import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { MyDiariesPage } from "@/features/teacher-diary/my-diaries-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/meus-diarios")({
  head: () => ({
    meta: [
      { title: `Meus diários — ${brand.name}` },
      { name: "description", content: "Diário do professor: aulas ministradas, chamada e conteúdo a partir das suas regências vigentes." },
      { property: "og:title", content: `Meus diários — ${brand.name}` },
      { property: "og:description", content: "Registro de aulas e frequência sobre as regências oficiais da escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <MyDiariesPage />}
      laboratory={() => <EmptyState title="Entre para usar o Diário" description="O Diário do professor só funciona com sua conta institucional." />}
    />
  ),
});
