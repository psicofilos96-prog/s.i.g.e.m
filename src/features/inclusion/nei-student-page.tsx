import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { PlansBox } from "./nei-plans";
import { NEI_SECTIONS, SECTION_LABEL, STAGE_LABEL, allowedNext, canWriteSection, currentEvent, eventProblem, isOverdue, timeline, type Entry, type NeiCase, type NeiSection, type NeiStage } from "./nei-cases";

const rpc = ((fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => unknown }).rpc(fn, args)) as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const MSG: Record<string, string> = {
  "nei:not-authorized": "Sua conta não tem papel do NEI para este estudante.",
  "nei:student-not-in-school": "O estudante não tem matrícula vigente nesta escola.",
  "nei:stale-version": "Outra pessoa registrou antes. Recarregue a ficha.",
  "nei:invalid-transition": "Essa etapa não segue a etapa atual.",
  "nei:assignee-without-role": "A pessoa escolhida não tem papel do NEI nesta escola.",
};
const human = (m: string) => Object.entries(MSG).find(([k]) => m.includes(k))?.[1] ?? "Não foi possível concluir com o seu acesso.";
const input = "w-full rounded-md border border-input bg-background p-2 text-sm";

type FileData = { role: "gestao" | "aee"; identity: { civil_name: string; social_name: string | null; birth_date: string | null } | null; enrollments: { class_label: string; valid_from: string }[]; entries: Entry[]; cases: NeiCase[]; pedagogical_records: number };

export function NeiStudentPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState(""); const [q, setQ] = useState("");
  const [found, setFound] = useState<{ student_id: string; name: string; class_label: string }[] | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  useEffect(() => { void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m))); }, []);
  const search = () => void rpc("nei_student_search", { _school: school, _q: q }).then((r) => setFound(r.error ? [] : (r.data as typeof found)));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Ficha NEI e casos" description="O estudante vem do cadastro e da matrícula centrais; aqui não se cadastra ninguém. Apoio nunca depende de laudo. Toda consulta fica registrada." />
      <section className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Escola<select className={input} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Nome (mín. 3 letras)<input className={input} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Button disabled={!school || q.trim().length < 3} onClick={search}>Buscar</Button>
      </section>
      {found && !student ? (found.length === 0 ? <EmptyState title="Nenhum estudante encontrado" description="Ou não há matrícula vigente com esse nome, ou sua conta não tem papel do NEI nesta escola." /> :
        <ul className="space-y-1">{found.map((f) => <li key={f.student_id}><button className="text-sm underline" onClick={() => setStudent(f.student_id)}>{f.name}</button> <span className="text-xs text-muted-foreground">{f.class_label} · {f.student_id}</span></li>)}</ul>) : null}
      {student ? <><Button variant="outline" onClick={() => setStudent(null)}>Voltar à busca</Button><StudentFile student={student} school={school} /></> : null}
    </div>
  );
}

function StudentFile({ student, school }: { student: string; school: string }) {
  const [d, setD] = useState<FileData | null | undefined>(undefined); const [err, setErr] = useState<string | null>(null);
  const load = () => void rpc("nei_student_file", { _student: student, _school: school }).then((r) => { if (r.error) setErr(human(r.error.message)); else setD(r.data as FileData | null); });
  useEffect(load, [student, school]);
  if (err) return <StatePanel tone="danger" title="Ficha indisponível" description={err} />;
  if (d === undefined) return <StatePanel title="Carregando ficha…" description="Lendo do servidor dentro do seu papel." />;
  if (d === null) return <EmptyState title="Sem acesso a esta ficha" description="Sua conta não tem papel do NEI para este estudante nesta escola, ou a matrícula não está vigente. A tentativa foi registrada." />;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border p-3 text-sm">
        <h2 className="font-semibold">Identificação (cadastro central)</h2>
        <p>{d.identity?.social_name ? <>{d.identity.social_name} <span className="text-muted-foreground">(nome social; civil: {d.identity.civil_name})</span></> : d.identity?.civil_name ?? "—"}</p>
        <p className="text-muted-foreground">Nascimento: {d.identity?.birth_date ?? "não registrado"} · Turma: {d.enrollments.map((e) => e.class_label).join(", ") || "—"} · Registros pedagógicos de inclusão: {d.pedagogical_records}</p>
        <p className="text-xs text-muted-foreground">Documentos restritos e laudos ficam na tela de Inclusão, com permissão própria; não aparecem aqui.</p>
      </section>
      <div className="grid gap-3 md:grid-cols-2">{NEI_SECTIONS.map((s) => <SectionBox key={s} section={s} d={d} student={student} school={school} onSaved={load} />)}</div>
      <PlansBox student={student} school={school} studentName={d.identity?.social_name || d.identity?.civil_name || "—"} />
      <CasesBox d={d} student={student} school={school} onSaved={load} today={today} />
      <section><h2 className="text-sm font-semibold">Linha do tempo</h2>
        <ul className="mt-1 space-y-0.5 text-xs">{timeline(d.entries, d.cases).map((t, i) => <li key={i}>{new Date(t.at).toLocaleString("pt-BR")} — {t.text}</li>)}</ul>
        {d.entries.length + d.cases.length === 0 ? <p className="text-xs text-muted-foreground">Nada registrado ainda.</p> : null}
      </section>
    </div>
  );
}

