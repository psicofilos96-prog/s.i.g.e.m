import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { evaluate, hasScope, SessionMetricCache, type CapabilityRow, type Ctx, type MetricDefinition, type MetricResult } from "./metric-engine";
import { LINKED_SURFACES, METRIC_CATALOG } from "./metric-catalog";
import { NETWORK_INDICATORS } from "./network-indicator-catalog";
import { STATE_LABEL, natureLabel, parseNetworkReading, type NetworkReading } from "./network-indicator-runtime";
import { ANALYTICS_BLOCKS, YEAR_LABEL, analyticsCsv, compareAll, displayState, displayValue, pointOf, qualityPanel, yearNature, type YearNature } from "./network-analytics";

/** AD.2 + AM: indicadores da rede pelo reader canônico; ano por estado registrado, comparação só compatível, qualidade separada. */
function NetworkIntelligence() {
  const [on, setOn] = useState(today());
  const [known, setKnown] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const [cmpOn, setCmpOn] = useState("");
  const [cmpYear, setCmpYear] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [reading, setReading] = useState<NetworkReading | null>(null);
  const [cmp, setCmp] = useState<NetworkReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    void db.from("institutional_school_record_versions").select("school_id, official_name, version_number").then((r: { data: { school_id: string; official_name: string; version_number: number }[] | null }) => {
      const last = new Map<string, { n: number; name: string }>();
      for (const x of r.data ?? []) { const c = last.get(x.school_id); if (!c || c.n < x.version_number) last.set(x.school_id, { n: x.version_number, name: x.official_name }); }
      setSchools([...last].map(([id, v]) => ({ id, name: v.name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    void loadYears().then(setYears);
  }, []);
  useEffect(() => {
    if (!on) return;
    setLoading(true); setError(null);
    void readNetwork(on, known, school, year).then((r) => { setReading(r.reading); setError(r.error); setLoading(false); });
  }, [on, known, school, year]);
  useEffect(() => {
    if (!cmpOn) { setCmp(null); return; }
    void readNetwork(cmpOn, known, school, cmpYear).then((r) => setCmp(r.reading));
  }, [cmpOn, cmpYear, known, school]);
  const ynOf = (id: string) => (id ? years.find((y) => y.id === id)?.nature ?? "sem-estado" : null);
  const yn = ynOf(year);
  const quality = reading ? qualityPanel(reading) : null;
  const name = (id: string) => schools.find((x) => x.id === id)?.name ?? id;
  const comparisons = reading && cmp ? compareAll(pointOf(reading, yn ?? "sem-estado"), pointOf(cmp, ynOf(cmpYear) ?? "sem-estado")) : null;
  function exportCsv() {
    if (!reading) return;
    const blob = new Blob([analyticsCsv(reading, yn ?? "sem-estado", name)], { type: "text/csv;charset=utf-8" });
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
        <label className="text-sm">Ano letivo<select className="ml-2 rounded border border-input bg-background p-2" value={year} onChange={(e) => setYear(e.target.value)}><option value="">Todos (sem recorte de ano)</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name} — {YEAR_LABEL[y.nature]}</option>)}</select></label>
        <label className="text-sm">Situação em <DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
        <label className="text-sm">Conhecido até (opcional) <DateInput value={known} onChange={(e) => setKnown(e.target.value)} /></label>
      </div>
      {yn ? <p className="text-xs text-muted-foreground">Natureza do ano: <strong>{YEAR_LABEL[yn]}</strong> (do estado registrado do ano; nenhum ano vira operacional sem ato humano de abertura).</p> : null}
      {loading ? <p role="status" className="text-sm">Lendo as fontes…</p>
        : error ? <EmptyState title="Indicadores indisponíveis" description={error} />
        : !reading ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reading.indicators.map((i) => { const d = NETWORK_INDICATORS.find((x) => x.key === i.key)!; const by = i.breakdown?.["escola"] ?? null; return (
              <article key={i.key} className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label={d.name}>
                <header className="flex items-start justify-between gap-2"><h3 className="font-medium">{d.name}</h3><span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{natureLabel(d, i)}</span></header>
                <p className="text-3xl font-semibold tabular-nums">{displayValue(i)}</p>
                <p className="text-xs" data-state={displayState(i)}><strong>{STATE_LABEL[i.state]}</strong>{i.reason ? ` — ${i.reason}` : ""}</p>
                <p className="text-xs text-muted-foreground">{d.definition} Unidade: {d.unit}. Versão {d.version}. Fonte: {i.source}.</p>
                {by && Object.keys(by).length > 1 ? (
                  <div><Button variant="link" className="h-auto p-0 text-xs" onClick={() => setOpen(open === i.key ? null : i.key)}>{open === i.key ? "Ocultar escolas" : "Ver por escola"}</Button>
                    {open === i.key ? <ul className="mt-1 max-h-48 overflow-auto text-xs">{Object.entries(by).sort((a, b) => name(a[0]).localeCompare(name(b[0]))).map(([k, v]) => <li key={k}>{name(k)}: {v}</li>)}</ul> : null}</div>
                ) : null}
              </article>); })}
          </div>
          <section aria-labelledby="comparar-ind" className="space-y-2 rounded-lg border border-border p-4">
            <h3 id="comparar-ind" className="font-medium">Comparar com outra leitura</h3>
            <p className="text-xs text-muted-foreground">Só compara mesma versão da definição, mesmo recorte, mesma natureza do ano e mesma fonte; caso contrário, o motivo aparece.</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">Situação em <DateInput value={cmpOn} onChange={(e) => setCmpOn(e.target.value)} /></label>
              <label className="text-sm">Ano letivo<select className="ml-2 rounded border border-input bg-background p-2" value={cmpYear} onChange={(e) => setCmpYear(e.target.value)}><option value="">Todos</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name} — {YEAR_LABEL[y.nature]}</option>)}</select></label>
            </div>
            {comparisons ? <ul className="space-y-1 text-sm">{comparisons.map((c) => <li key={c.key}>{c.name}: {c.result.kind === "comparavel" ? `diferença ${c.result.delta.toLocaleString("pt-BR")}` : `não comparável — ${c.result.reason}`}</li>)}</ul> : null}
          </section>
          <section aria-labelledby="qualidade-ind" className="space-y-2 rounded-lg border border-border p-4">
            <h3 id="qualidade-ind" className="font-medium">Qualidade das fontes</h3>
            <p className="text-xs text-muted-foreground">Lacunas das fontes, não desempenho: sem nota, ranking ou avaliação de escola ou profissional.</p>
            {quality ? <ul className="space-y-1 text-sm">{(Object.keys(quality) as (keyof typeof quality)[]).map((k) => <li key={k}><strong>{QUALITY_LABEL[k]}</strong>: {quality[k].length === 0 ? "nenhuma" : quality[k].map((q) => q.text).join("; ")}</li>)}</ul> : null}
          </section>
          <section aria-labelledby="bloqueios-ind" className="space-y-2 rounded-lg border border-border p-4">
            <h3 id="bloqueios-ind" className="font-medium">Bloqueados por fonte ou parâmetro ausente</h3>
            <ul className="space-y-1 text-sm">{ANALYTICS_BLOCKS.map((b) => <li key={b.code} data-state="BLOCKED"><strong>{b.label}</strong> ({b.code}): {b.reason}</li>)}</ul>
          </section>
        </>
      )}
    </section>
  );
}

