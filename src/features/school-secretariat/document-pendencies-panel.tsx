import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { StatePanel } from "@/components/sigem/patterns";
import {
  PENDENCY_STATUS_LABEL, groupPendencies, isOverdue, pendencyMessage,
  type Pendency, type PendencyEvent, type PendencyStatus,
} from "./document-pendencies";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (n: string, a: Record<string, unknown>) => (supabase.rpc as any)(n, a) as Promise<{ data: unknown; error: { message: string } | null }>;

export async function readPendencies(school: string): Promise<Pendency[]> {
  const { data, error } = await rpc("student_document_pendencies", { _school: school });
  if (error) throw new Error(error.message);
  return groupPendencies((data ?? []) as PendencyEvent[]);
}
async function record(a: { pendency: string | null; expected: number | null; enrollment: string | null; description: string; status: PendencyStatus; dueOn: string | null; note: string | null }) {
  const { error } = await rpc("record_student_document_pendency", {
    _pendency: a.pendency, _expected_version: a.expected, _enrollment: a.enrollment,
    _description: a.description, _status: a.status, _due_on: a.dueOn, _note: a.note,
  });
  if (error) throw new Error(error.message);
}

export function DocumentPendenciesPanel({ school, student, enrollment, on }: { school: string; student: string; enrollment: string | null; on: string }) {
  const [list, setList] = useState<Pendency[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [desc, setDesc] = useState(""); const [due, setDue] = useState(""); const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const load = () => readPendencies(school).then((l) => setList(l.filter((p) => p.current.student_id === student)), (e) => setErr(pendencyMessage(String(e))));
  useEffect(() => { void load(); }, [school, student]);
  async function run(f: () => Promise<void>, ok: string) {
    setMsg(null);
    try { await f(); setMsg(ok); await load(); } catch (e) { setMsg(pendencyMessage(e instanceof Error ? e.message : String(e))); }
  }
  return (
    <section aria-labelledby="pend-doc" className="space-y-2 rounded-md border border-border p-3 text-sm">
      <h3 id="pend-doc" className="font-medium">Documentos pendentes</h3>
      <p className="text-xs text-muted-foreground">Registro manual da escola. A rede ainda não definiu quais documentos são obrigatórios, então nada aqui é apresentado como exigência legal.</p>
      {err ? <StatePanel tone="warning" title="Pendências indisponíveis" description={err} />
        : list === null ? <p className="text-muted-foreground">Carregando…</p>
        : list.length === 0 ? <p className="text-muted-foreground">Nenhuma pendência registrada para este aluno.</p>
        : <ul className="space-y-2">{list.map((p) => <Item key={p.current.pendency_id} p={p} on={on} run={run} />)}</ul>}
      {enrollment ? (
        <div className="grid gap-2 border-t border-border pt-2 sm:grid-cols-[2fr_1fr]">
          <Input aria-label="Documento" placeholder="Documento (ex.: histórico escolar)" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <DateInput aria-label="Prazo (opcional)" value={due} onChange={(e) => setDue(e.target.value)} />
          <Input className="sm:col-span-2" aria-label="Observação" placeholder="Observação (opcional)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={!desc.trim()}
            onClick={() => run(async () => { await record({ pendency: null, expected: null, enrollment, description: desc.trim(), status: "pendente", dueOn: due || null, note: note.trim() || null }); setDesc(""); setDue(""); setNote(""); }, "Pendência registrada.")}>
            Registrar pendência</Button>
        </div>) : <p className="text-xs text-muted-foreground">Sem matrícula neste ano nesta escola; não é possível abrir pendência.</p>}
      {msg ? <p role="status">{msg}</p> : null}
    </section>
  );
}

function Item({ p, on, run }: { p: Pendency; on: string; run: (f: () => Promise<void>, ok: string) => Promise<void> }) {
  const c = p.current; const [open, setOpen] = useState(false);
  const move = (status: PendencyStatus) => run(() => record({ pendency: c.pendency_id, expected: c.version, enrollment: null, description: c.description, status, dueOn: c.due_on, note: c.note }), `Marcado como ${PENDENCY_STATUS_LABEL[status].toLowerCase()}.`);
  return (
    <li className="rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><span className="font-medium">{c.description}</span> · {PENDENCY_STATUS_LABEL[c.status]}
          {c.due_on ? ` · prazo ${c.due_on}` : ""}{isOverdue(p, on) ? " · prazo passou" : ""}</span>
        <span className="flex flex-wrap gap-1">
          {c.status !== "recebido" ? <Button size="sm" onClick={() => move("recebido")}>Recebido</Button> : null}
          {c.status !== "invalido" ? <Button size="sm" variant="outline" onClick={() => move("invalido")}>Inválido</Button> : null}
          {c.status !== "pendente" ? <Button size="sm" variant="outline" onClick={() => move("pendente")}>Reabrir</Button> : null}
          {c.status !== "dispensado" ? <Button size="sm" variant="ghost" onClick={() => move("dispensado")}>Dispensar</Button> : null}
        </span>
      </div>
      {c.note ? <p className="text-xs text-muted-foreground">{c.note}</p> : null}
      <button type="button" className="text-xs underline" aria-expanded={open} onClick={() => setOpen(!open)}>Histórico ({p.history.length})</button>
      {open ? <ol className="text-xs text-muted-foreground">{p.history.map((h) => <li key={h.version}>{h.recorded_at.slice(0, 10)} · {PENDENCY_STATUS_LABEL[h.status]}</li>)}</ol> : null}
    </li>
  );
}
