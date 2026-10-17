import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { checkUpload } from "@/features/privacy/file-guard";
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
  const [files, setFiles] = useState<Record<string, string[]>>({});
  async function load() {
    const att = await supabase.from("student_absence_justification_attachments").select("justification_id,object_path").eq("school_id", school);
    const m: Record<string, string[]> = {};
    for (const a of att.data ?? []) (m[a.justification_id] ??= []).push(a.object_path);
    setFiles(m);
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
  const attach = async (j: Justification, file: File) => {
    setMsg(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const c = checkUpload(bytes, file.type, ["image/jpeg", "image/png", "image/webp", "application/pdf"], 10 * 1024 * 1024);
    if (!c.ok) { setMsg(c.reason === "grande-demais" ? "O arquivo passa de 10 MB." : "Envie uma foto (JPG, PNG) ou um PDF."); return; }
    const ext = c.mime === "application/pdf" ? "pdf" : c.mime.split("/")[1];
    const path = `${school}/${j.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("atestados").upload(path, bytes, { contentType: c.mime });
    if (up.error) { setMsg("Não foi possível enviar o arquivo. Tente de novo."); return; }
    try { await callRpc("secretariat_attach_absence_justification", { _justification: j.id, _path: path, _mime: c.mime }); void load(); }
    catch (e) { setMsg(msgOf(e)); }
  };
  const view = async (path: string) => {
    const { data } = await supabase.storage.from("atestados").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else setMsg("Não foi possível abrir o arquivo.");
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(files[j.id] ?? []).map((p, i) => <Button key={p} size="sm" variant="ghost" onClick={() => void view(p)}>Ver arquivo {i + 1}</Button>)}
              {!j.voided && <label className="cursor-pointer text-primary underline-offset-4 hover:underline">Anexar foto ou PDF
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ""; if (fl) void attach(j, fl); }} /></label>}
            </div>
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
