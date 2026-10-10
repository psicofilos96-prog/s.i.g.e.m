import { callRpc } from "@/lib/rpc-call";
import { knownLabel } from "@/config/ui-vocabulary";
import { shiftMonthKey, operationalMonthKey } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { mealMessage } from "./meals-model";
import { checkRequest, explainCeiling, type CeilingInput } from "./ceiling-explain";

/** Parâmetros do teto: nenhum per capita/público/dias/estoque homologado é lido ainda ⇒ todos null (pendência explícita, nunca zero). */
const NO_PARAMS: CeilingInput = { perCapitaGrams: null, perCapitaHomologated: false, servedPublic: null, schoolDays: null, eligibleStockGrams: null, pendingDeliveriesGrams: null };
function LineCheck({ l }: { l: OrderLine }) {
  const r = checkRequest(l.quantidade, explainCeiling(NO_PARAMS), false, l.zero_motivo ?? null);
  return <ul className="text-xs text-muted-foreground">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>;
}
import {
  CONSOLIDADO_ALIMENTACAO, ORDER_STATUS_LABEL, PEDIDOS_ALIMENTACAO, orderAllows, classifyZero, orderReportRow, schoolCanEdit,
  type HistoryRow, type OrderLine, type OrderStatus,
} from "./order-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = callRpc;
const field = "mt-1 block w-full rounded border bg-background p-2";
interface Order { logical_id: string; version: number; status: OrderStatus; school_id: string; competence: string; lines: OrderLine[]; reason: string | null; window_closes_at: string; window_time_zone: string }
interface Named { logical_id: string; payload: Record<string, unknown> }
interface Cons { item_ref: string; unidade_ref: string; apresentacao_ref: string | null; contrato_ref: string | null; total: number; by_school: Record<string, number> }

function download(name: string, text: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = name; a.click();
}

