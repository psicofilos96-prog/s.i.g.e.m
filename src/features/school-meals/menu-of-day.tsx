import { useEffect, useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { CONDITIONS, CYCLE_TYPE, menuOfDay, plannedMenuText, type CyclePayload } from "./menu-cycle";

const field = "mt-1 block w-full rounded-lg border bg-background p-3 text-base";
export const STORE = "sigem.cozinha.modalidade";

/** Cardápio previsto de hoje (mesma leitura do Cardápio do dia). */
export function usePlannedMenu(today: string): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const mod = localStorage.getItem(STORE) ?? "";
    if (!mod) return;
    callRpc<{ payload: CyclePayload }[]>("meal_master_at", { _kind: "cardapio-planejado", _on: today, _known_at: null, _include_drafts: false })
      .then((r) => setText(plannedMenuText((r ?? []).map((x) => x.payload).filter((p) => p?.tipo === CYCLE_TYPE), mod, today)), () => setText(null));
  }, [today]);
  return text;
}

/** Cardápio do Dia: só de ciclo homologado, pela semana do cronograma. Sem cronograma para hoje = não presume semana. */
export function MenuOfDay({ today }: { today: string }) {
  const [cycles, setCycles] = useState<CyclePayload[] | null>(null);
  const [mod, setMod] = useState("");
  useEffect(() => { setMod(localStorage.getItem(STORE) ?? ""); }, []);
  useEffect(() => {
    void (async () => {
      try {
        const r = await callRpc<{ payload: CyclePayload }[]>("meal_master_at", { _kind: "cardapio-planejado", _on: today, _known_at: null, _include_drafts: false });
        setCycles((r ?? []).map((x) => x.payload).filter((p) => p?.tipo === CYCLE_TYPE));
      } catch { setCycles([]); }
    })();
  }, [today]);
  const mods = [...new Set((cycles ?? []).map((c) => c.modalidade))];
  const chosen = (cycles ?? []).filter((c) => c.modalidade === mod).sort((a, b) => CONDITIONS.indexOf(a.condicao as never) - CONDITIONS.indexOf(b.condicao as never));
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Cardápio do dia</h2>
      {cycles === null ? <p>…</p> : cycles.length === 0 ? <p className="text-muted-foreground">Nenhum cardápio de 4 semanas homologado para hoje.</p> : (<>
        <label className="block">Modalidade da escola<select className={field} value={mod} onChange={(e) => { setMod(e.target.value); localStorage.setItem(STORE, e.target.value); }}>
          <option value="">Escolha…</option>{mods.map((m) => <option key={m}>{m}</option>)}</select></label>
        {mod && chosen.map((c) => { const d = menuOfDay(c, today); return (
          <div key={c.condicao} className="rounded-lg border p-3">
            <p className="font-medium">{c.condicao}{d ? ` · Semana ${d.semana}` : ""}</p>
            {!d ? <p className="text-muted-foreground">Hoje não está no cronograma deste cardápio.</p>
              : d.cells.length === 0 ? <p className="text-muted-foreground">Sem preparação prevista para hoje.</p>
              : d.cells.map((x, i) => <div key={i}><p>{x.refeicao}: {x.preparacao}</p>{x.ingredientes.length > 0 && <p className="text-sm text-muted-foreground">Ingredientes previstos: {x.ingredientes.join(", ")}</p>}</div>)}
          </div>); })}
      </>)}
    </section>
  );
}
