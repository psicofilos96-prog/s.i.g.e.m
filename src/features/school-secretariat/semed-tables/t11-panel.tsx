import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Values } from "./semed-catalog";
import { T11_GAP, t11Compare, type T11Apur } from "./t11-gender";

const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
type Rule = { version: number; cutoff_date: string; sex_map: Record<string, string>; basis: string } | null;
const parseMap = (s: string) => Object.fromEntries(s.split(/[\n;]+/).map((l) => l.split("=").map((x) => x.trim())).filter((p) => p.length === 2 && p[0] && p[1]));

export function T11Panel({ school, year, network, draft, rows, onApur }: { school: string; year: number; network: boolean; draft: Values; rows: readonly { key: string }[]; onApur: (a: T11Apur | null) => void }) {
  const [rule, setRule] = useState<Rule>(null); const [apur, setApur] = useState<T11Apur | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [cut, setCut] = useState(""); const [map, setMap] = useState(""); const [basis, setBasis] = useState("");
  const load = useCallback(async () => {
    const [r, a] = await Promise.all([db.from("semed_t11_rule_versions").select("version, cutoff_date, sex_map, basis").eq("year", year).order("version", { ascending: false }).limit(1), rpc("semed_t11_apuracao", { _school: school, _year: year })]);
    const ru = ((r.data ?? [])[0] ?? null) as Rule; setRule(ru);
    if (ru) { setCut(ru.cutoff_date); setBasis(ru.basis); setMap(Object.entries(ru.sex_map).map(([k, v]) => `${k}=${v}`).join("\n")); }
    const ap = a.error ? null : (a.data as T11Apur | null); setApur(ap); onApur(ap);
  }, [school, year, onApur]);
  useEffect(() => { void load(); }, [load]);
  const saveRule = async () => {
    const r = await rpc("semed_t11_record_rule", { _year: year, _expected_version: rule?.version ?? 0, _cutoff: cut || null, _sex_map: parseMap(map), _basis: basis });
    setMsg(r.error ? `Recusado: ${r.error.message.replace(/^.*semed:/, "")}` : `Regra registrada (versão ${r.data as number}).`); if (!r.error) await load();
  };
  const t = apur?.totals ?? {};
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="Apuração por gênero">
      <h3 className="text-sm font-semibold">Apuração pelo cadastro (total da escola)</h3>
      <p className="text-xs text-muted-foreground">Gênero vem só do sexo registrado no cadastro do estudante; nunca é deduzido do nome. A zona vem do cadastro da escola.</p>
      {!rule ? <p className="text-sm">Regra da rede não registrada: sem data de corte, nada é apurado.</p> : <p className="text-xs">Regra v{rule.version} · data de corte {new Date(rule.cutoff_date + "T12:00").toLocaleDateString("pt-BR")} · {rule.basis}</p>}
      {apur?.rule_version && <ul className="text-xs"><li>Matrícula válida na data de corte: {t.total ?? "—"}</li><li>Masculino: {t.masc ?? "—"} · Feminino: {t.fem ?? "—"}</li>
        <li>Sexo não informado: {t.nao_informado ?? "—"} · fora de Masculino/Feminino: {t.fora_do_mapa ?? "—"} · matrículas sem data de início: {t.sem_data ?? "—"}</li></ul>}
      <table className="text-xs"><thead><tr><th className="text-left">Coluna</th><th className="px-2">Informado</th><th className="px-2">Apurado</th><th>Situação</th></tr></thead>
        <tbody>{t11Compare(draft, rows, apur).map((c) => <tr key={c.col}><td>{c.label}</td><td className="text-center">{c.typed ?? "—"}</td><td className="text-center">{c.apurado ?? "—"}</td><td className={c.status === "divergente" ? "font-semibold text-destructive" : ""}>{c.status}</td></tr>)}</tbody></table>
      {apur?.gaps.length ? <ul className="list-disc pl-4 text-xs text-muted-foreground">{apur.gaps.map((g) => <li key={g}>{T11_GAP[g] ?? g}</li>)}</ul> : null}
      {network && <div className="grid gap-2 rounded border p-2 text-xs sm:grid-cols-3">
        <label>Data de corte<br /><input type="date" aria-label="Data de corte" className="rounded border border-input bg-background p-1" value={cut} onChange={(e) => setCut(e.target.value)} /></label>
        <label className="sm:col-span-2">Mapa do cadastro (esquema/valor=masc|fem, um por linha)<br /><textarea aria-label="Mapa do sexo" className="w-full rounded border border-input bg-background p-1" rows={2} value={map} onChange={(e) => setMap(e.target.value)} /></label>
        <label className="sm:col-span-3">Fundamento<br /><input aria-label="Fundamento" className="w-full rounded border border-input bg-background p-1" value={basis} onChange={(e) => setBasis(e.target.value)} /></label>
        <div><Button size="sm" onClick={() => void saveRule()}>Registrar nova versão da regra</Button></div>
      </div>}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </section>
  );
}
