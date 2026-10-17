import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { PROTECTION_KIND_LABEL, PROTECTION_MESSAGES, protectionDocPath, type ProtectionAlert, type ProtectionKind } from "./protection-model";

const msgOf = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(PROTECTION_MESSAGES).find((x) => m.includes(x));
  return (k && PROTECTION_MESSAGES[k]) || "Não foi possível concluir. Tente de novo.";
};
const d = (s: string | null) => (s ? formatAcademicDateNumeric(s as never) : "sem data final");

type Detail = { seq: number; action: string; kind: ProtectionKind; restricted_person: string | null; valid_from: string; valid_until: string | null; summary: string | null; document_path: string | null; reason: string | null; recorded_at: string };

/** Alerta visível na ficha (quem não pode retirar); conteúdo judicial só ao abrir, com registro de acesso. */
export function ProtectionPanel({ school, student }: { school: string; student: string }) {
  const [alerts, setAlerts] = useState<ProtectionAlert[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = () => callRpc<ProtectionAlert[]>("student_protection_alerts", { _school: school, _student: student }).then((r) => setAlerts(r ?? []), () => setAlerts([]));
  useEffect(() => { void load(); }, [school, student]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!alerts) return null;
  const active = alerts.filter((a) => a.active);
  return (
    <section aria-label="Proteção judicial" className={`rounded-md border p-3 text-sm ${active.length ? "state-danger" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Proteção judicial (sigiloso){active.length ? "" : " — nenhuma restrição vigente"}</p>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>{adding ? "Fechar" : "Registrar medida"}</Button>
      </div>
      {active.map((a) => (
        <p key={a.measure_id} className="mt-1 font-semibold">
          {a.kind === "impedimento-de-retirada" ? `NÃO ENTREGAR o aluno a: ${a.restricted_person}` : PROTECTION_KIND_LABEL[a.kind]}
          {" "}· vigente desde {d(a.valid_from)}{a.valid_until ? ` até ${d(a.valid_until)}` : ""}
        </p>
      ))}
      {adding && <MeasureForm school={school} student={student} onDone={() => { setAdding(false); void load(); }} />}
      {alerts.length > 0 && (
        <ul className="mt-2 space-y-2">{alerts.map((a) => <MeasureItem key={a.measure_id} school={school} student={student} a={a} onDone={load} />)}</ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">O teor da decisão e o documento só aparecem ao clicar em "Ver conteúdo", e cada abertura fica registrada.</p>
    </section>
  );
}

function MeasureItem({ school, student, a, onDone }: { school: string; student: string; a: ProtectionAlert; onDone: () => void }) {
  const [detail, setDetail] = useState<Detail[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const open = async () => { setErr(null); try { setDetail(await callRpc<Detail[]>("student_protection_detail", { _school: school, _measure: a.measure_id })); } catch (e) { setErr(msgOf(e)); } };
  const doc = async (path: string) => {
    const { data, error } = await supabase.storage.from("protecao-judicial").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return setErr("Não foi possível abrir o documento."); window.open(data.signedUrl, "_blank", "noopener");
  };
  const end = async () => {
    setErr(null);
    try { await callRpc("secretariat_record_protection", { _school: school, _student: student, _measure: a.measure_id, _action: "encerrar", _kind: a.kind, _person: a.restricted_person, _from: a.valid_from, _until: null, _summary: null, _document: null, _reason: reason, _expected_seq: a.seq }); onDone(); }
    catch (e) { setErr(msgOf(e)); }
  };
  return (
    <li className="rounded-md border border-border p-2">
      <p>{PROTECTION_KIND_LABEL[a.kind]}{a.restricted_person ? ` · ${a.restricted_person}` : ""} · {d(a.valid_from)} a {d(a.valid_until)} · {a.active ? "vigente" : "encerrada"}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {!detail && <Button size="sm" variant="outline" onClick={() => void open()}>Ver conteúdo</Button>}
        {a.active && <><Input className="h-8 max-w-xs" placeholder="Motivo para encerrar" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="outline" disabled={reason.trim().length < 5} onClick={() => void end()}>Encerrar</Button></>}
      </div>
      {detail && <ol className="mt-2 space-y-1 text-xs">{detail.map((x) => (
        <li key={x.seq}>{x.action} em {formatAcademicDateNumeric(x.recorded_at.slice(0, 10) as never)}{x.summary ? ` — ${x.summary}` : ""}{x.reason ? ` (motivo: ${x.reason})` : ""}
          {x.document_path && <Button size="sm" variant="link" onClick={() => void doc(x.document_path!)}>Abrir documento</Button>}</li>))}</ol>}
      {err && <p className="text-destructive">{err}</p>}
    </li>
  );
}

function MeasureForm({ school, student, onDone }: { school: string; student: string; onDone: () => void }) {
  const [kind, setKind] = useState<ProtectionKind>("impedimento-de-retirada");
  const [person, setPerson] = useState(""); const [from, setFrom] = useState(""); const [until, setUntil] = useState("");
  const [summary, setSummary] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      let path: string | null = null;
      if (file) {
        if (file.type !== "application/pdf" && !file.type.startsWith("image/")) throw new Error("protection:file-type");
        path = protectionDocPath(school, student, crypto.randomUUID(), file.name);
        const up = await supabase.storage.from("protecao-judicial").upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw new Error("protection:upload");
      }
      await callRpc("secretariat_record_protection", { _school: school, _student: student, _measure: null, _action: "registrar", _kind: kind, _person: person, _from: from, _until: until || null, _summary: summary, _document: path, _reason: null, _expected_seq: 0 });
      onDone();
    } catch (e) { setErr(msgOf(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label>Tipo
        <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={kind} onChange={(e) => setKind(e.target.value as ProtectionKind)}>
          {(Object.keys(PROTECTION_KIND_LABEL) as ProtectionKind[]).map((k) => <option key={k} value={k}>{PROTECTION_KIND_LABEL[k]}</option>)}
        </select></label>
      <label>Pessoa impedida de retirar{kind === "impedimento-de-retirada" ? "" : " (se houver)"}<Input className="mt-1" value={person} onChange={(e) => setPerson(e.target.value)} /></label>
      <label>Vale a partir de<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>Vale até (opcional)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      <label className="sm:col-span-2">Resumo da decisão (sigiloso)<Input className="mt-1" value={summary} maxLength={1000} onChange={(e) => setSummary(e.target.value)} /></label>
      <label className="sm:col-span-2">Mandado ou decisão judicial (PDF ou foto)<input className="mt-1 block" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {err && <p className="text-destructive sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2"><Button size="sm" disabled={busy || !from || (kind === "impedimento-de-retirada" && person.trim().length < 3)} onClick={() => void save()}>Salvar medida</Button></div>
    </div>
  );
}
