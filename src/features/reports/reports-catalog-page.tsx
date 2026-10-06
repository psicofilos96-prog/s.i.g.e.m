import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/sigem/patterns";
import { REPORTS } from "./report-registry";

const WHERE: Record<string, string> = { "mapa-estatistico-rede": "/mapa-estatistico-rede", "inclusao-relatorio-pedagogico-minimizado": "/inclusao", "total-aulas-ofertadas": "/quadro-docente", "total-aulas-rede": "/quadro-docente", "necessidade-de-professor": "/quadro-docente" };

export function ReportsCatalogPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Catálogo único de relatórios. Cada relatório usa os dados que sua conta já pode ver; exportar nunca amplia acesso." />
      <ul className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <li key={r.id} className="rounded-md border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold">{r.title} <span className="text-xs text-muted-foreground">v{r.version}</span></h2>
            <p className="text-sm text-muted-foreground">{r.description}</p>
            {r.dependency ? (
              <p className="text-sm"><strong>Indisponível:</strong> {r.dependency}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Fonte: {r.source}</p>
                <p className="text-xs">Formatos: {r.formats.map((f) => f.toUpperCase()).join(", ")}{r.reproducible ? " · reproduzível (impressão digital)" : ""}</p>
                {WHERE[r.id] && <Link to={WHERE[r.id] as "/mapa-estatistico-rede"} className="text-sm text-primary underline">Abrir</Link>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
