import { operationalToday } from "@/lib/academic-date";
/**
 * Frente Z.2 — acompanhamento do Planejamento SOMENTE LEITURA (Orientação/Direção da escola; rede por capacidade).
 * Só planos compartilhados vigentes na data; nenhum rascunho, nenhuma ação de autoria, nenhum "aprovar/reprovar"
 * N10.2.3: análise (aprovar/pedir ajuste) só na fila abaixo, por capacidade `revisar-trabalho-docente`.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { ReviewQueue } from "@/features/teacher-review/review-panel";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { parseBlocks, parseRefs, planMessage } from "./planning-model";
import { plansOverview, type OverviewPlan } from "./planning-source";

const today = () => operationalToday();

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
      <PageHeader title="Acompanhamento do planejamento" description="Veja os planejamentos que os professores compartilharam. Para escrever ou alterar um plano, o professor responsável deve abrir a tela de Planejamento." />
      <div className="grid max-w-xl gap-2 sm:grid-cols-2">
        <label className="text-sm">Código da escola<input className="w-full rounded border bg-background p-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)} /></label>
        <label className="text-sm">Data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      </div>
      {school.trim() && (
        <section aria-labelledby="fila-op" className="space-y-2">
          <h2 id="fila-op" className="text-base font-semibold">Planejamentos e provas enviados para análise</h2>
          <ReviewQueue school={school.trim()} />
        </section>
      )}
      {!school.trim() ? <EmptyState title="Digite o código da escola" description="A escola ainda não foi informada, por isso os planejamentos não podem ser buscados. Digite o código no campo acima para consultar os planos compartilhados." />
        : err ? <StatePanel tone="danger" title="Não foi possível buscar os planejamentos" description={`${err} Confira a conexão e tente buscar novamente.`} />
        : !rows ? <SkeletonState label="Carregando" />
        : kind === "access-denied" ? <StatePanel tone="warning" title="Você não pode consultar os planejamentos desta escola" description="Sua conta não tem autorização para ver estes registros. Peça à gestão responsável para conferir seu acesso à escola." />
        : kind === "invalid" ? <StatePanel tone="warning" title="Confira os dados da busca" description="Falta informar a escola ou a data. Preencha os campos acima para buscar os planejamentos." />
        : plans.length === 0 ? <EmptyState title="Nenhum planejamento compartilhado nesta data" description="Nenhum professor compartilhou um planejamento para esta escola e data. Confira a data ou peça ao professor responsável que compartilhe o plano; rascunhos não aparecem nesta consulta." />
        : (
          <ul className="space-y-3">{plans.map((p) => (
            <li key={p.plan_version_id ?? ""} className="rounded border border-border p-3 text-sm">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-muted-foreground">Turma {p.class_id} · versão {p.version} · {p.covers_from ?? "sem início"} a {p.covers_until ?? "sem fim"}{p.period_id ? ` · período ${p.period_id}` : ""} · {parseRefs(p.curricular_refs).length} referência(s)</div>
              {parseBlocks(p.blocks).map((b, i) => <div key={i} className="mt-2"><div className="font-medium">{b.heading}</div><p className="whitespace-pre-wrap">{b.body}</p></div>)}
            </li>))}</ul>)}
    </div>
  );
}
