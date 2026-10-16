import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { semedXlsx, semedPdf, type DocMeta } from "./semed-export";
import type { TableDef } from "./semed-catalog";
import { PENDING_LABEL, consolidate, networkBlocks, pendingState, schoolBlocks, statusText, type RecCheck, type RecEvent, type RecSchool } from "./reconciliation-model";

/** Conciliação CIECE: verificações da escola (mesma data e escopo), pendências com justificativa e painel da rede. */
const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
const DOC: TableDef = { code: "REC", title: "CONCILIAÇÃO DAS TABELAS SEMED", landscape: true, sections: [] } as unknown as TableDef;
const download = (b: Blob, n: string) => { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); };
const ERR: Record<string, string> = { "motivo-obrigatorio": "Justificativa obrigatória (mín. 5 caracteres).", "base-desatualizada": "Os valores ou a trilha mudaram. Recarregue.", "rec-sem-divergencia": "Só divergência pode ter pendência aberta, retornada ou aprovada.", "sem-permissao": "Sem permissão para este ato." };

export function SemedReconciliation({ school, schoolName, year, network, canAct }: { school: string; schoolName: string; year: number; network: boolean; canAct: boolean }) {
  const [checks, setChecks] = useState<RecCheck[] | null>(null); const [events, setEvents] = useState<RecEvent[]>([]); const [net, setNet] = useState<RecSchool[] | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({}); const [msg, setMsg] = useState<string | null>(null); const [by, setBy] = useState<"zona" | "tipo" | "escola">("zona");
  const load = useCallback(async () => {
    const [c, e] = await Promise.all([rpc("semed_reconciliation_at", { _school: school, _year: year }), db.from("semed_reconciliation_events").select("school_id, check_key, fingerprint, seq, act, reason, actor_scope, created_at").eq("school_id", school).eq("year", year).order("seq")]);
    setChecks(c.error ? [] : ((c.data ?? []) as RecCheck[])); setEvents((e.data ?? []) as RecEvent[]);
  }, [school, year]);
  useEffect(() => { void load(); }, [load]);
  const loadNet = async () => { const r = await rpc("semed_reconciliation_network", { _year: year }); if (r.error) setMsg("Não foi possível consolidar a rede."); else setNet(r.data as RecSchool[]); };

  const act = async (c: RecCheck, a: RecEvent["act"]) => {
    const last = events.filter((e) => e.check_key === c.key).at(-1)?.seq ?? 0;
    const r = await rpc("semed_reconciliation_act", { _school: school, _year: year, _check: c.key, _fingerprint: c.fingerprint, _act: a, _reason: reason[c.key] ?? "", _expected_seq: last });
    if (r.error) { const k = r.error.message.replace(/^.*semed:/, ""); setMsg(ERR[k] ?? "Recusado."); return; }
    setMsg("Ato registrado na trilha."); setReason((x) => ({ ...x, [c.key]: "" })); await load();
  };
  const meta = (title: string): DocMeta => ({ year, tableCode: "REC", title, school: schoolName, inep: "", state: "conciliação (leitura derivada)", version: 1, generatedAt: new Date() });
  const self: RecSchool = { school_id: school, name: schoolName, zona: null, tipo: null, checks: checks ?? [] };
  const exp = async (kind: "pdf" | "xlsx", scope: "escola" | "rede") => {
    const b = scope === "rede" && net ? networkBlocks(net) : schoolBlocks(self, events);
    const m = meta(scope === "rede" ? "CONSOLIDAÇÃO DA REDE" : "CONCILIAÇÃO DA ESCOLA");
    if (kind === "pdf") download(await semedPdf(DOC, b, m), `conciliacao-${scope}-${year}.pdf`); else download(new Blob([await semedXlsx(b, m)]), `conciliacao-${scope}-${year}.xlsx`);
  };

  if (checks === null) return <p className="text-xs text-muted-foreground" role="status">Conciliando…</p>;
  const cons = net ? consolidate(net, by) : [];
  const maxN = Math.max(1, ...cons.map((c) => c.confere + c.divergente + c["nao-comparavel"] + c["sem-dado"]));
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="Conciliação CIECE">
      <h3 className="text-sm font-semibold">Conciliação CIECE — {schoolName}</h3>
      <p className="text-xs text-muted-foreground">Só se comparam fontes com a mesma data de referência e a mesma escola. Divergência nunca é apagada: corrige-se na fonte (tabela, cadastro ou mapa) ou a rede aprova com justificativa; se os valores mudarem, a pendência reabre.</p>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th scope="col" className="text-left">Verificação</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Situação</th><th scope="col">Pendência</th><th scope="col" className="text-left">Origem</th>{canAct && <th scope="col">Ato</th>}</tr></thead>
        <tbody>{checks.map((c) => { const ps = pendingState(c, events); return <tr key={c.key} className="border-t align-top" data-testid="rec-check">
          <td>{c.label}</td><td className="text-center">{c.a ?? "—"}{c.date_a ? <div className="text-muted-foreground">{c.date_a}</div> : null}</td><td className="text-center">{c.b ?? "—"}{c.date_b ? <div className="text-muted-foreground">{c.date_b}</div> : null}</td>
          <td className={c.status === "divergente" ? "font-semibold text-destructive" : ""}>{statusText(c.status)}</td><td>{PENDING_LABEL[ps]}</td>
          <td className="text-muted-foreground">{c.sources.map((s) => Object.entries(s).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (k === "fonte" ? String(v) : `${k} ${v}`)).join(" ")).join(" · ")}</td>
          {canAct && <td>{c.status === "divergente" && <div className="flex min-w-56 flex-col gap-1">
            <input aria-label={`Justificativa ${c.key}`} className="rounded border border-input bg-background p-1" placeholder="Justificativa" value={reason[c.key] ?? ""} onChange={(e) => setReason((x) => ({ ...x, [c.key]: e.target.value }))} />
            <div className="flex flex-wrap gap-1">{(ps === "sem-pendencia" || ps === "reaberta") && <Button size="sm" variant="outline" onClick={() => void act(c, "abrir")}>Abrir pendência</Button>}
              {network && <><Button size="sm" variant="outline" onClick={() => void act(c, "retornar")}>Retornar à escola</Button><Button size="sm" variant="outline" onClick={() => void act(c, "aprovar")}>Aprovar com justificativa</Button></>}</div>
          </div>}</td>}
        </tr>; })}</tbody></table></div>
      {events.length > 0 && <details><summary className="cursor-pointer text-xs">Trilha de atos ({events.length})</summary><ol className="text-xs">{events.map((e) => <li key={`${e.check_key}-${e.seq}`}>{new Date(e.created_at).toLocaleString("pt-BR")} · {checks.find((c) => c.key === e.check_key)?.label ?? e.check_key} · #{e.seq} {e.act} ({e.actor_scope}) · {humanizeForScreen(e.reason)}</li>)}</ol></details>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void exp("pdf", "escola")}>PDF da conciliação</Button><Button size="sm" variant="outline" onClick={() => void exp("xlsx", "escola")}>XLSX da conciliação</Button>
        {network && <Button size="sm" onClick={() => void loadNet()}>Consolidar rede</Button>}</div>
      {net && <div className="space-y-2 rounded border p-2" aria-label="Painel CIECE">
        <div className="flex flex-wrap items-center gap-2 text-xs"><strong>Painel da rede ({net.length} escolas)</strong>
          {(["zona", "tipo", "escola"] as const).map((b) => <Button key={b} size="sm" variant={b === by ? "default" : "outline"} onClick={() => setBy(b)}>por {b}</Button>)}
          <Button size="sm" variant="outline" onClick={() => void exp("pdf", "rede")}>PDF da rede</Button><Button size="sm" variant="outline" onClick={() => void exp("xlsx", "rede")}>XLSX da rede</Button></div>
        <div role="img" aria-label="Gráfico de verificações por situação" className="max-h-96 space-y-1 overflow-auto">{cons.map((c) => <div key={c.group} className="flex items-center gap-2 text-xs">
          <span className="w-48 truncate" title={c.group}>{c.group}</span>
          <div className="flex h-3 flex-1 overflow-hidden rounded bg-muted">{(["confere", "divergente", "nao-comparavel", "sem-dado"] as const).map((k) => <div key={k} title={`${k}: ${c[k]}`} style={{ width: `${(c[k] / maxN) * 100}%` }} className={k === "confere" ? "bg-primary" : k === "divergente" ? "bg-destructive" : k === "sem-dado" ? "bg-accent" : "bg-muted-foreground/40"} />)}</div>
        </div>)}</div>
        <p className="text-xs text-muted-foreground">Legenda: confere · divergente · não comparável · sem dado. Tabela equivalente abaixo; etapa não é consolidada porque as turmas não têm ano/etapa registrados.</p>
        <table className="w-full text-xs"><thead><tr><th scope="col" className="text-left">Grupo</th><th scope="col">Escolas</th><th scope="col">Confere</th><th scope="col">Divergente</th><th scope="col">Não comparável</th><th scope="col">Sem dado</th></tr></thead>
          <tbody>{cons.map((c) => <tr key={c.group} className="border-t"><td>{c.group}</td><td className="text-center">{c.schools}</td><td className="text-center">{c.confere}</td><td className="text-center">{c.divergente}</td><td className="text-center">{c["nao-comparavel"]}</td><td className="text-center">{c["sem-dado"]}</td></tr>)}</tbody></table>
      </div>}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </section>
  );
}
