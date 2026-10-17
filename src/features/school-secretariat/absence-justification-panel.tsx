import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { JUSTIFICATION_KINDS, JUSTIFICATION_MESSAGES, kindLabel, projectJustifications, type Justification, type JustificationEvent } from "./absence-justification";

const d = (s: string) => formatAcademicDateNumeric(s as never);
const msgOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(JUSTIFICATION_MESSAGES).find((x) => m.includes(x));
  return (k && JUSTIFICATION_MESSAGES[k]) || "Não foi possível registrar. Tente de novo.";
};

/** Atestados e justificativas na ficha do aluno. Não muda a chamada do professor: só registra o período amparado. */
export function AbsenceJustificationPanel({ school, student }: { school: string; student: string }) {
  const [list, setList] = useState<Justification[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "", starts: "", ends: "", issuer: "", registry: "", by: "", on: "", note: "" });
  const [msg, setMsg] = useState<string | null>(null);
  async function load() {
    const { data, error } = await supabase.from("student_absence_justification_events")
      .select("justification_id,act,doc_kind,starts_on,ends_on,issuer_name,issuer_registry,delivered_by,delivered_on,reason,recorded_at")
      .eq("school_id", school).eq("student_id", student);
    setList(error ? [] : projectJustifications((data ?? []) as JustificationEvent[]));
  }
  useEffect(() => { void load(); }, [school, student]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list) return null;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setMsg(null);
    try {
      await callRpc("secretariat_record_absence_justification", { _school: school, _student: student, _kind: f.kind, _starts: f.starts, _ends: f.ends, _issuer: f.issuer, _registry: f.registry || null, _delivered_by: f.by || null, _delivered_on: f.on, _note: f.note || null });
      setOpen(false); setF({ kind: "", starts: "", ends: "", issuer: "", registry: "", by: "", on: "", note: "" }); void load();
    } catch (e) { setMsg(msgOf(e)); }
  };
  const voidIt = async (j: Justification) => {
    const reason = window.prompt("Por que anular este atestado? (o registro continua no histórico)");
    if (!reason) return;
    try { await callRpc("secretariat_void_absence_justification", { _justification: j.id, _reason: reason }); void load(); }
    catch (e) { setMsg(msgOf(e)); }
  };
  const ready = f.kind && f.starts && f.ends && f.on && f.issuer.trim().length >= 3;
  return (
    <details className="rounded-md border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Atestados e justificativas de faltas ({list.filter((j) => !j.voided).length})</summary>
      <div className="mt-2 space-y-2">
        {list.length === 0 && <p className="text-muted-foreground">Nenhum atestado registrado.</p>}
        <ul className="space-y-2">{list.map((j) => (
          <li key={j.id} className={`rounded-md border border-border p-2 ${j.voided ? "text-muted-foreground line-through" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><b>{kindLabel(j.kind)}</b> · {d(j.startsOn)} a {d(j.endsOn)} ({j.days} {j.days === 1 ? "dia" : "dias"}) · {j.issuer}{j.registry ? ` (${j.registry})` : ""} · entregue em {d(j.deliveredOn)}</span>
              {!j.voided && <Button size="sm" variant="outline" onClick={() => void voidIt(j)}>Anular</Button>}
            </div>
            {j.voided && <p className="no-underline">Anulado: {j.voidReason}</p>}
          </li>))}</ul>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Registrar atestado"}</Button>
        {open && (
          <div className="grid gap-2 sm:grid-cols-4">
            <label>Tipo
              <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={f.kind} onChange={set("kind")}>
                <option value="">Escolha</option>
                {JUSTIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select></label>
            <label>Primeiro dia<DateInput value={f.starts} onChange={set("starts")} /></label>
            <label>Último dia<DateInput value={f.ends} onChange={set("ends")} /></label>
            <label>Entregue em<DateInput value={f.on} onChange={set("on")} /></label>
            <label>Quem emitiu<Input className="mt-1" value={f.issuer} onChange={set("issuer")} placeholder="Nome do profissional ou órgão" /></label>
            <label>Registro (CRM/CRO)<Input className="mt-1" value={f.registry} maxLength={60} onChange={set("registry")} /></label>
            <label>Quem entregou<Input className="mt-1" value={f.by} onChange={set("by")} /></label>
            <label>Observação<Input className="mt-1" value={f.note} maxLength={500} onChange={set("note")} /></label>
            <div className="sm:col-span-4"><Button size="sm" disabled={!ready} onClick={() => void save()}>Salvar atestado</Button></div>
          </div>)}
        {msg && <p role="status" className="text-destructive">{msg}</p>}
        <p className="text-xs text-muted-foreground">O código da doença (CID) não é guardado. A chamada do professor não é alterada: o atestado fica registrado como amparo das faltas do período.</p>
      </div>
    </details>
  );
}
