import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { BARRIER_CATEGORY, BARRIER_LABEL, SUPPORT_KIND, SUPPORT_LABEL, barrierClosed, coverageState, supportNext, supportProblem, type BarrierStatus, type SupportStage } from "./nei-support";

const rpc = ((fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => unknown }).rpc(fn, args)) as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const input = "w-full rounded-md border border-input bg-background p-2 text-sm";
const MSG: Record<string, string> = {
  "stale": "Outra pessoa registrou antes. Recarregue.", "invalid-transition": "Essa etapa não segue a atual.", "designation-not-found": "A designação ou atuação escolhida não está vigente nesta escola para este estudante.",
  "substitute-conflict": "O substituto já cobre outra pessoa nesse período.", "substitute-on-leave": "O substituto está afastado nesse período.", "engagement-not-found": "Atuação não encontrada ou não vigente nesta escola.",
  "student-not-in-school": "Estudante sem matrícula vigente nesta escola.", "not-authorized": "Seu papel no NEI não permite esta ação nesta escola.",
};
const human = (m: string) => Object.entries(MSG).find(([k]) => m.includes(k))?.[1] ?? "Não foi possível concluir.";

type Ev = { seq: number; stage: SupportStage; note: string; forwarded_to: string | null; linked: boolean; recorded_at: string };
type Req = { id: string; student_id: string; student_name: string | null; support_kind: string; justification: string; opened_at: string; events: Ev[] };
type Med = { logical_id: string; student_id: string; student_name: string | null; mediator_engagement_id: string; mediator_name: string | null; mediator_active: boolean; on_leave: boolean; substituted: boolean; valid_from: string; valid_to: string | null };
type Bev = { seq: number; status: BarrierStatus; priority: string | null; resource_needed: string | null; external_ref: string | null; note: string; recorded_at: string };
type Bar = { id: string; category: string; description: string; has_student: boolean; opened_at: string; events: Bev[] };
type Data = { requests: Req[]; mediations: Med[]; coverage: { kind: string; starts_on: string; ends_on: string | null; note: string; covered_name: string | null; substitute_name: string | null }[]; barriers: Bar[]; professionals: { engagement_id: string; name: string; label: string | null }[] };
const dt = (s: string | null) => s ? s.slice(0, 10).split("-").reverse().join("/") : "—";

export function NeiSupportPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]); const [school, setSchool] = useState("");
  const [d, setD] = useState<Data | null | undefined>(undefined);
  useEffect(() => { void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m))); }, []);
  const load = () => { if (school) void rpc("nei_school_support", { _school: school }).then((r) => setD(r.error ? null : (r.data as Data | null))); };
  useEffect(() => { setD(undefined); load(); }, [school]);
  const open = d ? d.requests.filter((r) => !["indeferida", "cancelada", "encerrada"].includes(r.events[r.events.length - 1]!.stage)).length : 0;
  const uncovered = d ? d.mediations.filter((m) => coverageState(m) === "descoberta").length : 0;
  const barriersOpen = d ? d.barriers.filter((b) => !barrierClosed(b.events[b.events.length - 1]!.status)).length : 0;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Profissionais de apoio e acessibilidade" description="Profissionais e designações vêm das atuações e mediações já registradas; o NEI não cria designação nem ato funcional. Barreiras citam a compra ou o patrimônio pela referência, sem duplicá-los." />
      <label className="text-sm">Escola <select className={input + " w-auto"} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {!school ? null : d === undefined ? <StatePanel title="Carregando…" description="Lendo no servidor dentro do seu papel." /> : d === null ? (
        <EmptyState title="Sem acesso a esta escola" description="Só coordenação, técnicos do NEI com escopo nesta escola ou a conta do NEI veem esta área. A tentativa foi registrada." />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            {[["Pedidos em aberto", open], ["Mediações vigentes", d.mediations.length], ["Mediações descobertas", uncovered], ["Barreiras em aberto", barriersOpen]].map(([l, v]) => (
              <div key={String(l)} className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>))}
          </div>
          <Requests d={d} school={school} onSaved={load} />
          <Coverage d={d} school={school} onSaved={load} />
          <Barriers d={d} school={school} onSaved={load} />
        </>
      )}
    </div>
  );
}

