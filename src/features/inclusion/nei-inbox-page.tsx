import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { STAGE_LABEL, hasClinicalText, overdue, type ProtocolStage } from "./nei-visits";
import { human, openNeiDocument } from "./nei-agenda-page";

const rpc = supabase.rpc as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const input = "w-full rounded-md border border-input bg-background p-2 text-sm";
const dt = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
type Item = { id: string; number: number; subject: string; school_id: string; sent_at: string; reply_due_on: string | null; last_stage: ProtocolStage; last_seq: number };
type Detail = { id: string; number: number; subject: string; body: string; destination_kind: string; student_name: string | null; is_recipient: boolean; events: { seq: number; stage: ProtocolStage; note: string | null; recorded_at: string }[]; documents: { id: string; file_name: string; object_path: string }[] };

/** Caixa de entrada de protocolos do NEI para quem os recebe (Direção, OP, AEE, docente, Supervisão, família autorizada). */
export function NeiInboxPage() {
  const [items, setItems] = useState<Item[] | null | undefined>(undefined); const [names, setNames] = useState<Map<string, string>>(new Map());
  const [open, setOpen] = useState<Detail | null>(null);
  const load = () => void rpc("nei_protocol_inbox").then((r) => setItems(r.error ? null : (r.data as Item[])));
  useEffect(() => { load(); void readCurrentSchoolNames().then((m) => setNames(new Map(Object.entries(m as unknown as Record<string, string>)))); }, []);
  const show = (id: string) => void rpc("open_nei_protocol", { _protocol: id }).then((r) => setOpen(r.error ? null : (r.data as Detail | null)));
  const today = new Date().toLocaleDateString("sv-SE");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Protocolos recebidos do NEI" description="A lista mostra só número e assunto. O conteúdo abre apenas para quem continua com vínculo vigente, e cada abertura fica registrada." />
      {items === undefined ? <StatePanel title="Carregando…" description="Lendo seus protocolos." /> : items === null ? <EmptyState title="Não foi possível carregar" description="Tente novamente em instantes." /> : items.length === 0 ? (
        <EmptyState title="Nenhum protocolo para você" description="Quando o NEI encaminhar algo à sua conta, aparece aqui." />
      ) : (
        <ul className="space-y-1">{items.map((i) => (
          <li key={i.id}><button className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border p-2 text-left text-sm hover:bg-muted" onClick={() => show(i.id)}>
            <span className="font-mono text-xs">nº {i.number}</span><StatusBadge tone={overdue(i.reply_due_on, i.last_stage !== "enviado" && i.last_stage !== "recebido", today) ? "danger" : "info"}>{STAGE_LABEL[i.last_stage]}</StatusBadge>
            <span>{i.subject}</span><span className="text-xs text-muted-foreground">{names.get(i.school_id) ?? ""} · {dt(i.sent_at)}{i.reply_due_on ? ` · devolutiva até ${dt(i.reply_due_on)}` : ""}</span></button></li>))}</ul>
      )}
      {open ? <DetailView d={open} onSaved={() => { load(); show(open.id); }} /> : null}
    </div>
  );
}

function DetailView({ d, onSaved }: { d: Detail; onSaved: () => void }) {
  const last = d.events[d.events.length - 1]!; const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const act = (stage: "recebido" | "devolutiva") => {
    if (stage === "devolutiva" && note.trim().length < 10) { setMsg("Devolutiva com pelo menos 10 caracteres."); return; }
    if (stage === "devolutiva" && d.destination_kind === "familia" && hasClinicalText(note)) { setMsg("Retire menção clínica da devolutiva."); return; }
    void rpc("record_nei_protocol_event", { _protocol: d.id, _expected_seq: last.seq, _stage: stage, _note: stage === "devolutiva" ? note : null })
      .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setNote(""); setMsg(null); onSaved(); } });
  };
  return (
    <section className="space-y-2 rounded-md border border-border p-3 text-sm">
      <h2 className="font-semibold">Protocolo nº {d.number} — {d.subject}</h2>
      {d.student_name ? <p className="text-xs text-muted-foreground">Estudante: {d.student_name}</p> : null}
      <p className="whitespace-pre-wrap">{d.body}</p>
      {d.documents.length ? <div className="flex flex-wrap gap-2 text-xs">{d.documents.map((x) => <button key={x.id} className="underline" onClick={() => void openNeiDocument(x.object_path)}>{x.file_name}</button>)}</div> : null}
      <ol className="text-xs text-muted-foreground">{d.events.map((e) => <li key={e.seq}>{dt(e.recorded_at)} — {STAGE_LABEL[e.stage]}{e.note ? `: ${e.note}` : ""}</li>)}</ol>
      {d.is_recipient && (last.stage === "enviado" || last.stage === "recebido") ? (
        <div className="space-y-1">
          {last.stage === "enviado" ? <Button size="sm" variant="outline" onClick={() => act("recebido")}>Confirmar recebimento</Button> : null}
          <textarea className={input} rows={2} placeholder="Devolutiva ao NEI" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" onClick={() => act("devolutiva")}>Enviar devolutiva</Button>
        </div>
      ) : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </section>
  );
}
