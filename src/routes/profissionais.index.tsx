import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ProfessionalsListPage } from "@/features/professionals/professionals-list-page";

export const Route = createFileRoute("/profissionais/")({
  head: () => ({ meta: [
    { title: `Profissionais — ${brand.name}` },
    { name: "description", content: "Consulta demonstrativa de profissionais, vínculos funcionais, lotações, funções e situações contextuais." },
    { property: "og:title", content: `Profissionais — ${brand.name}` },
    { property: "og:description", content: "Profissionais fictícios apresentados com minimização de dados e contexto funcional." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProfessionalsListPage,
});
