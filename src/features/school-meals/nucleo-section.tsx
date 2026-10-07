import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { indicators, nucleoMessage, QUALITY_LABELS, SOURCE_LABEL, workQueue, classify, type Indicator, type SummaryRow } from "./nucleo-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await (supabase.rpc as unknown as Rpc)(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
interface Trail { source: string; logical_id: string; version: number; act: string; school_id: string; reason: string | null; recorded_at: string }

const STATE_TEXT: Record<Indicator["state"], string> = { AVAILABLE: "", ZERO: "Nenhum", UNKNOWN: "Não disponível", UNAVAILABLE: "Indisponível", BLOCKED: "Bloqueado" };

function Card({ i }: { i: Indicator }) {
  const n = i.state === "AVAILABLE" || i.state === "ZERO";
  return (
    <a href={`#${i.anchor}`} className="block min-w-0 rounded-lg border bg-card p-3 text-card-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <p className="text-xs text-muted-foreground">{i.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{n ? i.value : <span className="text-base font-medium">{STATE_TEXT[i.state]}</span>}</p>
      <p className="mt-1 text-xs text-muted-foreground">{i.reason ?? i.help}</p>
    </a>
  );
}

/** Visão geral do Núcleo: o que precisa de ação agora. Somente leitura; nenhum fato é escrito daqui. */
export function NucleoHome({ names }: { names: Map<string, string> }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [competence, setCompetence] = useState(today.slice(0, 7));
  const [rows, setRows] = useState<SummaryRow[] | null>(null); const [quality, setQuality] = useState<SummaryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(await call<SummaryRow[]>("meal_network_action_summary", { _on: today, _competence: competence }));
      setQuality(await call<SummaryRow[]>("meal_network_data_quality", { _on: today }).catch(() => null)); setErr(null);
    } catch (e) { setRows(null); setErr(nucleoMessage((e as Error).message)); }
  }, [today, competence]);
  useEffect(() => { void load(); }, [load]);
  const ind = indicators(rows); const queue = workQueue(ind);
  return (
    <>
      <section id="visao-geral" aria-labelledby="ng" className="scroll-mt-4 space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0"><h2 id="ng" className="text-lg font-semibold">O que precisa de ação agora</h2>
            <p className="text-sm text-muted-foreground">Contagens lidas da rede na hora. "Nenhum" é zero lido; "Não disponível" e "Bloqueado" nunca viram zero.</p></div>
          <label className="text-sm">Competência<input className="mt-1 block w-28 rounded border bg-background p-2" value={competence} onChange={(e) => setCompetence(e.target.value)} placeholder="AAAA-MM" /></label>
        </div>
        {err && <StatePanel tone="warning" title="Visão da rede não disponível" description={err} />}
        <div>
          <h3 className="text-sm font-medium">Fila de trabalho</h3>
          {!rows ? <p className="text-sm text-muted-foreground">{err ? "—" : "Carregando…"}</p> : queue.length === 0
            ? <p className="text-sm text-muted-foreground">Nada aguardando ação nas contagens lidas.</p>
            : <ol className="mt-1 space-y-1 text-sm">{queue.map((q) => <li key={q.key}><a className="underline" href={`#${q.anchor}`}>{q.label}: {q.value}</a></li>)}</ol>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ind.map((i) => <Card key={i.key} i={i} />)}</div>
      </section>
      <section id="qualidade" aria-labelledby="nq" className="scroll-mt-4 space-y-2 rounded-lg border p-4 text-sm">
        <h2 id="nq" className="text-lg font-semibold">Qualidade dos dados</h2>
        <p className="text-muted-foreground">Apenas aponta; nenhuma correção é automática.</p>
        {!quality ? <p className="text-muted-foreground">Não disponível para esta conta.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">{Object.keys(QUALITY_LABELS).map((k) => { const c = classify(quality.find((q) => q.key === k));
            return <li key={k} className="rounded border p-2"><span className="font-medium">{QUALITY_LABELS[k]}</span>: {c.state === "AVAILABLE" || c.state === "ZERO" ? c.value : STATE_TEXT[c.state]}{c.reason && <span className="block text-xs text-muted-foreground">{c.reason}</span>}</li>; })}</ul>)}
      </section>
      <TrailSection names={names} />
    </>
  );
}

function TrailSection({ names }: { names: Map<string, string> }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`); const [to, setTo] = useState(today); const [school, setSchool] = useState("");
  const [rows, setRows] = useState<Trail[] | null>(null); const [err, setErr] = useState<string | null>(null); const [page, setPage] = useState(0);
  useEffect(() => {
    call<Trail[]>("meal_audit_trail_at", { _school: school || null, _from: `${from}T00:00:00Z`, _to: `${to}T23:59:59Z` })
      .then((r) => { setRows(r); setErr(null); setPage(0); }, (e: Error) => setErr(nucleoMessage(e.message)));
  }, [from, to, school]);
  const slice = (rows ?? []).slice(page * 50, page * 50 + 50);
  return (
    <section id="trilha" aria-labelledby="nt" className="scroll-mt-4 space-y-2 rounded-lg border p-4 text-sm">
      <h2 id="nt" className="text-lg font-semibold">Trilha</h2>
      <p className="text-muted-foreground">Só atos de pessoa natural registrada. Correções aparecem como nova versão, nunca apagam a anterior.</p>
      <div className="flex flex-wrap gap-3">
        <label>De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Escola<select className="mt-1 block rounded border bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Todas</option>{[...names].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
      </div>
      {err ? <StatePanel tone="warning" title="Trilha não disponível" description={err} /> : !rows ? <SkeletonState label="Carregando" />
        : rows.length === 0 ? <p className="text-muted-foreground">Nenhum ato registrado no período.</p> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="text-left"><th>Quando</th><th>Origem</th><th>Ato</th><th>Versão</th><th>Escola</th><th>Motivo</th></tr></thead>
            <tbody>{slice.map((r) => <tr key={`${r.source}|${r.logical_id}|${r.version}`} className="border-t">
              <td>{new Date(r.recorded_at).toLocaleString("pt-BR")}</td><td>{SOURCE_LABEL[r.source] ?? r.source}</td><td>{r.act}</td><td>{r.version}</td>
              <td>{names.get(r.school_id) ?? "Escola"}</td><td>{r.reason ?? "—"}</td></tr>)}</tbody></table>
            <div className="mt-2 flex gap-2"><button type="button" className="rounded border px-2 py-1 disabled:opacity-50" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
              <button type="button" className="rounded border px-2 py-1 disabled:opacity-50" disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(page + 1)}>Próxima</button>
              <span className="text-muted-foreground">{rows.length} atos{rows.length >= 2000 ? " (limite de 2000; reduza o período)" : ""}</span></div></div>)}
    </section>
  );
}
