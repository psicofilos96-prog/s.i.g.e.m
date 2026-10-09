import { SkeletonState } from "@/components/sigem/guidance";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority, sessionContextKey } from "@/features/authority/session-authority";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { ITEMS, evaluate, classify, CHECKLIST_LABEL, type Checklist } from "./readiness-model";
import { readProbes, type ReadClient } from "./readiness-probes";
import { useState } from "react";
import { buildReferenceRows, probeText, readYearReference } from "./prior-year-reference";


/** AY — central de preparação de 2027: orienta e valida; só navega. Não abre ano nem configura nada. */
export function YearPreparationPage() {
  const authority = useSessionAuthority();
  const q = useQuery({ queryKey: ["ay-readiness", sessionContextKey(authority)], enabled: authority.status === "signed-in", retry: false, queryFn: () => readProbes(supabase as unknown as ReadClient, 2027) });
  const [knownAt] = useState(() => new Date().toISOString());
  const ref = useQuery({ queryKey: ["ref-2026-2027", sessionContextKey(authority), knownAt], enabled: authority.status === "signed-in", retry: false,
    queryFn: async () => { const c = supabase as unknown as ReadClient; const [a, b] = await Promise.all([readYearReference(c, 2026, knownAt), readYearReference(c, 2027, knownAt)]); return buildReferenceRows(a, b); } });
  const h1 = <h1 className="sr-only">Preparação do ano letivo 2027</h1>;
  if (authority.status === "signed-out") return <>{h1}<StatePanel tone="neutral" title="Entre para continuar" description="A preparação de 2027 é lida com a permissão da sua conta." /></>;
  if (authority.status !== "signed-in" || q.isLoading) return <>{h1}<SkeletonState label="Carregando" /></>;
  const statuses = evaluate(q.data ?? {});
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const cls = new Map(ITEMS.map((d) => [d.id, classify(d, byId.get(d.id)!)] as const));
  const totals: Partial<Record<Checklist, number>> = {};
  for (const c of cls.values()) totals[c] = (totals[c] ?? 0) + 1;
  return (
    <div className="space-y-6">
      <PageHeader title="Preparação do ano letivo 2027" description="Situação de cada etapa, lida com a permissão da sua conta. Esta tela não grava nada e não abre 2027." />
      <div role="note" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        2026 permanece histórico e não é alterado. Abrir 2027 é ato humano separado, feito por quem tem a capacidade. Itens marcados "do ano 2027" contam somente registros de 2027 — dados de 2026 nunca os tornam prontos. Itens "sem ano" são cadastros institucionais lidos por inteiro. "Não verificado" significa que a fonte não pôde ser lida aqui — nunca que está vazia.
      </div>
      <section aria-labelledby="ay-sum">
        <h2 id="ay-sum" className="mb-2 text-lg font-semibold">Resumo</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(CHECKLIST_LABEL) as Checklist[]).filter((k) => totals[k]).map((k) => (
            <li key={k} className="rounded-md border border-border px-3 py-1"><strong>{totals[k]}</strong> {CHECKLIST_LABEL[k].toLowerCase()}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="ref-2026">
        <h2 id="ref-2026" className="mb-1 text-lg font-semibold">Referência 2026</h2>
        <p className="mb-2 text-sm text-muted-foreground">2026 registrado ao lado de 2027. A referência só orienta: nenhum fato de 2026 é copiado para 2027. Leitura feita em {new Date(knownAt).toLocaleString("pt-BR")}.</p>
        {ref.isLoading ? <SkeletonState label="Carregando referência" /> : !ref.data ? <StatePanel tone="neutral" title="Referência indisponível" description="Não foi possível ler a referência de 2026 agora." /> : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left"><tr><th scope="col" className="p-2">Item</th><th scope="col" className="p-2">2026 registrado</th><th scope="col" className="p-2">2027</th><th scope="col" className="p-2">Ponto de partida</th></tr></thead>
              <tbody className="divide-y divide-border">{ref.data.map((r) => (
                <tr key={r.def.id} data-ref={r.def.id}>
                  <th scope="row" className="p-2 text-left font-medium">{r.def.label}<span className="block text-xs font-normal text-muted-foreground">{r.def.domain}</span></th>
                  <td className="p-2 text-tabular">{probeText(r.y2026)}</td>
                  <td className="p-2"><span className="text-tabular">{r.y2027 ? probeText(r.y2027) : "Mesmo cadastro"}</span><span className="block text-xs text-muted-foreground">{r.note}</span></td>
                  <td className="p-2"><Link to={r.def.to} className="text-primary underline-offset-4 hover:underline">Usar como ponto de partida</Link>
                    <span className="block text-xs text-muted-foreground">{r.def.startingPoint}{r.def.neverCreates ? ` Nunca cria: ${r.def.neverCreates}.` : ""}</span></td>
                </tr>))}</tbody>
            </table>
          </div>)}
      </section>
      <section aria-labelledby="ay-items">
        <h2 id="ay-items" className="mb-2 text-lg font-semibold">Etapas</h2>
        <ol className="divide-y divide-border rounded-md border border-border">
          {ITEMS.map((d) => { const s = byId.get(d.id)!; return (
            <li key={d.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><p className="font-medium">{d.label} — <span data-state={s.state} data-checklist={cls.get(d.id)}>{CHECKLIST_LABEL[cls.get(d.id)!]}</span></p><p className="text-xs text-muted-foreground">{d.domain} · {d.scope === "annual" ? "Do ano 2027" : "Sem ano (cadastro institucional)"}</p><p className="text-muted-foreground">{s.reason}</p></div>
              <Link to={d.to} className="shrink-0 text-primary underline-offset-4 hover:underline">Abrir ferramenta</Link>
            </li>); })}
        </ol>
      </section>
    </div>
  );
}
