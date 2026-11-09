import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { VisitBookPage } from "@/features/school-visits/visit-book-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/visitas-escolares")({
  head: () => ({
    meta: [
      { title: `Livro de visitas da escola — ${brand.name}` },
      { name: "description", content: "Registro das visitas recebidas pela escola, usado na Seção VI do Mapa Estatístico." },
      { property: "og:title", content: `Livro de visitas da escola — ${brand.name}` },
      { property: "og:description", content: "Registro das visitas recebidas pela unidade escolar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <VisitBookPage />}
      laboratory={() => <EmptyState title="Entre para registrar visitas" description="O livro de visitas só funciona com sua conta." />}
    />
  ),
});
