import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { YearPreparationPage } from "@/features/year-transition/year-preparation-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/preparacao-ano")({
  head: () => ({
    meta: [
      { title: `Preparação do ano operacional — ${brand.name}` },
      { name: "description", content: "Transição de alunos e servidores entre anos, por escola, com decisão explícita da Secretaria." },
      { property: "og:title", content: `Preparação do ano operacional — ${brand.name}` },
      { property: "og:description", content: "Renovação, transferência e busca ativa exata sem cópia automática de vínculos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <YearPreparationPage />}
      laboratory={() => <EmptyState title="Entre para preparar o ano" description="A preparação do ano usa somente dados oficiais. Não há modo de demonstração." />}
    />
  ),
});
