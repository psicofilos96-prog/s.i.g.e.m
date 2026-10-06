import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { ALERT_LABEL, MINIMUM_STOCK_STATE, STOCK_BASIS_BLOCK, stockMessage, suggestLotsByExpiry } from "./stock-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await (supabase.rpc as unknown as Rpc)(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
interface Line { item_value_id: string; unit_value_id: string; lot: string | null; expires_on: string | null; balance: number | null; movements: number }
interface Alert { kind: string; item_value_id: string; unit_value_id: string; lot: string | null; detail: string }

export function StockSection({ school }: { school: string }) {
  const [on, setOn] = useState(new Date().toLocaleDateString("en-CA"));
  const [lines, setLines] = useState<Line[] | null>(null); const [alerts, setAlerts] = useState<Alert[]>([]);
  const [basis, setBasis] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!school) return;
    try {
      setLines(await call<Line[]>("meal_stock_balance_at", { _school: school, _on: on, _known_at: null }));
      setAlerts(await call<Alert[]>("meal_stock_alerts_at", { _school: school, _on: on, _expiry_window_days: null }).catch(() => []));
      const b = await call<{ state: string }[]>("meal_stock_basis_at", { _school: school, _competence: on.slice(0, 7) }).catch(() => []);
      setBasis(b[0]?.state ?? null); setErr(null);
    } catch (e) { setErr(stockMessage((e as Error).message)); }
  }, [school, on]);
  useEffect(() => { void load(); }, [load]);
  if (!school) return null;
  return (
    <section aria-labelledby="stk" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="stk" className="font-semibold">Estoque</h2>
      <label className="block max-w-xs">Saldo em<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      <StatePanel tone="info" title="Saldo derivado dos movimentos" description={`Nunca é digitado; ajuste exige contagem física e motivo. ${MINIMUM_STOCK_STATE}: não há alerta de estoque baixo.`} />
      {basis === "STOCK_BASIS_POLICY_PENDING" && <StatePanel tone="warning" title="Saldo para pedido não definido" description={`${STOCK_BASIS_BLOCK}. Consulte o saldo pela data desejada; o sistema não escolhe qual saldo vale para o pedido.`} />}
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} /> : !lines ? <p className="text-muted-foreground">Carregando…</p>
        : lines.length === 0 ? <p className="text-muted-foreground">Nenhum movimento registrado até esta data.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left"><th>Item</th><th>Unidade</th><th>Lote</th><th>Validade</th><th>Saldo</th></tr></thead>
            <tbody>{[...suggestLotsByExpiry(lines), ...lines.filter((l) => !((l.balance ?? 0) > 0))].map((l, i) => (
              <tr key={i} className="border-t"><td>{l.item_value_id}</td><td>{l.unit_value_id}</td><td>{l.lot ?? "—"}</td><td>{l.expires_on ? new Date(`${l.expires_on}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                <td>{l.balance == null ? "não disponível" : l.balance}</td></tr>))}</tbody></table>
            <p className="text-muted-foreground">Lotes com saldo aparecem pelo vencimento (PVPS) como sugestão; nenhuma baixa é automática.</p></div>)}
      {alerts.length > 0 && <ul aria-label="Alertas" className="divide-y">{alerts.map((a, i) => <li key={i} className="py-1">{ALERT_LABEL[a.kind] ?? a.kind}: {a.item_value_id} {a.lot ? `lote ${a.lot}` : ""} · {a.detail}</li>)}</ul>}
    </section>
  );
}
