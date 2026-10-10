import { callRpc } from "@/lib/rpc-call";
import { SamplesSection } from "./samples-section";
import { Link } from "@tanstack/react-router";
import { operationalToday, monthBounds, operationalMonthKey } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { KitchensSection, MenuPublications, InventorySection, NetworkOverview } from "./operation-sections";
import { PlanningSection } from "./planning-section";
import { OrdersSection } from "./orders-section";
import { ReceivingSection } from "./receiving-section";
import { StockSection } from "./stock-section";
import { ClosingSection } from "./closing-section";
import { TodaySection } from "./today-section";
import { NucleoHome } from "./nucleo-section";
import { ReportingCenter } from "./reporting-section";
import { NAV } from "./nucleo-model";
import { compare, coverage, mealMessage, shown, type Forecast, type Menu, type Service } from "./meals-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = callRpc;
const db = supabase as unknown as { from: (t: string) => any };
const field = "mt-1 block w-full rounded border bg-background p-2";
// NDATE.1: componentes locais (toISOString deslocava para o dia seguinte após 21h em Brasília).
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const br = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const PLANNING_CAPS = ["manter-planejamento-nutricional", "manter-catalogo-tecnico-alimentar", "manter-parametros-nutricionais", "conferir-conteudo-tecnico-alimentar", "homologar-conteudo-tecnico-alimentar", "manter-referencias-contratuais-alimentacao", "designar-inspetor-alimentacao", "gerir-documentos-alimentacao"];
let canPlan = false;
let canReviewOrders = false;
const ORDER_NET_CAPS = ["administrar-janela-de-pedido-alimentar", "analisar-pedido-alimentar", "autorizar-pedido-alimentar", "consolidar-demanda-alimentar"];
const MEAL_CAPS = ["manter-cardapio-escolar", "registrar-execucao-alimentacao", "consultar-alimentacao-escolar", "registrar-restricao-alimentar", "consultar-restricao-alimentar", "publicar-cardapio-escolar", "registrar-estoque-alimentar", "manter-unidades-de-alimentacao", "acompanhar-alimentacao-rede", "submeter-pedido-alimentar", ...PLANNING_CAPS, ...ORDER_NET_CAPS];
const NETWORK_ONLY = ["manter-unidades-de-alimentacao", "acompanhar-alimentacao-rede", ...PLANNING_CAPS, ...ORDER_NET_CAPS];

