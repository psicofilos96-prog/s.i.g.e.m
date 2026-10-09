import { SignInRequired } from "@/components/sigem/sign-in-required";
import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { InstitutionalProfessionalsListPage } from "@/features/students/institutional-lists";

export const Route = createFileRoute("/profissionais/")({
  head: () => ({
    meta: [
      { title: `Profissionais — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa de profissionais, vínculos funcionais, lotações, funções e situações contextuais.",
      },
      { property: "og:title", content: `Profissionais — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Profissionais fictícios apresentados com minimização de dados e contexto funcional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // PERF.LOADING.2: com sessão, só a base institucional paginada no servidor; demonstração apenas sem sessão.
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <InstitutionalProfessionalsListPage />} laboratory={() => <SignInRequired title="Profissionais" what="os profissionais da rede" />} />,
});
