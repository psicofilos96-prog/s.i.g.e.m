import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { ACTION_LABEL, DESTINATION, STAGE_LABEL, VISIT_LABEL, actionClosed, overdue, protocolProblem, visitClosed, visitProblem, type ActionStatus, type ProtocolStage, type VisitStatus } from "./nei-visits";

const rpc = ((fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => unknown }).rpc(fn, args)) as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const input = "w-full rounded-md border border-input bg-background p-2 text-sm";
const MSG: Record<string, string> = {
  stale: "Outra pessoa registrou antes. Recarregue.", "invalid-transition": "Essa etapa não segue a atual.", "clinical-text": "Retire CID, laudo ou menção clínica do texto.",
  "recipient-not-eligible": "Destinatário sem vínculo vigente para receber este protocolo.", "student-not-in-school": "Estudante sem matrícula vigente nesta escola.",
  "not-authorized": "Seu papel no NEI não permite esta ação.",
};
export const human = (m: string) => Object.entries(MSG).find(([k]) => m.includes(k))?.[1] ?? "Não foi possível concluir.";
const dt = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
const today = () => new Date().toLocaleDateString("sv-SE");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Doc = { id: string; file_name: string; object_path: string };
type Visit = { id: string; purpose: string; has_student: boolean; student_name: string | null; events: { seq: number; status: VisitStatus; on_date: string; report: string | null; recorded_at: string }[]; documents: Doc[] };
type Action = { id: string; visit_id: string | null; description: string; due_on: string | null; responsible_label: string | null; events: { seq: number; status: ActionStatus; note: string; recorded_at: string }[] };
type Proto = { id: string; number: number; subject: string; destination_kind: string; reply_due_on: string | null; sent_at: string; last_stage: ProtocolStage; last_seq: number };
type Agenda = { visits: Visit[]; actions: Action[]; protocols: Proto[] };

export async function openNeiDocument(path: string) {
  const s = await supabase.storage.from("nei-documentos").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (s.data) window.open(s.data.signedUrl, "_blank", "noopener");
}

async function attach(owner: { visit?: string; protocol?: string }, f: File): Promise<string | null> {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) return "Só PDF, JPG ou PNG.";
  if (f.size > 10 * 1024 * 1024) return "Arquivo acima de 10 MB.";
  const r = await rpc("register_nei_document", { _visit: owner.visit ?? null, _protocol: owner.protocol ?? null, _file_name: f.name.slice(0, 200), _mime: f.type, _size: f.size });
  if (r.error) return human(r.error.message);
  const u = await supabase.storage.from("nei-documentos").upload(String(r.data), f, { upsert: false });
  return u.error ? "Envio do arquivo falhou; o registro ficou sem conteúdo." : null;
}