let canManageKitchens = false;
let canNetwork = false;
async function mealSchools(): Promise<{ id: string; name: string }[]> {
  const caps = await call<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null }[]>("effective_scope_capabilities", {});
  const mine = (caps ?? []).filter((c) => c.policy_id && MEAL_CAPS.includes(c.capability_id));
  if (mine.length === 0) return [];
  canPlan = mine.some((c) => c.scope_level === "rede" && PLANNING_CAPS.includes(c.capability_id));
  canReviewOrders = mine.some((c) => c.scope_level === "rede" && ORDER_NET_CAPS.includes(c.capability_id));
  canNetwork = mine.some((c) => c.capability_id === "acompanhar-alimentacao-rede" && c.scope_level === "rede");
  canManageKitchens = mine.some((c) => c.capability_id === "manter-unidades-de-alimentacao" && c.scope_level === "rede");
  const { data } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false });
  const names = new Map<string, string>(); for (const r of data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
  const ids = mine.some((c) => c.scope_level === "rede" && !NETWORK_ONLY.includes(c.capability_id)) || mine.every((c) => NETWORK_ONLY.includes(c.capability_id)) ? [...names.keys()] : [...new Set(mine.map((c) => c.school_id!).filter(Boolean))];
  return ids.map((id) => ({ id, name: names.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name));
}

function useCatalog(scheme: string) {
  const [v, setV] = useState<{ value_id: string; label: string }[]>([]);
  useEffect(() => { void db.from("attribute_value_definitions").select("value_id, label").eq("scheme_id", scheme).eq("status", "homologada").then((r: any) => setV(r.data ?? [])); }, [scheme]);
  return v;
}

export function SchoolMealsPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [school, setSchool] = useState("");
  const [from, setFrom] = useState(() => monthBounds(operationalMonthKey()).from);
  const [to, setTo] = useState(() => monthBounds(operationalMonthKey()).to);
  useEffect(() => { mealSchools().then((s) => { setSchools(s); if (s.length === 1) setSchool(s[0]!.id); }, (e: Error) => setErr(mealMessage(e.message))); }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Alimentação Escolar" title="Cardápio e refeições da escola" description="Veja o cardápio, a previsão e o que foi servido em cada dia. Valor nutricional só aparece quando houver regra oficial configurada." />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !schools ? <SkeletonState label="Carregando" />
        : schools.length === 0 ? <EmptyState title="Sem acesso à alimentação escolar" description="Sua atuação não tem permissão vigente de alimentação escolar." />
        : <>
            <div className="flex flex-wrap gap-3 text-sm">
              <label>Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
            <nav aria-label="Seções da alimentação escolar" className="sticky top-0 z-10 -mx-1 overflow-x-auto bg-background/95 px-1 py-2"><ul className="flex gap-2 text-sm">{NAV.map(([id, l]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="block rounded-full border px-3 py-1.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{l}</a></li>)}</ul></nav>
            {(canPlan || canReviewOrders || canNetwork) && <NucleoHome names={new Map(schools.map((x) => [x.id, x.name]))} />}
            <div id="planejamento" className="scroll-mt-16">{canPlan && <PlanningSection />}</div>
            <div id="pedidos" className="scroll-mt-16" /><div id="autorizacoes" /><div id="consolidacao" />{(canReviewOrders || school) && <OrdersSection key={`o|${school}`} school={school} network={canReviewOrders} names={new Map(schools.map((x) => [x.id, x.name]))} />}
            <div id="entregas" className="scroll-mt-16" /><div id="nao-conformidades" /><div id="documentos" />{(canReviewOrders || school) && <ReceivingSection key={`r|${school}`} school={school} network={canReviewOrders} names={new Map(schools.map((x) => [x.id, x.name]))} />}
            <div id="estoque" className="scroll-mt-16" />{school && <StockSection key={`s|${school}`} school={school} />}
            <div id="amostras" className="scroll-mt-16" />{school && <SamplesSection key={`am|${school}`} school={school} schoolName={schools.find((x) => x.id === school)?.name ?? school} />}
            <div id="fechamento" className="scroll-mt-16" />{school && <ClosingSection key={`c|${school}`} school={school} />}
            {(canNetwork || school) && <ReportingCenter key={`rep|${school}|${canNetwork}`} network={canNetwork} defaultSchool={school} names={new Map(schools.map((x) => [x.id, x.name]))} />}
            <p className="text-sm"><Link className="underline" to="/alimentacao-escolar/cozinha">Abrir Estação Cozinha</Link></p>
            <KitchensSection names={new Map(schools.map((x) => [x.id, x.name]))} canManage={canManageKitchens} />
            {from && to && <NetworkOverview key={`${from}|${to}`} from={from} to={to} names={new Map(schools.map((x) => [x.id, x.name]))} />}
            <div id="execucao" className="scroll-mt-16" /><div id="relatorios" />{school && from && to && <School key={`${school}|${from}|${to}`} school={school} from={from} to={to} />}
          </>}
    </div>
  );
}

function School({ school, from, to }: { school: string; from: string; to: string }) {
  const [data, setData] = useState<{ menus: Menu[]; forecasts: Forecast[]; services: Service[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const slots = useCatalog("refeicao-escolar"); const preps = useCatalog("preparacao-alimentar");
  const label = (list: { value_id: string; label: string }[], id: string) => list.find((x) => x.value_id === id)?.label ?? id;
  const load = useCallback(async () => {
    try {
      const [menus, forecasts, services] = await Promise.all([
        call<Menu[]>("meal_menus_at", { _school: school, _from: from, _to: to, _known_at: null, _logical_id: null }),
        call<Forecast[]>("meal_forecasts_at", { _school: school, _from: from, _to: to, _known_at: null }),
        call<Service[]>("meal_services_at", { _school: school, _from: from, _to: to, _known_at: null }),
      ]);
      setData({ menus, forecasts, services }); setErr(null);
    } catch (e) { setErr(mealMessage((e as Error).message)); }
  }, [school, from, to]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (data ? compare(data.menus, data.forecasts, data.services, null).filter((r) => r.date >= from && r.date <= to) : []), [data, from, to]);
  const cov = coverage(rows);
  const act = async (fn: string, a: Record<string, unknown>) => { setMsg(null); try { await call(fn, a); await load(); setMsg("Registrado."); } catch (e) { setMsg(mealMessage((e as Error).message)); } };
  async function fix(kind: "forecast" | "service", base: Forecast | Service) {
    const reason = await askText("Motivo da correção:"); if (!reason?.trim()) return;
    if (kind === "forecast") { const n = await askText("Previsão corrigida:", String((base as Forecast).forecast_count)); if (n === null) return;
      await act("record_meal_forecast", { _base_id: base.id, _kind: "retificacao", _school: school, _on: null, _slot: null, _count: Number(n), _basis: (base as Forecast).basis, _reason: reason }); }
    else { const n = await askText("Servidas (vazio = não informado):", String((base as Service).served_count ?? "")); if (n === null) return;
      await act("record_meal_service", { _base_id: base.id, _kind: "retificacao", _school: school, _on: null, _slot: null, _offered: (base as Service).offered_count, _served: n === "" ? null : Number(n), _source: (base as Service).source_note, _reason: reason }); }
  }
  if (err) return <StatePanel tone="warning" title="Dados não disponíveis" description={err} />;
  if (!data) return <SkeletonState label="Carregando" />;
  const fOf = (d: string, s: string) => data.forecasts.find((f) => f.served_on === d && f.meal_slot_value_id === s);
  const sOf = (d: string, s: string) => data.services.find((f) => f.served_on === d && f.meal_slot_value_id === s);
  return (
    <div className="space-y-6">
      <section aria-labelledby="cmp" className="space-y-2">
        <h2 id="cmp" className="font-semibold">Previsto × executado</h2>
        <p className="text-sm">Cobertura do período: {cov.plannedSlots === null ? "sem cardápio no período — não há base para cobertura" : `${cov.withService} de ${cov.plannedSlots} refeições planejadas com execução informada`}</p>
        <p className="text-xs text-muted-foreground">Dias letivos: o calendário aplicável a esta escola não foi resolvido nesta tela; nenhuma data foi considerada letiva ou não letiva por suposição.</p>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cardápio, previsão ou refeição registrados no período.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Previsto, ofertado e servido por dia</caption>
            <thead><tr className="text-left"><th scope="col" className="p-2">Dia</th><th scope="col" className="p-2">Refeição</th><th scope="col" className="p-2">Cardápio</th><th scope="col" className="p-2">Previsto</th><th scope="col" className="p-2">Ofertadas</th><th scope="col" className="p-2">Servidas</th><th scope="col" className="p-2">Diferença</th><th scope="col" className="p-2"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{rows.map((r) => { const f = fOf(r.date, r.slot); const s = sOf(r.date, r.slot); return (
              <tr key={`${r.date}|${r.slot}`} className="border-t align-top">
                <td className="p-2">{br(r.date)}</td><td className="p-2">{label(slots, r.slot)}</td>
                <td className="p-2">{r.planned ? r.planned.map((p) => label(preps, p)).join(", ") : "sem cardápio"}{r.divergence && <span className="block text-xs">{r.divergence}</span>}</td>
                <td className="p-2">{shown(r.forecast)}</td><td className="p-2">{shown(r.offered)}</td><td className="p-2">{shown(r.served)}</td><td className="p-2">{r.difference === null ? "—" : r.difference}</td>
                <td className="p-2 space-x-1">{f && <Button size="sm" variant="ghost" onClick={() => void fix("forecast", f)}>Corrigir previsão</Button>}{s && <Button size="sm" variant="ghost" onClick={() => void fix("service", s)}>Corrigir execução</Button>}</td>
              </tr>); })}</tbody></table></div>)}
      </section>
      <TodaySection key={`t|${school}`} school={school} slots={slots} />
      <MenuForm school={school} from={from} to={to} slots={slots} preps={preps} onSave={(a) => act("record_meal_menu", a)} />
      <CountForm title="Registrar previsão" school={school} slots={slots} onSave={(d, s, n, extra) => act("record_meal_forecast", { _base_id: null, _kind: "registro", _school: school, _on: d, _slot: s, _count: n, _basis: extra, _reason: null })} extraLabel="Base da previsão (obrigatória)" />
      <CountForm title="Registrar refeições servidas" school={school} slots={slots} onSave={(d, s, n, extra, offered) => act("record_meal_service", { _base_id: null, _kind: "registro", _school: school, _on: d, _slot: s, _offered: offered, _served: n, _source: extra || null, _reason: null })} extraLabel="Fonte (opcional)" withOffered />
      <MenuPublications school={school} menus={data.menus} />
      <InventorySection school={school} from={from} to={to} />
      <Restrictions school={school} />
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}

function MenuForm({ school, from, to, slots, preps, onSave }: { school: string; from: string; to: string; slots: { value_id: string; label: string }[]; preps: { value_id: string; label: string }[]; onSave: (a: Record<string, unknown>) => void }) {
  const [entries, setEntries] = useState<{ date: string; slot: string; preparations: string[] }[]>([]);
  const [d, setD] = useState(from); const [s, setS] = useState(""); const [p, setP] = useState<string[]>([]);
  void school;
  if (slots.length === 0 || preps.length === 0) return <section className="rounded border p-3 text-sm"><h2 className="font-semibold">Cardápio</h2><p className="text-muted-foreground">Os catálogos de refeições e preparações ainda não têm valores aprovados. Sem eles, não é possível montar cardápio.</p></section>;
  return (
    <details className="rounded border p-3 text-sm"><summary className="cursor-pointer font-semibold">Montar cardápio do período</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label>Dia<DateInput value={d} onChange={(e) => setD(e.target.value)} /></label>
        <label>Refeição<select className={field} value={s} onChange={(e) => setS(e.target.value)}><option value="">Escolha…</option>{slots.map((x) => <option key={x.value_id} value={x.value_id}>{x.label}</option>)}</select></label>
        <label>Preparações<select multiple className={field} value={p} onChange={(e) => setP([...e.target.selectedOptions].map((o) => o.value))}>{preps.map((x) => <option key={x.value_id} value={x.value_id}>{x.label}</option>)}</select></label>
      </div>
      <Button className="mt-2" variant="outline" disabled={!s || p.length === 0} onClick={() => { setEntries([...entries.filter((e) => !(e.date === d && e.slot === s)), { date: d, slot: s, preparations: p }]); setP([]); }}>Adicionar ao cardápio</Button>
      {entries.length > 0 && <ul className="mt-2">{entries.map((e) => <li key={`${e.date}${e.slot}`}>{br(e.date)} · {e.slot} · {e.preparations.length} preparação(ões)</li>)}</ul>}
      <Button className="mt-2" disabled={entries.length === 0} onClick={() => { onSave({ _base_id: null, _kind: "registro", _school: school, _group: null, _starts: from, _ends: to, _entries: entries, _reason: null }); setEntries([]); }}>Salvar cardápio</Button>
    </details>
  );
}

function CountForm({ title, slots, onSave, extraLabel, withOffered }: { title: string; school: string; slots: { value_id: string; label: string }[]; onSave: (d: string, s: string, n: number | null, extra: string, offered: number | null) => void; extraLabel: string; withOffered?: boolean }) {
  const [d, setD] = useState(operationalToday()); const [s, setS] = useState(""); const [n, setN] = useState(""); const [o, setO] = useState(""); const [x, setX] = useState("");
  if (slots.length === 0) return null;
  return (
    <details className="rounded border p-3 text-sm"><summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label>Dia<DateInput value={d} onChange={(e) => setD(e.target.value)} /></label>
        <label>Refeição<select className={field} value={s} onChange={(e) => setS(e.target.value)}><option value="">Escolha…</option>{slots.map((v) => <option key={v.value_id} value={v.value_id}>{v.label}</option>)}</select></label>
        {withOffered && <label>Ofertadas (vazio = não informado)<input inputMode="numeric" className={field} value={o} onChange={(e) => setO(e.target.value.replace(/\D/g, ""))} /></label>}
        <label>{withOffered ? "Servidas (vazio = não informado)" : "Quantidade prevista"}<input inputMode="numeric" className={field} value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="sm:col-span-2">{extraLabel}<input maxLength={300} className={field} value={x} onChange={(e) => setX(e.target.value)} /></label>
      </div>
      <Button className="mt-2" disabled={!s || (withOffered ? n === "" && o === "" : n === "" || !x.trim())} onClick={() => onSave(d, s, n === "" ? null : Number(n), x, o === "" ? null : Number(o))}>Registrar</Button>
    </details>
  );
}

type Restriction = { id: string; student_id: string; restriction_value_id: string; handling_note: string | null; valid_from: string; valid_to: string | null };
function Restrictions({ school }: { school: string }) {
  const [rs, setRs] = useState<Restriction[] | null>(null);
  const [denied, setDenied] = useState(false);
  const cats = useCatalog("restricao-alimentar");
  useEffect(() => { call<Restriction[]>("dietary_restrictions_at", { _school: school, _on: operationalToday(), _known_at: null }).then(setRs, () => setDenied(true)); }, [school]);
  if (denied) return null; // sem permissão sensível: nada é revelado, nem a existência
  return (
    <section aria-labelledby="rst" className="space-y-2 rounded border p-3 text-sm">
      <h2 id="rst" className="font-semibold">Restrições alimentares vigentes (acesso restrito)</h2>
      <p className="text-xs text-muted-foreground">Somente a restrição e a orientação de manejo. Não registre diagnóstico.</p>
      {!rs ? <SkeletonState label="Carregando" /> : rs.length === 0 ? <p className="text-muted-foreground">Nenhuma restrição vigente registrada.</p>
        : <ul>{rs.map((r) => <li key={r.id}>Estudante {r.student_id} · {cats.find((c) => c.value_id === r.restriction_value_id)?.label ?? r.restriction_value_id}{r.handling_note ? ` · ${r.handling_note}` : ""}</li>)}</ul>}
    </section>
  );
}
