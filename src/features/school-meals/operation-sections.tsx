import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { mealMessage } from "./meals-model";
import { INVENTORY_CATALOG_PENDING, PUBLICATION_LABEL, inventoryReady, publicationState, quantity, type NetworkRow, type PublicationEvent } from "./operation-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = callRpc;
const db = supabase as unknown as { from: (t: string) => any };
const field = "mt-1 block w-full rounded border bg-background p-2";
const br = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const isCap = (m: string) => m.startsWith("capability:");

type MenuHead = { id: string; logical_id: string; starts_on: string; ends_on: string; event_kind: string };

/** Publicação governada: ato próprio sobre a versão vigente; retificar o cardápio exige republicar. */
export function MenuPublications({ school, menus }: { school: string; menus: MenuHead[] }) {
  const [events, setEvents] = useState<PublicationEvent[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { try { setEvents(await call<PublicationEvent[]>("meal_menu_publications_at", { _school: school })); } catch (e) { setMsg(mealMessage((e as Error).message)); } }, [school]);
  useEffect(() => { void load(); }, [load]);
  const act = async (m: MenuHead, action: "publicacao" | "retirada", next: number) => {
    const reason = action === "retirada" ? await askText("Motivo da retirada:") : null;
    if (action === "retirada" && !reason?.trim()) return;
    setMsg(null);
    try { await call("record_meal_menu_publication", { _menu_version: m.id, _expected_sequence: next, _action: action, _reason: reason }); await load(); setMsg("Registrado."); }
    catch (e) { const t = (e as Error).message; setMsg(isCap(t) ? "Sua atuação não tem permissão para publicar cardápio." : mealMessage(t)); }
  };
  const live = menus.filter((m) => m.event_kind !== "revogacao");
  return (
    <section aria-labelledby="pub" className="space-y-2 rounded border p-3 text-sm">
      <h2 id="pub" className="font-semibold">Publicação do cardápio para famílias</h2>
      <p className="text-xs text-muted-foreground">Famílias só veem cardápio publicado. Planejado não é servido.</p>
      {!events ? <SkeletonState label="Carregando" /> : live.length === 0 ? <p className="text-muted-foreground">Nenhum cardápio vigente no período.</p> : (
        <ul className="space-y-1">{live.map((m) => { const s = publicationState(events, m.logical_id, m.id); return (
          <li key={m.id} className="flex flex-wrap items-center gap-2">
            <span>{br(m.starts_on)}–{br(m.ends_on)} · {PUBLICATION_LABEL[s.kind]}</span>
            {s.kind !== "publicado" && <Button size="sm" variant="outline" onClick={() => void act(m, "publicacao", s.nextSequence)}>Publicar</Button>}
            {(s.kind === "publicado" || s.kind === "versao-desatualizada") && <Button size="sm" variant="ghost" onClick={() => void act(m, "retirada", s.nextSequence)}>Retirar</Button>}
          </li>); })}</ul>)}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}

/** Estoque: livro de movimentações só com catálogos aprovados; sem catálogo, INVENTORY_CATALOG_PENDING. */
export function InventorySection({ school, from, to }: { school: string; from: string; to: string }) {
  const [items, setItems] = useState<{ value_id: string; label: string }[] | null>(null);
  const [units, setUnits] = useState<{ value_id: string; label: string }[]>([]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [form, setForm] = useState({ item: "", unit: "", kind: "entrada", qty: "", on: to });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void db.from("attribute_value_definitions").select("value_id, label").eq("scheme_id", "item-de-estoque-alimentar").eq("status", "homologada").then((r: any) => setItems(r.data ?? []));
    void db.from("attribute_value_definitions").select("value_id, label").eq("scheme_id", "unidade-de-medida-alimentar").eq("status", "homologada").then((r: any) => setUnits(r.data ?? []));
  }, []);
  const load = useCallback(async () => {
    try { setRows(await call<any[]>("meal_inventory_at", { _school: school, _from: from, _to: to, _known_at: null })); }
    catch (e) { if (isCap((e as Error).message)) setDenied(true); else setMsg(mealMessage((e as Error).message)); }
  }, [school, from, to]);
  useEffect(() => { void load(); }, [load]);
  if (denied) return null;
  if (!items) return null;
  if (!inventoryReady(items, units)) return <section className="rounded border p-3 text-sm"><h2 className="font-semibold">Estoque</h2><p className="text-muted-foreground">{INVENTORY_CATALOG_PENDING}</p></section>;
  const save = async () => {
    setMsg(null);
    try { await call("record_meal_inventory_movement", { _base_id: null, _kind: "registro", _school: school, _item: form.item, _unit: form.unit, _movement: form.kind, _quantity: Number(form.qty), _on: form.on, _note: null, _reason: null }); await load(); setMsg("Registrado."); }
    catch (e) { setMsg(mealMessage((e as Error).message)); }
  };
  const lab = (l: { value_id: string; label: string }[], id: string) => l.find((x) => x.value_id === id)?.label ?? id;
  return (
    <details className="rounded border p-3 text-sm"><summary className="cursor-pointer font-semibold">Estoque — movimentações</summary>
      <p className="mt-1 text-xs text-muted-foreground">Registro de entradas, saídas e ajustes. O sistema não define estoque mínimo nem consumo esperado.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        <label>Item<select className={field} value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}><option value="">Escolha…</option>{items.map((x) => <option key={x.value_id} value={x.value_id}>{x.label}</option>)}</select></label>
        <label>Unidade<select className={field} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="">Escolha…</option>{units.map((x) => <option key={x.value_id} value={x.value_id}>{x.label}</option>)}</select></label>
        <label>Tipo<select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste</option></select></label>
        <label>Quantidade<input className={field} inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></label>
        <label>Data<DateInput value={form.on} onChange={(e) => setForm({ ...form, on: e.target.value })} /></label>
      </div>
      <Button className="mt-2" disabled={!form.item || !form.unit || form.qty === ""} onClick={() => void save()}>Registrar movimentação</Button>
      {rows && (rows.length === 0 ? <p className="mt-2 text-muted-foreground">Nenhuma movimentação no período.</p> :
        <ul className="mt-2">{rows.map((r) => <li key={r.id}>{br(r.moved_on)} · {r.movement_kind} · {lab(items, r.item_value_id)} · {r.quantity} {lab(units, r.unit_value_id)}{r.event_kind === "anulacao" ? " (anulada)" : ""}</li>)}</ul>)}
      {msg && <p role="status">{msg}</p>}
    </details>
  );
}

