import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { ADHESION_BLOCK, CALENDAR_UNRESOLVED, THEORETICAL_DEBIT_BLOCK, executionMessage } from "./execution-model";
import { LABELS_STATE, MANUAL_CLASSES, MOVEMENT_CLASS_LABEL, expiresWithin, expiryText, lotText, opsMessage, type KitchenDay } from "./operations-l3-model";

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
  const [school, setSchool] = useState(""); const [day, setDay] = useState<KitchenDay | null>(null);
  const [slots, setSlots] = useState<{ value_id: string; label: string }[]>([]);
  const [docs, setDocs] = useState<{ title: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const caps = await call<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null }[]>("effective_scope_capabilities", {});
        const ids = [...new Set((caps ?? []).filter((c) => c.policy_id && c.capability_id === KITCHEN_CAP && c.scope_level === "escola" && c.school_id).map((c) => c.school_id!))];
        const { data } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").in("school_id", ids.length ? ids : ["-"]).order("version_number", { ascending: false });
        const names = new Map<string, string>(); for (const r of data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
        const list = ids.map((id) => ({ id, name: names.get(id) ?? id })); setSchools(list); if (list.length === 1) setSchool(list[0]!.id);
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
          {schools && schools.length > 1 && <label className="block">Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
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
    <Card title="Refeições de hoje">
      {slots.length === 0 ? <p className="text-muted-foreground">Nenhuma refeição homologada.</p> : (
        <ul className="space-y-2">{slots.map((s) => { const e = day.executions.find((x) => x.slot === s.value_id); return (
          <li key={s.value_id} className="rounded-lg border p-3"><strong>{s.label}</strong>: {!e ? "sem registro" : e.followed === true ? "cardápio seguido" : e.followed === false ? `desvio — ${e.deviation ?? ""}` : "não informado"}
            {e && <div className="text-muted-foreground">Refeições servidas: {e.meals_total ?? "não informado"} · Alunos presentes: {e.students_present ?? "não informado"}</div>}</li>); })}</ul>)}
      <p className="text-muted-foreground">{ADHESION_BLOCK}. Refeições servidas e alunos presentes são medidas separadas.</p>
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
      <p className="text-muted-foreground">{THEORETICAL_DEBIT_BLOCK}: só sai do estoque o consumo que você registrar.</p>
    </Card>
    <QuickConsumption school={school} stock={day.stock} today={today} onDone={onDone} />
    <Card title="Checklist e documentos">
      <p>Registros operacionais de hoje: {day.operational_records}. Checklists só existem sobre modelo operacional homologado.</p>
      {docs === null ? <p className="text-muted-foreground">Documentos técnicos não disponíveis para sua atuação.</p> : docs.length === 0 ? <p className="text-muted-foreground">Nenhum POP ou cartilha homologado.</p>
        : <ul className="list-disc pl-5">{docs.map((d, i) => <li key={i}>{d.title}</li>)}</ul>}
      <p className="text-muted-foreground">Etiquetas: {LABELS_STATE} — sem modelo aprovado, nenhuma etiqueta é impressa.</p>
    </Card>
  </div>);
}

