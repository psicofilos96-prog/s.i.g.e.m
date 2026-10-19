import { useCallback, useEffect, useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { opsMessage } from "./operations-l3-model";

type Row = { equipment: string; equipment_kind: string; changed_on: string; period_months: number; next_on: string; note: string | null; history: number };
const field = "mt-1 block w-full rounded-lg border bg-background p-3 text-base";
/** Prazos padrão do sistema (especificação do setor): torneira 6 meses, purificador maior 9 meses; editáveis por registro. */
export const DEFAULT_MONTHS = { torneira: 6, maior: 9 } as const;
const br = (d: string) => d.split("-").reverse().join("/");
const daysUntil = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400000);

export function WaterFiltersPanel({ school, today }: { school: string; today: string }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ equipment: "", kind: "torneira" as "torneira" | "maior", on: today, months: "6", note: "" });
  const load = useCallback(async () => { try { setRows(await callRpc<Row[]>("meal_water_filters_at", { _school: school })); setErr(null); } catch (e) { setErr(opsMessage((e as Error).message)); } }, [school]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    try {
      await callRpc("record_meal_water_filter_change", { _school: school, _equipment: f.equipment, _kind: f.kind, _on: f.on, _months: Number(f.months), _note: f.note, _key: crypto.randomUUID() });
      setMsg("Troca registrada."); setF({ ...f, equipment: "", note: "" }); await load();
    } catch (e) { setMsg(opsMessage((e as Error).message)); }
  };
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Refil dos purificadores de água</h2>
      {err ? <p className="text-muted-foreground">{err}</p> : !rows ? <p>…</p> : rows.length === 0 ? <p className="text-muted-foreground">Nenhuma troca registrada.</p> : (
        <ul className="divide-y">{rows.map((r) => { const d = daysUntil(r.next_on, today); return (
          <li key={r.equipment} className="py-2">{r.equipment} ({r.equipment_kind === "torneira" ? "de torneira" : "maior"}) · última troca {br(r.changed_on)} · próxima {br(r.next_on)}
            <span className={d <= 15 ? " text-destructive font-medium" : " text-muted-foreground"}>{d < 0 ? ` · vencida há ${-d} dia(s)` : d <= 30 ? ` · vence em ${d} dia(s)` : ""}</span></li>); })}</ul>)}
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Equipamento<input className={field} value={f.equipment} placeholder="ex.: Purificador da cozinha" onChange={(e) => setF({ ...f, equipment: e.target.value })} /></label>
        <label>Tipo<select className={field} value={f.kind} onChange={(e) => { const k = e.target.value as "torneira" | "maior"; setF({ ...f, kind: k, months: String(DEFAULT_MONTHS[k]) }); }}>
          <option value="torneira">De torneira</option><option value="maior">Maior</option></select></label>
        <label>Data da troca<input type="date" max={today} className={field} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></label>
        <label>Próxima troca em (meses)<input inputMode="numeric" className={field} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value.replace(/\D/g, "") })} /></label>
      </div>
      <p className="text-xs text-muted-foreground">Padrão do sistema: 6 meses (torneira) e 9 meses (maior). Ajuste se o fabricante indicar outro prazo.</p>
      <button type="button" disabled={f.equipment.trim().length < 2 || !f.months} onClick={() => void save()} className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">Registrar troca</button>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