function printVisit(v: Visit, school: string) {
  const last = v.events[v.events.length - 1]!;
  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de visita técnica — NEI</title><style>@page{size:A4;margin:20mm}body{font:12pt/1.5 serif;text-align:justify}h1{font-size:14pt;text-align:center}.sig{margin-top:60px;text-align:center}</style></head><body>
<h1>Núcleo de Educação Inclusiva — Relatório de visita técnica</h1>
<p><b>Unidade:</b> ${esc(school)}<br><b>Data:</b> ${dt(last.on_date)}<br><b>Situação:</b> ${VISIT_LABEL[last.status]}${v.student_name ? `<br><b>Estudante:</b> ${esc(v.student_name)}` : ""}</p>
<p><b>Finalidade:</b> ${esc(v.purpose)}</p><p><b>Relatório:</b><br>${esc(last.report ?? "Não registrado.").replace(/\n/g, "<br>")}</p>
<p style="font-size:9pt">Documento restrito do NEI. Não contém dado clínico.</p><div class="sig">______________________________<br>Responsável técnico do NEI</div></body></html>`);
  w.document.close(); w.print();
}

export function NeiAgendaPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]); const [school, setSchool] = useState("");
  const [d, setD] = useState<Agenda | null | undefined>(undefined);
  useEffect(() => { void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m))); }, []);
  const load = () => { if (school) void rpc("nei_school_agenda", { _school: school }).then((r) => setD(r.error ? null : (r.data as Agenda | null))); };
  useEffect(() => { setD(undefined); load(); }, [school]);
  const name = schools.find((s) => s.id === school)?.name ?? school;
  const t = today();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Agenda, visitas e protocolos" description="Visitas técnicas com relatório, providências com prazo opcional e protocolos com devolutiva para contas que já têm vínculo vigente. Nada sai com dado clínico; documentos ficam em arquivo privado." />
      <label className="text-sm">Escola <select className={input + " w-auto"} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {!school ? null : d === undefined ? <StatePanel title="Carregando…" description="Lendo no servidor dentro do seu papel." /> : d === null ? (
        <EmptyState title="Sem acesso a esta escola" description="Só coordenação, técnicos do NEI com escopo nesta escola ou a conta do NEI veem esta área. A tentativa foi registrada." />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            {[["Visitas agendadas", d.visits.filter((v) => !visitClosed(v.events[v.events.length - 1]!.status)).length],
              ["Providências abertas", d.actions.filter((a) => !actionClosed(a.events[a.events.length - 1]!.status)).length],
              ["Providências vencidas", d.actions.filter((a) => overdue(a.due_on, actionClosed(a.events[a.events.length - 1]!.status), t)).length],
              ["Protocolos sem devolutiva", d.protocols.filter((p) => p.last_stage === "enviado" || p.last_stage === "recebido").length]].map(([l, v]) => (
              <div key={String(l)} className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>))}
          </div>
          <Visits d={d} school={school} schoolName={name} onSaved={load} />
          <Actions d={d} school={school} onSaved={load} />
          <Protocols d={d} school={school} onSaved={load} />
        </>
      )}
    </div>
  );
}

function StudentPicker({ school, value, onChange }: { school: string; value: string; onChange: (s: string) => void }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ student_id: string; name: string }[]>([]);
  return (
    <div className="space-y-1">
      <div className="flex gap-1"><input className={input} placeholder="Estudante (opcional, mín. 3 letras)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" variant="outline" disabled={q.trim().length < 3} onClick={() => void rpc("nei_student_search", { _school: school, _q: q }).then((r) => setFound(r.error ? [] : (r.data as typeof found)))}>Buscar</Button></div>
      {found.length ? <select className={input} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Estudante"><option value="">Sem estudante</option>{found.map((f) => <option key={f.student_id} value={f.student_id}>{f.name}</option>)}</select> : null}
    </div>
  );
}

function Visits({ d, school, schoolName, onSaved }: { d: Agenda; school: string; schoolName: string; onSaved: () => void }) {
  const [purpose, setPurpose] = useState(""); const [on, setOn] = useState(""); const [student, setStudent] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const create = () => void rpc("schedule_nei_visit", { _school: school, _student: student || null, _purpose: purpose, _on: on })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setPurpose(""); setOn(""); setStudent(""); setMsg(null); onSaved(); } });
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Visitas técnicas</h2>
      {d.visits.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma visita registrada.</p> : d.visits.map((v) => <VisitCard key={v.id} v={v} schoolName={schoolName} onSaved={onSaved} />)}
      <div className="space-y-1 rounded-md border border-dashed border-border p-3 text-sm">
        <p className="font-medium">Agendar visita</p>
        <input className={input} placeholder="Finalidade da visita (mín. 5)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <input type="date" className={input + " w-auto"} value={on} onChange={(e) => setOn(e.target.value)} aria-label="Data da visita" />
        <StudentPicker school={school} value={student} onChange={setStudent} />
        <Button size="sm" disabled={purpose.trim().length < 5 || !on} onClick={create}>Agendar</Button>{msg ? <span className="ml-2 text-xs text-destructive">{msg}</span> : null}
      </div>
    </section>
  );
}

function VisitCard({ v, schoolName, onSaved }: { v: Visit; schoolName: string; onSaved: () => void }) {
  const last = v.events[v.events.length - 1]!;
  const [to, setTo] = useState<VisitStatus>("realizada"); const [report, setReport] = useState(""); const [date, setDate] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const save = () => {
    const p = visitProblem(last.status, to, report, date); if (p) { setMsg(p); return; }
    void rpc("record_nei_visit_event", { _visit: v.id, _expected_seq: last.seq, _status: to, _on: date || null, _report: report || null })
      .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setReport(""); setMsg(null); onSaved(); } });
  };
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={visitClosed(last.status) ? "neutral" : "info"}>{VISIT_LABEL[last.status]}</StatusBadge><span className="font-medium">{dt(last.on_date)}</span><span>{v.purpose}</span>{v.student_name ? <span className="text-muted-foreground">· {v.student_name}</span> : null}</div>
      {last.report ? <p className="mt-1 whitespace-pre-wrap text-xs">{last.report}</p> : null}
      <div className="mt-1 flex flex-wrap gap-2 text-xs">
        {v.documents.map((x) => <button key={x.id} className="underline" onClick={() => void openNeiDocument(x.object_path)}>{x.file_name}</button>)}
        <label className="cursor-pointer underline">Anexar documento<input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach({ visit: v.id }, f).then((m) => { setMsg(m); onSaved(); }); }} /></label>
        {last.status === "realizada" ? <button className="underline" onClick={() => printVisit(v, schoolName)}>Imprimir relatório (A4)</button> : null}
      </div>
      {!visitClosed(last.status) ? (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap gap-1">
            <select className={input + " w-auto"} value={to} onChange={(e) => setTo(e.target.value as VisitStatus)} aria-label="Próxima situação"><option value="realizada">Realizada</option><option value="reagendada">Reagendar</option><option value="cancelada">Cancelar</option></select>
            {to === "reagendada" ? <input type="date" className={input + " w-auto"} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Nova data" /> : null}
          </div>
          {to !== "reagendada" ? <textarea className={input} rows={2} placeholder={to === "realizada" ? "Relatório da visita (sem dado clínico)" : "Justificativa"} value={report} onChange={(e) => setReport(e.target.value)} /> : null}
          <Button size="sm" variant="outline" onClick={save}>Registrar</Button>
        </div>
      ) : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}

function Actions({ d, school, onSaved }: { d: Agenda; school: string; onSaved: () => void }) {
  const [desc, setDesc] = useState(""); const [due, setDue] = useState(""); const [resp, setResp] = useState(""); const [visit, setVisit] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const t = today();
  const create = () => void rpc("open_nei_action", { _school: school, _visit: visit || null, _description: desc, _due: due || null, _responsible: resp })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setDesc(""); setDue(""); setResp(""); setMsg(null); onSaved(); } });
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Providências e prazos</h2>
      {d.actions.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma providência registrada.</p> : d.actions.map((a) => <ActionRow key={a.id} a={a} late={overdue(a.due_on, actionClosed(a.events[a.events.length - 1]!.status), t)} onSaved={onSaved} />)}
      <div className="space-y-1 rounded-md border border-dashed border-border p-3 text-sm">
        <p className="font-medium">Nova providência</p>
        <input className={input} placeholder="O que precisa ser feito (mín. 5)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          <input type="date" className={input + " w-auto"} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Prazo (opcional)" />
          <input className={input + " w-auto"} placeholder="Responsável (texto)" value={resp} onChange={(e) => setResp(e.target.value)} />
          <select className={input + " w-auto"} value={visit} onChange={(e) => setVisit(e.target.value)} aria-label="Visita de origem"><option value="">Sem visita de origem</option>{d.visits.map((v) => <option key={v.id} value={v.id}>{dt(v.events[v.events.length - 1]!.on_date)} — {v.purpose.slice(0, 40)}</option>)}</select>
        </div>
        <Button size="sm" disabled={desc.trim().length < 5} onClick={create}>Registrar providência</Button>{msg ? <span className="ml-2 text-xs text-destructive">{msg}</span> : null}
      </div>
    </section>
  );
}

function ActionRow({ a, late, onSaved }: { a: Action; late: boolean; onSaved: () => void }) {
  const last = a.events[a.events.length - 1]!; const [to, setTo] = useState<ActionStatus>("em-andamento"); const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const save = () => void rpc("record_nei_action_event", { _action: a.id, _expected_seq: last.seq, _status: to, _note: note })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setNote(""); setMsg(null); onSaved(); } });
  const need = to === "em-andamento" ? 3 : 10;
  return (
    <div className="rounded-md border border-border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={late ? "danger" : actionClosed(last.status) ? "neutral" : "info"}>{late ? "Vencida" : ACTION_LABEL[last.status]}</StatusBadge><span>{a.description}</span><span className="text-xs text-muted-foreground">prazo {a.due_on ? dt(a.due_on) : "não definido"}{a.responsible_label ? ` · ${a.responsible_label}` : ""}</span></div>
      {!actionClosed(last.status) ? (
        <div className="mt-1 flex flex-wrap gap-1">
          <select className={input + " w-auto"} value={to} onChange={(e) => setTo(e.target.value as ActionStatus)} aria-label="Andamento"><option value="em-andamento">Em andamento</option><option value="concluida">Concluir</option><option value="cancelada">Cancelar</option></select>
          <input className={input + " w-auto flex-1"} placeholder={`Anotação (mín. ${need})`} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" disabled={note.trim().length < need} onClick={save}>Registrar</Button>
        </div>
      ) : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}

function Protocols({ d, school, onSaved }: { d: Agenda; school: string; onSaved: () => void }) {
  const [kind, setKind] = useState("direcao"); const [student, setStudent] = useState(""); const [cands, setCands] = useState<{ user_id: string; label: string }[] | null>(null); const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [due, setDue] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setCands(null); setRecipient(""); void rpc("nei_recipient_candidates", { _school: school, _kind: kind, _student: student || null }).then((r) => setCands(r.error ? [] : (r.data as { user_id: string; label: string }[]))); }, [school, kind, student]);
  const send = () => {
    const p = protocolProblem(subject, body, kind, recipient, student); if (p) { setMsg(p); return; }
    void rpc("send_nei_protocol", { _school: school, _student: student || null, _kind: kind, _recipient: recipient, _subject: subject, _body: body, _due: due || null })
      .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setSubject(""); setBody(""); setMsg(`Protocolo nº ${String(r.data)} enviado.`); onSaved(); } });
  };
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Protocolos e encaminhamentos</h2>
      {d.protocols.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum protocolo enviado.</p> : d.protocols.map((p) => <ProtocolRow key={p.id} p={p} onSaved={onSaved} />)}
      <div className="space-y-1 rounded-md border border-dashed border-border p-3 text-sm">
        <p className="font-medium">Novo protocolo</p>
        <select className={input + " w-auto"} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Destino">{Object.entries(DESTINATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <StudentPicker school={school} value={student} onChange={setStudent} />
        {cands === null ? <p className="text-xs text-muted-foreground">Procurando destinatários com vínculo vigente…</p> : cands.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma conta com vínculo vigente para este destino{kind === "familia" ? " (responsável precisa de autorização vigente em comunicados)" : ""}.</p>
        ) : <select className={input} value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label="Destinatário"><option value="">Escolha o destinatário</option>{cands.map((c) => <option key={c.user_id} value={c.user_id}>{c.label}</option>)}</select>}
        <input className={input} placeholder="Assunto (aparece na caixa de entrada; sem dado clínico)" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
        <textarea className={input} rows={3} placeholder="Mensagem (sem CID, laudo ou diagnóstico)" value={body} onChange={(e) => setBody(e.target.value)} />
        <label className="text-xs">Devolutiva até (opcional) <input type="date" className={input + " w-auto"} value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <div><Button size="sm" onClick={send}>Enviar protocolo</Button>{msg ? <span className="ml-2 text-xs">{msg}</span> : null}</div>
      </div>
    </section>
  );
}

function ProtocolRow({ p, onSaved }: { p: Proto; onSaved: () => void }) {
  const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [file, setFile] = useState<string | null>(null);
  const late = overdue(p.reply_due_on, p.last_stage === "devolutiva" || p.last_stage === "encerrado", today());
  const close = () => void rpc("record_nei_protocol_event", { _protocol: p.id, _expected_seq: p.last_seq, _stage: "encerrado", _note: note })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else onSaved(); });
  return (
    <div className="rounded-md border border-border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">nº {p.number}</span><StatusBadge tone={late ? "danger" : p.last_stage === "encerrado" ? "neutral" : "info"}>{late ? "Devolutiva vencida" : STAGE_LABEL[p.last_stage]}</StatusBadge><span>{p.subject}</span><span className="text-xs text-muted-foreground">→ {DESTINATION[p.destination_kind]} · {dt(p.sent_at)}</span></div>
      {p.last_stage !== "encerrado" ? (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <label className="cursor-pointer underline">Anexar documento<input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach({ protocol: p.id }, f).then((m) => setFile(m ?? `${f.name} anexado.`)); }} /></label>
          <input className={input + " w-auto flex-1"} placeholder="Nota de encerramento (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" onClick={close}>Encerrar</Button>
        </div>
      ) : null}
      {file ? <p className="text-xs">{file}</p> : null}{msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}
