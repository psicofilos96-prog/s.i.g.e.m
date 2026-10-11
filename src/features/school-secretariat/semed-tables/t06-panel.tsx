import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Values } from "./semed-catalog";
import type { T06Apur } from "./semed-export";
import { T06_GAP, t06Divergences } from "./t06-movement";

import { DateInput } from "@/components/sigem/date-input";
const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
type Rule = { version: number; initial_date: string; final_date: string; movement_map: Record<string, string>; standing_map: Record<string, string>; basis: string } | null;
const LABEL: Record<string, string> = { inicial: "Matrícula inicial", recebidos: "Recebidos", transferencia: "Transferência", cancelamento: "Cancelamento", evasao: "Evasão", aprovados: "Aprovados", reprovados: "Reprovados", final: "Matrícula final" };
const br = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");
const parseMap = (s: string) => Object.fromEntries(s.split(/[\n;]+/).map((l) => l.split("=").map((x) => x.trim())).filter((p) => p.length === 2 && p[0] && p[1]));

export function T06Panel({ school, year, network, draft, rows, onApur }: {
  school: string; year: number; network: boolean; draft: Values; rows: readonly { key: string }[]; onApur: (a: T06Apur | null) => void;
}) {
  const [rule, setRule] = useState<Rule>(null); const [apur, setApur] = useState<(T06Apur & { counts?: Record<string, number> }) | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ini, setIni] = useState(""); const [fin, setFin] = useState(""); const [mv, setMv] = useState(""); const [st, setSt] = useState(""); const [basis, setBasis] = useState("");
  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      db.from("semed_t06_rule_versions").select("version, initial_date, final_date, movement_map, standing_map, basis").eq("year", year).order("version", { ascending: false }).limit(1),
      rpc("semed_t06_apuracao", { _school: school, _year: year }),
    ]);
    const ru = ((r.data ?? [])[0] ?? null) as Rule; setRule(ru);
    if (ru) { setIni(ru.initial_date); setFin(ru.final_date); setBasis(ru.basis); setMv(Object.entries(ru.movement_map).map(([k, v]) => `${k}=${v}`).join("\n")); setSt(Object.entries(ru.standing_map).map(([k, v]) => `${k}=${v}`).join("\n")); }
    const ap = a.error ? null : (a.data as T06Apur | null); setApur(ap); onApur(ap);
  }, [school, year, onApur]);
  useEffect(() => { void load(); }, [load]);

  const div = apur ? t06Divergences(draft, rows, apur.totals) : [];
  const saveRule = async () => {
    const r = await rpc("semed_t06_record_rule", { _year: year, _expected_version: rule?.version ?? 0, _initial: ini || null, _final: fin || null, _movement_map: parseMap(mv), _standing_map: parseMap(st), _basis: basis });
    setMsg(r.error ? `Recusado: ${r.error.message.replace(/^.*semed:/, "")}` : `Regra registrada (versão ${r.data as number}).`); if (!r.error) await load();
  };

  return (
    <section className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Apuração por eventos reais (total da escola)</h3>
      <p className="text-xs">Regra: {rule ? <>versão {rule.version} · matrícula inicial em {br(rule.initial_date)} · final em {br(rule.final_date)} · fundamento: {rule.basis}</> : "não registrada — nada é apurado."}</p>
      {apur && (
        <>
          <table className="text-xs"><thead><tr><th scope="col" className="pr-3 text-left">Coluna</th><th scope="col" className="pr-3">Apurado</th></tr></thead>
            <tbody>{Object.keys(LABEL).map((k) => <tr key={k}><td className="pr-3">{LABEL[k]}</td><td className="pr-3 text-center">{apur.totals[k as keyof typeof apur.totals] ?? "não apurado"}</td></tr>)}</tbody></table>
          {apur.counts && Object.keys(apur.counts).length > 0 && <p className="text-xs text-muted-foreground">Matrículas sem data de início: {apur.counts["sem_data_de_inicio"] ?? "—"} · movimentações sem coluna: {apur.counts["movimentacoes_sem_coluna"] ?? "—"} · saídas sem tipo: {apur.counts["saidas_sem_tipo"] ?? "—"} · situações sem fechamento: {apur.counts["situacoes_sem_fechamento"] ?? "—"}.</p>}
          <ul className="list-disc pl-5 text-xs text-muted-foreground">{apur.gaps.map((g) => <li key={g}>{T06_GAP[g] ?? g}</li>)}</ul>
        </>
      )}
      {div.length > 0 && (
        <div role="alert" className="rounded border border-destructive p-2 text-xs">
          Total informado diverge da apuração em: {div.map((d) => `${LABEL[d.col]} (informado ${d.typed ?? "—"}, apurado ${d.computed})`).join("; ")}. O envio será recusado: corrija o rascunho ou registre o evento oficial (matrícula, movimentação, fechamento) que falta.
        </div>
      )}
      <p className="text-xs text-muted-foreground">Evasão nunca é presumida por ausência; aprovados/reprovados só contam após fechamento registrado. Colunas não apuradas seguem preenchidas pela Secretaria.</p>
      {network && (
        <details className="rounded border p-2 text-xs"><summary className="cursor-pointer font-medium">Registrar nova versão da regra (rede)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label>Data da matrícula inicial<br /><DateInput aria-label="Data da matrícula inicial" className="rounded-md border border-input bg-background p-1" value={ini} onChange={(e) => setIni(e.target.value)} /></label>
            <label>Data da matrícula final<br /><DateInput aria-label="Data da matrícula final" className="rounded-md border border-input bg-background p-1" value={fin} onChange={(e) => setFin(e.target.value)} /></label>
            <label>Tipo de movimentação homologado = coluna (transferencia/cancelamento/evasao), um por linha<br /><textarea aria-label="Mapa de movimentações" className="w-full rounded-md border border-input bg-background p-1" rows={3} value={mv} onChange={(e) => setMv(e.target.value)} /></label>
            <label>Situação acadêmica oficial = coluna (aprovados/reprovados), uma por linha<br /><textarea aria-label="Mapa de situações" className="w-full rounded-md border border-input bg-background p-1" rows={3} value={st} onChange={(e) => setSt(e.target.value)} /></label>
            <label className="sm:col-span-2">Fundamento (decisão ou norma)<br /><input aria-label="Fundamento da Tabela 06" className="w-full rounded-md border border-input bg-background p-1" value={basis} onChange={(e) => setBasis(e.target.value)} /></label>
          </div>
          <Button size="sm" className="mt-2" onClick={() => void saveRule()}>Registrar regra</Button>
        </details>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