function Requests({ d, school, onSaved }: { d: Data; school: string; onSaved: () => void }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ student_id: string; name: string }[]>([]); const [student, setStudent] = useState("");
  const [kind, setKind] = useState("mediador"); const [just, setJust] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const search = () => void rpc("nei_student_search", { _school: school, _q: q }).then((r) => setFound(r.error ? [] : (r.data as typeof found)));
  const create = () => void rpc("open_nei_support_request", { _student: student, _school: school, _kind: kind, _justification: just })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setJust(""); setStudent(""); setMsg(null); onSaved(); } });
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Pedidos de apoio</h2>
      {d.requests.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum pedido registrado.</p> : d.requests.map((r) => <RequestCard key={r.id} r={r} d={d} onSaved={onSaved} />)}
      <div className="space-y-1 rounded-md border border-dashed border-border p-3 text-sm">
        <p className="font-medium">Novo pedido</p>
        <div className="flex gap-1"><input className={input} placeholder="Nome do estudante (mín. 3)" value={q} onChange={(e) => setQ(e.target.value)} /><Button size="sm" variant="outline" disabled={q.trim().length < 3} onClick={search}>Buscar</Button></div>
        {found.length ? <select className={input} value={student} onChange={(e) => setStudent(e.target.value)} aria-label="Estudante"><option value="">Escolha o estudante</option>{found.map((f) => <option key={f.student_id} value={f.student_id}>{f.name}</option>)}</select> : null}
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de apoio">{Object.entries(SUPPORT_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <textarea className={input} rows={2} placeholder="Justificativa pedagógica (mín. 10). Laudo não é exigido." value={just} onChange={(e) => setJust(e.target.value)} />
        <Button size="sm" disabled={!student || just.trim().length < 10} onClick={create}>Registrar pedido</Button>{msg ? <span className="ml-2 text-xs text-destructive">{msg}</span> : null}
      </div>
    </section>
  );
}

