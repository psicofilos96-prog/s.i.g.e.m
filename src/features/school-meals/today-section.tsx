import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { ADHESION_BLOCK, CALENDAR_UNRESOLVED, THEORETICAL_DEBIT_BLOCK, executionMessage, plannedVsExecuted, servedFacts, type Execution } from "./execution-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await (supabase.rpc as unknown as Rpc)(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
interface Row extends Execution { id: string; meal_slot_value_id: string; executed_preparation: string | null }
interface Slot { value_id: string; label: string }
const LABEL = { "sem-registro": "Sem registro", seguido: "Cardápio seguido", desvio: "Desvio registrado", "nao-informado": "Não informado" } as const;

/** "Hoje na alimentação": execução do dia por refeição. Nada aqui altera o cardápio publicado. */
export function TodaySection({ school, slots }: { school: string; slots: Slot[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [slot, setSlot] = useState(""); const [followed, setFollowed] = useState<"" | "sim" | "nao">("");
  const [deviation, setDeviation] = useState(""); const [meals, setMeals] = useState(""); const [basis, setBasis] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!school) return;
    try { setRows(await call<Row[]>("meal_executions_at", { _school: school, _from: today, _to: today, _known_at: null })); setErr(null); }
    catch (e) { setErr(executionMessage((e as Error).message)); }
  }, [school, today]);
  useEffect(() => { void load(); }, [load]);
  if (!school) return null;
  const save = async () => {
    try {
      await call("record_meal_execution", { _base_id: null, _kind: "registro", _school: school, _on: today, _slot: slot, _planned_menu: null,
        _followed: followed === "" ? null : followed === "sim", _preparation: null, _deviation: deviation || null, _deviation_reason: null,
        _authorization: null, _meals_total: meals === "" ? null : Number(meals), _count_basis: basis || null, _breakdown: [],
        _students_present: null, _students_source: null, _consumption: [], _tz: Intl.DateTimeFormat().resolvedOptions().timeZone, _reason: null });
      setMsg("Execução registrada."); setSlot(""); setFollowed(""); setDeviation(""); setMeals(""); setBasis(""); void load();
    } catch (e) { setMsg(executionMessage((e as Error).message)); }
  };
  return (
    <section aria-labelledby="hoje" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="hoje" className="font-semibold">Hoje na alimentação</h2>
      <StatePanel tone="info" title="Dia operacional" description={CALENDAR_UNRESOLVED} />
      <StatePanel tone="info" title="Adesão não calculada" description={`${ADHESION_BLOCK}. Refeições servidas e alunos presentes aparecem como medidas separadas. ${THEORETICAL_DEBIT_BLOCK}: consumo só sai do estoque quando registrado.`} />
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} /> : !rows ? <p className="text-muted-foreground">Carregando…</p> : (
        <ul className="space-y-1">{slots.map((s) => { const r = rows.find((x) => x.meal_slot_value_id === s.value_id) ?? null; const f = servedFacts(r);
          return <li key={s.value_id} className="rounded border p-2"><strong>{s.label}</strong>: {LABEL[plannedVsExecuted(r)]}
            {r && <> · Refeições servidas: {f.meals ?? "não informado"}{f.basis ? ` (${f.basis})` : ""} · Alunos presentes: {f.students ?? "não informado"}</>}</li>; })}
          {slots.length === 0 && <li className="text-muted-foreground">Nenhuma refeição homologada.</li>}</ul>)}
      <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="font-medium">Registrar execução</legend>
        <label>Refeição<select className="block w-full rounded border p-2" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Escolha…</option>{slots.map((s) => <option key={s.value_id} value={s.value_id}>{s.label}</option>)}</select></label>
        <label>Cardápio seguido?<select className="block w-full rounded border p-2" value={followed} onChange={(e) => setFollowed(e.target.value as "" | "sim" | "nao")}><option value="">Não informar</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>
        {followed === "nao" && <label className="sm:col-span-2">O que foi servido no lugar<input className="block w-full rounded border p-2" value={deviation} onChange={(e) => setDeviation(e.target.value)} /></label>}
        <label>Refeições servidas<input inputMode="numeric" className="block w-full rounded border p-2" value={meals} onChange={(e) => setMeals(e.target.value.replace(/\D/g, ""))} /></label>
        <label>Base da contagem<input className="block w-full rounded border p-2" placeholder="ex.: inclui repetições" value={basis} onChange={(e) => setBasis(e.target.value)} /></label>
        <button type="button" disabled={!slot} onClick={save} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50 sm:col-span-2">Registrar</button>
        {msg && <p role="status" className="sm:col-span-2">{msg}</p>}
      </fieldset>
    </section>
  );
}
