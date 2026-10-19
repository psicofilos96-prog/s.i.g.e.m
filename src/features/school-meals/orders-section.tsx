import { humanizeForScreen } from "@/config/technical-codes";
import { allowedItems } from "./master-form-model";
import { callRpc } from "@/lib/rpc-call";
import { knownLabel } from "@/config/ui-vocabulary";
import { shiftMonthKey, operationalMonthKey } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { runReport, toCsv, toPrintableHtml, toXlsx, fingerprint } from "@/features/reports/report-engine";
import { MAPA_COMPRAS, MAPA_DISTRIBUICAO, MAPA_ENTREGAS, SALDO_CONTRATOS, contractBalanceRows, deliveryWaveRows, type ScheduledDelivery, distributionMapRows, distributionTotals, purchaseMapRows } from "./purchase-map";
import { mealMessage } from "./meals-model";
import { authorizationNeeds, explainServerLine, type ServerCeilingLine } from "./ceiling-explain";
import { operationalToday } from "@/lib/academic-date";
import { OrderWindowForm, ScheduleForm } from "./network-operations";
import { institution } from "@/config/institution";
import { CYCLE_TYPE, type CyclePayload } from "./menu-cycle";
import { menuIngredientsMissing, menuIngredientsOfMonth } from "./planned-consumption";

