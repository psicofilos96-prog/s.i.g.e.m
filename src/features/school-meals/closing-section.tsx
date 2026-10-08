import { callRpc } from "@/lib/rpc-call";
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { CHECKLIST_AREAS, CHECKLIST_LABEL, CODE_TEXT, checklistComplete, checklistState, isCompetenceEnded, opsMessage, type ChecklistRow } from "./operations-l3-model";
import { formatDateTime, operationalToday, shiftMonthKey, operationalMonthKey } from "@/lib/academic-date";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = callRpc;
interface Closing { id: string; competence: string; version: number; closing_on: string; manifest_sha256: string; recorded_at: string; reason: string | null; movement_ids: string[] }
const STATE_TEXT = { AVAILABLE: "Registrado", ZERO: "Nenhum (zero registrado)", PENDING: "Pendente", UNKNOWN: "Desconhecido", BLOCKED: "Bloqueado" } as const;
const prevMonth = () => shiftMonthKey(operationalMonthKey(), -1);

/** Checklist da competência: só lê fatos. Fechar não apaga nem impede retificação; reemissão é nova versão com motivo. */
export function ClosingSection({ school }: { school: string }) {
  const [competence, setCompetence] = useState(prevMonth());
  const [rows, setRows] = useState<ChecklistRow[] | null>(null); const [closings, setClosings] = useState<Closing[]>([]);
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState(""); const busy = useRef(false); const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      setRows(await call<ChecklistRow[]>("meal_competence_checklist_at", { _school: school, _competence: competence }));
      setClosings((await call<Closing[]>("meal_stock_closings_at", { _school: school })).filter((c) => c.competence === competence)); setErr(null);
    } catch (e) { setErr(opsMessage((e as Error).message)); setRows(null); }
  }, [school, competence]);
  useEffect(() => { void load(); }, [load]);
  const head = closings[0];
  const ended = isCompetenceEnded(competence, operationalToday());
  const close = async () => {
    if (busy.current) return; busy.current = true; setPending(true);
    try { await call("record_meal_stock_closing", { _school: school, _competence: competence, _expected_version: head?.version ?? null, _reason: head ? reason : null }); setMsg(head ? "Nova versão do fechamento emitida." : "Fechamento registrado."); setReason(""); void load(); }
    catch (e) { setMsg(opsMessage((e as Error).message)); }
    finally { busy.current = false; setPending(false); }
  };
  return (
    <section aria-labelledby="fech" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="fech" className="font-semibold">Fechamento da competência</h2>
      <label className="block max-w-xs">Competência<input type="month" className="mt-1 block w-full rounded border bg-background p-2" value={competence} onChange={(e) => setCompetence(e.target.value)} /></label>
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} /> : !rows ? <SkeletonState label="Carregando" /> : (<>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Checklist">{CHECKLIST_AREAS.map((a) => { const r = rows.find((x) => x.area === a); const s = r ? checklistState(r) : "UNKNOWN"; return (
          <li key={a} className={`rounded border p-2 ${s === "PENDING" || s === "BLOCKED" ? "border-warning" : ""}`}>
            <div className="font-medium">{CHECKLIST_LABEL[a]}</div>
            <div>{STATE_TEXT[s]}{r?.amount != null && s !== "UNKNOWN" && a !== "fechamento" ? ` · ${r.amount}` : ""}</div>
            {r?.code && <p className="text-muted-foreground">{CODE_TEXT[r.code] ?? (a === "fechamento" ? `Manifesto ${r.code.slice(0, 12)}…` : r.code)}</p>}
          </li>); })}</ul>
        <StatePanel tone={checklistComplete(rows) ? "success" : "info"} title={checklistComplete(rows) ? "Todas as áreas com registro" : "Competência com pendências ou desconhecidos"}
          description="O sistema não conclui por ausência de registro. Fechar não apaga nada e não impede retificação posterior." />
        {!ended ? <StatePanel tone="warning" title="Mês em andamento" description={CODE_TEXT["COMPETENCE_NOT_ENDED"]!} /> : (
          <fieldset className="space-y-2"><legend className="font-medium">{head ? "Reemitir fechamento (nova versão)" : "Fechar estoque do mês"}</legend>
            {head && <label className="block">Motivo da nova versão<input className="mt-1 block w-full rounded border bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
            <button type="button" disabled={pending || (!!head && !reason.trim())} onClick={close} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{pending ? "Enviando…" : head ? "Emitir nova versão" : "Fechar"}</button>
          </fieldset>)}
        {closings.length > 0 && <ol aria-label="Versões do fechamento" className="divide-y rounded border">{closings.map((c) => (
          <li key={c.id} className="p-2">Versão {c.version} · {formatDateTime(c.recorded_at)} · {c.movement_ids.length} movimento(s) · manifesto <code>{c.manifest_sha256.slice(0, 16)}…</code>{c.reason ? ` · motivo: ${c.reason}` : ""}</li>))}</ol>}
      </>)}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
