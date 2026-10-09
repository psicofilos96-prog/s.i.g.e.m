import { useLatestRequest } from "@/lib/latest-request";
import { OffsetPager } from "@/components/sigem/list-pager";
import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { exportIncomplete, runReport, toCsv, toPrintableHtml, toXlsx, type CellValue } from "@/features/reports/report-engine";
import {
  DATASETS, EXPORT_LIMIT, KEY_LABEL, PAGE_SIZE, REPORTING_REPORTS, classifyRep, drillFilter, groupSummary, reportingMessage, toReportRow,
  type Dataset, type Filters, type SummaryRow,
} from "./reporting-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = callRpc;
interface Row { total: number; school_id: string; row_data: Record<string, unknown> }
interface Drill { dataset: Dataset; key: string; filters: Filters }

const STATE_TEXT = { AVAILABLE: "", ZERO: "Nenhum", UNKNOWN: "Não informado", UNAVAILABLE: "Indisponível", BLOCKED: "Bloqueado" } as const;
const field = "mt-1 block w-full rounded border bg-background p-2";

function save(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }

/** Central do Núcleo e relatórios: leitura pura. Cartão → drill-down com o mesmo filtro do agregado → exportação pelo report-engine. */
export function ReportingCenter({ names, network, defaultSchool }: { names: Map<string, string>; network: boolean; defaultSchool: string }) {
  const today = operationalToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`); const [to, setTo] = useState(today);
  const [school, setSchool] = useState(network ? "" : defaultSchool);
  const [rows, setRows] = useState<SummaryRow[] | null>(null); const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(async () => {
    const current = latest(); setLoading(true);
    try { const r = await call<SummaryRow[]>("meal_reporting_summary", { _school: school || null, _from: from, _to: to }); if (!current()) return; setRows(r); setErr(null); }
    catch (e) { if (!current()) return; setRows(null); setErr(reportingMessage((e as Error).message)); }
    finally { if (current()) setLoading(false); }
  }, [school, from, to, latest]);
  useEffect(() => { void load(); setDrill(null); }, [load]);
  const by = groupSummary(rows);
  const blocked = by.get("bloqueios") ?? [];
  return (
    <section id="central-relatorios" aria-labelledby="rc" className="scroll-mt-4 space-y-4 rounded-lg border p-4 text-sm">
      <div>
        <h2 id="rc" className="text-lg font-semibold">Central e relatórios</h2>
        <p className="text-muted-foreground">Contagens de fatos registrados. "Nenhum" é zero lido; "Não informado" e "Bloqueado" nunca viram zero. Toque num número para ver os registros que o explicam.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}>
          {network && <option value="">Toda a rede autorizada</option>}
          {[...names].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label>De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {err ? <StatePanel tone="warning" title="Central não disponível" description={err} />
        : !rows ? <p role="status" className="text-muted-foreground">{loading ? "Carregando…" : "—"}</p> : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(DATASETS) as Dataset[]).map((ds) => (
              <div key={ds} className="min-w-0 rounded-lg border bg-card p-3 text-card-foreground">
                <h3 className="font-medium">{DATASETS[ds]}</h3>
                <ul className="mt-2 space-y-1">
                  {(by.get(ds) ?? []).map((r) => { const c = classifyRep(r); const f = drillFilter(ds, r.key);
                    const text = c.state === "AVAILABLE" || c.state === "ZERO" ? (c.state === "ZERO" ? "Nenhum" : String(c.value)) : STATE_TEXT[c.state];
                    return (
                      <li key={r.key} className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0">{KEY_LABEL[r.key] ?? r.key}{c.reason && <span className="block text-xs text-muted-foreground">{c.reason}</span>}</span>
                        {f && c.state !== "ZERO" ? <button type="button" className="shrink-0 rounded px-1 font-semibold tabular-nums underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                          aria-label={`Ver registros: ${KEY_LABEL[r.key] ?? r.key}`} onClick={() => setDrill({ dataset: ds, key: r.key, filters: f })}>{text}</button>
                          : <span className="shrink-0 font-semibold tabular-nums">{text}</span>}
                      </li>); })}
                </ul>
                <button type="button" className="mt-2 text-xs underline" onClick={() => setDrill({ dataset: ds, key: "todos", filters: {} })}>Ver todos e exportar</button>
              </div>))}
          </div>
          <div className="rounded-lg border p-3">
            <h3 className="font-medium">Regras e fontes pendentes</h3>
            <p className="text-xs text-muted-foreground">Não calculados até haver regra homologada ou fonte oficial. Não é zero.</p>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">{blocked.map((b) => <li key={b.key}><span className="font-medium">{KEY_LABEL[b.key] ?? b.key}</span>: Bloqueado <span className="block text-xs text-muted-foreground">{b.reason}</span></li>)}</ul>
          </div>
        </>)}
      {drill && <DrillPanel drill={drill} school={school} from={from} to={to} names={names} onClose={() => setDrill(null)} />}
    </section>
  );
}

function DrillPanel({ drill, school, from, to, names, onClose }: { drill: Drill; school: string; from: string; to: string; names: Map<string, string>; onClose: () => void }) {
  const [page, setPage] = useState(0); const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [lot, setLot] = useState(""); const [busy, setBusy] = useState(false);
  const filters: Filters = { ...drill.filters, ...(lot && drill.dataset === "movimentos" && !drill.filters.lote ? { lote: lot } : {}) };
  const args = (limit: number, offset: number) => ({ _dataset: drill.dataset, _school: school || null, _from: from, _to: to, _filters: filters, _limit: limit, _offset: offset });
  const key = JSON.stringify(filters);
  useEffect(() => { setPage(0); }, [key]);
  useEffect(() => {
    setRows(null);
    call<Row[]>("meal_reporting_rows", args(PAGE_SIZE, page * PAGE_SIZE)).then((r) => { setRows(r); setErr(null); }, (e: Error) => setErr(reportingMessage(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page, school, from, to, drill.dataset]);
  const total = rows?.[0]?.total ?? 0;
  const def = REPORTING_REPORTS[drill.dataset];
  const label = drill.key === "todos" ? "Todos" : KEY_LABEL[drill.key] ?? drill.key;
  async function exportAs(fmt: "csv" | "xlsx" | "pdf") {
    if (busy) return; setBusy(true);
    try {
      const all: Row[] = [];
      let exhausted = false;
      for (let off = 0; ; off += EXPORT_LIMIT) { const r = await call<Row[]>("meal_reporting_rows", args(EXPORT_LIMIT, off)); all.push(...r); if (r.length < EXPORT_LIMIT) { exhausted = true; break; } if (all.length >= def.syncRowLimit) break; }
      const incomplete = exportIncomplete(all.length, total, exhausted);
      const src: Record<string, CellValue>[] = all.map((r) => toReportRow(drill.dataset, names.get(r.school_id) ?? "Escola", r.row_data));
      const result = runReport(def, { params: { from, to } }, src);
      const branding = { headerLines: ["SIGEM — Alimentação Escolar"], title: def.title };
      const meta = [`Período: ${from} a ${to}`, `Escopo: ${school ? names.get(school) ?? "Escola" : "Rede autorizada"}`, `Recorte: ${label}`, "Mesmos filtros e permissões da tela.", ...(incomplete ? [`INCOMPLETO: ${all.length} de ${total} linhas (limite de exportação); restrinja o período.`] : [])];
      const base = `${def.id}-${from}-${to}`;
      if (fmt === "csv") save(`${base}.csv`, new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
      else if (fmt === "xlsx") save(`${base}.xlsx`, new Blob([await toXlsx(result, branding, meta)]));
      else { const w = window.open("", "_blank", "noopener"); if (w) { w.document.write(toPrintableHtml(result, branding, meta)); w.document.close(); w.print(); } }
    } catch (e) { setErr(reportingMessage((e as Error).message)); } finally { setBusy(false); }
  }
  return (
    <div role="region" aria-label={`Registros: ${DATASETS[drill.dataset]} — ${label}`} className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{DATASETS[drill.dataset]} — {label}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy || !rows || total === 0} onClick={() => exportAs("csv")}>CSV</Button>
          <Button variant="outline" size="sm" disabled={busy || !rows || total === 0} onClick={() => exportAs("xlsx")}>XLSX</Button>
          <Button variant="outline" size="sm" disabled={busy || !rows || total === 0} onClick={() => exportAs("pdf")}>PDF</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>
      {drill.dataset === "movimentos" && !drill.filters.lote && (
        <label className="block max-w-xs">Lote<select className={field} value={lot} onChange={(e) => setLot(e.target.value)}>
          <option value="">Todos</option><option value="informado">Com lote informado</option><option value="ausente">Sem lote informado</option></select></label>)}
      {err ? <StatePanel tone="warning" title="Registros não disponíveis" description={err} /> : !rows ? <SkeletonState label="Carregando" />
        : rows.length === 0 ? <p className="text-muted-foreground">Nenhum registro neste recorte.</p> : (
        <>
          <ul className="space-y-2">{rows.map((r, i) => { const v = toReportRow(drill.dataset, names.get(r.school_id) ?? "Escola", r.row_data);
            return <li key={i} className="rounded border p-2"><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
              {def.columns.map((c) => <div key={c.id} className="contents"><dt className="text-muted-foreground">{c.label}</dt><dd className="break-words">{v[c.id] === null || v[c.id] === undefined ? "não informado" : String(v[c.id])}</dd></div>)}
            </dl></li>; })}</ul>
          <OffsetPager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} noun="registros">
            {total} registros · página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </OffsetPager>
        </>)}
    </div>
  );
}
