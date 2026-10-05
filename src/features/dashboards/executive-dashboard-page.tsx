import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/sigem/page-header";
import { EmptyState, StatePanel } from "@/components/sigem/states";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { evaluate, hasScope, SessionMetricCache, type CapabilityRow, type Ctx, type MetricDefinition, type MetricResult } from "./metric-engine";
import { LINKED_SURFACES, METRIC_CATALOG } from "./metric-catalog";

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
        <h2 id="pessoal" className="text-lg font-semibold">{PERSPECTIVE_LABEL.pessoal}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{METRIC_CATALOG.filter((d) => d.scope === "pessoal").map((d) => <MetricCard key={d.id} d={d} ctx={selfCtx} caps={caps} tick={tick} />)}</div>
      </section>
      <section aria-labelledby="escola" className="space-y-3">
        <h2 id="escola" className="text-lg font-semibold">Escola</h2>
        {schools.length === 0 ? <EmptyState title="Nenhuma escola no seu alcance" description="Sua atuação não tem permissão vigente com alcance de escola ou rede." /> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">Escola<select className="ml-2 rounded border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Selecione…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-sm">Situação em <DateInput value={on} onChange={setOn} /></label>
              <label className="text-sm">Conhecido até (opcional) <DateInput value={known} onChange={setKnown} /></label>
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
      <section aria-labelledby="outras" className="space-y-2">
        <h2 id="outras" className="text-lg font-semibold">Outras perspectivas</h2>
        <p className="text-sm text-muted-foreground">Rede (CIECE), Supervisão, Avaliação e Direção têm números próprios nas suas áreas; aqui não são recalculados.</p>
        <ul className="space-y-1 text-sm">{LINKED_SURFACES.map((s) => <li key={s.route}><Link to={s.route as "/"} className="underline">{s.label}</Link> — {s.why}</li>)}</ul>
      </section>
    </div>
  );
}
