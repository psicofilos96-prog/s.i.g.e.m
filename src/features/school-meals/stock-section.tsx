import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { knownLabel } from "@/config/ui-vocabulary";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { ALERT_LABEL, MINIMUM_STOCK_STATE, STOCK_BASIS_BLOCK, stockMessage, suggestLotsByExpiry } from "./stock-model";
import {
  MANUAL_CLASSES, MOVEMENT_CLASS_LABEL, adjustmentFor, divergence, expiryText, filterLedger, itemCard, lotText, opsMessage,
  type CountLine, type LedgerFilter, type LedgerRow,
} from "./operations-l3-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = callRpc;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const field = "mt-1 block w-full rounded border bg-background p-2";
const today = () => operationalToday();
interface Line { item_value_id: string; unit_value_id: string; lot: string | null; expires_on: string | null; balance: number | null; movements: number }
interface Alert { kind: string; item_value_id: string; unit_value_id: string; lot: string | null; detail: string }
interface Count { logical_id: string; version: number; status: string; counted_on: string; lines: CountLine[]; author_person_id: string }
type Tab = "saldo" | "ficha" | "registrar" | "contagem" | "transferencia";
const TABS: [Tab, string][] = [["saldo", "Saldo"], ["ficha", "Ficha e histórico"], ["registrar", "Registrar saída"], ["contagem", "Contagem física"], ["transferencia", "Transferência"]];

/** Trava de dupla submissão: um envio por vez, sempre liberada no fim. */
function useOnce() {
  const busy = useRef(false); const [pending, setPending] = useState(false);
  const run = useCallback(async (fn: () => Promise<void>) => { if (busy.current) return; busy.current = true; setPending(true); try { await fn(); } finally { busy.current = false; setPending(false); } }, []);
  return { pending, run };
}

