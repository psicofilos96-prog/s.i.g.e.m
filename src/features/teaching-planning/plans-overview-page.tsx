/**
 * Frente Z.2 — acompanhamento do Planejamento SOMENTE LEITURA (Orientação/Direção da escola; rede por capacidade).
 * Só planos compartilhados vigentes na data; nenhum rascunho, nenhuma ação de autoria, nenhum "aprovar/reprovar"
 * (não há regra homologada de aprovação pedagógica).
 */
import { useEffect, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { parseBlocks, parseRefs, planMessage } from "./planning-model";
import { plansOverview, type OverviewPlan } from "./planning-source";

const today = () => new Date().toLocaleDateString("sv-SE");

export function PlansOverviewPage() {
  const [school, setSchool] = useState("");
  const [on, setOn] = useState(today());
  const [rows, setRows] = useState<OverviewPlan[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!school.trim()) { setRows(null); return; }
    let live = true; setRows(null); setErr(null);
    plansOverview(school.trim(), on).then((r) => live && setRows(r)).catch((e) => live && setErr(planMessage((e as Error).message)));
    return () => { live = false; };
  }, [school, on]);
  const kind = rows?.[0]?.result_kind;
  const plans = rows?.filter((r) => r.result_kind === "plan") ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Acompanhamento do planejamento" description="Consulta somente leitura dos planejamentos compartilhados. Escrever ou alterar plano é ato exclusivo do professor da regência." />
      <div className="grid max-w-xl gap-2 sm:grid-cols-2">
        <label className="text-sm">Escola (código)<input className="w-full rounded border bg-background p-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)} /></label>
        <label className="text-sm">Data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      </div>
      {!school.trim() ? <EmptyState title="Informe a escola" description="A consulta só mostra o que sua atuação autoriza." />
        : err ? <StatePanel tone="danger" title="Consulta indisponível" description={err} />
        : !rows ? <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
        : kind === "access-denied" ? <StatePanel tone="warning" title="Sem autorização para esta escola" description="Sua atuação vigente não tem capacidade de consulta do planejamento nesta escola." />
        : kind === "invalid" ? <StatePanel tone="warning" title="Consulta inválida" description="Informe escola e data." />
        : plans.length === 0 ? <EmptyState title="Nenhum planejamento compartilhado nesta data" description="Rascunhos não aparecem aqui. Ausência de plano compartilhado não é falta do professor." />
        : (
          <ul className="space-y-3">{plans.map((p) => (
            <li key={p.plan_version_id ?? ""} className="rounded border border-border p-3 text-sm">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-muted-foreground">Turma {p.class_id} · v{p.version} · {p.covers_from ?? "sem início"} a {p.covers_until ?? "sem fim"}{p.period_id ? ` · período ${p.period_id}` : ""} · {parseRefs(p.curricular_refs).length} referência(s)</div>
              {parseBlocks(p.blocks).map((b, i) => <div key={i} className="mt-2"><div className="font-medium">{b.heading}</div><p className="whitespace-pre-wrap">{b.body}</p></div>)}
            </li>))}</ul>)}
    </div>
  );
}
