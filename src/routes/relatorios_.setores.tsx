import { createFileRoute, Link } from "@tanstack/react-router";
import { SectorBoardsPage } from "@/features/reports/dashboards/sector-page";
import { PageHeader } from "@/components/sigem/patterns";

export const Route = createFileRoute("/relatorios_/setores")({
  head: () => ({
    meta: [
      { title: "Painéis por setor — SIGEM" },
      { name: "description", content: "Ações, alertas e indicadores de cada setor, com detalhamento até os registros que sua conta pode ver." },
      { property: "og:title", content: "Painéis por setor — SIGEM" },
      { property: "og:description", content: "Secretaria, CIECE, Direção, Docente, Diário, Mapa, Alimentação, Avaliação e Supervisão no mesmo catálogo de dados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <nav className="text-sm"><Link to="/relatorios" className="underline">Relatórios</Link> › Painéis por setor</nav>
      <PageHeader eyebrow="Relatórios" title="Painéis por setor" description="O que cada setor precisa acompanhar, lido com o acesso da sua conta. Clique num grupo para ver os registros." />
      <SectorBoardsPage />
    </div>
  );
}
