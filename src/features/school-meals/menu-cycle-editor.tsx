import { useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { mealMessage } from "./meals-model";
import { CONDITIONS, CYCLE_TYPE, MODALITIES, WEEKDAYS, cycleProblems, splitIngredients, type Cell, type CyclePayload, type WeekRange } from "./menu-cycle";

const field = "block w-full rounded border bg-background p-1 text-sm";
const key = (s: number, d: number) => `${s}|${d}`;

/** Editor visual do ciclo de 4 semanas. Gravar cria rascunho; vale para as escolas só após conferência e homologação em Planejamento. */
export function MenuCycleEditor() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [mod, setMod] = useState<string>(MODALITIES[3]); const [cond, setCond] = useState<string>(CONDITIONS[0]);
  const [meal, setMeal] = useState("Refeição principal");
  const [cells, setCells] = useState<Record<string, { p: string; i: string }>>({});
  const [ranges, setRanges] = useState<WeekRange[]>([]);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const payload = (): CyclePayload => ({
    competencia: year, tipo: CYCLE_TYPE, modalidade: mod, condicao: cond, cronograma: ranges,
    entradas: Object.entries(cells).filter(([, v]) => v.p.trim()).map(([k, v]): Cell => { const [s, d] = k.split("|").map(Number); return { semana: s!, dia: d!, refeicao: meal, preparacao: v.p.trim(), ingredientes: splitIngredients(v.i) }; }),
  });
  const problems = cycleProblems(payload());
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const from = ranges.map((r) => r.de).sort()[0] ?? `${year}-01-01`;
      await callRpc("record_meal_master", { _staging: null, _kind: "cardapio-planejado", _logical: null, _expected_version: null, _action: "registro", _payload: payload(), _school: null, _from: from, _to: null, _reason: null });
      setMsg("Rascunho gravado. Confira e homologue em Planejamento → Cardápios para valer nas escolas.");
    } catch (e) { setMsg(`Não gravado: ${mealMessage((e as Error).message)}`); } finally { setBusy(false); }
  };
  const set = (s: number, d: number, k: "p" | "i", v: string) => setCells({ ...cells, [key(s, d)]: { p: "", i: "", ...cells[key(s, d)], [k]: v } });
  return (
    <section aria-label="Cardápio em 4 semanas" className="space-y-3 rounded border p-3 text-sm">
      <h2 className="font-semibold">Cardápio em 4 semanas</h2>
      <div className="flex flex-wrap gap-2">
        <label>Ano<input className={field} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <label>Modalidade<select className={field} value={mod} onChange={(e) => setMod(e.target.value)}>{MODALITIES.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Condição<select className={field} value={cond} onChange={(e) => setCond(e.target.value)}>{CONDITIONS.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Refeição<input className={field} value={meal} onChange={(e) => setMeal(e.target.value)} /></label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] border-collapse">
          <thead><tr><th className="p-1" />{WEEKDAYS.map((d) => <th key={d} className="p-1 text-left">{d}</th>)}</tr></thead>
          <tbody>{[1, 2, 3, 4].map((s) => (
            <tr key={s} className="border-t align-top"><th className="p-1 text-left">Semana {s}</th>
              {WEEKDAYS.map((_, d) => (
                <td key={d} className="space-y-1 p-1">
                  <textarea aria-label={`Semana ${s} ${WEEKDAYS[d]} preparação`} rows={2} className={field} placeholder="Preparação" value={cells[key(s, d)]?.p ?? ""} onChange={(e) => set(s, d, "p", e.target.value)} />
                  <textarea aria-label={`Semana ${s} ${WEEKDAYS[d]} ingredientes`} rows={2} className={field} placeholder="Ingredientes, separados por vírgula" value={cells[key(s, d)]?.i ?? ""} onChange={(e) => set(s, d, "i", e.target.value)} />
                </td>))}</tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Cronograma do ano (qual semana vale em cada período)</p>
        {ranges.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input type="date" className="rounded border bg-background p-1" value={r.de} onChange={(e) => setRanges(ranges.map((x, j) => j === i ? { ...x, de: e.target.value } : x))} />
            a <input type="date" className="rounded border bg-background p-1" value={r.ate} onChange={(e) => setRanges(ranges.map((x, j) => j === i ? { ...x, ate: e.target.value } : x))} />
            = Semana <select className="rounded border bg-background p-1" value={r.semana} onChange={(e) => setRanges(ranges.map((x, j) => j === i ? { ...x, semana: Number(e.target.value) } : x))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
            <button type="button" className="text-xs underline" onClick={() => setRanges(ranges.filter((_, j) => j !== i))}>remover</button>
          </div>))}
        <Button size="sm" variant="outline" onClick={() => { const last = ranges[ranges.length - 1]; setRanges([...ranges, { de: "", ate: "", semana: last ? (last.semana % 4) + 1 : 1 }]); }}>Adicionar período</Button>
      </div>
      {problems.map((p) => <p key={p} className="text-destructive">{p}</p>)}
      <Button disabled={busy || problems.length > 0} onClick={() => void save()}>Gravar rascunho</Button>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