export function StockSection({ school }: { school: string }) {
  const [tab, setTab] = useState<Tab>("saldo");
  const [on, setOn] = useState(today());
  const [lines, setLines] = useState<Line[] | null>(null); const [alerts, setAlerts] = useState<Alert[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null); const [counts, setCounts] = useState<Count[]>([]);
  const [basis, setBasis] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(`${today().slice(0, 7)}-01`);
  const load = useCallback(async () => {
    if (!school) return;
    try {
      setLines(await call<Line[]>("meal_stock_balance_at", { _school: school, _on: on, _known_at: null }));
      setLedger(await call<LedgerRow[]>("meal_stock_ledger_at", { _school: school, _from: from, _to: on, _known_at: null }));
      setAlerts(await call<Alert[]>("meal_stock_alerts_at", { _school: school, _on: on, _expiry_window_days: null }).catch(() => []));
      setCounts(await call<Count[]>("meal_stock_counts_at", { _school: school }).catch(() => []));
      const b = await call<{ state: string }[]>("meal_stock_basis_at", { _school: school, _competence: on.slice(0, 7) }).catch(() => []);
      setBasis(b[0]?.state ?? null); setErr(null);
    } catch (e) { setErr(stockMessage((e as Error).message)); }
  }, [school, on, from]);
  useEffect(() => { void load(); }, [load]);
  if (!school) return null;
  return (
    <section aria-labelledby="stk" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="stk" className="font-semibold">Estoque</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Histórico desde<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Saldo em<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      </div>
      <StatePanel tone="info" title="Saldo derivado dos movimentos" description={`Nunca é digitado. Entrada só nasce do aceite do recebimento. ${MINIMUM_STOCK_STATE}: sem estoque mínimo, ideal ou cobertura em dias.`} />
      {basis === "STOCK_BASIS_POLICY_PENDING" && <StatePanel tone="warning" title="Saldo para pedido não definido" description={`${STOCK_BASIS_BLOCK}. O sistema não escolhe qual saldo vale para o pedido.`} />}
      <div role="tablist" aria-label="Estoque" className="flex flex-wrap gap-2">{TABS.map(([id, l]) => (
        <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-full border px-3 py-1.5 ${tab === id ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} /> : !lines || !ledger ? <SkeletonState label="Carregando" /> : (
        <div role="tabpanel">
          {tab === "saldo" && <BalanceView lines={lines} alerts={alerts} />}
          {tab === "ficha" && <LedgerView ledger={ledger} />}
          {tab === "registrar" && <MovementForm school={school} lines={lines} onDone={load} />}
          {tab === "contagem" && <CountView school={school} lines={lines} counts={counts} onDone={load} />}
          {tab === "transferencia" && <TransferForm school={school} lines={lines} />}
        </div>)}
    </section>
  );
}

function BalanceView({ lines, alerts }: { lines: Line[]; alerts: Alert[] }) {
  if (lines.length === 0) return <p className="text-muted-foreground">Nenhum movimento registrado até esta data. Isso não afirma estoque zero.</p>;
  const ordered = [...suggestLotsByExpiry(lines), ...lines.filter((l) => !((l.balance ?? 0) > 0))];
  return (<div className="space-y-2">
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ordered.map((l, i) => (
      <li key={i} className="rounded border p-2"><strong>{l.item_value_id}</strong> · {l.unit_value_id}
        <div>Saldo: {l.balance == null ? "não disponível (sinal desconhecido)" : l.balance}</div>
        <div className="text-muted-foreground">Lote: {lotText(l.lot)} · Validade: {expiryText(l.expires_on)} · {l.movements} movimento(s)</div></li>))}</ul>
    <p className="text-muted-foreground">Lotes com saldo aparecem pelo vencimento (PVPS) como sugestão; nenhuma baixa é automática.</p>
    {alerts.length > 0 && <ul aria-label="Alertas factuais" className="divide-y rounded border">{alerts.map((a, i) => <li key={i} className="p-2">{ALERT_LABEL[a.kind] ?? a.kind}: {a.item_value_id} {a.lot ? `lote ${a.lot}` : ""} · {a.detail}</li>)}</ul>}
  </div>);
}

function LedgerView({ ledger }: { ledger: LedgerRow[] }) {
  const [f, setF] = useState<LedgerFilter>({ situation: "vigente" });
  const items = useMemo(() => [...new Set(ledger.map((r) => `${r.item_value_id}|${r.unit_value_id}`))], [ledger]);
  const lots = useMemo(() => [...new Set(ledger.map((r) => r.lot).filter(Boolean))] as string[], [ledger]);
  const [card, setCard] = useState("");
  const rows = filterLedger(ledger, f);
  const [ci, cu] = card.split("|");
  return (<div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-4">
      <label>Item<select className={field} value={f.item ?? ""} onChange={(e) => setF({ ...f, item: e.target.value || undefined })}><option value="">Todos</option>{[...new Set(ledger.map((r) => r.item_value_id))].map((i) => <option key={i}>{i}</option>)}</select></label>
      <label>Classe<select className={field} value={f.klass ?? ""} onChange={(e) => setF({ ...f, klass: e.target.value || undefined })}><option value="">Todas</option>{Object.entries(MOVEMENT_CLASS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Lote<select className={field} value={f.lot ?? ""} onChange={(e) => setF({ ...f, lot: e.target.value || undefined })}><option value="">Todos</option><option value="__sem__">Não informado</option>{lots.map((l) => <option key={l}>{l}</option>)}</select></label>
      <label>Situação<select className={field} value={f.situation} onChange={(e) => setF({ ...f, situation: e.target.value as LedgerFilter["situation"] })}><option value="vigente">Vigentes</option><option value="substituido">Substituídos</option><option value="todos">Todos</option></select></label>
    </div>
    {rows.length === 0 ? <p className="text-muted-foreground">Nenhum movimento com estes filtros.</p> : (
      <ul className="divide-y rounded border">{rows.map((r) => (
        <li key={r.id} className="p-2"><strong>{new Date(`${r.moved_on}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong> · {knownLabel(MOVEMENT_CLASS_LABEL, r.movement_class)} · {r.item_value_id}: {r.sign == null ? "?" : r.sign > 0 ? "+" : r.sign < 0 ? "−" : "±"}{r.quantity} {r.unit_value_id}
          <div className="text-muted-foreground">Lote {lotText(r.lot)} · validade {expiryText(r.expires_on)} · {r.event_kind}{r.superseded ? " (substituído)" : ""}{r.source_receipt_version_id ? " · origem: aceite" : ""}{r.stock_count_ref ? " · origem: contagem" : ""}{r.reason ? ` · motivo: ${r.reason}` : ""}</div></li>))}</ul>)}
    <label className="block max-w-sm">Ficha do item<select className={field} value={card} onChange={(e) => setCard(e.target.value)}><option value="">Escolha…</option>{items.map((i) => <option key={i} value={i}>{i.replace("|", " · ")}</option>)}</select></label>
    {card && <ol aria-label="Ficha do item" className="divide-y rounded border">{itemCard(ledger, ci!, cu!).map(({ row, running }) => (
      <li key={row.id} className="flex justify-between p-2"><span>{new Date(`${row.moved_on}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {knownLabel(MOVEMENT_CLASS_LABEL, row.movement_class)} {row.quantity}</span><span>Saldo: {running ?? "não disponível"}</span></li>))}</ol>}
  </div>);
}

function MovementForm({ school, lines, onDone }: { school: string; lines: Line[]; onDone: () => void }) {
  const items = [...new Set(lines.map((l) => `${l.item_value_id}|${l.unit_value_id}`))];
  const [it, setIt] = useState(""); const [klass, setKlass] = useState<string>(MANUAL_CLASSES[0]); const [qty, setQty] = useState("");
  const [on, setOn] = useState(today()); const [lot, setLot] = useState(""); const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const { pending, run } = useOnce();
  const save = () => run(async () => {
    const [item, unit] = it.split("|");
    try {
      await call("record_meal_stock_movement", { _base_id: null, _kind: "registro", _school: school, _class: klass, _item: item, _unit: unit, _quantity: Number(qty.replace(",", ".")),
        _direction: null, _on: on, _tz: TZ, _lot: lot || null, _expires: null, _contract: null, _schedule: null, _source_doc: null, _count: null, _literal: null, _note: null, _reason: reason || null });
      setMsg("Movimento registrado."); setQty(""); setReason(""); onDone();
    } catch (e) { setMsg(opsMessage((e as Error).message)); }
  });
  if (items.length === 0) return <p className="text-muted-foreground">Sem item com movimento: a primeira entrada nasce do aceite do recebimento.</p>;
  return (<fieldset className="grid gap-2 sm:grid-cols-2"><legend className="font-medium">Consumo observado, perda ou devolução</legend>
    <label>Item<select className={field} value={it} onChange={(e) => setIt(e.target.value)}><option value="">Escolha…</option>{items.map((i) => <option key={i} value={i}>{i.replace("|", " · ")}</option>)}</select></label>
    <label>Classe<select className={field} value={klass} onChange={(e) => setKlass(e.target.value)}>{MANUAL_CLASSES.map((c) => <option key={c} value={c}>{MOVEMENT_CLASS_LABEL[c]}</option>)}</select></label>
    <label>Quantidade<input inputMode="decimal" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
    <label>Data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
    <label>Lote (se houver)<input className={field} value={lot} onChange={(e) => setLot(e.target.value)} /></label>
    <label>Motivo<input className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    <button type="button" disabled={!it || !qty || pending} onClick={save} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50 sm:col-span-2">{pending ? "Enviando…" : "Registrar"}</button>
    {msg && <p role="status" className="sm:col-span-2">{msg}</p>}
  </fieldset>);
}

const COUNT_STATUS: Record<string, string> = { rascunho: "Rascunho", conferida: "Conferida", aprovada: "Aprovada", anulada: "Anulada" };
function CountView({ school, lines, counts, onDone }: { school: string; lines: Line[]; counts: Count[]; onDone: () => void }) {
  const [phys, setPhys] = useState<Record<number, string>>({}); const [just, setJust] = useState<Record<number, string>>({});
  const [on, setOn] = useState(today()); const [msg, setMsg] = useState<string | null>(null); const { pending, run } = useOnce();
  const submit = (status: "rascunho" | "conferida") => run(async () => {
    const payload = lines.map((l, i) => ({ l, i })).filter(({ i }) => phys[i] !== undefined && phys[i] !== "")
      .map(({ l, i }) => ({ item_value_id: l.item_value_id, unit_value_id: l.unit_value_id, lote: l.lot, fisica: Number(phys[i]!.replace(",", ".")), justificativa: just[i] || null }));
    try { await call("record_meal_stock_count", { _logical: null, _expected_version: null, _status: status, _school: school, _counted_on: on, _lines: payload, _reason: null }); setMsg("Contagem registrada."); setPhys({}); setJust({}); onDone(); }
    catch (e) { setMsg(opsMessage((e as Error).message)); }
  });
  const act = (c: Count, status: "conferida" | "aprovada" | "anulada", reason: string | null) => run(async () => {
    try { await call("record_meal_stock_count", { _logical: c.logical_id, _expected_version: c.version, _status: status, _school: null, _counted_on: null, _lines: status === "conferida" ? c.lines : null, _reason: reason }); setMsg("Contagem atualizada."); onDone(); }
    catch (e) { setMsg(opsMessage((e as Error).message)); }
  });
  const adjust = (c: Count, l: CountLine) => run(async () => {
    const a = adjustmentFor(l); if (!a) return;
    try { await call("record_meal_stock_movement", { _base_id: null, _kind: "registro", _school: school, _class: "ajuste-inventario", _item: l.item_value_id, _unit: l.unit_value_id, _quantity: a.quantity,
      _direction: a.direction, _on: c.counted_on, _tz: TZ, _lot: l.lote, _expires: null, _contract: null, _schedule: null, _source_doc: null, _count: c.logical_id, _literal: null, _note: null, _reason: l.justificativa ?? "ajuste pela contagem" });
      setMsg("Ajuste lançado no estoque, vinculado à contagem."); onDone(); }
    catch (e) { setMsg(opsMessage((e as Error).message)); }
  });
  return (<div className="space-y-3">
    {lines.length === 0 ? <p className="text-muted-foreground">Sem linhas de estoque para contar.</p> : (
      <fieldset className="space-y-2"><legend className="font-medium">Nova contagem física</legend>
        <label className="block max-w-xs">Data da contagem<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
        <ul className="grid gap-2 sm:grid-cols-2">{lines.map((l, i) => (
          <li key={i} className="rounded border p-2"><strong>{l.item_value_id}</strong> · {l.unit_value_id} · lote {lotText(l.lot)}
            <div className="text-muted-foreground">Calculado hoje: {l.balance ?? "não disponível"}</div>
            <label>Físico<input inputMode="decimal" className={field} value={phys[i] ?? ""} onChange={(e) => setPhys({ ...phys, [i]: e.target.value })} /></label>
            <label>Justificativa da diferença<input className={field} value={just[i] ?? ""} onChange={(e) => setJust({ ...just, [i]: e.target.value })} /></label></li>))}</ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => submit("rascunho")} className="rounded border px-3 py-2 disabled:opacity-50">Salvar rascunho</button>
          <button type="button" disabled={pending} onClick={() => submit("conferida")} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">Registrar conferida</button>
        </div></fieldset>)}
    <h3 className="font-medium">Contagens</h3>
    {counts.length === 0 ? <p className="text-muted-foreground">Nenhuma contagem registrada.</p> : (
      <ul className="space-y-2">{counts.map((c) => (
        <li key={c.logical_id} className="rounded border p-2">
          <div><strong>{new Date(`${c.counted_on}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong> · {knownLabel(COUNT_STATUS, c.status)} · versão {c.version}</div>
          <ul className="mt-1 divide-y">{c.lines.map((l, i) => { const d = divergence(l); return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-1"><span>{l.item_value_id} · lote {lotText(l.lote)}: físico {l.fisica} × calculado {l.calculada ?? "não disponível"} — {d === "UNKNOWN" ? "diferença desconhecida" : d === "IGUAL" ? "sem diferença" : `diferença ${l.diferenca}`}</span>
              {d === "DIVERGENTE" && (c.status === "conferida" || c.status === "aprovada") && <button type="button" disabled={pending} onClick={() => adjust(c, l)} className="rounded border px-2 py-1 disabled:opacity-50">Lançar ajuste</button>}</li>); })}</ul>
          {(c.status === "rascunho" || c.status === "conferida") && <div className="mt-2 flex flex-wrap gap-2">
            {c.status === "rascunho" && <button type="button" disabled={pending} onClick={() => act(c, "conferida", null)} className="rounded border px-2 py-1">Conferir</button>}
            <button type="button" disabled={pending} onClick={() => act(c, "aprovada", null)} className="rounded border px-2 py-1">Aprovar (outra pessoa)</button>
            <button type="button" disabled={pending} onClick={async () => { const r = await askText("Motivo da anulação"); if (r) void act(c, "anulada", r); }} className="rounded border px-2 py-1">Anular</button></div>}
        </li>))}</ul>)}
    {msg && <p role="status">{msg}</p>}
  </div>);
}

function TransferForm({ school, lines }: { school: string; lines: Line[] }) {
  const items = [...new Set(lines.map((l) => `${l.item_value_id}|${l.unit_value_id}`))];
  const [it, setIt] = useState(""); const [to, setTo] = useState(""); const [qty, setQty] = useState(""); const [msg, setMsg] = useState<string | null>(null); const { pending, run } = useOnce();
  const save = () => run(async () => {
    const [item, unit] = it.split("|");
    try { await call("record_meal_stock_transfer", { _from_school: school, _to_school: to, _item: item, _unit: unit, _quantity: Number(qty.replace(",", ".")), _on: today(), _tz: TZ, _lot: null, _expires: null, _note: null, _reason: null }); setMsg("Transferência registrada."); }
    catch (e) { setMsg(opsMessage((e as Error).message)); }
  });
  return (<fieldset className="grid gap-2 sm:grid-cols-3"><legend className="font-medium">Transferência entre escolas</legend>
    <p className="sm:col-span-3 text-muted-foreground">Só é aceita com política homologada de transferência e permissão de rede. Sem ela, o banco recusa com o código do bloqueio.</p>
    <label>Item<select className={field} value={it} onChange={(e) => setIt(e.target.value)}><option value="">Escolha…</option>{items.map((i) => <option key={i} value={i}>{i.replace("|", " · ")}</option>)}</select></label>
    <label>Escola de destino (código)<input className={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
    <label>Quantidade<input inputMode="decimal" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
    <button type="button" disabled={!it || !to || !qty || pending} onClick={save} className="rounded border px-3 py-2 disabled:opacity-50 sm:col-span-3">Solicitar transferência</button>
    {msg && <p role="status" className="sm:col-span-3">{msg}</p>}
  </fieldset>);
}
