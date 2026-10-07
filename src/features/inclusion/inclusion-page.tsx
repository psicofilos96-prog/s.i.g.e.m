import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { TermReviewPanel } from "./term-review-panel";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { schoolsInScope } from "@/features/school-followup/followup-source";
import { CREATABLE_RECORD_TYPES, RECORD_TYPES, clinicalWarning, inclusionMessage, isActiveOn, minimizedExport, toCsv, type InclusionRecord, type Mediation, type RecordType } from "./inclusion-model";
import { AeeSection, MyMediatedStudents, NetworkOverview } from "./aee-sections";
import { openInclusionAttachment, uploadInclusionAttachment } from "./inclusion-attachments.functions";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await rpc(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
const today = () => new Date().toISOString().slice(0, 10);
const br = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "sem término");
const field = "mt-1 block w-full rounded border bg-background p-2";

export function InclusionPage() {
  const [schools, setSchools] = useState<string[] | null>(null);
  const [school, setSchool] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { schoolsInScope().then((s) => { setSchools(s); if (s.length === 1) setSchool(s[0]!); }, (e: Error) => setErr(inclusionMessage(e.message))); }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Inclusão — apoio educacional, AEE e mediação" description="Registros pedagógicos com finalidade educacional. Não é prontuário: diagnóstico não é exigido nem registrado aqui." />
      <MyMediatedStudents />
      <NetworkOverview />
      <TermReviewPanel />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !schools ? <SkeletonState label="Carregando" />
        : schools.length === 0 ? <EmptyState title="Nenhuma escola no seu alcance" description="Sua atuação não tem permissão vigente com alcance de escola para inclusão." />
        : <>
            <label className="block max-w-sm text-sm">Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">Escolha…</option>{schools.map((s) => <option key={s}>{s}</option>)}</select></label>
            {school && <School key={school} school={school} />}
          </>}
    </div>
  );
}

function School({ school }: { school: string }) {
  const [meds, setMeds] = useState<Mediation[] | null>(null);
  const [student, setStudent] = useState("");
  const [open, setOpen] = useState("");
  const loadMeds = useCallback(() => call<Mediation[]>("inclusion_mediations_at", { _school: school, _known_at: null }).then(setMeds, () => setMeds([])), [school]);
  useEffect(() => { void loadMeds(); }, [loadMeds]);
  return (
    <div className="space-y-6">
      <section aria-labelledby="med" className="space-y-2">
        <h2 id="med" className="text-lg font-semibold">Mediação</h2>
        {!meds ? <SkeletonState label="Carregando" /> : meds.length === 0 ? <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Nenhum vínculo de mediação que você possa ver.</p> : (
          <>
            <p className="text-sm text-muted-foreground">{meds.filter((m) => isActiveOn(m, today())).length} vínculo(s) em andamento hoje · {meds.filter((m) => !isActiveOn(m, today())).length} encerrado(s) ou futuro(s)</p>
            <ul className="grid gap-2 md:grid-cols-2">{[...meds].sort((a, b) => Number(isActiveOn(b, today())) - Number(isActiveOn(a, today()))).map((m) => {
              const on = isActiveOn(m, today());
              return (
                <li key={m.id} className={`flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm ${on ? "border-l-4 border-l-primary" : "opacity-80"}`}>
                  <div>
                    <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{on ? "Em andamento" : "Fora do período"}</span>
                    <p>{br(m.valid_from)} até {br(m.valid_to)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpen(m.student_id)}>Abrir aluno</Button>
                </li>);
            })}</ul>
          </>)}
        <MediationForm school={school} onDone={loadMeds} />
      </section>
      <AeeSection school={school} />
      <form className="flex flex-wrap items-end gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); setOpen(student.trim()); }}>
        <label>Identificador do estudante<input className={field} value={student} onChange={(e) => setStudent(e.target.value)} /></label>
        <Button type="submit" disabled={!student.trim()}>Abrir</Button>
      </form>
      {open && <Student key={open} school={school} student={open} />}
    </div>
  );
}

function MediationForm({ school, onDone }: { school: string; onDone: () => void }) {
  const [f, setF] = useState({ student: "", cls: "", engagement: "", from: today(), to: "" });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <details className="rounded border p-3 text-sm"><summary className="cursor-pointer">Registrar vínculo de mediação</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label>Estudante<input className={field} value={f.student} onChange={(e) => setF({ ...f, student: e.target.value })} /></label>
        <label>Turma (opcional)<input className={field} value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })} /></label>
        <label>Atuação do mediador<input className={field} value={f.engagement} onChange={(e) => setF({ ...f, engagement: e.target.value })} /></label>
        <label>Início<DateInput value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label>Término (opcional)<DateInput value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      </div>
      <Button className="mt-2" disabled={!f.student || !f.engagement} onClick={async () => {
        try { await call("record_inclusion_mediation", { _base_id: null, _kind: "registro", _school: school, _student: f.student.trim(), _class: f.cls.trim() || null,
          _mediator_engagement: f.engagement.trim(), _valid_from: f.from, _valid_to: f.to || null, _reason: null }); setMsg("Vínculo registrado."); onDone(); }
        catch (e) { setMsg(inclusionMessage((e as Error).message)); }
      }}>Registrar</Button>
      {msg && <p role="status" className="mt-1">{msg}</p>}
    </details>
  );
}

