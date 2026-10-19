import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { CALENDAR_UNRESOLVED, executionMessage } from "./execution-model";
import { MANUAL_CLASSES, MOVEMENT_CLASS_LABEL, expiresWithin, expiryText, lotText, opsMessage, type KitchenDay } from "./operations-l3-model";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { MENU_REASONS, adhesion, diaryProblems, grossTotal, pvpsOrder, type Compliance, type Counts } from "./kitchen-diary";
import { WaterFiltersPanel } from "./water-filters-panel";
import { LabelsPanel } from "./labels-panel";
import { MenuOfDay, usePlannedMenu } from "./menu-of-day";
import { plannedFirst } from "./planned-consumption";
import { SpecialDietKitchenList } from "./special-diet";
type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = callRpc;
const db = supabase as unknown as { from: (t: string) => any };
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const field = "mt-1 block w-full rounded-lg border bg-background p-3 text-base";
const big = "w-full rounded-lg px-4 py-3 text-base font-medium disabled:opacity-50";
const KITCHEN_CAP = "registrar-execucao-alimentacao";

/** Estação Cozinha: só a escola da atuação; o banco decide (meal_kitchen_day_at falha fechado). Nada de aluno ou pessoa. */
export function KitchenStation() {
  const today = operationalToday();
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const own = useOwnSchoolId(); const [pickedSchool, setSchool] = useState(""); const school = own ?? pickedSchool; const [day, setDay] = useState<KitchenDay | null>(null);
  const [slots, setSlots] = useState<{ value_id: string; label: string }[]>([]);
  const [docs, setDocs] = useState<{ title: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const caps = await call<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null; engagement_id: string | null }[]>("effective_scope_capabilities", {});
        // Concessão homologada (política) ou da estação do setor (sem atuação); o banco revalida em meal_kitchen_day_at.
        const mine = (caps ?? []).filter((c) => (c.policy_id || !c.engagement_id) && c.capability_id === KITCHEN_CAP);
        const network = mine.some((c) => c.scope_level === "rede");
        const ids = [...new Set(mine.filter((c) => c.scope_level === "escola" && c.school_id).map((c) => c.school_id!))];
        let q = db.from("institutional_school_record_versions").select("school_id, official_name, version_number, active").order("version_number", { ascending: false });
        if (!network) q = q.in("school_id", ids.length ? ids : ["-"]);
        const { data } = await q;
        const heads = new Map<string, { name: string; active: boolean }>(); for (const r of data ?? []) if (!heads.has(r.school_id)) heads.set(r.school_id, { name: r.official_name, active: r.active });
        const all = network ? [...heads.entries()].filter(([, h]) => h.active).map(([id]) => id) : ids;
        const list = all.map((id) => ({ id, name: heads.get(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); setSchools(list); if (list.length === 1) setSchool(list[0]!.id);
      } catch (e) { setErr(opsMessage((e as Error).message)); }
    })();
    void db.from("attribute_value_definitions").select("value_id, label").eq("scheme_id", "refeicao-escolar").eq("status", "homologada").then((r: any) => setSlots(r.data ?? []));
  }, []);
  const load = useCallback(async () => {
    if (!school) return;
    try { setDay(await call<KitchenDay>("meal_kitchen_day_at", { _school: school, _on: today })); setErr(null); } catch (e) { setDay(null); setErr(opsMessage((e as Error).message)); }
    try { const d = await call<{ payload: { titulo?: string } }[]>("meal_master_at", { _kind: "documento-tecnico", _on: today, _known_at: null, _include_drafts: false }); setDocs((d ?? []).map((x) => ({ title: x.payload?.titulo ?? "Documento" }))); } catch { setDocs(null); }
  }, [school, today]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Cozinha" description={`Hoje, ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}. Só a sua unidade; nada aqui altera cardápio, catálogo ou autorização.`} />
      {schools === null && !err ? <SkeletonState label="Carregando" />
        : schools && schools.length === 0 ? <StatePanel tone="warning" title="Sem atuação de cozinha" description="Sua atuação não inclui registro de execução da alimentação em nenhuma escola nesta data." />
        : (<>
          {!own && schools && schools.length > 1 && <label className="block">Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          {err && <StatePanel tone="warning" title="Não disponível" description={err} />}
          {school && day && <KitchenDayView school={school} day={day} slots={slots} docs={docs} onDone={load} today={today} />}
        </>)}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 rounded-xl border p-4"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;
}

function KitchenDayView({ school, day, slots, docs, onDone, today }: { school: string; day: KitchenDay; slots: { value_id: string; label: string }[]; docs: { title: string }[] | null; onDone: () => void; today: string }) {
  const label = (v: string) => slots.find((s) => s.value_id === v)?.label ?? "Refeição";
  return (<div className="space-y-4">
    <StatePanel tone="info" title="Dia operacional" description={CALENDAR_UNRESOLVED} />
    <MenuOfDay today={today} />
    {school && <SpecialDietKitchenList school={school} today={today} />}
    <Card title="Refeições de hoje">
      {slots.length === 0 ? <p className="text-muted-foreground">Nenhuma refeição cadastrada.</p> : (
        <ul className="space-y-2">{slots.map((s) => { const e = day.executions.find((x) => x.slot === s.value_id); return (
          <li key={s.value_id} className="rounded-lg border p-3"><strong>{s.label}</strong>: {!e ? "sem registro" : e.followed === true ? "cardápio seguido" : e.followed === false ? `desvio — ${e.deviation ?? ""}` : "não informado"}
            {e && <div className="text-muted-foreground">Refeições servidas: {e.meals_total ?? "não informado"} · Alunos presentes: {e.students_present ?? "não informado"}</div>}</li>); })}</ul>)}
      <p className="text-muted-foreground">Refeições servidas e alunos presentes são contagens separadas. A adesão aparece no Diário da Cozinha quando as contagens são informadas.</p>
    </Card>
    <QuickExecution school={school} slots={slots} today={today} onDone={onDone} taken={day.executions.map((e) => e.slot)} label={label} />
    <Card title="Entregas esperadas hoje">
      {day.deliveries.length === 0 ? <p className="text-muted-foreground">Nenhuma entrega programada para hoje.</p> : (
        <ul className="divide-y">{day.deliveries.map((d) => <li key={d.schedule} className="py-2">{d.item} · {d.quantity} {d.unit} — {d.receipt_status ? "recebida" : "aguardando recebimento"}</li>)}</ul>)}
      {day.overdue_receipts > 0 && <StatePanel tone="warning" title="Recebimentos pendentes" description={`${day.overdue_receipts} entrega(s) com data anterior sem recebimento confirmado.`} />}
    </Card>
    <Card title="Estoque da unidade">
      {day.stock.length === 0 ? <p className="text-muted-foreground">Sem saldo registrado. Isso não afirma estoque zero.</p> : (
        <ul className="divide-y">{day.stock.map((l, i) => { const near = expiresWithin(l.expires_on, today, 7); return (
          <li key={i} className="py-2">{l.item} · {l.balance ?? "não disponível"} {l.unit}<div className="text-muted-foreground">Lote {lotText(l.lot)} · validade {expiryText(l.expires_on)}{near ? " · vence em até 7 dias ou já venceu" : ""}</div></li>); })}</ul>)}
      <p className="text-muted-foreground">Só sai do estoque o consumo que você registrar.</p>
    </Card>
    <QuickConsumption school={school} stock={day.stock} today={today} onDone={onDone} />
    <WaterFiltersPanel school={school} today={today} />
    {day && <LabelsPanel school={school} today={today} stock={day.stock} />}
    <Card title="Checklist e documentos">
      <p>Registros operacionais de hoje: {day.operational_records}. Checklists só existem sobre modelo operacional homologado.</p>
      {docs === null ? <p className="text-muted-foreground">Documentos técnicos não disponíveis para sua conta.</p> : docs.length === 0 ? <p className="text-muted-foreground">Nenhum POP ou cartilha cadastrado.</p>
        : <ul className="list-disc pl-5">{docs.map((d, i) => <li key={i}>{d.title}</li>)}</ul>}
    </Card>
  </div>);
}

const num = (s: string) => (s === "" ? null : Number(s));
function QuickExecution({ school, slots, today, onDone, taken, label }: { school: string; slots: { value_id: string; label: string }[]; today: string; onDone: () => void; taken: string[]; label: (v: string) => string }) {
  const [slot, setSlot] = useState(""); const [comp, setComp] = useState<Compliance | "">(""); const [reason, setReason] = useState(""); const [served, setServed] = useState("");
  const [prep, setPrep] = useState(""); const [c, setC] = useState({ present: "", first: "", repeats: "", staff: "" }); const [sample, setSample] = useState(false);
  const [msg, setMsg] = useState<string | null>(null); const busy = useRef(false); const [pending, setPending] = useState(false);
  const planned = usePlannedMenu(today);
  const counts: Counts = { present: num(c.present), first: num(c.first), repeats: num(c.repeats), staff: num(c.staff) };
  const problems = diaryProblems(comp, reason, served, counts);
  const total = grossTotal(counts); const adh = adhesion(counts);
  const save = async () => {
    if (busy.current || problems.length) return; busy.current = true; setPending(true);
    try {
      const basis = `cardápio previsto: ${planned ?? "não informado"}; 1ª refeição a alunos: ${c.first || "não informado"}; repetições: ${c.repeats || "não informado"}; servidores: ${c.staff || "não informado"}; amostra coletada e etiquetada: ${sample ? "sim" : "não"}`;
      await call("record_meal_execution", { _base_id: null, _kind: "registro", _school: school, _on: today, _slot: slot, _planned_menu: null,
        _followed: comp === "sim", _preparation: prep || (comp === "sim" ? planned : null) || null, _deviation: comp === "sim" ? null : `${comp === "parcialmente" ? "Parcialmente" : "Não"} — servido: ${served.trim()}`, _deviation_reason: comp === "sim" ? null : reason,
        _authorization: null, _meals_total: total, _count_basis: basis, _breakdown: [], _students_present: counts.present, _students_source: counts.present == null ? null : "contagem da cozinha no turno", _consumption: [], _tz: TZ, _reason: null });
      setMsg(`Registrado: ${label(slot)}.`); setSlot(""); setComp(""); setReason(""); setServed(""); setPrep(""); setC({ present: "", first: "", repeats: "", staff: "" }); setSample(false); onDone();
    } catch (e) { setMsg(executionMessage((e as Error).message)); } finally { busy.current = false; setPending(false); }
  };
  const nField = (k: keyof typeof c, l: string) => <label className="block">{l}<input inputMode="numeric" className={field} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value.replace(/\D/g, "") })} /></label>;
  return (<Card title="Diário da Cozinha — refeição do turno">
    <label className="block">Refeição / turno<select className={field} value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Escolha…</option>{slots.filter((s) => !taken.includes(s.value_id)).map((s) => <option key={s.value_id} value={s.value_id}>{s.label}</option>)}</select></label>
    <p className="text-muted-foreground">Previsto hoje: {planned ?? "não informado (escolha a modalidade no Cardápio do dia)"}</p>
    <p className="font-medium">1. O cardápio foi cumprido?</p>
    <div role="radiogroup" aria-label="Cardápio cumprido?" className="grid grid-cols-3 gap-2">{([["sim", "Sim"], ["parcialmente", "Parcialmente"], ["nao", "Não"]] as const).map(([v, l]) => (
      <button key={v} type="button" role="radio" aria-checked={comp === v} onClick={() => setComp(v)} className={`${big} border ${comp === v ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>
    {comp && comp !== "sim" && <>
      <label className="block">Motivo<select className={field} value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Escolha…</option>{MENU_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="block">Cardápio efetivamente servido<input className={field} value={served} onChange={(e) => setServed(e.target.value)} /></label></>}
    <label className="block">Preparação executada<input className={field} value={prep} onChange={(e) => setPrep(e.target.value)} /></label>
    <p className="font-medium">2. Refeições servidas</p>
    <div className="grid grid-cols-2 gap-2">{nField("present", "Alunos presentes no turno")}{nField("first", "1ª refeição servida a alunos")}{nField("repeats", "Repetições de alunos")}{nField("staff", "Refeições de servidores")}</div>
    <p className="text-sm">Adesão real: {adh == null ? "não calculada" : `${adh}%`} · Total bruto de refeições: {total ?? "não informado"}</p>
    <p className="text-xs text-muted-foreground">Fórmulas padrão do sistema: adesão = 1ª refeição ÷ presentes (máx. 100%); total = alunos + repetições + servidores.</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Amostra do turno coletada e etiquetada (RDC 216)</label>
    {problems.map((p) => <p key={p} className="text-destructive text-sm">{p}</p>)}
    <button type="button" disabled={!slot || pending || problems.length > 0} onClick={save} className={`${big} bg-primary text-primary-foreground`}>{pending ? "Enviando…" : "Registrar"}</button>
    {msg && <p role="status">{msg}</p>}
  </Card>);
}

/** 3. Baixa de ingredientes do dia: lotes em ordem PVPS, botões +1 e uma saída por linha no livro de estoque. */
function QuickConsumption({ school, stock, today, onDone }: { school: string; stock: KitchenDay["stock"]; today: string; onDone: () => void }) {
  const lines = pvpsOrder(stock);
  const plannedMenu = usePlannedMenu(today);
  const [qty, setQty] = useState<Record<number, string>>({}); const [klass, setKlass] = useState<string>("consumo-observado"); const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const busy = useRef(false); const [pending, setPending] = useState(false);
  if (lines.length === 0) return null;
  const bump = (k: number, d: number) => setQty({ ...qty, [k]: String(Math.max(0, Number((qty[k] ?? "0").replace(",", ".")) + d)) });
  const save = async () => {
    if (busy.current) return; busy.current = true; setPending(true);
    const out: string[] = [];
    for (const [k, v] of Object.entries(qty)) {
      const n = Number(v.replace(",", ".")); if (!n) continue; const l = lines[Number(k)]!;
      try {
        await call("record_meal_stock_movement", { _base_id: null, _kind: "registro", _school: school, _class: klass, _item: l.item, _unit: l.unit, _quantity: n, _direction: null, _on: today, _tz: TZ,
          _lot: l.lot, _expires: null, _contract: null, _schedule: null, _source_doc: null, _count: null, _literal: null, _note: null, _reason: reason || null });
        out.push(`${l.item}: baixa de ${n}`);
      } catch (e) { out.push(`${l.item}: ${opsMessage((e as Error).message)}`); }
    }
    setMsg(out.length ? out.join(" · ") : "Nenhuma quantidade informada."); setQty({}); busy.current = false; setPending(false); onDone();
  };
  return (<Card title="3. Baixa de ingredientes do dia">
    <p className="text-sm text-muted-foreground">Lotes em ordem de vencimento: o que vence primeiro sai primeiro.</p>
    <label className="block">Tipo<select className={field} value={klass} onChange={(e) => setKlass(e.target.value)}>{MANUAL_CLASSES.map((c) => <option key={c} value={c}>{MOVEMENT_CLASS_LABEL[c]}</option>)}</select></label>
    {plannedMenu && <p className="text-sm">Itens do cardápio previsto aparecem primeiro. A quantidade é sempre a usada de fato.</p>}
    <ul className="divide-y">{plannedFirst(lines, plannedMenu).map(({ line: l, index: k, planned }) => (
      <li key={k} className="flex flex-wrap items-center gap-2 py-2">
        <span className="min-w-40 flex-1">{planned && <strong>Previsto · </strong>}{l.item} ({l.unit}) · saldo {l.balance ?? "não disponível"} · lote {lotText(l.lot)} · validade {expiryText(l.expires_on)}</span>
        <button type="button" className="rounded border px-3 py-2" onClick={() => bump(k, 1)}>+1</button>
        <input inputMode="decimal" aria-label={`Quantidade de ${l.item}`} className="w-20 rounded border bg-background p-2" value={qty[k] ?? ""} onChange={(e) => setQty({ ...qty, [k]: e.target.value })} />
      </li>))}</ul>
    <label className="block">Motivo (obrigatório se o saldo ficar negativo)<input className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    <button type="button" disabled={pending} onClick={save} className={`${big} bg-primary text-primary-foreground`}>{pending ? "Enviando…" : "Registrar baixas"}</button>
    {msg && <p role="status">{msg}</p>}
  </Card>);
}
