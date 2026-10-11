import { useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { operationalToday } from "@/lib/academic-date";
import { mealMessage } from "./meals-model";
import { receivingMessage } from "./receiving-model";
import type { OrderLine } from "./order-model";

const field = "mt-1 block w-full rounded border bg-background p-2";
const TZ = "America/Sao_Paulo";

/** Abertura explícita da janela de pedidos (record_meal_order_window): o banco decide capability e validade. */
export function OrderWindowForm({ competence, onDone }: { competence: string; onDone: (m: string) => Promise<void> }) {
  const [closes, setCloses] = useState(""); const [reason, setReason] = useState(""); const [err, setErr] = useState<string | null>(null);
  const open = async () => {
    setErr(null);
    if (!closes) { setErr("Informe a data de fechamento."); return; }
    try {
      await callRpc("record_meal_order_window", { _logical: null, _expected_version: null, _action: "abertura", _competence: competence, _school_ids: null,
        _opens: new Date(Date.now() - 60_000).toISOString(), _closes: new Date(`${closes}T23:59:00-03:00`).toISOString(), _tz: TZ,
        _basis: "abertura-explicita", _rule: null, _reason: reason.trim() || null });
      setReason(""); await onDone(`Janela de ${competence} aberta para todas as escolas até ${closes.split("-").reverse().join("/")}.`);
    } catch (e) { setErr(mealMessage((e as Error).message)); }
  };
  return (
    <form aria-label="Abrir janela de pedidos" className="grid gap-2 rounded border p-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void open(); }}>
      <p className="sm:col-span-3 font-medium">Abrir janela de pedidos ({competence})</p>
      <label>Fecha em<DateInput className={field} value={closes} min={operationalToday()} onChange={(e) => setCloses(e.target.value)} /></label>
      <label className="sm:col-span-2">Motivo da abertura<input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex.: calendário de compras da competência" /></label>
      {err && <p role="alert" className="sm:col-span-3 text-destructive">{err}</p>}
      <div className="sm:col-span-3"><Button type="submit" variant="outline">Abrir janela</Button></div>
    </form>
  );
}

interface Named { logical_id: string; payload: Record<string, unknown> }
/** Programação de entrega sobre pedido autorizado (soma ≤ autorizado é conferida pelo banco). */
export function ScheduleForm({ order, lines, contracts, itemLabel, onDone }: { order: string; lines: OrderLine[]; contracts: Named[]; itemLabel: (id: string) => string; onDone: (m: string) => Promise<void> }) {
  const [line, setLine] = useState(0); const [qty, setQty] = useState<number | "">(""); const [on, setOn] = useState(operationalToday());
  const [err, setErr] = useState<string | null>(null);
  const l = lines[line];
  if (!l) return null;
  const send = async () => {
    setErr(null);
    if (qty === "" || qty <= 0) { setErr("Informe a quantidade a entregar."); return; }
    try {
      await callRpc("record_meal_delivery_schedule", { _logical: null, _expected_version: null, _action: "programacao", _order: order, _item: l.item_ref, _unit: l.unidade_ref,
        _presentation: l.apresentacao_ref ?? null, _contract: l.contrato_ref ?? null, _frequency: null, _quantity: qty, _expected_on: on, _reason: null });
      setQty(""); await onDone(`Entrega programada: ${qty} de ${itemLabel(l.item_ref)} para ${on.split("-").reverse().join("/")}.`);
    } catch (e) { setErr(receivingMessage((e as Error).message)); }
  };
  return (
    <form aria-label="Programar entrega" className="grid gap-2 rounded border p-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label>Item autorizado<select className={field} value={line} onChange={(e) => setLine(Number(e.target.value))}>{lines.map((x, i) => <option key={i} value={i}>{itemLabel(x.item_ref)} (autorizado {x.quantidade})</option>)}</select></label>
      <label>Quantidade desta entrega<input type="number" min={0} className={field} value={qty} onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))} /></label>
      <label>Data prevista<DateInput className={field} value={on} onChange={(e) => setOn(e.target.value)} /></label>
      <p className="self-end text-muted-foreground">Contrato da linha: {l.contrato_ref ? String(contracts.find((c) => c.logical_id === l.contrato_ref)?.payload["numero"] ?? "registrado") : "não informado"}</p>
      {err && <p role="alert" className="sm:col-span-4 text-destructive">{err}</p>}
      <div className="sm:col-span-4"><Button type="submit" size="sm">Programar entrega</Button></div>
    </form>
  );
}
