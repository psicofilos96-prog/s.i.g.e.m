import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { detect, DEFAULT_PARAMS, METHOD, type Series, type SeriesOutcome } from "@/features/anomalies/anomaly-core";
import { loadSeries } from "@/features/anomalies/anomaly-sources";

export const Route = createFileRoute("/revisao-de-anomalias")({
  head: () => ({
    meta: [
      { title: "Variações para revisar — SIGEM" },
      { name: "description", content: "Variações estatísticas em contagens agregadas que merecem conferência, com método e limitações." },
      { property: "og:title", content: "Variações para revisar — SIGEM" },
      { property: "og:description", content: "Sinais para revisão humana, sem decisão automática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const DISMISS_KEY = "sigem.anomalias.descartadas.v1";

function Page() {
  const [data, setData] = useState<{ series: Series[]; outcomes: SeriesOutcome[]; unavailable: string[] } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]")); } catch { /* ignora */ }
    loadSeries().then((r) => setData({ ...r, outcomes: r.series.map((s) => detect(s, DEFAULT_PARAMS)) }));
  }, []);
  const dismiss = (id: string) => { const n = [...dismissed, id]; setDismissed(n); localStorage.setItem(DISMISS_KEY, JSON.stringify(n)); };

  return (
    <section className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader title="Variações para revisar" description="Contagens agregadas que mudaram muito em relação ao histórico recente — convite à conferência, não conclusão." />
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Inconsistências certas ficam na <Link to="/qualidade-dos-dados" className="underline">Central de Qualidade</Link>.</p>
        <details className="text-sm"><summary className="cursor-pointer">Como é calculado</summary>
          <p className="mt-2">{METHOD.description} Limiar {DEFAULT_PARAMS.robustZ}, variação mínima {DEFAULT_PARAMS.minRelativeChange * 100}%, grupos abaixo de {DEFAULT_PARAMS.minGroupSize} são ignorados, histórico mínimo {DEFAULT_PARAMS.minReference} pontos.</p>
          <ul className="mt-2 list-disc pl-5">{METHOD.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      </header>
      {!data && <SkeletonState label="Carregando" />}
      {data?.unavailable.map((u) => <p key={u} className="text-sm text-muted-foreground">Fonte não disponível para sua conta: {u}.</p>)}
      {data && data.series.length === 0 && <StatePanel title="Nenhuma série disponível" description="Sua conta não lê nenhuma contagem agregada que possa ser comparada com o histórico." />}
      {data?.series.map((s, i) => {
        const o = data.outcomes[i]!;
        const signals = o.state === "verificado" ? o.signals.filter((x) => !dismissed.includes(x.id)) : [];
        return (
          <section key={s.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-xs text-muted-foreground">População: {s.population}.</p>
            {o.state === "nao-verificavel" ? <p className="text-sm">Não verificável: {o.reason}</p> : (
              <p className="text-sm text-muted-foreground">{o.evaluated} pontos avaliados; {o.skippedSmall} ignorados por grupo pequeno; {o.missing} sem dado.</p>
            )}
            {o.state === "verificado" && signals.length === 0 && <p className="text-sm">Nada para revisar.</p>}
            {signals.map((x) => (
              <article key={x.id} className="space-y-1 rounded-md border border-border p-3">
                <p className="text-sm">{x.explanation}</p>
                <p className="text-xs text-muted-foreground">Método {x.method} v{x.methodVersion} · desvio {x.deviation} · janela {x.reference.window[0]} a {x.reference.window[1]} ({x.reference.size} pontos)</p>
                <Button size="sm" variant="outline" onClick={() => dismiss(x.id)}>Descartar</Button>
              </article>
            ))}
          </section>
        );
      })}
    </section>
  );
}
