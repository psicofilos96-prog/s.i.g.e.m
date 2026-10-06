import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { evaluate, hasScope, SessionMetricCache, type CapabilityRow, type Ctx, type MetricDefinition, type MetricResult } from "./metric-engine";
import { LINKED_SURFACES, METRIC_CATALOG } from "./metric-catalog";
import { NETWORK_INDICATORS } from "./network-indicator-catalog";
import { INDICADORES_REDE, STATE_LABEL, indicatorRows, natureLabel, parseNetworkReading, qualityFindings, type NetworkReading } from "./network-indicator-runtime";
import { runReport, toCsv } from "@/features/reports/report-engine";

/** AD.2: indicadores da rede com valores do reader canônico; estados distintos, natureza e proveniência explícitas. */
function NetworkIntelligence() {
  const [on, setOn] = useState(today());
  const [known, setKnown] = useState("");
  const [school, setSchool] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [reading, setReading] = useState<NetworkReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    void db.from("institutional_school_record_versions").select("school_id, official_name, version_number").then((r: { data: { school_id: string; official_name: string; version_number: number }[] | null }) => {
      const last = new Map<string, { n: number; name: string }>();
      for (const x of r.data ?? []) { const c = last.get(x.school_id); if (!c || c.n < x.version_number) last.set(x.school_id, { n: x.version_number, name: x.official_name }); }
      setSchools([...last].map(([id, v]) => ({ id, name: v.name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);
  useEffect(() => {
    if (!on) return;
    setLoading(true); setError(null);
    void db.rpc("network_indicators_at", { _on: on, _known_at: known ? `${known}T23:59:59Z` : null, _school: school || null, _year: null })
      .then((r: { data: unknown; error: { message: string } | null }) => {
        if (r.error) { setReading(null); setError(/session-required/.test(r.error.message) ? "Entre para consultar os indicadores da rede." : "Não foi possível ler os indicadores agora."); }
        else setReading(parseNetworkReading(r.data));
        setLoading(false);
      });
  }, [on, known, school]);
  const quality = reading ? qualityFindings(reading) : [];
  const name = (id: string) => schools.find((x) => x.id === id)?.name ?? id;
  function exportCsv() {
    if (!reading) return;
    const res = runReport(INDICADORES_REDE, { params: {} }, indicatorRows(reading));
    const blob = new Blob([toCsv(res, { headerLines: ["SIGEM"], title: INDICADORES_REDE.title }, [`Situação em ${reading.asOf}`, `Recorte: ${reading.school ? name(reading.school) : "rede"}`, "Projeção dinâmica; não é documento oficial."])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `indicadores-rede-${reading.asOf}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <section aria-labelledby="rede-ind" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="rede-ind" className="text-lg font-semibold">Indicadores da rede (CIECE)</h2>
        <Button variant="outline" onClick={exportCsv} disabled={!reading}>Exportar CSV</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Recorte<select className="ml-2 rounded border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Rede</option>{schools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="text-sm">Situação em <DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
        <label className="text-sm">Conhecido até (opcional) <DateInput value={known} onChange={(e) => setKnown(e.target.value)} /></label>
      </div>
      {loading ? <p role="status" className="text-sm">Lendo as fontes…</p>
        : error ? <EmptyState title="Indicadores indisponíveis" description={error} />
        : !reading ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reading.indicators.map((i) => { const d = NETWORK_INDICATORS.find((x) => x.key === i.key)!; const by = i.breakdown?.["escola"] ?? null; return (
              <article key={i.key} className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label={d.name}>
                <header className="flex items-start justify-between gap-2"><h3 className="font-medium">{d.name}</h3><span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{natureLabel(d, i)}</span></header>
                <p className="text-3xl font-semibold tabular-nums">{i.state === "available" || i.state === "zero" ? (i.value ?? 0).toLocaleString("pt-BR") : "—"}</p>
                <p className="text-xs"><strong>{STATE_LABEL[i.state]}</strong>{i.reason ? ` — ${i.reason}` : ""}</p>
                <p className="text-xs text-muted-foreground">{d.definition} Unidade: {d.unit}. Fonte: {i.source}.</p>
                {by && Object.keys(by).length > 1 ? (
                  <div><Button variant="link" className="h-auto p-0 text-xs" onClick={() => setOpen(open === i.key ? null : i.key)}>{open === i.key ? "Ocultar escolas" : "Ver por escola"}</Button>
                    {open === i.key ? <ul className="mt-1 max-h-48 overflow-auto text-xs">{Object.entries(by).sort((a, b) => name(a[0]).localeCompare(name(b[0]))).map(([k, v]) => <li key={k}>{name(k)}: {v}</li>)}</ul> : null}</div>
                ) : null}
              </article>); })}
          </div>
          <section aria-labelledby="qualidade-ind" className="space-y-2 rounded-lg border border-border p-4">
            <h3 id="qualidade-ind" className="font-medium">Qualidade das fontes</h3>
            <p className="text-xs text-muted-foreground">Lacunas das fontes, não desempenho: nada aqui avalia escola ou profissional.</p>
            {quality.length === 0 ? <p className="text-sm">Nenhuma lacuna nas fontes deste recorte.</p>
              : <ul className="space-y-1 text-sm">{quality.map((q) => <li key={q.key}><span className="text-muted-foreground">[{QUALITY_LABEL[q.kind]}]</span> {q.text}</li>)}</ul>}
          </section>
        </>
      )}
    </section>
  );
}

const QUALITY_LABEL = { ausencia: "ausência", "nao-autorizado": "fora do seu alcance", "pendente-oficializacao": "aguardando oficialização", "fonte-nao-constituida": "fonte não constituída" } as const;

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const today = () => new Date().toISOString().slice(0, 10);
const cache = new SessionMetricCache();
const PERSPECTIVE_LABEL: Record<string, string> = { secretaria: "Secretaria — vida escolar", "departamento-pessoal": "Departamento Pessoal", alimentacao: "Alimentação Escolar", pessoal: "Minha conta" };

function MetricCard({ d, ctx, caps, tick }: { d: MetricDefinition; ctx: Ctx; caps: readonly CapabilityRow[]; tick: number }) {
  const [state, setState] = useState<{ result: MetricResult; fetchedAt: number; stale: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setState(null); evaluate(d, ctx, caps, cache, tick > 0).then(setState); }, [d, ctx, caps, tick]);
  const r = state?.result;
  return (
    <article className="rounded-lg border border-border bg-card p-4 space-y-2" aria-labelledby={`m-${d.id}`}>
      <h3 id={`m-${d.id}`} className="text-sm font-medium text-muted-foreground">{d.label}</h3>
      {!r ? <p role="status" className="text-sm">Calculando…</p>
        : r.status === "disponivel" ? <p className="text-3xl font-semibold tabular-nums">{r.value.toLocaleString("pt-BR")} <span className="text-sm font-normal text-muted-foreground">{r.unit}</span></p>
        : <p className="text-sm"><strong>Não disponível.</strong> {r.reason}</p>}
      {r?.status === "disponivel" && r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
      {state && <p className="text-xs text-muted-foreground">Calculado às {new Date(state.fetchedAt).toLocaleTimeString("pt-BR")}{state.stale ? " — desatualizado, use Atualizar" : ""}</p>}
      <button type="button" className="text-xs underline" aria-expanded={open} onClick={() => setOpen(!open)}>De onde veio esse número?</button>
      {open && (
        <dl className="text-xs space-y-1">
          <div><dt className="inline font-medium">Definição: </dt><dd className="inline">{d.definition}</dd></div>
          <div><dt className="inline font-medium">Fórmula (v{d.version}): </dt><dd className="inline">{d.formula}</dd></div>
          <div><dt className="inline font-medium">Fonte: </dt><dd className="inline">{d.source}</dd></div>
          <div><dt className="inline font-medium">Granularidade: </dt><dd className="inline">{d.granularity}</dd></div>
          <div><dt className="inline font-medium">Situação em: </dt><dd className="inline">{ctx.validOn}; conhecido até {ctx.knownAt ?? "agora"}</dd></div>
          {r?.status === "disponivel" && r.refs.length > 0 && <div><dt className="font-medium">Registros que compõem o número ({r.refs.length}):</dt><dd className="font-mono break-all max-h-24 overflow-auto">{r.refs.slice(0, 200).join(", ")}{r.refs.length > 200 ? " …" : ""}</dd></div>}
          {d.drillRoute && <div><Link to={d.drillRoute as "/"} className="underline">Abrir os registros na área de origem</Link></div>}
        </dl>
      )}
    </article>
  );
}

export function ExecutiveDashboardPage() {
  const [caps, setCaps] = useState<CapabilityRow[] | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [school, setSchool] = useState(""); const [on, setOn] = useState(today()); const [known, setKnown] = useState(""); const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      const { data, error } = await db.rpc("effective_scope_capabilities", {});
      if (error) throw new Error("capabilities");
      const c = (data ?? []) as CapabilityRow[];
      const { data: v } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false });
      const names = new Map<string, string>(); for (const r of v ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
      const net = c.some((x) => x.policy_id && x.scope_level === "rede");
      const ids = net ? [...names.keys()] : [...new Set(c.filter((x) => x.policy_id && x.school_id).map((x) => x.school_id!))];
      setSchools(ids.map((id) => ({ id, name: names.get(id) ?? "Escola sem nome registrado" })).sort((a, b) => a.name.localeCompare(b.name)));
      setCaps(c);
    })().catch(() => setErr("Não foi possível ler suas permissões vigentes."));
  }, []);
  const schoolCtx = useMemo<Ctx>(() => ({ scope: { kind: "escola", schoolId: school }, validOn: on, knownAt: known ? `${known}T23:59:59Z` : null }), [school, on, known]);
  const selfCtx = useMemo<Ctx>(() => ({ scope: { kind: "pessoal" }, validOn: today(), knownAt: null }), []);
  if (err) return <StatePanel tone="danger" title="Não foi possível abrir" description={err} />;
  if (!caps) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>;
  const schoolMetrics = METRIC_CATALOG.filter((d) => d.scope === "escola");
  const groups = [...new Set(schoolMetrics.map((d) => d.perspective))];
  return (
    <div className="space-y-6">
      <PageHeader title="Painéis executivos" description="Números calculados na hora a partir dos registros oficiais, com definição, fórmula e fonte. Cada perspectiva aparece conforme suas permissões vigentes — nunca pelo nome do cargo." />
      <section aria-labelledby="pessoal" className="space-y-3">
        <h2 id="pessoal" className="text-lg font-semibold">{PERSPECTIVE_LABEL["pessoal"]}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{METRIC_CATALOG.filter((d) => d.scope === "pessoal").map((d) => <MetricCard key={d.id} d={d} ctx={selfCtx} caps={caps} tick={tick} />)}</div>
      </section>
      <section aria-labelledby="escola" className="space-y-3">
        <h2 id="escola" className="text-lg font-semibold">Escola</h2>
        {schools.length === 0 ? <EmptyState title="Nenhuma escola no seu alcance" description="Sua atuação não tem permissão vigente com alcance de escola ou rede." /> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">Escola<select className="ml-2 rounded border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Selecione…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-sm">Situação em <DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
              <label className="text-sm">Conhecido até (opcional) <DateInput value={known} onChange={(e) => setKnown(e.target.value)} /></label>
              <Button variant="outline" onClick={() => { cache.invalidate(); setTick((t) => t + 1); }}>Atualizar</Button>
            </div>
            {!school ? <p className="text-sm text-muted-foreground">Escolha uma escola.</p> : groups.map((g) => {
              const ms = schoolMetrics.filter((d) => d.perspective === g && hasScope(caps, d.capabilities, schoolCtx.scope));
              return (
                <div key={g} className="space-y-2">
                  <h3 className="font-medium">{PERSPECTIVE_LABEL[g]}</h3>
                  {ms.length === 0 ? <p className="text-sm text-muted-foreground">Não disponível: sem permissão vigente nesta escola para esta área.</p>
                    : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{ms.map((d) => <MetricCard key={d.id} d={d} ctx={schoolCtx} caps={caps} tick={tick} />)}</div>}
                </div>
              );
            })}
          </>
        )}
      </section>
      <NetworkIntelligence />
      <section aria-labelledby="outras" className="space-y-2">
        <h2 id="outras" className="text-lg font-semibold">Outras perspectivas</h2>
        <p className="text-sm text-muted-foreground">Rede (CIECE), Supervisão, Avaliação e Direção têm números próprios nas suas áreas; aqui não são recalculados.</p>
        <ul className="space-y-1 text-sm">{LINKED_SURFACES.map((s) => <li key={s.route}><Link to={s.route as "/"} className="underline">{s.label}</Link> — {s.why}</li>)}</ul>
      </section>
    </div>
  );
}