function SectionBox({ section, d, student, school, onSaved }: { section: NeiSection; d: FileData; student: string; school: string; onSaved: () => void }) {
  const cur = d.entries.filter((e) => e.section === section && e.current);
  const hist = d.entries.filter((e) => e.section === section && !e.current);
  const [text, setText] = useState(""); const [fix, setFix] = useState<string | null>(null); const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const can = canWriteSection(d.role, section);
  const save = () => void rpc("record_nei_profile_entry", { _student: student, _school: school, _section: section, _content: text, _supersedes: fix, _reason: fix ? reason : null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setText(""); setFix(null); setReason(""); onSaved(); } });
  return (
    <section className="rounded-md border border-border p-3 text-sm space-y-2">
      <h3 className="font-semibold">{SECTION_LABEL[section]}</h3>
      {cur.length === 0 ? <p className="text-xs text-muted-foreground">Sem registro.</p> : cur.map((e) => (
        <div key={e.id} className="rounded bg-muted p-2"><p className="whitespace-pre-wrap">{e.content}</p>
          <p className="text-xs text-muted-foreground">{new Date(e.recorded_at).toLocaleDateString("pt-BR")}{e.correction_reason ? ` · correção: ${e.correction_reason}` : ""}</p>
          {can ? <button className="text-xs underline" onClick={() => { setFix(e.id); setText(e.content); }}>Corrigir</button> : null}</div>))}
      {hist.length ? <details className="text-xs"><summary>{hist.length} versão(ões) anterior(es)</summary>{hist.map((e) => <p key={e.id} className="mt-1 whitespace-pre-wrap text-muted-foreground">{e.content}</p>)}</details> : null}
      {can ? <div className="space-y-1">
        <textarea className={input} rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Novo registro em ${SECTION_LABEL[section]}`} />
        {fix ? <input className={input} placeholder="Motivo da correção (mín. 5)" value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
        <Button size="sm" disabled={text.trim().length < 3 || (!!fix && reason.trim().length < 5)} onClick={save}>{fix ? "Gravar correção" : "Registrar"}</Button>
        {fix ? <Button size="sm" variant="ghost" onClick={() => { setFix(null); setText(""); }}>Cancelar</Button> : null}
        {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
      </div> : null}
    </section>
  );
}

function CasesBox({ d, student, school, onSaved, today }: { d: FileData; student: string; school: string; onSaved: () => void; today: string }) {
  const [summary, setSummary] = useState(""); const [by, setBy] = useState(""); const [prio, setPrio] = useState(""); const [due, setDue] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const open = () => void rpc("open_nei_case", { _student: student, _school: school, _summary: summary, _requested_by: by, _priority: prio, _due: due || null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setSummary(""); setBy(""); setPrio(""); setDue(""); onSaved(); } });
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Casos</h2>
      {d.cases.map((c) => <CaseCard key={c.id} c={c} role={d.role} school={school} onSaved={onSaved} today={today} />)}
      {d.role === "gestao" ? <div className="rounded-md border border-dashed border-border p-3 space-y-1 text-sm">
        <p className="font-medium">Abrir caso (solicitação)</p>
        <textarea className={input} rows={2} placeholder="O que foi solicitado (mín. 10)" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <div className="grid gap-1 sm:grid-cols-3">
          <input className={input} placeholder="Quem solicitou (ex.: escola, família)" value={by} onChange={(e) => setBy(e.target.value)} />
          <input className={input} placeholder="Prioridade (opcional)" value={prio} onChange={(e) => setPrio(e.target.value)} />
          <input type="date" className={input} aria-label="Prazo (opcional)" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <Button size="sm" disabled={summary.trim().length < 10} onClick={open}>Abrir caso</Button>
        {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
      </div> : null}
    </section>
  );
}

function CaseCard({ c, role, school, onSaved, today }: { c: NeiCase; role: "gestao" | "aee"; school: string; onSaved: () => void; today: string }) {
  const cur = currentEvent(c);
  const options = role === "aee" ? [cur.stage] : allowedNext(cur.stage);
  const [to, setTo] = useState<NeiStage>(cur.stage); const [note, setNote] = useState(""); const [prio, setPrio] = useState(""); const [due, setDue] = useState(""); const [who, setWho] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [people, setPeople] = useState<{ user_id: string; person_name: string; role: string }[]>([]);
  useEffect(() => { if (role === "gestao") void rpc("nei_case_assignees", { _school: school }).then((r) => setPeople(r.error ? [] : (r.data as typeof people))); }, [role, school]);
  const problem = eventProblem(cur.stage, to, note);
  const send = () => void rpc("record_nei_case_event", { _case: c.id, _expected_seq: cur.seq, _stage: to, _note: note, _priority: prio || null, _due: due || null, _assignee: who || null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setNote(""); setMsg(null); onSaved(); } });
  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={cur.stage === "encerramento" ? "neutral" : "info"}>{STAGE_LABEL[cur.stage]}</StatusBadge>
        {cur.priority ? <span className="text-xs">Prioridade: {cur.priority}</span> : null}
        {cur.due_date ? <span className={`text-xs ${isOverdue(cur, today) ? "text-destructive" : ""}`}>Prazo: {cur.due_date}{isOverdue(cur, today) ? " (vencido)" : ""}</span> : null}
        {cur.assigned ? <span className="text-xs">{cur.assigned_to_me ? "Responsável: você" : "Com responsável"}</span> : <span className="text-xs text-muted-foreground">Sem responsável</span>}</div>
      <p>{c.request_summary}{c.requested_by_label ? <span className="text-muted-foreground"> — por {c.requested_by_label}</span> : null}</p>
      <ol className="space-y-0.5 text-xs">{c.events.map((e) => <li key={e.seq}>#{e.seq} {STAGE_LABEL[e.stage]} · {new Date(e.recorded_at).toLocaleString("pt-BR")}: {e.note}</li>)}</ol>
      {cur.stage !== "encerramento" ? <div className="space-y-1">
        <div className="grid gap-1 sm:grid-cols-4">
          <select className={input} value={to} onChange={(e) => setTo(e.target.value as NeiStage)} aria-label="Etapa">{options.map((s) => <option key={s} value={s}>{s === cur.stage ? `Andamento (${STAGE_LABEL[s]})` : STAGE_LABEL[s]}</option>)}</select>
          {role === "gestao" ? <>
            <input className={input} placeholder="Nova prioridade" value={prio} onChange={(e) => setPrio(e.target.value)} />
            <input type="date" className={input} aria-label="Novo prazo" value={due} onChange={(e) => setDue(e.target.value)} />
            <select className={input} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Responsável"><option value="">Manter responsável</option>{people.map((p) => <option key={p.user_id + p.role} value={p.user_id}>{p.person_name} ({p.role})</option>)}</select>
          </> : null}
        </div>
        <textarea className={input} rows={2} placeholder={to === "encerramento" ? "Justificativa do encerramento (mín. 10)" : "Descrição do andamento"} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" disabled={!!problem} onClick={send}>Registrar</Button>
        {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
      </div> : null}
    </div>
  );
}