/** LOTE 9 — teto calculado pelo banco (mesma função que congela a avaliação no ato). */
async function evaluate(school: string, lines: OrderLine[]) {
  return callRpc<ServerCeilingLine[]>("meal_order_ceiling_evaluation", { _school: school, _lines: lines, _on: operationalToday() });
}
function CeilingPanel({ school, lines }: { school: string; lines: OrderLine[] }) {
  const [ev, setEv] = useState<ServerCeilingLine[] | null>(null); const [e, setE] = useState<string | null>(null);
  const key = JSON.stringify(lines);
  useEffect(() => { let on = true; setEv(null); setE(null); if (!school || lines.length === 0) return; evaluate(school, lines).then((r) => on && setEv(r)).catch((x) => on && setE(String((x as Error).message))); return () => { on = false; }; }, [school, key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (lines.length === 0) return null;
  if (e) return <p className="text-xs text-destructive">Teto não avaliado: {e}</p>;
  if (!ev) return <p className="text-xs text-muted-foreground">Calculando teto…</p>;
  return <ul className="text-xs" aria-label="Teto por item">{ev.map((l) => <li key={l.linha} className={l.excede ? "text-destructive" : "text-muted-foreground"}>Item {l.linha}: {explainServerLine(l)}{l.per_capita_registro ? ` (per capita homologado v${l.per_capita_versao})` : ""}</li>)}</ul>;
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
  const [items, setItems] = useState<Named[]>([]); const [rules, setRules] = useState<Named[]>([]); const [units, setUnits] = useState<Named[]>([]); const [pubs, setPubs] = useState<Named[]>([]);
  const [contracts, setContracts] = useState<Named[]>([]); const [suppliers, setSuppliers] = useState<Named[]>([]);
  const [cons, setCons] = useState<Cons[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const label = (list: Named[], id: string) => String(list.find((x) => x.logical_id === id)?.payload["nome"] ?? "item não identificado");
  const load = useCallback(async () => {
    try {
      const [o, it, un, pb, rl] = await Promise.all([
        call<Order[]>("meal_orders_at", { _competence: competence, _school: network ? null : school || null, _known_at: null }),
        call<Named[]>("meal_master_at", { _kind: "item-alimentar", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
        call<Named[]>("meal_master_at", { _kind: "unidade-de-medida", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
        call<Named[]>("meal_master_at", { _kind: "publico-de-atendimento", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
        call<Named[]>("meal_master_at", { _kind: "regra-de-elegibilidade-item", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
      ]);
      setRules(rl); setOrders(o); setItems(it); setUnits(un); setPubs(pb); setErr(null);
      if (network) {
        setCons(await call<Cons[]>("meal_demand_consolidation_at", { _competence: competence }).catch(() => null));
        const [ct, sp] = await Promise.all([
          call<Named[]>("meal_master_at", { _kind: "referencia-contratual", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
          call<Named[]>("meal_master_at", { _kind: "fornecedor", _on: null, _known_at: null, _include_drafts: false }).catch(() => []),
        ]);
        setContracts(ct); setSuppliers(sp);
      }
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
  async function exportPurchaseMap(fmt: "pdf" | "xlsx", kind: "compras" | "distribuicao" | "entregas" | "saldo" = "compras") {
    const prices = await call<Named[]>("meal_master_at", { _kind: "preco-contratado", _on: null, _known_at: null, _include_drafts: false }).catch(() => [] as Named[]);
    const ctx = { items, units, contracts, suppliers, schools: names, prices };
    const base = (cons ?? []).map((c) => ({ ...c, total: Number(c.total) }));
    const def = kind === "compras" ? MAPA_COMPRAS : kind === "entregas" ? MAPA_ENTREGAS : kind === "saldo" ? SALDO_CONTRATOS : MAPA_DISTRIBUICAO;
    let rows;
    if (kind === "entregas") {
      const [y, m] = competence.split("-").map(Number);
      if (!y || !m) { setMsg("Informe a competência no formato AAAA-MM."); return; }
      const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      try { rows = deliveryWaveRows(await call<ScheduledDelivery[]>("meal_deliveries_at", { _school: null, _from: `${competence}-01`, _to: last, _as_of: last, _known_at: null }), ctx); }
      catch (e) { setMsg(`Não foi possível ler as entregas programadas: ${(e as Error).message}`); return; }
      if (rows.length === 0) { setMsg("Nenhuma entrega programada nesta competência."); return; }
    } else if (kind === "saldo") {
      const y = competence.slice(0, 4);
      try { rows = contractBalanceRows(prices, await call<ScheduledDelivery[]>("meal_deliveries_at", { _school: null, _from: `${y}-01-01`, _to: `${y}-12-31`, _as_of: `${y}-12-31`, _known_at: null }), ctx); }
      catch (e) { setMsg(`Não foi possível ler as entregas programadas: ${(e as Error).message}`); return; }
      if (rows.length === 0) { setMsg("Nenhum preço de contrato homologado."); return; }
    } else rows = kind === "compras" ? purchaseMapRows(base, ctx) : distributionMapRows(base, ctx);
    const result = runReport(def, { params: { competence } }, rows);
    const logo = new URL(institution.emblemUrl, window.location.href).href;
    const branding = { headerLines: [institution.governmentName, institution.departmentName, "Núcleo de Alimentação Escolar — SIGEM"], title: def.title, logoUrl: logo };
    const meta = [`Competência: ${competence}`, "Somente pedidos autorizados vigentes.", "Não é ordem de compra nem empenho.", ...(kind === "distribuicao" ? distributionTotals(rows).map((t) => `Total ${t.supplier}: R$ ${t.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${t.complete ? "" : " (incompleto: há item sem preço no contrato)"}`) : []), `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`];
    if (fmt === "xlsx") {
      const buf = await toXlsx(result, branding, meta);
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); a.download = `mapa-${kind}-${competence}.xlsx`; a.click();
      return;
    }
    const w = window.open("", "_blank"); if (!w) { setMsg("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(toPrintableHtml(result, branding, meta, await fingerprint(result))); w.document.close(); w.focus(); w.print();
  }
  const mine = orders?.find((o) => !network && o.school_id === school && o.status !== "cancelado" && o.status !== "rejeitado");
  return (
    <section aria-labelledby="ord" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="ord" className="font-semibold">Pedido mensal</h2>
      <label className="block max-w-xs">Competência<input className={field} value={competence} onChange={(e) => setCompetence(e.target.value)} placeholder="AAAA-MM" /></label>
      {msg && <p role="status">{msg}</p>}
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} />
        : !orders ? <SkeletonState label="Carregando" />
        : network ? <><OrderWindowForm competence={competence} onDone={async (m) => { setMsg(m); await load(); }} /><NetworkQueue orders={orders} names={names} act={act} itemLabel={(id) => label(items, id)} contracts={contracts} onDone={async (m) => { setMsg(m); await load(); }} /></>
        : <SchoolOrder school={school} competence={competence} order={mine ?? null} items={items} units={units} pubs={pubs} rules={rules} act={act} />}
      {orders && orders.length > 0 && <Button variant="outline" onClick={() => void exportOrders()}>Exportar pedidos (CSV)</Button>}
      {network && cons && (
        <div className="space-y-1">
          <h3 className="font-medium">Consolidação (somente autorizados)</h3>
          {cons.length === 0 ? <p className="text-muted-foreground">Nenhuma quantidade autorizada nesta competência.</p> : (
            <ul className="divide-y">{cons.map((c, i) => <li key={i} className="py-1">{label(items, c.item_ref)} — {c.total} {label(units, c.unidade_ref)} · {Object.keys(c.by_school).length} destino(s)</li>)}</ul>
          )}
          {cons.length > 0 && <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCons}>Exportar consolidado (CSV)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("pdf")}>Mapa de compras (PDF A4)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("xlsx")}>Mapa de compras (XLSX)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("pdf", "distribuicao")}>Mapa de distribuição por fornecedor (PDF A4)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("xlsx", "distribuicao")}>Mapa de distribuição (XLSX)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("pdf", "entregas")}>Mapa por entrega — 1ª/2ª (PDF A4)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("xlsx", "entregas")}>Mapa por entrega (XLSX)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("pdf", "saldo")}>Saldo dos contratos (PDF A4)</Button>
            <Button variant="outline" onClick={() => void exportPurchaseMap("xlsx", "saldo")}>Saldo dos contratos (XLSX)</Button>
          </div>}
        </div>
      )}
    </section>
  );
}

function SchoolOrder({ school, competence, order, items: allItems, units, pubs, rules, act }: { school: string; competence: string; order: Order | null; items: Named[]; units: Named[]; pubs: Named[]; rules: Named[]; act: (a: Record<string, unknown>) => Promise<void> }) {
  const [lines, setLines] = useState<OrderLine[]>(order?.lines ?? []);
  const [publico, setPublico] = useState<string>(order?.lines?.[0]?.publico_ref ?? "");
  const items = allowedItems(allItems, rules, publico || null);
  const choosePublico = (p: string) => { setPublico(p); setLines((ls) => ls.map((l) => ({ ...l, publico_ref: p || undefined }))); };
  useEffect(() => setLines(order?.lines ?? []), [order]);
  const editable = !order || schoolCanEdit(order.status);
  if (items.length === 0 || units.length === 0) return <StatePanel tone="warning" title="Faltam os itens do pedido" description="O Núcleo de Alimentação precisa cadastrar os itens e as unidades antes." />;
  const base = { _logical: order?.logical_id ?? null, _expected_version: order?.version ?? null, _school: school, _competence: competence };
  return (
    <div className="space-y-2">
      <p>Situação: {order ? knownLabel(ORDER_STATUS_LABEL, order.status) : "sem pedido"}{order ? ` · janela fecha em ${new Date(order.window_closes_at).toLocaleString("pt-BR", { timeZone: order.window_time_zone })} (${order.window_time_zone})` : ""}</p>
      {pubs.length > 0 && <label className="block max-w-sm">Quem a escola atende<select className={field} disabled={!editable} value={publico} onChange={(e) => choosePublico(e.target.value)}><option value="">escolha</option>{pubs.map((p) => <option key={p.logical_id} value={p.logical_id}>{String(p.payload["rotulo"] ?? "público")}</option>)}</select>
        <span className="text-xs text-muted-foreground">Os itens que esse público não recebe nem aparecem na lista.</span></label>}
      {order?.reason && <p className="text-muted-foreground">Motivo registrado: {humanizeForScreen(order.reason)}</p>}
      {lines.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-4">
          <label>Item<select className={field} disabled={!editable} value={l.item_ref} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item_ref: e.target.value } : x)))}>{items.map((it) => <option key={it.logical_id} value={it.logical_id}>{String(it.payload["nome"])}</option>)}</select></label>
          <label>Unidade<select className={field} disabled={!editable} value={l.unidade_ref} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unidade_ref: e.target.value } : x)))}>{units.map((u) => <option key={u.logical_id} value={u.logical_id}>{String(u.payload["nome"])}</option>)}</select></label>
          <label>Quantidade<input type="number" min={0} className={field} disabled={!editable} value={l.quantidade} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantidade: Number(e.target.value) } : x)))} /></label>
          <label>Se zero, por quê<select className={field} disabled={!editable || l.quantidade > 0} value={l.zero_motivo ?? ""} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, zero_motivo: (e.target.value || undefined) as OrderLine["zero_motivo"] } : x)))}>
            <option value="">—</option><option value="saldo-suficiente">Saldo suficiente</option><option value="nao-aplicavel">Não aplicável</option><option value="outro">Outro</option></select>
            {classifyZero(l) === "zero-sem-justificativa" && <span className="text-muted-foreground">Zero sem justificativa (permitido).</span>}</label>
          <label>Público atendido<input type="number" min={0} className={field} disabled={!editable} value={l.publico_atendido ?? ""} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, publico_atendido: e.target.value === "" ? undefined : Number(e.target.value) } : x)))} /></label>
          <label>Base do público<input className={field} disabled={!editable} value={l.publico_base ?? ""} placeholder="ex.: matrícula de agosto" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, publico_base: e.target.value || undefined } : x)))} /></label>
          <label>Dias letivos<input type="number" min={0} className={field} disabled={!editable} value={l.dias_letivos ?? ""} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, dias_letivos: e.target.value === "" ? undefined : Number(e.target.value) } : x)))} /></label>
          <label>Base dos dias<input className={field} disabled={!editable} value={l.dias_base ?? ""} placeholder="ex.: calendário do ano" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, dias_base: e.target.value || undefined } : x)))} /></label>
        </div>
      ))}
      <MenuCheck competence={competence} itemNames={lines.map((l) => String(items.find((it) => it.logical_id === l.item_ref)?.payload["nome"] ?? ""))} />
      <CeilingPanel school={school} lines={lines} />
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLines([...lines, { item_ref: items[0]!.logical_id, unidade_ref: units[0]!.logical_id, quantidade: 0, publico_ref: publico || undefined }])}>Adicionar item</Button>
          <Button variant="outline" onClick={() => void act({ ...base, _action: "rascunho", _lines: lines, _reason: null })}>Salvar rascunho</Button>
          {order && <Button onClick={() => {
            const zeros = lines.filter((l) => classifyZero(l) === "zero-sem-justificativa").map((l) => String(items.find((it) => it.logical_id === l.item_ref)?.payload["nome"] ?? l.item_ref));
            if (zeros.length && !window.confirm(`Estes itens estão com quantidade zero e sem motivo:\n\n${zeros.join("\n")}\n\nConfirma o envio assim mesmo?`)) return;
            void act({ ...base, _action: "submissao", _lines: lines, _reason: null });
          }}>Submeter pedido</Button>}
        </div>
      )}
    </div>
  );
}

