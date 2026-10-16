import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { distortion, mergeAdjusted, T04_ROWS, type DistortionRow } from "./t04-distortion";
import type { Values } from "./semed-catalog";

import { DateInput } from "@/components/sigem/date-input";
const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
export type T04Rule = { version: number; reference_date: string; thresholds: Record<string, number>; basis: string } | null;
type Apur = { rule_version: number | null; reference_date: string | null; students: number | null; duplicate_allocations?: number; without_birth_date?: number; without_stage?: number; cells: Record<string, number>; gaps: string[] };
type Adj = { cell_key: string; computed_value: number | null; value: number | null; reason: string; created_at: string };
const GAP: Record<string, string> = {
  "regra-ausente": "A rede ainda não registrou a regra (data de referência e idade de distorção por linha).",
  "data-de-nascimento-sem-fonte": "O cadastro central não tem data de nascimento dos estudantes: a idade não pode ser calculada.",
  "ano-etapa-da-turma-sem-oferta-registrada": "As turmas não têm ano/etapa registrados na oferta: não é possível saber a linha de cada estudante.",
};

export function DistortionChart({ rows }: { rows: DistortionRow[] }) {
  const shown = rows.filter((r) => r.total !== null);
  if (!shown.length) return <p className="text-xs text-muted-foreground">Sem valores informados para o gráfico.</p>;
  return (
    <div className="space-y-1" role="img" aria-label="Gráfico de distorção série × idade por linha">
      {shown.map((r) => (
        <div key={r.rowKey} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0">{r.label}</span>
          <div className="h-3 flex-1 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${r.pct ?? 0}%` }} /></div>
          <span className="w-40 shrink-0">{r.pct === null ? (r.threshold === null ? "sem regra" : "indeterminado") : `${String(r.pct).replace(".", ",")}% (${r.distorted}/${r.total})`}</span>
        </div>
      ))}
    </div>
  );
}

