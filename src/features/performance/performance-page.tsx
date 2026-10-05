import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  aggregate, compareTemporal, computeMetric, FORMULA_LABEL, goalStatus, perfMessage,
  type AssessmentVersion, type Disclosure, type Goal, type GroupBy, type MetricValue, type MetricVersion, type ResultRow,
} from "./performance-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await rpc(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
const field = "mt-1 block w-full rounded border bg-background p-2";
const br = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const fmt = (v: MetricValue) => (v.status === "calculada" ? v.value.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : v.status === "sem-base" ? "Sem base" : "Fórmula incompatível");

export function PerformancePage() {
  const [assessments, setAssessments] = useState<AssessmentVersion[] | null>(null);
  const [disclosure, setDisclosure] = useState<Disclosure>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(""); const [cmp, setCmp] = useState("");
  useEffect(() => {
    Promise.all([call<AssessmentVersion[]>("inst_assessments_at", { _known_at: null, _logical_id: null }), call<Disclosure[]>("performance_disclosure_at", { _known_at: null })])
      .then(([a, d]) => { setAssessments(a.filter((x) => x.event_kind !== "revogacao")); setDisclosure(d?.[0] ?? null); }, (e: Error) => setErr(perfMessage(e.message)));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Avaliação e Desempenho" description="Avaliações institucionais e externas da rede. Dado observado, métrica calculada e meta aparecem separados; nenhum índice existe sem fórmula, versão e fonte declaradas." />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !assessments ? <p className="text-sm text-muted-foreground" role="status">Carregando…</p>
        : assessments.length === 0 ? <EmptyState title="Nenhuma avaliação institucional registrada" description="Sem avaliação cadastrada não há resultado nem métrica a mostrar. As avaliações rotineiras do professor continuam no Diário." />
        : <>
            {!disclosure && <StatePanel tone="warning" title="Política de divulgação não configurada" description="Nenhum grupo é suprimido porque não existe limiar registrado. A exportação de agregados fica bloqueada até a política existir." />}
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <label>Avaliação<select className={field} value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Escolha…</option>{assessments.map((a) => <option key={a.logical_id} value={a.logical_id}>{a.title} — {br(a.applied_from)} (v{a.version})</option>)}</select></label>
              <label>Comparar com (opcional)<select className={field} value={cmp} onChange={(e) => setCmp(e.target.value)}><option value="">Nenhuma</option>{assessments.filter((a) => a.logical_id !== sel).map((a) => <option key={a.logical_id} value={a.logical_id}>{a.title} — {br(a.applied_from)}</option>)}</select></label>
            </div>
            {sel && <AssessmentView key={sel + cmp} a={assessments.find((x) => x.logical_id === sel)!} other={assessments.find((x) => x.logical_id === cmp) ?? null} disclosure={disclosure} />}
          </>}
    </div>
  );
}

function useAssessmentData(a: AssessmentVersion | null) {
  const [d, setD] = useState<{ results: ResultRow[]; metrics: MetricVersion[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!a) return;
    Promise.all([call<ResultRow[]>("inst_assessment_results_at", { _assessment: a.logical_id, _school: null, _known_at: null }), call<MetricVersion[]>("performance_metrics_at", { _assessment: a.logical_id, _known_at: null })])
      .then(([results, metrics]) => setD({ results, metrics: metrics.filter((m) => m.event_kind !== "revogacao") }), (e: Error) => setErr(perfMessage(e.message)));
  }, [a]);
  return { d, err };
}