type YearRow = { id: string; name: string; nature: YearNature };
async function loadYears(): Promise<YearRow[]> {
  const [v, s] = await Promise.all([
    db.from("institutional_academic_year_versions").select("academic_year_id, official_name, version"),
    db.from("academic_year_operational_states").select("academic_year_id, state, sequence"),
  ]);
  const name = new Map<string, { n: number; name: string }>();
  for (const x of (v.data ?? []) as { academic_year_id: string; official_name: string; version: number }[]) { const c = name.get(x.academic_year_id); if (!c || c.n < x.version) name.set(x.academic_year_id, { n: x.version, name: x.official_name }); }
  const head = new Map<string, { n: number; state: string }>();
  for (const x of (s.data ?? []) as { academic_year_id: string; state: string; sequence: number }[]) { const c = head.get(x.academic_year_id); if (!c || c.n < x.sequence) head.set(x.academic_year_id, { n: x.sequence, state: x.state }); }
  return [...name].map(([id, x]) => ({ id, name: x.name, nature: yearNature(head.get(id)?.state) })).sort((a, b) => a.name.localeCompare(b.name));
}
async function readNetwork(on: string, known: string, school: string, year: string): Promise<{ reading: NetworkReading | null; error: string | null }> {
  const r = await db.rpc("network_indicators_at", { _on: on, _known_at: known ? `${known}T23:59:59Z` : null, _school: school || null, _year: year || null });
  if (r.error) return { reading: null, error: /session-required/.test(r.error.message) ? "Entre para consultar os indicadores da rede." : "Não foi possível ler os indicadores agora." };
  return { reading: parseNetworkReading(r.data), error: null };
}

const QUALITY_LABEL = { incompleto: "Incompleto", ambiguo: "Ambíguo", conflito: "Conflito", "fonte-pendente": "Fonte pendente", "nao-homologado": "Não homologado", reconferencia: "Reconferência" } as const;

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const today = () => new Date().toISOString().slice(0, 10);
const cache = new SessionMetricCache();
const PERSPECTIVE_LABEL: Record<string, string> = { secretaria: "Secretaria — vida escolar", "departamento-pessoal": "Dados funcionais (DP externo)", alimentacao: "Alimentação Escolar", pessoal: "Minha conta" };

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
  if (!caps) return <SkeletonState label="Carregando" />;
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