function NetworkQueue({ orders, names, act, itemLabel, contracts, onDone }: { orders: Order[]; names: Map<string, string>; act: (a: Record<string, unknown>) => Promise<void>; itemLabel: (id: string) => string; contracts: Named[]; onDone: (m: string) => Promise<void> }) {
  const [contractOf, setContractOf] = useState<Record<string, string>>({});
  if (orders.length === 0) return <p className="text-muted-foreground">Nenhum pedido nesta competência.</p>;
  const go = async (o: Order, action: string, needReason: boolean) => {
    const reason = needReason ? await askText("Motivo:") : null; if (needReason && !reason?.trim()) return;
    const base = { _logical: o.logical_id, _expected_version: o.version, _action: action, _school: null, _competence: null, _lines: null, _reason: reason };
    if (action !== "autorizacao") return void act(base);
    let ev: ServerCeilingLine[];
    try { ev = await evaluate(o.school_id, o.lines); } catch { return; } // sem avaliação não há autorização
    const needs = authorizationNeeds(ev);
    const chosen = contractOf[o.logical_id];
    let lines: OrderLine[] | null = chosen ? o.lines.map((l) => ({ ...l, contrato_ref: chosen })) : null;
    if (needs.exceeding.length) {
      lines = lines ?? [...o.lines];
      for (const n of needs.exceeding) {
        const j = await askText(`Item ${n} excede o teto calculado (${explainServerLine(ev[n - 1]!)}) Justifique (mín. 10 caracteres):`);
        if (!j || j.trim().length < 10) return;
        lines[n - 1] = { ...lines[n - 1]!, justificativa_excesso: j.trim() };
      }
    }
    let ack: string | null = null;
    if (needs.ackRequired) {
      ack = await askText(`Teto não calculável: ${ev.filter((l) => l.estado === "pendente").map(explainServerLine).join(" ")} Registre sua ciência e a base da conferência:`);
      if (!ack?.trim()) return;
    }
    const why = lines ? await askText("Motivo do registro da justificativa no pedido:") : null;
    if (lines && !why?.trim()) return;
    void act({ ...base, _lines: lines, _reason: why ?? base._reason, _ceiling_ack: ack, __rpc: "record_meal_order_with_ceiling" });
  };
  return (
    <ul className="divide-y">
      {orders.map((o) => (
        <li key={o.logical_id} className="space-y-1 py-2">
          <p className="font-medium">{names.get(o.school_id) ?? o.school_id} — {knownLabel(ORDER_STATUS_LABEL, o.status)} · v{o.version}</p>
          <p className="text-muted-foreground">{o.lines.map((l) => `${itemLabel(l.item_ref)}: ${l.quantidade}`).join(" · ") || "sem itens"}</p>
          {orderAllows(o.status, "autorizacao") && <CeilingPanel school={o.school_id} lines={o.lines} />}
          {orderAllows(o.status, "autorizacao") && contracts.length > 0 && <label className="block max-w-sm">Contrato/empenho para atender<select className={field} value={contractOf[o.logical_id] ?? ""} onChange={(e) => setContractOf({ ...contractOf, [o.logical_id]: e.target.value })}><option value="">não informado</option>{contracts.map((c) => <option key={c.logical_id} value={c.logical_id}>{String(c.payload["numero"] ?? "contrato")}{c.payload["empenho"] ? ` · empenho ${String(c.payload["empenho"])}` : ""}</option>)}</select></label>}
          <div className="flex flex-wrap gap-2">
            {orderAllows(o.status, "analise") && <Button size="sm" variant="outline" onClick={() => go(o, "analise", false)}>Iniciar análise</Button>}
            {orderAllows(o.status, "autorizacao") && <>
              <Button size="sm" variant="outline" onClick={() => go(o, "devolucao", true)}>Devolver</Button>
              <Button size="sm" onClick={() => go(o, "autorizacao", false)}>Autorizar como solicitado</Button>
              <Button size="sm" variant="destructive" onClick={() => go(o, "rejeicao", true)}>Rejeitar</Button>
            </>}
          </div>
          {orderAllows(o.status, "retificacao") && <ScheduleForm order={o.logical_id} lines={o.lines} contracts={contracts} itemLabel={itemLabel} onDone={onDone} />}
        </li>
      ))}
    </ul>
  );
}