function QuickExecution({ school, slots, today, onDone, taken, label }: { school: string; slots: { value_id: string; label: string }[]; today: string; onDone: () => void; taken: string[]; label: (v: string) => string }) {
  const [slot, setSlot] = useState(""); const [followed, setFollowed] = useState<"" | "sim" | "nao">(""); const [prep, setPrep] = useState("");
  const [deviation, setDeviation] = useState(""); const [why, setWhy] = useState(""); const [meals, setMeals] = useState(""); const [basis, setBasis] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const busy = useRef(false); const [pending, setPending] = useState(false);
  const save = async () => {
    if (busy.current) return; busy.current = true; setPending(true);
    try {
      await call("record_meal_execution", { _base_id: null, _kind: "registro", _school: school, _on: today, _slot: slot, _planned_menu: null,
        _followed: followed === "" ? null : followed === "sim", _preparation: prep || null, _deviation: deviation || null, _deviation_reason: why || null,
        _authorization: null, _meals_total: meals === "" ? null : Number(meals), _count_basis: basis || null, _breakdown: [], _students_present: null, _students_source: null, _consumption: [], _tz: TZ, _reason: null });
      setMsg(`Registrado: ${label(slot)}.`); setSlot(""); setFollowed(""); setPrep(""); setDeviation(""); setWhy(""); setMeals(""); setBasis(""); onDone();
    } catch (e) { setMsg(executionMessage((e as Error).message)); } finally { busy.current = false; setPending(false); }
  };
  return (<Card title="Registrar execução">
    <label className="block">Refeição<select className={field} value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Escolha…</option>{slots.filter((s) => !taken.includes(s.value_id)).map((s) => <option key={s.value_id} value={s.value_id}>{s.label}</option>)}</select></label>
    <div role="radiogroup" aria-label="Cardápio seguido?" className="grid grid-cols-3 gap-2">{([["sim", "Seguido"], ["nao", "Não seguido"], ["", "Não informar"]] as const).map(([v, l]) => (
      <button key={v} type="button" role="radio" aria-checked={followed === v} onClick={() => setFollowed(v)} className={`${big} border ${followed === v ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>
    <label className="block">Preparação executada<input className={field} value={prep} onChange={(e) => setPrep(e.target.value)} /></label>
    {followed === "nao" && <><label className="block">O que foi servido no lugar<input className={field} value={deviation} onChange={(e) => setDeviation(e.target.value)} /></label>
      <label className="block">Motivo do desvio<input className={field} value={why} onChange={(e) => setWhy(e.target.value)} /></label></>}
    <label className="block">Refeições servidas (não são alunos)<input inputMode="numeric" className={field} value={meals} onChange={(e) => setMeals(e.target.value.replace(/\D/g, ""))} /></label>
    <label className="block">Base da contagem<input className={field} placeholder="ex.: inclui repetições" value={basis} onChange={(e) => setBasis(e.target.value)} /></label>
    <button type="button" disabled={!slot || pending} onClick={save} className={`${big} bg-primary text-primary-foreground`}>{pending ? "Enviando…" : "Registrar"}</button>
    {msg && <p role="status">{msg}</p>}
  </Card>);
}

function QuickConsumption({ school, stock, today, onDone }: { school: string; stock: KitchenDay["stock"]; today: string; onDone: () => void }) {
  const [i, setI] = useState(""); const [klass, setKlass] = useState<string>("consumo-observado"); const [qty, setQty] = useState(""); const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const busy = useRef(false); const [pending, setPending] = useState(false);
  if (stock.length === 0) return null;
  const save = async () => {
    if (busy.current) return; busy.current = true; setPending(true);
    const l = stock[Number(i)]!;
    try {
      await call("record_meal_stock_movement", { _base_id: null, _kind: "registro", _school: school, _class: klass, _item: l.item, _unit: l.unit, _quantity: Number(qty.replace(",", ".")), _direction: null, _on: today, _tz: TZ,
        _lot: l.lot, _expires: null, _contract: null, _schedule: null, _source_doc: null, _count: null, _literal: null, _note: null, _reason: reason || null });
      setMsg("Saída registrada no estoque."); setQty(""); setReason(""); onDone();
    } catch (e) { setMsg(opsMessage((e as Error).message)); } finally { busy.current = false; setPending(false); }
  };
  return (<Card title="Consumo observado ou perda">
    <label className="block">Item e lote<select className={field} value={i} onChange={(e) => setI(e.target.value)}><option value="">Escolha…</option>{stock.map((l, k) => <option key={k} value={k}>{l.item} · lote {lotText(l.lot)}</option>)}</select></label>
    <label className="block">Tipo<select className={field} value={klass} onChange={(e) => setKlass(e.target.value)}>{MANUAL_CLASSES.map((c) => <option key={c} value={c}>{MOVEMENT_CLASS_LABEL[c]}</option>)}</select></label>
    <label className="block">Quantidade<input inputMode="decimal" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
    <label className="block">Motivo (obrigatório se o saldo ficar negativo)<input className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    <button type="button" disabled={i === "" || !qty || pending} onClick={save} className={`${big} bg-primary text-primary-foreground`}>{pending ? "Enviando…" : "Registrar saída"}</button>
    {msg && <p role="status">{msg}</p>}
  </Card>);
}
