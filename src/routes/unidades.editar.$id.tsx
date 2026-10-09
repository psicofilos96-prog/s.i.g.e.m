import { createFileRoute } from "@tanstack/react-router";
import { UnitEditorPage } from "@/features/units/unit-editor-page";

export const Route = createFileRoute("/unidades/editar/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Editar unidade escolar — SIGEM" },
      { name: "description", content: "Registro de nova versão do cadastro de uma unidade escolar." },
      { property: "og:title", content: "Editar unidade escolar — SIGEM" },
      { property: "og:description", content: "Nova versão do cadastro institucional, preservando a anterior." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: function EditUnit() { const { id } = Route.useParams(); return <UnitEditorPage schoolId={id} />; },
});
