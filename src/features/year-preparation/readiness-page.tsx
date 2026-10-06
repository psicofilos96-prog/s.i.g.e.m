import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority, sessionContextKey } from "@/features/authority/session-authority";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { ITEMS, evaluate, summarize, type ReadinessState } from "./readiness-model";
import { readProbes, type ReadClient } from "./readiness-probes";

const LABEL: Record<ReadinessState, string> = { READY: "Pronto", PENDING: "Pendente", BLOCKED: "Bloqueado", NOT_APPLICABLE: "Não se aplica", UNKNOWN: "Desconhecido" };

/** AY — central de preparação de 2027: orienta e valida; só navega. Não abre ano nem configura nada. */
export function YearPreparationPage() {
  const authority = useSessionAuthority();
  const q = useQuery({ queryKey: ["ay-readiness", sessionContextKey(authority)], enabled: authority.status === "signed-in", retry: false, queryFn: () => readProbes(supabase as unknown as ReadClient, 2027) });
  const h1 = <h1 className="sr-only">Preparação do ano letivo 2027</h1>;
  if (authority.status === "signed-out") return <>{h1}<StatePanel tone="neutral" title="Entre para continuar" description="A preparação de 2027 é lida com a permissão da sua conta." /></>;
  if (authority.status !== "signed-in" || q.isLoading) return <>{h1}<p role="status" className="text-sm text-muted-foreground">Carregando…</p></>;
  const statuses = evaluate(q.data ?? {});
  const summary = summarize(statuses);
  const byId = new Map(statuses.map((s) => [s.id, s]));
  return (
    <div className="space-y-6">
      <PageHeader title="Preparação do ano letivo 2027" description="Situação de cada etapa, lida com a permissão da sua conta. Esta tela não grava nada e não abre 2027." />
      <div role="note" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        2026 permanece histórico e não é alterado. Abrir 2027 é ato humano separado, feito por quem tem a capacidade. Itens marcados "do ano 2027" contam somente registros de 2027 — dados de 2026 nunca os tornam prontos. Itens "sem ano" são cadastros institucionais lidos por inteiro. "Desconhecido" significa que a fonte não pôde ser lida aqui — nunca que está vazia.
      </div>
      <section aria-labelledby="ay-sum">
        <h2 id="ay-sum" className="mb-2 text-lg font-semibold">Resumo por área</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary).map(([d, row]) => (
            <li key={d} className="rounded-md border border-border p-3 text-sm"><strong>{d}</strong>: {Object.entries(row).map(([k, n]) => `${n} ${LABEL[k as ReadinessState].toLowerCase()}`).join(" · ")}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="ay-items">
        <h2 id="ay-items" className="mb-2 text-lg font-semibold">Etapas</h2>
        <ol className="divide-y divide-border rounded-md border border-border">
          {ITEMS.map((d) => { const s = byId.get(d.id)!; return (
            <li key={d.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><p className="font-medium">{d.label} — <span data-state={s.state}>{LABEL[s.state]}</span></p><p className="text-xs text-muted-foreground">{d.scope === "annual" ? "Do ano 2027" : "Sem ano (cadastro institucional)"}</p><p className="text-muted-foreground">{s.reason}</p></div>
              <Link to={d.to} className="shrink-0 text-primary underline-offset-4 hover:underline">Abrir módulo</Link>
            </li>); })}
        </ol>
      </section>
    </div>
  );
}