function Student({ school, student }: { school: string; student: string }) {
  const [rs, setRs] = useState<InclusionRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<InclusionRecord[] | null>(null);
  const load = useCallback(async () => {
    try { setRs(await call<InclusionRecord[]>("inclusion_records_at", { _school: school, _student: student, _known_at: null, _logical_id: null })); setErr(null); }
    catch (e) { setErr(inclusionMessage((e as Error).message)); }
  }, [school, student]);
  useEffect(() => { void load(); }, [load]);
  async function amend(r: InclusionRecord, kind: "retificacao" | "encerramento") {
    const reason = await askText(kind === "encerramento" ? "Motivo do encerramento:" : "Motivo da correção:");
    if (!reason?.trim()) return;
    const body = kind === "retificacao" ? await askText("Texto corrigido:", r.body) : r.body;
    if (!body?.trim()) return;
    const to = kind === "encerramento" ? await askText("Data de término (AAAA-MM-DD):", today()) : r.valid_to;
    try {
      await call("record_inclusion_record", { _base_id: r.id, _kind: kind, _record_type: r.record_type, _school: school, _student: student,
        _category_scheme: r.category_scheme_id, _category_value: r.category_value_id, _purpose: r.educational_purpose, _body: body,
        _valid_from: r.valid_from, _valid_to: to || null, _share_with_mediation: r.share_with_mediation, _reason: reason });
      await load();
    } catch (e) { setMsg(inclusionMessage((e as Error).message)); }
  }
  function exportCsv() {
    const blob = new Blob([toCsv(minimizedExport(rs ?? [], today()))], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "relatorio-pedagogico-minimizado.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <section aria-labelledby="stu" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="stu" className="font-semibold">Estudante {student}</h2>
        {rs && rs.length > 0 && <Button size="sm" variant="outline" onClick={exportCsv}>Exportar relatório minimizado</Button>}</div>
      <MyMediatedStudents />
      <NetworkOverview />
      <TermReviewPanel />
      {err ? <StatePanel tone="warning" title="Registros não disponíveis" description={err} />
        : !rs ? <SkeletonState label="Carregando" />
        : rs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro de inclusão visível para você. Isso não indica ausência de necessidade.</p>
        : <ul className="space-y-2 text-sm">{rs.map((r) => (
            <li key={r.id} className="rounded border p-2">
              <p className="text-xs text-muted-foreground">{RECORD_TYPES.find((t) => t.id === r.record_type)?.label} · {br(r.valid_from)} a {br(r.valid_to)}{r.event_kind === "encerramento" ? " · encerrado" : ""}{r.version > 1 ? ` · versão ${r.version}` : ""}{r.share_with_mediation ? " · compartilhado com mediação" : ""}</p>
              <p className="text-xs">Finalidade: {r.educational_purpose}</p>
              <p className="whitespace-pre-wrap">{r.body}</p>
              {r.event_kind !== "encerramento" && <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => void amend(r, "retificacao")}>Corrigir</Button>
                <Button size="sm" variant="ghost" onClick={() => void amend(r, "encerramento")}>Encerrar</Button>
                {r.version > 1 && <Button size="sm" variant="ghost" onClick={() => void call<InclusionRecord[]>("inclusion_records_at", { _school: school, _student: student, _known_at: null, _logical_id: r.logical_id }).then(setHistory, (e: Error) => setMsg(inclusionMessage(e.message)))}>Histórico</Button>}
              </div>}
              <Attachments recordLogicalId={r.logical_id} />
            </li>))}</ul>}
      {history && <div role="region" aria-label="Histórico" className="rounded border p-2 text-xs"><div className="flex justify-between"><strong>Histórico</strong><Button size="sm" variant="ghost" onClick={() => setHistory(null)}>Fechar</Button></div>
        <ol>{[...history].sort((a, b) => a.version - b.version).map((h) => <li key={h.id}>v{h.version} · {h.event_kind} · {new Date(h.recorded_at).toLocaleString("pt-BR")}{h.reason ? ` · motivo: ${h.reason}` : ""}</li>)}</ol></div>}
      {!err && <NewRecord school={school} student={student} onDone={load} />}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}

function NewRecord({ school, student, onDone }: { school: string; student: string; onDone: () => void }) {
  const [f, setF] = useState({ type: "necessidade-de-apoio" as RecordType, category: "", purpose: "", body: "", from: today(), to: "", share: false });
  const [cats, setCats] = useState<{ value_id: string; label: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const catalog = RECORD_TYPES.find((t) => t.id === f.type)!.catalog;
  useEffect(() => {
    setCats([]); if (!catalog) return;
    void (supabase as any).from("attribute_value_definitions").select("value_id, label").eq("scheme_id", catalog).eq("status", "homologada")
      .then((r: { data: { value_id: string; label: string }[] | null }) => setCats(r.data ?? []));
  }, [catalog]);
  const warn = clinicalWarning(`${f.purpose} ${f.body}`);
  return (
    <div className="space-y-2 rounded border p-3 text-sm">
      <h3 className="font-medium">Novo registro</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Tipo<select className={field} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as RecordType, category: "" })}>{CREATABLE_RECORD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        {catalog && <label>Categoria (opcional){cats.length === 0 ? <span className="mt-1 block text-muted-foreground">Catálogo ainda sem valores aprovados.</span>
          : <select className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Sem categoria</option>{cats.map((c) => <option key={c.value_id} value={c.value_id}>{c.label}</option>)}</select>}</label>}
        <label>Início<DateInput value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label>Término (opcional)<DateInput value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      </div>
      <label className="block">Finalidade educacional<input maxLength={500} className={field} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></label>
      <label className="block">Registro pedagógico<textarea maxLength={6000} className={field} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      {(f.type === "necessidade-de-apoio" || f.type === "plano-educacional") && <label className="flex items-center gap-2"><input type="checkbox" checked={f.share} onChange={(e) => setF({ ...f, share: e.target.checked })} />Compartilhar com a mediação vigente deste estudante</label>}
      {warn && <p role="alert">{warn}</p>}
      <Button disabled={!f.purpose.trim() || !f.body.trim()} onClick={async () => {
        try { await call("record_inclusion_record", { _base_id: null, _kind: "registro", _record_type: f.type, _school: school, _student: student,
          _category_scheme: f.category ? catalog : null, _category_value: f.category || null, _purpose: f.purpose, _body: f.body,
          _valid_from: f.from, _valid_to: f.to || null, _share_with_mediation: f.share, _reason: null });
          setF({ ...f, purpose: "", body: "" }); setMsg("Registrado."); onDone(); }
        catch (e) { setMsg(inclusionMessage((e as Error).message)); }
      }}>Registrar</Button>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

type Att = { id: string; classification: "pedagogico" | "clinico"; purpose: string; media_type: string; size_bytes: number; recorded_at: string; withdrawn: boolean };
function Attachments({ recordLogicalId }: { recordLogicalId: string }) {
  const [list, setList] = useState<Att[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const upload = useServerFn(uploadInclusionAttachment);
  const openFn = useServerFn(openInclusionAttachment);
  const load = useCallback(() => call<Att[]>("inclusion_attachments_for", { _record_logical: recordLogicalId }).then(setList, () => setList(null)), [recordLogicalId]);
  useEffect(() => { void load(); }, [load]);
  async function onFile(file: File, classification: "pedagogico" | "clinico") {
    const purpose = await askText("Finalidade educacional deste anexo:"); if (!purpose?.trim()) return;
    const buf = new Uint8Array(await file.arrayBuffer()); let bin = ""; for (const b of buf) bin += String.fromCharCode(b);
    try { await upload({ data: { recordLogicalId, classification, purpose, mediaType: file.type, base64: btoa(bin) } }); setMsg("Anexo guardado."); await load(); }
    catch (e) { setMsg(inclusionMessage((e as Error).message)); }
  }
  if (list === null) return null; // sem permissão para anexos: nada é revelado
  return (
    <div className="mt-2 border-t pt-2 text-xs">
      <p className="font-medium">Anexos</p>
      {list.length === 0 ? <p className="text-muted-foreground">Nenhum anexo visível.</p> : <ul>{list.map((a) => (
        <li key={a.id}>{a.classification === "clinico" ? "Clínico (restrito)" : "Pedagógico"} · {a.purpose} · {Math.ceil(a.size_bytes / 1024)} KB{a.withdrawn ? " · retirado" : ""}
          {" "}<button className="underline" onClick={async () => {
            const p = await askText("Finalidade do acesso (fica registrada):"); if (!p?.trim()) return;
            try { const { url } = await openFn({ data: { attachmentId: a.id, purpose: p } }); window.open(url, "_blank", "noopener"); } catch (e) { setMsg(inclusionMessage((e as Error).message)); }
          }}>abrir</button></li>))}</ul>}
      <div className="mt-1 flex flex-wrap gap-3">
        <label className="cursor-pointer underline">Anexar pedagógico<input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0], "pedagogico")} /></label>
        <label className="cursor-pointer underline">Anexar clínico (segregado)<input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0], "clinico")} /></label>
      </div>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