/** Rede: grandezas separadas; escola sem registro não aparece como zero. Sem avaliação nutricional. */
export function NetworkOverview({ from, to, names }: { from: string; to: string; names: Map<string, string> }) {
  const [rows, setRows] = useState<NetworkRow[] | null>(null);
  const [state, setState] = useState<"ok" | "denied" | string>("ok");
  useEffect(() => {
    call<NetworkRow[]>("meal_network_overview", { _from: from, _to: to }).then(setRows, (e: Error) => setState(isCap(e.message) ? "denied" : mealMessage(e.message)));
  }, [from, to]);
  if (state === "denied") return null;
  return (
    <section aria-labelledby="net" className="space-y-2 rounded border p-3 text-sm">
      <h2 id="net" className="font-semibold">Visão da rede</h2>
      <p className="text-xs text-muted-foreground">Previsto, servido e dias com cardápio são medidas separadas. Escolas sem registro no período não aparecem — ausência não é zero. Não há avaliação de qualidade nutricional.</p>
      {state !== "ok" ? <p>{state}</p> : !rows ? <SkeletonState label="Carregando" /> : rows.length === 0 ? <p className="text-muted-foreground">Nenhuma escola com registro no período.</p> : (
        <div className="overflow-x-auto"><table className="w-full"><caption className="sr-only">Visão da rede por escola</caption>
          <thead><tr className="text-left"><th scope="col" className="p-2">Escola</th><th scope="col" className="p-2">Previsto (total)</th><th scope="col" className="p-2">Dias com previsão</th><th scope="col" className="p-2">Servidas (total)</th><th scope="col" className="p-2">Dias com servidas informadas</th><th scope="col" className="p-2">Registros sem servidas</th><th scope="col" className="p-2">Dias com cardápio</th><th scope="col" className="p-2">Cardápios publicados</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.school_id} className="border-t"><td className="p-2">{names.get(r.school_id) ?? r.school_id}</td><td className="p-2">{quantity(r.forecast_total)}</td><td className="p-2">{quantity(r.forecast_days)}</td><td className="p-2">{quantity(r.served_total)}</td><td className="p-2">{quantity(r.served_days)}</td><td className="p-2">{quantity(r.served_unknown_records)}</td><td className="p-2">{quantity(r.menu_days)}</td><td className="p-2">{quantity(r.published_menus)}</td></tr>)}</tbody>
        </table></div>)}
    </section>
  );
}