/** Confere o pedido contra o cardápio homologado do mês. Só aponta ingrediente sem item; nunca calcula quantidade. */
function MenuCheck({ competence, itemNames }: { competence: string; itemNames: string[] }) {
  const [cycles, setCycles] = useState<CyclePayload[] | null>(null);
  const [mod, setMod] = useState("");
  useEffect(() => { setMod(localStorage.getItem("sigem.cozinha.modalidade") ?? ""); }, []);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(competence)) return;
    callRpc<{ payload: CyclePayload }[]>("meal_master_at", { _kind: "cardapio-planejado", _on: `${competence}-01`, _known_at: null, _include_drafts: false })
      .then((r) => setCycles((r ?? []).map((x) => x.payload).filter((p) => p?.tipo === CYCLE_TYPE)), () => setCycles([]));
  }, [competence]);
  if (!cycles) return null;
  const mods = [...new Set(cycles.map((c) => c.modalidade))];
  if (mods.length === 0) return <p className="text-muted-foreground">Cardápio do mês: não há cardápio aprovado para comparar.</p>;
  const ing = mod ? menuIngredientsOfMonth(cycles, mod, competence) : [];
  const missing = menuIngredientsMissing(ing, itemNames.filter(Boolean));
  return (
    <div className="rounded border p-2">
      <label className="block max-w-xs">Cardápio do mês — modalidade<select className={field} value={mod} onChange={(e) => { setMod(e.target.value); localStorage.setItem("sigem.cozinha.modalidade", e.target.value); }}><option value="">escolha</option>{mods.map((m) => <option key={m}>{m}</option>)}</select></label>
      {mod && (ing.length === 0 ? <p className="text-muted-foreground">Nenhum ingrediente previsto neste mês.</p>
        : missing.length === 0 ? <p>Todos os ingredientes do cardápio do mês estão no pedido.</p>
        : <p>Ingredientes do cardápio sem item no pedido: {missing.join(", ")}. Confira antes de submeter (o sistema não calcula a quantidade).</p>)}
    </div>
  );
}
