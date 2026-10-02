import { createFileRoute } from "@tanstack/react-router";
import { ClassWorkspacePage } from "@/features/classes/class-workspace-page";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import * as Inst from "@/features/classes/institutional-classes-pages";

export const Route = createFileRoute("/turmas/nova")({
  head: () => ({
    meta: [
      { title: `Nova turma — ${brand.name}` },
      {
        name: "description",
        content:
          "Configuração demonstrativa de turma a partir do contexto: unidade, período letivo, oferta, organização, agrupamentos e matriz.",
      },
      { property: "og:title", content: `Nova turma — ${brand.name}` },
      {
        property: "og:description",
        content: "Workspace demonstrativo de configuração de turma, sem persistência de dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate institutional={() => <Inst.InstitutionalClassCreatePage />} laboratory={() => <ClassWorkspacePage mode="nova" />} />,
});
