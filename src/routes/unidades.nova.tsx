import { createFileRoute } from "@tanstack/react-router";
import { UnitEditorPage } from "@/features/units/unit-editor-page";

export const Route = createFileRoute("/unidades/nova")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova unidade escolar — SIGEM" },
      { name: "description", content: "Cadastro de nova unidade escolar da rede municipal de Itaperuna." },
      { property: "og:title", content: "Nova unidade escolar — SIGEM" },
      { property: "og:description", content: "Cadastro institucional de unidade escolar, versionado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <UnitEditorPage schoolId={null} />,
});
