import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardPage } from "@/features/reports/dashboards/dashboard-page";
import { PageHeader } from "@/components/sigem/patterns";

export const Route = createFileRoute("/relatorios_/paineis")({
  head: () => ({
    meta: [
      { title: "Painéis e gráficos — SIGEM" },
      { name: "description", content: "Monte painéis com gráficos sobre escolas, turmas, matrículas, servidores, jornadas, frequência e avaliações, com filtros, drill-down e exportação." },
      { property: "og:title", content: "Painéis e gráficos — SIGEM" },
      { property: "og:description", content: "Gráficos lidos no servidor com o acesso da sua conta: cada escola vê só o que já pode ver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <nav className="text-sm print:hidden"><Link to="/relatorios" className="underline">Relatórios</Link> › Painéis e gráficos</nav>
      <PageHeader eyebrow="Relatórios" title="Painéis e gráficos" description="Monte gráficos com os dados do catálogo, filtre por período, clique numa barra para detalhar e salve o painel. Os dados são lidos com o seu acesso." />
      <DashboardPage />
    </div>
  );
}
