import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DateInput } from "@/components/sigem/date-input";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { buildPanel, clinicalWarning, display, followupMessage, visibleRecords, type FollowupRecord, type Measure } from "./followup-panel";
import { readCategories, readPanel, readRecords, schoolsInScope, writeRecord } from "./followup-source";

const today = () => new Date().toISOString().slice(0, 10);

export function SchoolFollowupPage({ perspective }: { perspective: "orientacao" | "direcao" }) {
  const title = perspective === "orientacao" ? "Orientação Pedagógica" : "Direção Escolar";
  const [schools, setSchools] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [school, setSchool] = useState("");
  const [validOn, setValidOn] = useState(today());
  const [knownAt, setKnownAt] = useState("");
  useEffect(() => { schoolsInScope().then((s) => { setSchools(s); if (s.length === 1) setSchool(s[0]!); }, (e: Error) => setErr(followupMessage(e.message))); }, []);
  return (
    <div className="space-y-6">
      <PageHeader title={title} description="Acompanhamento da escola a partir dos registros oficiais. Nota e frequência continuam sendo do professor; aqui nada é alterado." />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !schools ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : schools.length === 0 ? <EmptyState title="Nenhuma escola no seu alcance" description="Sua atuação não tem permissão vigente com alcance de escola. O acesso não vem do nome do cargo." />
        : (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <label>Escola<select className="mt-1 block rounded border bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
                <option value="">Escolha…</option>{schools.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label>Data de referência<DateInput value={validOn} onChange={(e) => setValidOn(e.target.value)} /></label>
              <label>Conhecido até (opcional)<input type="datetime-local" className="mt-1 block rounded border bg-background p-2" value={knownAt} onChange={(e) => setKnownAt(e.target.value)} /></label>
            </div>
            {school && <SchoolView key={`${school}|${validOn}|${knownAt}`} school={school} validOn={validOn} knownAt={knownAt ? new Date(knownAt).toISOString() : null} />}
          </>)}
    </div>
  );
}

function SchoolView({ school, validOn, knownAt }: { school: string; validOn: string; knownAt: string | null }) {
  const [panel, setPanel] = useState<ReturnType<typeof buildPanel> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ label: string; records: readonly string[] } | null>(null);
  const [subject, setSubject] = useState<{ kind: "escola" | "turma" | "estudante"; id: string; label: string }>({ kind: "escola", id: school, label: "Escola" });
  useEffect(() => { readPanel(school, { validOn, knownAt }).then((i) => setPanel(buildPanel(i)), (e: Error) => setErr(followupMessage(e.message))); }, [school, validOn, knownAt]);
  if (err) return <StatePanel tone="danger" title="Não foi possível carregar o painel" description={err} />;
  if (!panel) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const Cell = ({ label, v }: { label: string; v: Measure }) => (
    <button className="rounded border bg-card p-3 text-left disabled:opacity-70" disabled={v.value === null} onClick={() => setDrill({ label, records: v.records })} aria-label={`${label}: ${display(v.value)}. Ver registros`}>
      <span className="block text-xs text-muted-foreground">{label}</span><span className="text-lg font-semibold">{display(v.value)}</span>
    </button>);
  return (
    <div className="space-y-6">
      <section aria-labelledby="painel" className="space-y-3">
        <h2 id="painel" className="font-semibold">Painel da escola</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Cell label="Turmas" v={panel.totals.classes} /><Cell label="Matrículas vigentes" v={panel.totals.enrollments} /><Cell label="Estudantes em turma" v={panel.totals.allocated} />
        </div>
        {panel.classes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma turma registrada ou legível para sua conta.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Turma</th><th className="p-2">Estudantes</th><th className="p-2">Fechamentos de frequência</th><th className="p-2">Fechamentos avaliativos</th><th className="p-2"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{panel.classes.map((c) => (
              <tr key={c.classId} className="border-t">
                <td className="p-2">{c.name}</td>
                {([["Estudantes", c.students], ["Fechamentos de frequência", c.attendanceClosings], ["Fechamentos avaliativos", c.assessmentClosings]] as const).map(([l, v]) => (
                  <td key={l} className="p-2"><button className="underline disabled:no-underline" disabled={v.value === null} onClick={() => setDrill({ label: `${c.name} — ${l}`, records: v.records })}>{display(v.value)}</button></td>))}
                <td className="p-2 space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setSubject({ kind: "turma", id: c.classId, label: c.name })}>Acompanhamento</Button>
                  <Link to="/diario/turmas/$turmaId/avaliacao/conselho" params={{ turmaId: c.classId }} className="text-xs underline">Conselho de Classe</Link>
                </td>
              </tr>))}</tbody></table></div>)}
        {drill && (
          <div role="region" aria-label={`Registros: ${drill.label}`} className="rounded border p-3 text-sm">
            <div className="flex justify-between"><strong>{drill.label}</strong><Button size="sm" variant="ghost" onClick={() => setDrill(null)}>Fechar</Button></div>
            {drill.records.length === 0 ? <p>Nenhum registro.</p> : <ul className="mt-1 max-h-48 overflow-auto font-mono text-xs">{drill.records.map((r) => <li key={r}>{r}</li>)}</ul>}
          </div>)}
      </section>
      <section aria-labelledby="pend" className="space-y-2">
        <h2 id="pend" className="font-semibold">Pendências derivadas</h2>
        {panel.pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pendência derivada dos registros legíveis. Isso não significa que tudo está em ordem: fontes não disponíveis não entram aqui.</p> : (
          <ul className="text-sm space-y-1">{panel.pending.map((p, i) => (
            <li key={i}>{p.label}{p.kind === "matricula-sem-turma" && <> — <button className="underline" onClick={() => setSubject({ kind: "estudante", id: p.subjectId, label: `Estudante ${p.subjectId}` })}>acompanhar</button></>}</li>))}</ul>)}
      </section>
      <Records school={school} subject={subject} knownAt={knownAt} onBack={() => setSubject({ kind: "escola", id: school, label: "Escola" })} />
    </div>
  );
}

