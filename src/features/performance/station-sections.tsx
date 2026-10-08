import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/features/data-import/import-center-view";
import { formatAcademicDate } from "@/lib/academic-date";
import { perfMessage, type AssessmentVersion, type Disclosure, type MetricVersion, type ResultRow } from "./performance-model";
import {
  EXPORT_BLOCKED_NO_POLICY, IMPORT_ADAPTER_ID, MIN_EVOLUTION_EDITIONS, NOT_RANKING_NOTE, STATION_REPORTS,
  evolutionRows, evolutionSeries, exportEvolution, stationHome, type ExportOut,
} from "./performance-station";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await (supabase.rpc as unknown as Rpc)(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };

export function openPrintable(html: string) {
  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

export function ExportButtons({ make, name }: { make: () => ExportOut; name: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const run = (kind: "csv" | "pdf") => { const r = make(); if (!r.ok) return setMsg(r.reason); setMsg(null); if (kind === "csv") downloadCsv(`${name}.csv`, r.csv); else openPrintable(r.html); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => run("csv")}>Exportar CSV</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => run("pdf")}>Gerar PDF</Button>
      {msg && <p role="status" className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

export function StationHomePanel({ assessments, disclosure }: { assessments: readonly AssessmentVersion[]; disclosure: Disclosure }) {
  const h = stationHome(assessments, disclosure);
  return (
    <section aria-labelledby="home" className="space-y-2 rounded border p-4 text-sm">
      <h2 id="home" className="font-semibold">Visão geral da estação</h2>
      <dl className="grid gap-2 sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Avaliações registradas</dt><dd>{h.total}</dd></div>
        <div><dt className="text-muted-foreground">Institucionais · externas</dt><dd>{h.byOrigin.institucional} · {h.byOrigin.externa}</dd></div>
        <div><dt className="text-muted-foreground">Aplicação mais recente</dt><dd>{h.latestApplication ? formatAcademicDate(h.latestApplication.slice(0, 10)) : "Não disponível"}</dd></div>
        <div><dt className="text-muted-foreground">Política de divulgação</dt><dd>{h.policy === "registrada" ? "Registrada" : "Não registrada"}</dd></div>
      </dl>
      <ul className="list-disc pl-5">{h.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
      <div className="flex flex-wrap gap-3">
        <Link to="/importacoes" search={{ adaptador: IMPORT_ADAPTER_ID }} className="underline">Importar resultados pela Central de Importações</Link>
      </div>
      <details>
        <summary>Relatórios da estação</summary>
        <ul className="mt-1 list-disc pl-5">{STATION_REPORTS.map((r) => <li key={r.id}>{r.title} — {r.dependency ? r.dependency : `disponível nesta tela (${r.formats.join(", ").toUpperCase()})`}</li>)}</ul>
      </details>
    </section>
  );
}

/** Evolução com 3+ edições pelo motor existente (compareSeries); ordem cronológica, nunca por valor. */
export function EvolutionSection({ reference, current, assessments, disclosure }: { reference: MetricVersion; current: AssessmentVersion; assessments: readonly AssessmentVersion[]; disclosure: Disclosure }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [data, setData] = useState<Map<string, { metrics: MetricVersion[]; results: ResultRow[] }>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const ids = useMemo(() => [...new Set([current.logical_id, ...picked])], [current.logical_id, picked]);
  useEffect(() => {
    const missing = ids.filter((id) => !data.has(id));
    if (!missing.length) return;
    Promise.all(missing.map(async (id) => [id, {
      results: await call<ResultRow[]>("inst_assessment_results_at", { _assessment: id, _school: null, _known_at: null }),
      metrics: (await call<MetricVersion[]>("performance_metrics_at", { _assessment: id, _known_at: null })).filter((m) => m.event_kind !== "revogacao"),
    }] as const)).then((rs) => setData((d) => new Map([...d, ...rs])), (e: Error) => setErr(perfMessage(e.message)));
  }, [ids, data]);
  const loaded = ids.filter((id) => data.has(id));
  const ev = evolutionSeries(reference, loaded.map((id) => ({ assessment: assessments.find((a) => a.logical_id === id)!, ...data.get(id)! })));
  const rows = evolutionRows(ev);
  return (
    <section aria-labelledby={`evo-${reference.id}`} className="space-y-2 rounded border p-4 text-sm">
      <h2 id={`evo-${reference.id}`} className="font-semibold">Evolução entre edições — {reference.label}</h2>
      <fieldset className="flex flex-wrap gap-3"><legend className="text-muted-foreground">Edições a incluir (mínimo {MIN_EVOLUTION_EDITIONS} com a atual)</legend>
        {assessments.filter((a) => a.logical_id !== current.logical_id).map((a) => (
          <label key={a.logical_id} className="flex items-center gap-1"><input type="checkbox" checked={picked.includes(a.logical_id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, a.logical_id] : p.filter((x) => x !== a.logical_id))} />{a.title}</label>))}
      </fieldset>
      {err && <p role="alert" className="text-destructive">{err}</p>}
      {!ev.enough ? <p role="status" className="text-muted-foreground">Escolha pelo menos {MIN_EVOLUTION_EDITIONS} edições para ver a evolução.</p> : (
        <>
          <table className="w-full"><caption className="sr-only">Evolução cronológica</caption>
            <thead><tr className="text-left"><th scope="col">Edição</th><th scope="col">Aplicação</th><th scope="col">Valor</th><th scope="col">Variação</th><th scope="col">Observação</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={String(r['edicao'])} className="border-t align-top"><td>{r['edicao']}</td><td>{formatAcademicDate(String(r['aplicacao']))}</td><td>{r['valor'] ?? "Sem base"}</td>
              <td>{r['variacao'] === null ? "—" : `${Number(r['variacao']).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}${r['variacao_pct'] === null ? "" : ` (${Number(r['variacao_pct']).toLocaleString("pt-BR")}%)`}`}</td><td>{r['observacao']}</td></tr>)}</tbody>
          </table>
          <p className="text-xs text-muted-foreground">{NOT_RANKING_NOTE}</p>
          {disclosure ? <ExportButtons name={`evolucao-${reference.logical_id}`} make={() => exportEvolution(ev, reference, disclosure)} /> : <p className="text-xs text-muted-foreground">{EXPORT_BLOCKED_NO_POLICY}</p>}
        </>
      )}
    </section>
  );
}
