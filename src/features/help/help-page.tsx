import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Input } from "@/components/ui/input";
import { GLOSSARY, RELEASES, TOPICS } from "./help-content";
import { flowsFor, searchHelp, topicVisible, toursFor, txt } from "./help-model";
import { useHelpViewer } from "./help-components";

export function HelpPage() {
  const v = useHelpViewer();
  const [q, setQ] = useState("");
  const hits = searchHelp(q, v);
  return (
    <div className="space-y-8">
      <PageHeader title="Central de ajuda" description="Conceitos, fluxos e novidades do SIGEM. A ajuda explica o sistema; as regras escolares vêm sempre das configurações homologadas." />
      <section aria-labelledby="busca" className="space-y-2">
        <h2 id="busca" className="text-lg font-semibold">Buscar na ajuda</h2>
        <label className="block text-sm">Termo<Input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {q.trim() && (hits.length ? <ul className="space-y-2" aria-live="polite">{hits.map((h) => <li key={h.kind + h.id}><a href={`#${h.kind}-${h.id}`} className="font-medium text-primary underline">{h.title}</a><p className="text-sm text-muted-foreground">{h.excerpt}</p></li>)}</ul>
          : <p role="status" className="text-sm">Nenhum resultado para "{q}".</p>)}
      </section>
      <section aria-labelledby="conceitos" className="space-y-3">
        <h2 id="conceitos" className="text-lg font-semibold">Conceitos</h2>
        {TOPICS.filter((t) => topicVisible(t, v)).map((t) => (
          <article key={t.id} id={`topico-${t.id}`} className="rounded-md border border-border p-3">
            <h3 className="font-medium">{txt(t.title)}</h3><p className="text-sm">{txt(t.body)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Versão {t.version} · {t.updatedOn}</p>
            {t.links && <p className="mt-1 text-sm">{t.links.map((l) => <a key={l.to} href={l.to} className="mr-3 text-primary underline">{txt(l.label)}</a>)}</p>}
          </article>))}
      </section>
      <section aria-labelledby="fluxos" className="space-y-3">
        <h2 id="fluxos" className="text-lg font-semibold">Como funciona</h2>
        {flowsFor(v).map((f) => <article key={f.id}><h3 className="font-medium">{txt(f.title)}</h3><ol className="list-decimal pl-5 text-sm">{f.steps.map((s, i) => <li key={i}>{s.to ? <a href={s.to} className="text-primary underline">{txt(s.text)}</a> : txt(s.text)}</li>)}</ol></article>)}
      </section>
      <section aria-labelledby="tours" className="space-y-3">
        <h2 id="tours" className="text-lg font-semibold">Roteiros guiados (opcionais)</h2>
        {toursFor(v).map((t) => <article key={t.id}><h3 className="font-medium">{txt(t.title)}</h3><ol className="list-decimal pl-5 text-sm">{t.steps.map((s) => <li key={s.route}><a href={s.route} className="text-primary underline">{txt(s.text)}</a></li>)}</ol></article>)}
      </section>
      <section aria-labelledby="glossario" className="space-y-2">
        <h2 id="glossario" className="text-lg font-semibold">Glossário</h2>
        {GLOSSARY.length ? <dl className="grid gap-2 sm:grid-cols-2">{GLOSSARY.map((g) => <div key={g.id} id={`glossario-${g.id}`}><dt className="font-medium">{txt(g.term)}</dt><dd className="text-sm">{txt(g.definition)}</dd></div>)}</dl> : <EmptyState title="Glossário vazio" description="Nenhum termo cadastrado." />}
      </section>
      <section aria-labelledby="novidades" className="space-y-2">
        <h2 id="novidades" className="text-lg font-semibold">Novidades</h2>
        {RELEASES.map((r) => <article key={r.version}><h3 className="font-medium">{r.version}</h3><ul className="list-disc pl-5 text-sm">{r.items.map((i, k) => <li key={k}>{txt(i)}</li>)}</ul></article>)}
      </section>
    </div>
  );
}