function RequestCard({ r, d, onSaved }: { r: Req; d: Data; onSaved: () => void }) {
  const last = r.events[r.events.length - 1]!; const opts = supportNext(last.stage);
  const [to, setTo] = useState<SupportStage | "">(opts[0] ?? ""); const [note, setNote] = useState(""); const [fw, setFw] = useState(""); const [link, setLink] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const meds = d.mediations.filter((m) => m.student_id === r.student_id);
  const problem = to ? supportProblem(last.stage, to, note, fw, link) : "Pedido encerrado.";
  const send = () => { const [k, id] = link.split(":"); void rpc("record_nei_support_event", { _request: r.id, _expected_seq: last.seq, _stage: to, _note: note, _forwarded_to: fw || null, _mediation: k === "m" ? id : null, _engagement: k === "e" ? id : null })
    .then((x) => { if (x.error) setMsg(human(x.error.message)); else { setNote(""); setMsg(null); onSaved(); } }); };
  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-1">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.student_name ?? r.student_id}</span><span className="text-xs">{SUPPORT_KIND[r.support_kind]}</span><StatusBadge tone="info">{SUPPORT_LABEL[last.stage]}</StatusBadge></div>
      <ol className="text-xs space-y-0.5">{r.events.map((e) => <li key={e.seq}>#{e.seq} {dt(e.recorded_at)} · {SUPPORT_LABEL[e.stage]}{e.forwarded_to ? ` → ${e.forwarded_to}` : ""}{e.linked ? " · vinculado a registro existente" : ""}: {e.note}</li>)}</ol>
      {opts.length ? <div className="grid gap-1 sm:grid-cols-3">
        <select className={input} value={to} onChange={(e) => setTo(e.target.value as SupportStage)} aria-label="Próxima etapa">{opts.map((s) => <option key={s} value={s}>{SUPPORT_LABEL[s]}</option>)}</select>
        {to === "encaminhada" ? <input className={input} placeholder="Encaminhado para (quem decide)" value={fw} onChange={(e) => setFw(e.target.value)} /> : null}
        {to === "designada" ? <select className={input} value={link} onChange={(e) => setLink(e.target.value)} aria-label="Designação existente"><option value="">Escolha o registro existente</option>
          {meds.map((m) => <option key={m.logical_id} value={`m:${m.logical_id}`}>Mediação: {m.mediator_name ?? "—"} desde {dt(m.valid_from)}</option>)}
          {d.professionals.map((p) => <option key={p.engagement_id} value={`e:${p.engagement_id}`}>Atuação: {p.name}{p.label ? ` (${p.label})` : ""}</option>)}</select> : null}
        <textarea className={input + " sm:col-span-3"} rows={2} placeholder="Andamento / fundamentação" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" disabled={!!problem} onClick={send}>Registrar</Button>{problem ? <span className="text-xs text-muted-foreground sm:col-span-2">{problem}</span> : null}
      </div> : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}

function Coverage({ d, school, onSaved }: { d: Data; school: string; onSaved: () => void }) {
  const [covered, setCovered] = useState(""); const [kind, setKind] = useState("afastamento"); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [sub, setSub] = useState(""); const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const send = () => void rpc("record_nei_coverage_event", { _school: school, _covered: covered, _kind: kind, _starts: start, _ends: end || null, _substitute: kind === "substituicao" ? sub : null, _note: note })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setNote(""); setMsg(null); onSaved(); } });
  const ok = covered && start && note.trim().length >= 5 && (kind !== "substituicao" || (sub && sub !== covered));
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Mediações vigentes e cobertura</h2>
      {d.mediations.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma mediação vigente registrada pela escola. Isso não prova ausência de necessidade.</p> : (
        <table className="w-full text-sm"><caption className="sr-only">Mediações e cobertura</caption><thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Estudante</th><th className="p-1">Mediador</th><th className="p-1">Vigência</th><th className="p-1">Cobertura</th></tr></thead>
          <tbody>{d.mediations.map((m) => { const c = coverageState(m); return <tr key={m.logical_id} className="border-t border-border"><td className="p-1">{m.student_name ?? m.student_id}</td><td className="p-1">{m.mediator_name ?? "—"}</td><td className="p-1">{dt(m.valid_from)}–{dt(m.valid_to)}</td>
            <td className="p-1"><StatusBadge tone={c === "descoberta" ? "danger" : c === "substituida" ? "warning" : "success"}>{c === "descoberta" ? (m.mediator_active ? "Descoberta (afastado sem substituto)" : "Descoberta (atuação encerrada)") : c === "substituida" ? "Coberta por substituto" : "Coberta"}</StatusBadge></td></tr>; })}</tbody></table>)}
      {d.coverage.length ? <ul className="text-xs space-y-0.5">{d.coverage.map((c, i) => <li key={i}>{c.kind === "afastamento" ? "Afastamento" : "Substituição"} de {c.covered_name ?? "—"}{c.substitute_name ? ` por ${c.substitute_name}` : ""} · {dt(c.starts_on)}–{dt(c.ends_on)}: {c.note}</li>)}</ul> : null}
      <div className="grid gap-1 rounded-md border border-dashed border-border p-3 text-sm sm:grid-cols-3">
        <p className="font-medium sm:col-span-3">Registrar afastamento ou substituição (registro do NEI; não é ato funcional do DP)</p>
        <select className={input} value={covered} onChange={(e) => setCovered(e.target.value)} aria-label="Profissional"><option value="">Profissional</option>{d.professionals.map((p) => <option key={p.engagement_id} value={p.engagement_id}>{p.name}</option>)}</select>
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo"><option value="afastamento">Afastamento</option><option value="substituicao">Substituição</option></select>
        {kind === "substituicao" ? <select className={input} value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Substituto"><option value="">Substituto</option>{d.professionals.filter((p) => p.engagement_id !== covered).map((p) => <option key={p.engagement_id} value={p.engagement_id}>{p.name}</option>)}</select> : <span />}
        <input type="date" className={input} aria-label="Início" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="date" className={input} aria-label="Fim (opcional)" value={end} onChange={(e) => setEnd(e.target.value)} />
        <input className={input} placeholder="Observação (mín. 5)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" disabled={!ok} onClick={send}>Registrar</Button>{msg ? <span className="text-xs text-destructive sm:col-span-2">{msg}</span> : null}
      </div>
    </section>
  );
}