export function T04Panel({ school, year, network, canFill, editable, draft, setDraft, onRule }: {
  school: string; year: number; network: boolean; canFill: boolean; editable: boolean;
  draft: Values; setDraft: (v: Record<string, string | number | null>) => void; onRule: (r: T04Rule) => void;
}) {
  const [rule, setRule] = useState<T04Rule>(null); const [apur, setApur] = useState<Apur | null>(null); const [adjs, setAdjs] = useState<Adj[]>([]);
  const [msg, setMsg] = useState<string | null>(null); const [reason, setReason] = useState("");
  const [rd, setRd] = useState(""); const [th, setTh] = useState<Record<string, string>>({}); const [basis, setBasis] = useState("");
  const load = useCallback(async () => {
    const [r, a, j] = await Promise.all([
      db.from("semed_t04_rule_versions").select("version, reference_date, thresholds, basis").eq("year", year).order("version", { ascending: false }).limit(1),
      rpc("semed_t04_apuracao", { _school: school, _year: year }),
      db.from("semed_t04_adjustments").select("cell_key, computed_value, value, reason, created_at").eq("school_id", school).eq("year", year).order("created_at"),
    ]);
    const ru = ((r.data ?? [])[0] ?? null) as T04Rule; setRule(ru); onRule(ru);
    if (ru) { setRd(ru.reference_date); setTh(Object.fromEntries(Object.entries(ru.thresholds).map(([k, v]) => [k, String(v)]))); setBasis(ru.basis); }
    setApur(a.error ? null : (a.data as Apur)); setAdjs((j.data ?? []) as Adj[]);
  }, [school, year, onRule]);
  useEffect(() => { void load(); }, [load]);

  const merged = useMemo(() => mergeAdjusted(apur?.cells ?? {}, adjs), [apur, adjs]);
  const hasComputed = (apur?.students ?? 0) > 0 && Object.keys(apur?.cells ?? {}).length > 0;
  const diffs = useMemo(() => !hasComputed ? [] : [...new Set([...Object.keys(draft), ...Object.keys(merged)])]
    .filter((k) => k.startsWith("m.") && (draft[k] ?? null) !== (merged[k] ?? null)), [draft, merged, hasComputed]);
  const rows = distortion(draft, rule?.thresholds ?? null);

  const saveRule = async () => {
    const thresholds = Object.fromEntries(Object.entries(th).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)]));
    const r = await rpc("semed_t04_record_rule", { _year: year, _expected_version: rule?.version ?? 0, _reference_date: rd || null, _thresholds: thresholds, _basis: basis });
    setMsg(r.error ? `Recusado: ${r.error.message.replace(/^.*semed:/, "")}` : `Regra registrada (versão ${r.data as number}).`); if (!r.error) await load();
  };
  const useApuracao = () => setDraft({ ...Object.fromEntries(Object.entries(draft).filter(([k]) => !k.startsWith("m."))), ...merged } as Record<string, string | number | null>);
  const recordAdj = async () => {
    const r = await rpc("semed_t04_record_adjustments", { _school: school, _year: year, _reason: reason, _items: diffs.map((k) => ({ cell: k, computed: apur?.cells[k] ?? null, value: draft[k] ?? null })) });
    setMsg(r.error ? `Recusado: ${r.error.message.replace(/^.*semed:/, "")}` : `${r.data as number} ajuste(s) registrado(s).`); if (!r.error) { setReason(""); await load(); }
  };

  return (
    <section className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Apuração pelo cadastro central e distorção</h3>
      <p className="text-xs">Regra: {rule ? <>versão {rule.version} · data de referência {new Date(rule.reference_date + "T12:00").toLocaleDateString("pt-BR")} · fundamento: {rule.basis}</> : "não registrada — sem regra o indicador não é calculado."}</p>
      {apur && (
        <div className="text-xs">
          {apur.students !== null && <p>Estudantes com enturmação vigente na data: <b>{apur.students}</b> (cada um contado uma vez{apur.duplicate_allocations ? `; ${apur.duplicate_allocations} enturmação(ões) simultânea(s) descartada(s)` : ""}). Sem data de nascimento: {apur.without_birth_date ?? "—"} · sem ano/etapa: {apur.without_stage ?? "—"}.</p>}
          <ul className="list-disc pl-5 text-muted-foreground">{apur.gaps.map((g) => <li key={g}>{GAP[g] ?? g}</li>)}</ul>
          {!hasComputed && <p className="mt-1">Enquanto faltarem essas fontes a matriz é preenchida pela Secretaria e nenhuma célula é calculada.</p>}
        </div>
      )}
      {canFill && editable && hasComputed && <Button size="sm" variant="outline" onClick={useApuracao}>Usar a apuração no rascunho (substitui a matriz)</Button>}
      {diffs.length > 0 && canFill && (
        <div className="flex flex-wrap items-end gap-2 rounded border p-2 text-xs">
          <span>{diffs.length} célula(s) diferem da apuração e precisam de justificativa antes de salvar.</span>
          <input aria-label="Justificativa do ajuste" className="min-w-64 rounded-md border border-input bg-background p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justificativa" />
          <Button size="sm" onClick={() => void recordAdj()}>Registrar ajuste</Button>
        </div>
      )}
      <div><h4 className="mb-1 text-xs font-semibold">Distorção série × idade (% da linha com idade ≥ a idade de distorção da regra)</h4><DistortionChart rows={rows} /></div>
      {adjs.length > 0 && <details className="text-xs"><summary>Ajustes registrados ({adjs.length})</summary><ol>{adjs.map((a, i) => <li key={i}>{new Date(a.created_at).toLocaleString("pt-BR")} · {a.cell_key}: {a.computed_value ?? "—"} → {a.value ?? "—"} · {humanizeForScreen(a.reason)}</li>)}</ol></details>}
      {network && (
        <details className="rounded border p-2 text-xs"><summary className="cursor-pointer font-medium">Registrar nova versão da regra (rede)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label>Data de referência<br /><DateInput aria-label="Data de referência" className="rounded-md border border-input bg-background p-1" value={rd} onChange={(e) => setRd(e.target.value)} /></label>
            <label>Fundamento (decisão ou norma)<br /><input aria-label="Fundamento" className="w-full rounded-md border border-input bg-background p-1" value={basis} onChange={(e) => setBasis(e.target.value)} /></label>
          </div>
          <p className="mt-2">Idade a partir da qual há distorção, por linha (vazio = linha sem indicador):</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{T04_ROWS.map((r) => <label key={r.key} className="flex items-center gap-1">{r.label}<input aria-label={`Idade de distorção ${r.label}`} inputMode="numeric" className="w-12 rounded border border-input bg-background p-0.5" value={th[r.key] ?? ""} onChange={(e) => setTh({ ...th, [r.key]: e.target.value })} /></label>)}</div>
          <Button size="sm" className="mt-2" onClick={() => void saveRule()}>Registrar regra</Button>
        </details>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
