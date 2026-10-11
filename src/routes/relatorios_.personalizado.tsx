import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomReportPage } from "@/features/reports/custom/custom-report-page";

export const Route = createFileRoute("/relatorios_/personalizado")({
  head: () => ({
    meta: [
      { title: "Gerador personalizado de relatórios — SIGEM" },
      { name: "description", content: "Monte relatórios cruzando escolas, turmas, estudantes, matrículas, servidores e jornadas, com filtros, agrupamentos e exportação PDF/XLSX/CSV." },
      { property: "og:title", content: "Gerador personalizado de relatórios — SIGEM" },
      { property: "og:description", content: "Relatórios montados por você, lidos no servidor com o acesso da sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <nav className="text-sm"><Link to="/relatorios" className="underline">Relatórios</Link> › Gerador personalizado</nav>
      <h1 className="text-2xl font-semibold">Gerador personalizado</h1>
      <p className="text-sm text-muted-foreground">Escolha a fonte, cruze com outras, filtre, agrupe e exporte. A consulta roda no servidor com o seu acesso: cada escola vê só o que já pode ver.</p>
      <CustomReportPage />
    </main>
  );
}