type Kitchen = { kitchen_id: string; version: number; name: string; host_school_id: string | null; valid_from: string; valid_to: string | null; served_schools: string[] };

/** Unidades/cozinhas: rede mantém; escola vê só a unidade que a atende. */
export function KitchensSection({ names, canManage }: { names: Map<string, string>; canManage: boolean }) {
  const [rows, setRows] = useState<Kitchen[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", from: operationalToday(), kitchen: "", school: "" });
  const today = operationalToday();
  const load = useCallback(async () => { try { setRows(await call<Kitchen[]>("meal_kitchens_at", { _on: today })); } catch (e) { setMsg(mealMessage((e as Error).message)); } }, [today]);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: string, a: Record<string, unknown>) => { setMsg(null); try { await call(fn, a); await load(); setMsg("Registrado."); } catch (e) { const t = (e as Error).message; setMsg(t === "meal:school-already-served" ? "Esta escola já é atendida por outra unidade nesse período." : mealMessage(t)); } };
  if (!rows || (rows.length === 0 && !canManage)) return null;
  return (
    <section aria-labelledby="kit" className="space-y-2 rounded border p-3 text-sm">
      <h2 id="kit" className="font-semibold">Unidades de preparo (cozinhas)</h2>
      {rows.length === 0 ? <p className="text-muted-foreground">Nenhuma unidade cadastrada.</p> :
        <ul>{rows.map((k) => <li key={k.kitchen_id}><span className="font-medium">{k.name}</span> · desde {br(k.valid_from)} · atende: {k.served_schools.length === 0 ? "nenhuma escola vigente" : k.served_schools.map((s) => names.get(s) ?? s).join(", ")}</li>)}</ul>}
      {canManage && (
        <details><summary className="cursor-pointer">Cadastrar unidade ou vincular escola</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label>Nome da unidade<input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Desde<DateInput value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
            <div className="flex items-end"><Button variant="outline" disabled={!form.name.trim()} onClick={() => void act("record_meal_kitchen", { _kitchen: null, _expected_version: null, _name: form.name, _host_school: null, _from: form.from, _to: null, _reason: null })}>Cadastrar unidade</Button></div>
            <label>Unidade<select className={field} value={form.kitchen} onChange={(e) => setForm({ ...form, kitchen: e.target.value })}><option value="">Escolha…</option>{rows.map((k) => <option key={k.kitchen_id} value={k.kitchen_id}>{k.name}</option>)}</select></label>
            <label>Escola atendida<select className={field} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}><option value="">Escolha…</option>{[...names].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
            <div className="flex items-end"><Button variant="outline" disabled={!form.kitchen || !form.school} onClick={() => void act("record_meal_kitchen_link", { _base_id: null, _kind: "registro", _kitchen: form.kitchen, _school: form.school, _from: form.from, _to: null, _reason: null })}>Vincular escola</Button></div>
          </div>
        </details>)}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