export function OrdersSection({ school, network, names }: { school: string; network: boolean; names: Map<string, string> }) {
  // NDATE.2: próxima competência com virada de ano (dezembro → janeiro do ano seguinte).
  const [competence, setCompetence] = useState(() => shiftMonthKey(operationalMonthKey(), 1));
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [items, setItems] = useState<Named[]>([]); const [units, setUnits] = useState<Named[]>([]);
  const [cons, setCons] = useState<Cons[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const label = (list: Named[], id: string) => String(list.find((x) => x.logical_id === id)?.payload["nome"] ?? "item não identificado");
  const load = useCallback(async () => {
    try {
      const [o, it, un] = await Promise.all([
        call<Order[]>("meal_orders_at", { _competence: competence, _school: network ? null : school || null, _known_at: null }),
        call<Named[]>("meal_master_at", { _kind: "item-alimentar", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
        call<Named[]>("meal_master_at", { _kind: "unidade-de-medida", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
      ]);
      setOrders(o); setItems(it); setUnits(un); setErr(null);
      if (network) setCons(await call<Cons[]>("meal_demand_consolidation_at", { _competence: competence }).catch(() => null));
    } catch (e) { setErr(mealMessage((e as Error).message)); }
  }, [competence, school, network]);
  useEffect(() => { void load(); }, [load]);
  const act = async (a: Record<string, unknown>) => {
    setMsg(null);
    try { const { __rpc, ...args } = a; await call(typeof __rpc === "string" ? __rpc : "record_meal_order", args); await load(); setMsg("Registrado."); } catch (e) { setMsg(mealMessage((e as Error).message)); }
  };
  async function exportOrders() {
    const rows = [];
    for (const o of orders ?? []) rows.push(orderReportRow(names.get(o.school_id) ?? o.school_id, await call<HistoryRow[]>("meal_order_history", { _logical: o.logical_id })));
    download(`pedidos-${competence}.csv`, toCsv(runReport(PEDIDOS_ALIMENTACAO, { params: { competence } }, rows), { headerLines: ["SIGEM"], title: PEDIDOS_ALIMENTACAO.title }, [`Competência: ${competence}`]));
  }
  function exportCons() {
    const rows = (cons ?? []).map((c) => ({ item: label(items, c.item_ref), unit: label(units, c.unidade_ref), presentation: c.apresentacao_ref, contract: c.contrato_ref,
      total: c.total, schools: Object.entries(c.by_school).map(([s, q]) => `${names.get(s) ?? s}: ${q}`).join("; ") }));
    download(`consolidado-${competence}.csv`, toCsv(runReport(CONSOLIDADO_ALIMENTACAO, { params: { competence } }, rows), { headerLines: ["SIGEM"], title: CONSOLIDADO_ALIMENTACAO.title }, [`Competência: ${competence}`, "Não é ordem de compra."]));
  }
  const mine = orders?.find((o) => !network && o.school_id === school && o.status !== "cancelado" && o.status !== "rejeitado");
  return (
    <section aria-labelledby="ord" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="ord" className="font-semibold">Pedido mensal</h2>
      <label className="block max-w-xs">Competência<input className={field} value={competence} onChange={(e) => setCompetence(e.target.value)} placeholder="AAAA-MM" /></label>
      {(() => { const c = explainCeiling(NO_PARAMS); return c.state === "pendente" ? <StatePanel tone="warning" title="Teto do pedido não calculável" description={`Falta: ${c.missing.join("; ")}. O envio é permitido; a autorização definitiva aguarda revisão.`} /> : null; })()}
      {msg && <p role="status">{msg}</p>}
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} />
        : !orders ? <SkeletonState label="Carregando" />
        : network ? <NetworkQueue orders={orders} names={names} act={act} itemLabel={(id) => label(items, id)} />
        : <SchoolOrder school={school} competence={competence} order={mine ?? null} items={items} units={units} act={act} />}
      {orders && orders.length > 0 && <Button variant="outline" onClick={() => void exportOrders()}>Exportar pedidos (CSV)</Button>}
      {network && cons && (
        <div className="space-y-1">
          <h3 className="font-medium">Consolidação (somente autorizados)</h3>
          {cons.length === 0 ? <p className="text-muted-foreground">Nenhuma quantidade autorizada nesta competência.</p> : (
            <ul className="divide-y">{cons.map((c, i) => <li key={i} className="py-1">{label(items, c.item_ref)} — {c.total} {label(units, c.unidade_ref)} · {Object.keys(c.by_school).length} destino(s)</li>)}</ul>
          )}
          {cons.length > 0 && <Button variant="outline" onClick={exportCons}>Exportar consolidado (CSV)</Button>}
        </div>
      )}
    </section>
  );
}

function SchoolOrder({ school, competence, order, items, units, act }: { school: string; competence: string; order: Order | null; items: Named[]; units: Named[]; act: (a: Record<string, unknown>) => Promise<void> }) {
  const [lines, setLines] = useState<OrderLine[]>(order?.lines ?? []);
  useEffect(() => setLines(order?.lines ?? []), [order]);
  const editable = !order || schoolCanEdit(order.status);
  if (items.length === 0 || units.length === 0) return <StatePanel tone="warning" title="Catálogo não homologado" description="Sem itens e unidades homologados pelo Núcleo não é possível montar pedido." />;
  const base = { _logical: order?.logical_id ?? null, _expected_version: order?.version ?? null, _school: school, _competence: competence };
  return (
    <div className="space-y-2">
      <p>Situação: {order ? knownLabel(ORDER_STATUS_LABEL, order.status) : "sem pedido"}{order ? ` · janela fecha em ${new Date(order.window_closes_at).toLocaleString("pt-BR", { timeZone: order.window_time_zone })} (${order.window_time_zone})` : ""}</p>
      {order?.reason && <p className="text-muted-foreground">Motivo registrado: {order.reason}</p>}
      {lines.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-4">
          <label>Item<select className={field} disabled={!editable} value={l.item_ref} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item_ref: e.target.value } : x)))}>{items.map((it) => <option key={it.logical_id} value={it.logical_id}>{String(it.payload["nome"])}</option>)}</select></label>
          <label>Unidade<select className={field} disabled={!editable} value={l.unidade_ref} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unidade_ref: e.target.value } : x)))}>{units.map((u) => <option key={u.logical_id} value={u.logical_id}>{String(u.payload["nome"])}</option>)}</select></label>
          <label>Quantidade<input type="number" min={0} className={field} disabled={!editable} value={l.quantidade} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantidade: Number(e.target.value) } : x)))} /></label>
          <label>Se zero, por quê<select className={field} disabled={!editable || l.quantidade > 0} value={l.zero_motivo ?? ""} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, zero_motivo: (e.target.value || undefined) as OrderLine["zero_motivo"] } : x)))}>
            <option value="">—</option><option value="saldo-suficiente">Saldo suficiente</option><option value="nao-aplicavel">Não aplicável</option><option value="outro">Outro</option></select>
            {classifyZero(l) === "zero-sem-justificativa" && <span className="text-muted-foreground">Zero sem justificativa (permitido).</span>}</label>
          <div className="sm:col-span-4"><LineCheck l={l} /></div>
        </div>
      ))}
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLines([...lines, { item_ref: items[0]!.logical_id, unidade_ref: units[0]!.logical_id, quantidade: 0 }])}>Adicionar item</Button>
          <Button variant="outline" onClick={() => void act({ ...base, _action: "rascunho", _lines: lines, _reason: null })}>Salvar rascunho</Button>
          {order && <Button onClick={() => void act({ ...base, _action: "submissao", _lines: lines, _reason: null })}>Submeter pedido</Button>}
        </div>
      )}
    </div>
  );
}

