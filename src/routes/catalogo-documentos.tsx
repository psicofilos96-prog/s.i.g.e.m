import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { filterCatalog, SECTORS, type DocStatus } from "@/features/reports/document-catalog";

const title = "Catálogo de documentos — SIGEM";
const description = "Todos os documentos e relatórios do SIGEM por setor, com onde emitir e o que ainda falta.";

export const Route = createFileRoute("/catalogo-documentos")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const STATUS_STYLE: Record<DocStatus, string> = { COMPLETO: "bg-primary text-primary-foreground", PARCIAL: "bg-secondary text-secondary-foreground", PENDENTE: "bg-accent text-accent-foreground", BLOQUEADO: "bg-muted text-muted-foreground" };

function Page() {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [status, setStatus] = useState<DocStatus | null>(null);
  const docs = filterCatalog(q, sector, status);
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Catálogo de documentos</h1>
        <p className="text-sm text-muted-foreground">Onde emitir cada documento e, quando ainda não dá, o motivo exato.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Buscar documento" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        <select aria-label="Setor" value={sector ?? ""} onChange={(e) => setSector(e.target.value || null)} className="rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos os setores</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {(["COMPLETO", "PARCIAL", "PENDENTE", "BLOQUEADO"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(status === s ? null : s)}>{s}</Button>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{d.label}</p>
              <p className="text-xs text-muted-foreground">{d.sector} · Depende de: {d.dependsOn === "desenvolvimento" ? "desenvolvimento" : d.dependsOn === "norma" ? "norma ausente" : "dados reais (só produção)"} · {d.reason}</p>
            </div>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[d.status]}`}>{d.status}</span>
            {d.route && !d.route.includes("$") ? <Button asChild size="sm" variant="outline"><Link to={d.route as "/relatorios"}>Abrir</Link></Button> : null}
          </li>
        ))}
        {docs.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhum documento com esses filtros.</li>}
      </ul>
    </main>
  );
}