function Barriers({ d, school, onSaved }: { d: Data; school: string; onSaved: () => void }) {
  const [cat, setCat] = useState("arquitetonica"); const [desc, setDesc] = useState(""); const [prio, setPrio] = useState(""); const [res, setRes] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const create = () => void rpc("open_nei_barrier", { _school: school, _student: null, _category: cat, _description: desc, _priority: prio || null, _resource: res || null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setDesc(""); setMsg(null); onSaved(); } });
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Barreiras e recursos de acessibilidade</h2>
      {d.barriers.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma barreira registrada.</p> : d.barriers.map((b) => <BarrierCard key={b.id} b={b} onSaved={onSaved} />)}
      <div className="grid gap-1 rounded-md border border-dashed border-border p-3 text-sm sm:grid-cols-3">
        <select className={input} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">{Object.entries(BARRIER_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className={input} placeholder="Prioridade (opcional)" value={prio} onChange={(e) => setPrio(e.target.value)} />
        <input className={input} placeholder="Recurso necessário (opcional)" value={res} onChange={(e) => setRes(e.target.value)} />
        <textarea className={input + " sm:col-span-3"} rows={2} placeholder="Descrição da barreira (mín. 10)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button size="sm" disabled={desc.trim().length < 10} onClick={create}>Registrar barreira</Button>{msg ? <span className="text-xs text-destructive">{msg}</span> : null}
      </div>
    </section>
  );
}

function BarrierCard({ b, onSaved }: { b: Bar; onSaved: () => void }) {
  const last = b.events[b.events.length - 1]!;
  const [st, setSt] = useState<BarrierStatus>("em-andamento"); const [note, setNote] = useState(""); const [ref, setRef] = useState(""); const [prio, setPrio] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const bad = note.trim().length < 3 || (barrierClosed(st) && note.trim().length < 10);
  const send = () => void rpc("record_nei_barrier_event", { _barrier: b.id, _expected_seq: last.seq, _status: st, _note: note, _priority: prio || null, _resource: null, _external_ref: ref || null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setNote(""); setMsg(null); onSaved(); } });
  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-1">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{BARRIER_CATEGORY[b.category]}</span><StatusBadge tone={barrierClosed(last.status) ? "neutral" : "warning"}>{BARRIER_LABEL[last.status]}</StatusBadge>
        {last.priority ? <span className="text-xs">Prioridade: {last.priority}</span> : null}{last.external_ref ? <span className="text-xs">Ref. compra/patrimônio: {last.external_ref}</span> : null}{b.has_student ? <span className="text-xs">ligada a estudante</span> : null}</div>
      <p>{b.description}</p>{last.resource_needed ? <p className="text-xs">Recurso: {last.resource_needed}</p> : null}
      <ol className="text-xs space-y-0.5">{b.events.map((e) => <li key={e.seq}>#{e.seq} {dt(e.recorded_at)} · {BARRIER_LABEL[e.status]}: {e.note}</li>)}</ol>
      {!barrierClosed(last.status) ? <div className="grid gap-1 sm:grid-cols-4">
        <select className={input} value={st} onChange={(e) => setSt(e.target.value as BarrierStatus)} aria-label="Situação">{(["em-andamento", "resolvida", "sem-solucao"] as BarrierStatus[]).map((s) => <option key={s} value={s}>{BARRIER_LABEL[s]}</option>)}</select>
        <input className={input} placeholder="Nova prioridade" value={prio} onChange={(e) => setPrio(e.target.value)} />
        <input className={input} placeholder="Nº do processo de compra/patrimônio" value={ref} onChange={(e) => setRef(e.target.value)} />
        <Button size="sm" disabled={bad} onClick={send}>Registrar</Button>
        <textarea className={input + " sm:col-span-4"} rows={2} placeholder={barrierClosed(st) ? "Justificativa (mín. 10)" : "Andamento"} value={note} onChange={(e) => setNote(e.target.value)} />
      </div> : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}