function NetworkQueue({ orders, names, act, itemLabel }: { orders: Order[]; names: Map<string, string>; act: (a: Record<string, unknown>) => Promise<void>; itemLabel: (id: string) => string }) {
  if (orders.length === 0) return <p className="text-muted-foreground">Nenhum pedido nesta competência.</p>;
  const go = async (o: Order, action: string, needReason: boolean) => {
    const reason = needReason ? await askText("Motivo:") : null; if (needReason && !reason?.trim()) return;
    const base = { _logical: o.logical_id, _expected_version: o.version, _action: action, _school: null, _competence: null, _lines: null, _reason: reason };
    if (action !== "autorizacao") return void act(base);
    const ack = await askText("Teto não calculável (per capita, público, dias letivos ou estoque sem homologação). Registre sua ciência e a base da conferência:");
    if (!ack?.trim()) return;
    void act({ ...base, _ceiling_ack: ack, __rpc: "record_meal_order_with_ceiling" });
  };
  return (
    <ul className="divide-y">
      {orders.map((o) => (
        <li key={o.logical_id} className="space-y-1 py-2">
          <p className="font-medium">{names.get(o.school_id) ?? o.school_id} — {knownLabel(ORDER_STATUS_LABEL, o.status)} · v{o.version}</p>
          <p className="text-muted-foreground">{o.lines.map((l) => `${itemLabel(l.item_ref)}: ${l.quantidade}`).join(" · ") || "sem itens"}</p>
          {orderAllows(o.status, "autorizacao") && <p className="text-xs text-muted-foreground">Teto não calculado: confira per capita, público, dias letivos e estoque antes de autorizar.</p>}
          <div className="flex flex-wrap gap-2">
            {orderAllows(o.status, "analise") && <Button size="sm" variant="outline" onClick={() => go(o, "analise", false)}>Iniciar análise</Button>}
            {orderAllows(o.status, "autorizacao") && <>
              <Button size="sm" variant="outline" onClick={() => go(o, "devolucao", true)}>Devolver</Button>
              <Button size="sm" onClick={() => go(o, "autorizacao", false)}>Autorizar como solicitado</Button>
              <Button size="sm" variant="destructive" onClick={() => go(o, "rejeicao", true)}>Rejeitar</Button>
            </>}
          </div>
        </li>
      ))}
    </ul>
  );
}
