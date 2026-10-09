import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { RegistryHero } from "@/components/sigem/registry-layout";
import { QUICK_REPORTS, QuickReportCard } from "./quick-reports";
import { ReportBuilder } from "./report-builder-page";
import { CATALOG, NATURE_LABEL, OFFICIAL_DOCUMENTS, catalogOptions, emptyCatalogFilter, filterCatalog, suggestReports, type CatalogFilter } from "./report-catalog";

const SCOPE: Record<string, string> = { rede: "Rede", escola: "Escola", pessoa: "Pessoa", conta: "Conta" };
const sel = "w-full min-w-0 min-h-9 pointer-coarse:min-h-11 rounded-md border border-input bg-background px-2 py-1 text-sm";

export function ReportsCatalogPage() {
  const [f, setF] = useState<CatalogFilter>(emptyCatalogFilter);
  const opts = catalogOptions(CATALOG);
  const list = filterCatalog(CATALOG, f);
  const [ask, setAsk] = useState("");
  const tips = suggestReports(CATALOG, ask);
  return (
    <div className="space-y-8">
      <RegistryHero
        eyebrow="Rede Municipal de Itaperuna · Central de relatórios"
        title="Qual relatório você precisa?"
        lede="Os mais usados geram com um clique. Para montar o seu, use o gerador. Você só vê e exporta o que sua conta já pode ler."
        count={<>{CATALOG.length}<span className="ml-2 align-middle text-sm font-normal text-muted-foreground">no catálogo</span></>}
      />
      <section aria-labelledby="quick-h" className="space-y-3">
        <h2 id="quick-h" className="font-display text-2xl font-semibold text-foreground">Mais usados</h2>
        <div className="grid gap-4 lg:grid-cols-2">{QUICK_REPORTS.map((q) => <QuickReportCard key={q.sourceId} {...q} />)}</div>
      </section>
      <section aria-labelledby="builder-h" className="space-y-3">
        <h2 id="builder-h" className="font-display text-2xl font-semibold text-foreground">Montar o seu</h2>
        <ReportBuilder />
      </section>
      <h2 className="font-display text-2xl font-semibold text-foreground">Catálogo completo</h2>
      <section aria-label="Assistente de relatórios" className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="flex flex-col gap-1 text-sm font-medium">Descreva o que você quer saber
          <input className={sel} value={ask} placeholder="Ex.: estudantes matriculados por escola" onChange={(e) => setAsk(e.target.value)} />
        </label>
        {ask.trim() && (tips.length === 0
          ? <p className="text-sm text-muted-foreground" role="status">Nenhum relatório do catálogo corresponde. Tente outras palavras ou use os filtros abaixo.</p>
          : <ul className="space-y-1 text-sm" role="status">{tips.map((t) => <li key={t.id}>{t.available ? <Link to={t.route as never} className="underline">{t.title}</Link> : <span>{t.title} <span className="text-muted-foreground">(indisponível: {t.dependency})</span></span>} <span className="text-muted-foreground">· {t.domain}</span></li>)}</ul>)}
      </section>
      <div className="flex flex-wrap gap-3" role="search">
        <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Buscar
          <input className={sel} value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} />
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Domínio
          <select className={sel} value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })}><option value="">Todos</option>{opts.domain.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Escopo
          <select className={sel} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}><option value="">Todos</option>{opts.scope.map((d) => <option key={d} value={d}>{SCOPE[d] ?? d}</option>)}</select>
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Natureza
          <select className={sel} value={f.nature} onChange={(e) => setF({ ...f, nature: e.target.value })}><option value="">Todas</option>{opts.nature.map((d) => <option key={d} value={d}>{NATURE_LABEL[d as keyof typeof NATURE_LABEL]}</option>)}</select>
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Disponibilidade
          <select className={sel} value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value as CatalogFilter["availability"] })}><option value="">Todas</option><option value="disponivel">Disponível</option><option value="indisponivel">Indisponível</option></select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground" role="status">{list.length} de {CATALOG.length} relatórios</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((r) => (
          <li key={r.id} className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display text-lg font-semibold">{r.title} <span className="text-xs text-muted-foreground">v{r.version}</span></h3>
            <p className="text-xs text-muted-foreground">{r.domain} · escopo {SCOPE[r.scope]} · {NATURE_LABEL[r.nature]}</p>
            <p className="text-sm text-muted-foreground">{r.description}</p>
            {!r.available ? (
              <p className="text-sm"><strong>Indisponível:</strong> {r.dependency}</p>
            ) : (
              <>
                <p className="text-xs">Fonte: {r.source}</p>
                <p className="text-xs">Acesso: {r.acl}</p>
                <p className="text-xs">Filtros: {r.params.length ? r.params.join(", ") : "nenhum"}{r.temporal.asOf ? " · data de referência" : ""}{r.temporal.knownAt ? " · conhecido até" : ""}</p>
                <p className="text-xs">Formatos: {r.formats.map((x) => (x === "pdf" ? "impressão" : x.toUpperCase())).join(", ")}</p>
                <Link to={r.route as "/relatorios"} className="text-sm text-primary underline">Abrir na tela dona</Link>
              </>
            )}
          </li>
        ))}
      </ul>
      <section className="rounded-md border border-border p-4 text-sm">
        <h2 className="font-semibold">{OFFICIAL_DOCUMENTS.title}</h2>
        <p className="text-muted-foreground">{OFFICIAL_DOCUMENTS.note}</p>
        <Link to="/secretaria" className="inline-flex min-h-6 items-center text-primary underline pointer-coarse:min-h-11">Abrir a Secretaria</Link>
      </section>
    </div>
  );
}