function AssessmentView({ a, other, disclosure }: { a: AssessmentVersion; other: AssessmentVersion | null; disclosure: Disclosure }) {
  const { d, err } = useAssessmentData(a);
  const o = useAssessmentData(other);
  const [by, setBy] = useState<GroupBy>("escola");
  const [drill, setDrill] = useState<{ title: string; ids: readonly string[] } | null>(null);
  if (err) return <StatePanel tone="danger" title="Resultados indisponíveis" description={`${err} A consulta da rede inteira exige alcance de rede; com alcance escolar, use a escola da sua atuação.`} />;
  if (!d) return <p className="text-sm text-muted-foreground" role="status">Carregando resultados…</p>;
  const observed = d.results.filter((r) => r.event_kind !== "revogacao");
  return (
    <div className="space-y-6">
      <section aria-labelledby="obs" className="rounded border p-4">
        <h2 id="obs" className="font-semibold">Dado observado</h2>
        <p className="text-sm text-muted-foreground">Origem: {a.origin === "externa" ? "avaliação externa" : "avaliação institucional"}{a.source_note ? ` — fonte: ${a.source_note}` : ""}. População-alvo declarada: {a.target_population.map((p) => `${p.axis_id} = ${p.value_id}`).join("; ")}.</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-muted-foreground">Observados</dt><dd>{observed.filter((r) => r.status === "observado").length}</dd></div>
          <div><dt className="text-muted-foreground">Ausentes</dt><dd>{observed.filter((r) => r.status === "ausente").length}</dd></div>
          <div><dt className="text-muted-foreground">Não aplicados</dt><dd>{observed.filter((r) => r.status === "nao-aplicado").length}</dd></div>
        </dl>
        {observed.length === 0 && <p className="mt-2 text-sm">Nenhum resultado registrado para esta avaliação. Isso não significa resultado zero.</p>}
      </section>

      <section aria-labelledby="met" className="rounded border p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="met" className="font-semibold">Métricas calculadas</h2>
          <label className="text-sm">Agrupar por<select className={field} value={by} onChange={(e) => setBy(e.target.value as GroupBy)}><option value="escola">Escola</option><option value="turma">Turma</option><option value="item">Item/habilidade</option></select></label>
        </div>
        {d.metrics.length === 0 ? <p className="text-sm">Nenhuma métrica com fórmula registrada para esta avaliação. Sem fórmula, nenhum indicador é mostrado.</p>
          : d.metrics.map((m) => {
            const total = computeMetric(m.formula, a.scale, d.results);
            const groups = aggregate(d.results, by, m.formula, a.scale, disclosure);
            const om = o.d?.metrics.find((x) => x.logical_id === m.logical_id) ?? o.d?.metrics.find((x) => x.population_key === m.population_key) ?? null;
            const c = other && o.d && om ? compareTemporal({ metric: m, assessment: a, value: total }, { metric: om, assessment: other, value: computeMetric(om.formula, other.scale, o.d.results) }) : null;
            return (
              <div key={m.id} className="rounded border p-3">
                <p className="font-medium">{m.label} <span className="text-xs text-muted-foreground">v{m.version}</span></p>
                <p className="text-xs text-muted-foreground">Fórmula: {FORMULA_LABEL(m.formula)} · População: {m.population_key} · Fonte: {m.source_note}</p>
                <p className="mt-1 text-lg">{fmt(total)} {total.status === "calculada" && m.unit_label}<button className="ml-2 text-sm underline" onClick={() => setDrill({ title: m.label, ids: total.resultIds })}>ver registros</button></p>
                {c && <p className="text-sm">{c.comparable ? (c.delta === null ? "Comparável, mas um dos lados não tem base." : `Variação em relação a ${other!.title}: ${c.delta.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`) : `Sem comparação: ${c.reason}`}</p>}
                <Goals metric={m} value={total} />
                <table className="mt-2 w-full text-sm"><caption className="sr-only">Métrica por grupo</caption>
                  <thead><tr className="text-left"><th>Grupo</th><th>Estudantes</th><th>Valor</th></tr></thead>
                  <tbody>{groups.map((g) => <tr key={g.key} className="border-t"><td>{g.label}</td><td>{g.disclosed ? g.students : "—"}</td>
                    <td>{g.disclosed ? <button className="underline" onClick={() => setDrill({ title: `${m.label} — ${g.label}`, ids: g.metric.resultIds })}>{fmt(g.metric)}</button> : <span title={g.suppressedReason ?? ""}>Suprimido</span>}</td></tr>)}</tbody>
                </table>
              </div>
            );
          })}
      </section>
      {drill && (
        <section aria-labelledby="drill" className="rounded border p-4">
          <div className="flex justify-between"><h2 id="drill" className="font-semibold">Registros de origem — {drill.title}</h2><Button variant="outline" size="sm" onClick={() => setDrill(null)}>Fechar</Button></div>
          <table className="mt-2 w-full text-sm"><thead><tr className="text-left"><th>Escola</th><th>Estudante</th><th>Item</th><th>Situação</th><th>Valor bruto</th><th>Versão</th></tr></thead>
            <tbody>{d.results.filter((r) => drill.ids.includes(r.id)).slice(0, 500).map((r) => <tr key={r.id} className="border-t"><td>{r.school_id}</td><td>{r.student_id}</td><td>{r.item_id ?? "global"}</td><td>{r.status}</td><td>{r.raw_value ?? "não informado"}</td><td>v{r.version}</td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  );
}

function Goals({ metric, value }: { metric: MetricVersion; value: MetricValue }) {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  useEffect(() => { call<Goal[]>("performance_goals_at", { _metric_logical: metric.logical_id, _known_at: null }).then(setGoals, () => setGoals([])); }, [metric.logical_id]);
  const list = useMemo(() => (goals ?? []).filter((g) => g.metric_version_id === metric.id), [goals, metric.id]);
  if (!goals) return null;
  if (list.length === 0) return <p className="text-xs text-muted-foreground">Meta: nenhuma meta registrada para esta versão da métrica.</p>;
  return <ul className="text-sm">{list.map((g) => <li key={g.id}>Meta {g.comparator} {String(g.target_value)}{g.school_id ? ` (escola ${g.school_id})` : " (rede)"} — fonte: {g.source_note} — {({ atingida: "atingida", "nao-atingida": "não atingida", "sem-base": "sem base para avaliar" })[goalStatus(g, value)]}</li>)}</ul>;
}