function Records({ school, subject, knownAt, onBack }: { school: string; subject: { kind: "escola" | "turma" | "estudante"; id: string; label: string }; knownAt: string | null; onBack: () => void }) {
  const [rs, setRs] = useState<FollowupRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cats, setCats] = useState<{ value_id: string; label: string }[] | null>(null);
  const [form, setForm] = useState({ category: "", body: "", visibility: "acompanhamento-da-escola", occurredOn: today() });
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<{ logical: string; items: FollowupRecord[] } | null>(null);
  const load = useCallback(async () => {
    try { setRs(await readRecords({ school, subjectKind: subject.kind, subjectId: subject.id, knownAt })); setErr(null); } catch (e) { setErr(followupMessage((e as Error).message)); }
  }, [school, subject, knownAt]);
  useEffect(() => { void load(); readCategories().then(setCats, () => setCats([])); }, [load]);
  const warn = useMemo(() => clinicalWarning(form.body), [form.body]);
  const catLabel = (id: string) => cats?.find((c) => c.value_id === id)?.label ?? id;
  async function save(base: FollowupRecord | null, kind: "registro" | "retificacao" | "anulacao") {
    setMsg(null);
    const reason = kind === "registro" ? null : window.prompt(kind === "anulacao" ? "Motivo da anulação:" : "Motivo da correção:");
    if (kind !== "registro" && !reason?.trim()) return;
    const body = kind === "retificacao" ? window.prompt("Texto corrigido:", base!.body) : form.body;
    if (kind === "retificacao" && !body?.trim()) return;
    try {
      await writeRecord({ baseId: base?.id ?? null, kind, school, subjectKind: subject.kind, subjectId: subject.id,
        category: kind === "registro" ? form.category : base!.category_value_id, body: body ?? null,
        visibility: kind === "registro" ? form.visibility : base!.visibility, occurredOn: kind === "registro" ? form.occurredOn : base!.occurred_on, reason });
      setForm({ ...form, body: "" }); await load();
    } catch (e) { setMsg(followupMessage((e as Error).message)); }
  }
  async function openHistory(logical: string) {
    try { setHistory({ logical, items: await readRecords({ school, logicalId: logical }) }); } catch (e) { setMsg(followupMessage((e as Error).message)); }
  }
  return (
    <section aria-labelledby="reg" className="space-y-3">
      <div className="flex items-center justify-between"><h2 id="reg" className="font-semibold">Acompanhamento — {subject.label}</h2>
        {subject.kind !== "escola" && <Button size="sm" variant="ghost" onClick={onBack}>Voltar à escola</Button>}</div>
      {err ? <StatePanel tone="warning" title="Acompanhamentos não disponíveis" description={err} />
        : !rs ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : visibleRecords(rs).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro de acompanhamento.</p>
        : <ul className="space-y-2 text-sm">{visibleRecords(rs).map((r) => (
            <li key={r.id} className="rounded border p-2">
              <p className="text-xs text-muted-foreground">{new Date(`${r.occurred_on}T12:00:00`).toLocaleDateString("pt-BR")} · {catLabel(r.category_value_id)} · {r.visibility === "autoria" ? "visível só para quem registrou" : "acompanhamento da escola"}{r.version > 1 ? ` · versão ${r.version}` : ""}</p>
              <p className="whitespace-pre-wrap">{r.body}</p>
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => void save(r, "retificacao")}>Corrigir</Button>
                <Button size="sm" variant="ghost" onClick={() => void save(r, "anulacao")}>Anular</Button>
                {r.version > 1 && <Button size="sm" variant="ghost" onClick={() => void openHistory(r.logical_id)}>Histórico</Button>}
              </div>
            </li>))}</ul>}
      {history && <div className="rounded border p-2 text-xs" role="region" aria-label="Histórico do registro">
        <div className="flex justify-between"><strong>Histórico</strong><Button size="sm" variant="ghost" onClick={() => setHistory(null)}>Fechar</Button></div>
        <ol>{history.items.sort((a, b) => a.version - b.version).map((h) => <li key={h.id}>v{h.version} · {h.event_kind} · {new Date(h.recorded_at).toLocaleString("pt-BR")}{h.reason ? ` · motivo: ${h.reason}` : ""} — {h.body}</li>)}</ol></div>}
      {!err && (
        <div className="space-y-2 rounded border p-3 text-sm">
          <h3 className="font-medium">Novo registro</h3>
          {cats && cats.length === 0 ? <p className="text-muted-foreground">Nenhuma categoria de acompanhamento aprovada no catálogo. Sem categoria, não é possível registrar.</p> : (
            <>
              <label className="block">Categoria<select className="mt-1 block w-full rounded border bg-background p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Escolha…</option>{(cats ?? []).map((c) => <option key={c.value_id} value={c.value_id}>{c.label}</option>)}</select></label>
              <label className="block">Data do fato<DateInput value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} /></label>
              <label className="block">Registro<textarea maxLength={4000} className="mt-1 block w-full rounded border bg-background p-2" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
              {warn && <p role="alert" className="text-sm">{warn}</p>}
              <label className="block">Visibilidade<select className="mt-1 block rounded border bg-background p-2" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                <option value="acompanhamento-da-escola">Acompanhamento da escola</option><option value="autoria">Só para mim</option></select></label>
              <Button disabled={!form.category || !form.body.trim()} onClick={() => void save(null, "registro")}>Registrar</Button>
            </>)}
        </div>)}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
