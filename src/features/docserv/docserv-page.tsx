import { CpfInput } from "@/components/sigem/cpf-input";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentsPanel } from "./documents-panel";
import { MyDocuments } from "./my-documents";
import { SchoolDocsPanel } from "./school-panel";
import { NetworkPanel } from "./network-panel";
import { API_PORT_STATUS, OUTCOME_LABEL, availablePanels, cpfDigits, needsManualDecision, type DocservContext, type QueueItem } from "./docserv-model";

import { LoadingState } from "@/components/sigem/states";
const field = "h-8 rounded-md border bg-background px-2 text-sm";

export function DocservPage() {
  const [ctx, setCtx] = useState<DocservContext | "error" | null>(null);
  useEffect(() => { void supabase.rpc("docserv_context").then((r) => setCtx(r.error ? "error" : (r.data as unknown as DocservContext))); }, []);
  if (ctx === null) return <LoadingState label="Carregando…" />;
  if (ctx === "error") return <p className="p-4 text-sm text-destructive">Não foi possível ler suas permissões no DocServ.</p>;
  const panels = availablePanels(ctx);
  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold">DocServ — documentos funcionais</h1>
        <p className="text-xs text-muted-foreground">Módulo do SIGEM: mesmo login, mesmas pessoas e escolas. O acesso vem das suas permissões, não de um perfil separado.</p>
      </header>
      {panels.length === 0 && <p className="rounded-md border p-3 text-sm">Sua conta ainda não tem acesso ao DocServ. Servidores precisam de pessoa vinculada à conta; escolas e rede precisam de permissão documental atribuída.</p>}
      {panels.includes("servidor") && <section className="rounded-md border p-3"><h2 className="text-sm font-semibold">Meus documentos</h2>{ctx.person_id && <MyDocuments person={ctx.person_id} />}</section>}
      {panels.includes("escola") && <section className="rounded-md border p-3"><h2 className="text-sm font-semibold">Documentos da escola</h2>{ctx.escola_schools.map((s) => <SchoolDocsPanel key={s} school={s} />)}</section>}
      {panels.includes("rede") && <><section className="rounded-md border p-3"><h2 className="text-sm font-semibold">Painel central da rede (núcleo documental)</h2><NetworkPanel /></section><IdentityConsole /></>}
      <section className="rounded-md border p-3">
        <h2 className="text-sm font-semibold">Situação da portabilidade</h2>
        <ul className="mt-1 text-xs">{API_PORT_STATUS.map((a) => <li key={a.route}>{a.status === "portado" ? "✔" : "…"} {a.route} — {a.status === "portado" ? "disponível" : `pendente (${a.lote})`}</li>)}</ul>
      </section>
    </div>
  );
}

function IdentityConsole() {
  const [kind, setKind] = useState<"servidor" | "escola">("servidor");
  const [mat, setMat] = useState(""); const [cpf, setCpf] = useState(""); const [inep, setInep] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => { const r = await supabase.rpc("docserv_identity_queue", { _limit: 100 }); setQueue(r.error ? [] : (r.data as unknown as QueueItem[])); }, []);
  useEffect(() => { void load(); }, [load]);
  const resolve = async () => {
    const d = cpf ? cpfDigits(cpf) : null;
    if (cpf && !d) { setMsg("CPF precisa ter 11 dígitos."); return; }
    const r = await supabase.rpc("docserv_resolve_identity", { _kind: kind, _matricula: mat || null, _cpf: d, _inep: inep || null, _commit: true } as never);
    setCpf("");
    if (r.error) { setMsg(r.error.message.includes("identifier") ? "Informe ao menos um identificador." : "Não foi possível resolver."); return; }
    const o = (r.data as { outcome: keyof typeof OUTCOME_LABEL }).outcome; setMsg(`Resultado: ${OUTCOME_LABEL[o]}.`); void load();
  };
  const decide = async (q: QueueItem, choice: string | null) => {
    const r = await supabase.rpc("docserv_decide_identity", { _key: q.key, _choice: choice, _reason: reason, _expected_seq: q.seq } as never);
    setMsg(r.error ? (r.error.message.includes("reason") ? "Informe o motivo (mín. 5 caracteres)." : r.error.message.includes("stale") ? "Outra pessoa decidiu antes; recarregado." : "Não foi possível registrar.") : "Decisão registrada.");
    if (!r.error) setReason(""); void load();
  };
  return (
    <section className="rounded-md border p-3" aria-label="Identidade DocServ">
      <h2 className="text-sm font-semibold">Correspondência de identidade (rede)</h2>
      <p className="mb-2 text-xs text-muted-foreground">Liga matrícula, CPF ou INEP do DocServ à pessoa/escola já cadastrada no SIGEM. O CPF não é guardado: vira código protegido. Nenhuma pessoa é criada; casos ambíguos aguardam sua decisão.</p>
      <div className="flex flex-wrap items-end gap-2">
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value as "servidor" | "escola")} aria-label="Tipo"><option value="servidor">Servidor</option><option value="escola">Escola</option></select>
        {kind === "servidor" && <input className={field} placeholder="Matrícula" value={mat} onChange={(e) => setMat(e.target.value)} />}
        {kind === "servidor" && <CpfInput aria-label="CPF" className={field} value={cpf} onChange={setCpf} />}
        <input className={field} placeholder="INEP" value={inep} onChange={(e) => setInep(e.target.value)} />
        <Button size="sm" onClick={() => void resolve()}>Resolver</Button>
      </div>
      {msg && <p className="mt-2 text-xs" role="status">{msg}</p>}
      <input className={`${field} mt-2 w-full`} placeholder="Motivo da decisão manual" value={reason} onChange={(e) => setReason(e.target.value)} />
      {queue === null ? <LoadingState label="Carregando…" /> : queue.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nenhuma correspondência registrada.</p> : (
        <ul className="mt-2 space-y-1 text-xs">{queue.map((q) => (
          <li key={q.key} className="rounded border p-2">
            {q.kind} · {OUTCOME_LABEL[q.outcome]}{q.manual ? " (manual)" : ""} · {q.matricula ? `matrícula ${q.matricula} · ` : ""}{q.cpf ? "CPF informado · " : ""}{q.inep ? `INEP ${q.inep}` : ""}
            {needsManualDecision(q) && <div className="mt-1 flex flex-wrap gap-1">{q.candidates.map((c, i) => {
              const id = c.person_id ?? c.school_id ?? ""; return <Button key={id + i} size="sm" variant="outline" onClick={() => void decide(q, id)}>Escolher {q.masked_names?.[i] ?? id.slice(0, 8)}{c.via ? ` (${c.via})` : ""}</Button>;
            })}<Button size="sm" variant="ghost" onClick={() => void decide(q, null)}>Descartar</Button></div>}
          </li>))}</ul>)}
    </section>
  );
}
