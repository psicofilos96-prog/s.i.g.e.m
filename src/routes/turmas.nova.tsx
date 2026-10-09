import { SignInRequired } from "@/components/sigem/sign-in-required";
import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { ClassCreateWizardPage } from "@/features/classes/class-wizard-page";

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
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <ClassCreateWizardPage />} laboratory={() => <SignInRequired title="Nova turma" what="e cadastrar turmas" />} />,
});
