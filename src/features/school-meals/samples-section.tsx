/** LOTE 9 — amostras de alimentos com etiqueta imprimível (código opaco, sem dado pessoal). Grava só por `record_meal_food_sample`. */
import { useCallback, useEffect, useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { mealMessage } from "./meals-model";

type Sample = { logical_id: string; version: number; event: string; collected_on: string; meal_slot: string; preparation: string; sample_code: string; retention_hours: number | null; storage_temp: number | null; note: string | null };
const field = "mt-1 block w-full rounded border bg-background p-2";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function sampleLabelHtml(s: Pick<Sample, "sample_code" | "collected_on" | "meal_slot" | "preparation" | "retention_hours" | "storage_temp">, schoolName: string) {
  const br = s.collected_on.split("-").reverse().join("/");
  return `<div style="width:90mm;height:50mm;border:1px solid #000;padding:3mm;font:10pt sans-serif;box-sizing:border-box;page-break-inside:avoid;margin:2mm"><b>AMOSTRA ${esc(s.sample_code)}</b><br>${esc(schoolName)}<br>Coleta: ${br} · ${esc(s.meal_slot)}<br>${esc(s.preparation)}<br>Retenção: ${s.retention_hours ? `${s.retention_hours} h` : "não informada"} · Temp.: ${s.storage_temp ?? "não informada"}${s.storage_temp != null ? " °C" : ""}<br>Responsável: ______________</div>`;
}

export function SamplesSection({ school, schoolName }: { school: string; schoolName: string }) {
  const [day, setDay] = useState(operationalToday());
  const [rows, setRows] = useState<Sample[] | null>(null); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [d, setD] = useState({ slot: "", prep: "", hours: "", temp: "" });
  const load = useCallback(async () => {
    try { setRows(await callRpc<Sample[]>("meal_food_samples_at", { _school: school, _from: day, _to: day })); setErr(null); } catch (e) { setErr(mealMessage((e as Error).message)); }
  }, [school, day]);
  useEffect(() => { void load(); }, [load]);
  const print = (list: Sample[]) => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!doctype html><html><head><title>Etiquetas de amostra</title><style>@page{size:A4;margin:10mm}body{display:flex;flex-wrap:wrap}</style></head><body>${list.map((s) => sampleLabelHtml(s, schoolName)).join("")}</body></html>`); w.document.close(); w.print(); };
  const collect = async () => {
    setMsg(null);
    try {
      await callRpc("record_meal_food_sample", { _logical: null, _expected_version: null, _event: "coleta", _school: school, _on: day, _slot: d.slot, _preparation: d.prep, _retention_hours: d.hours ? Number(d.hours) : null, _temp: d.temp ? Number(d.temp) : null, _note: null, _reason: null });
      setD({ slot: "", prep: "", hours: "", temp: "" }); setMsg("Amostra registrada."); await load();
    } catch (e) { setMsg(mealMessage((e as Error).message)); }
  };
  const discard = async (s: Sample) => { try { await callRpc("record_meal_food_sample", { _logical: s.logical_id, _expected_version: s.version, _event: "descarte", _school: null, _on: null, _slot: null, _preparation: null, _retention_hours: null, _temp: null, _note: "Descarte registrado", _reason: null }); await load(); } catch (e) { setMsg(mealMessage((e as Error).message)); } };
  return (
    <section aria-labelledby="amostras" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="amostras" className="font-semibold">Amostras e etiquetas</h2>
      <label className="block max-w-xs">Dia<input type="date" className={field} value={day} onChange={(e) => setDay(e.target.value)} /></label>
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} /> : !rows ? <p className="text-muted-foreground">Carregando…</p> : (<>
        {rows.length === 0 ? <p className="text-muted-foreground">Nenhuma amostra neste dia.</p> : (
          <ul className="divide-y">{rows.map((s) => <li key={s.logical_id} className="flex flex-wrap items-center justify-between gap-2 py-1"><span>{s.sample_code} · {s.meal_slot} · {s.preparation}{s.event === "descarte" ? " · descartada" : ""}</span>
            <span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => print([s])}>Etiqueta</Button>{s.event !== "descarte" && <Button size="sm" variant="ghost" onClick={() => void discard(s)}>Registrar descarte</Button>}</span></li>)}</ul>)}
        {rows.length > 1 && <Button variant="outline" onClick={() => print(rows.filter((r) => r.event !== "descarte"))}>Imprimir todas (A4)</Button>}
        <div className="grid gap-2 sm:grid-cols-4">
          <label>Refeição<input className={field} value={d.slot} onChange={(e) => setD({ ...d, slot: e.target.value })} placeholder="ex.: almoço" /></label>
          <label>Preparação<input className={field} value={d.prep} onChange={(e) => setD({ ...d, prep: e.target.value })} /></label>
          <label>Retenção (h, conforme norma vigente)<input type="number" min={1} className={field} value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} /></label>
          <label>Temperatura (°C)<input type="number" className={field} value={d.temp} onChange={(e) => setD({ ...d, temp: e.target.value })} /></label>
        </div>
        <Button onClick={() => void collect()} disabled={!d.slot.trim() || !d.prep.trim()}>Registrar coleta</Button>
      </>)}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
