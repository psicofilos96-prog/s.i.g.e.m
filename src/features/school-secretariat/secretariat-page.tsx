import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { readYears, locateStudent, type YearOption } from "@/features/year-transition/year-transition-source";
import { lookupMessage, normalizeStudentLookup, type StudentLookupKind } from "@/features/year-transition/year-transition";
import {
  issueLabel, lifeKindLabel, orderLife, secretariatMessage, yearStateLabel,
  type LifeEvent, type PendingRow, type SecretariatOverview,
} from "./secretariat";
import { listInstitutionalClasses } from "@/features/classes/institutional-class-source";
import { eligibleClassOptions, type ClassOption } from "./secretariat";
import { allocateToClass, readMovementTypes, readOverview, readPending, reassignClass, readSchoolLife, recordExit } from "./secretariat-source";
import { DocumentPendenciesPanel } from "./document-pendencies-panel";

const today = () => new Date().toISOString().slice(0, 10);
const errText = (e: unknown) => secretariatMessage(e instanceof Error ? e.message : String(e));

export function SecretariatPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [years, setYears] = useState<YearOption[]>([]);
  const [school, setSchool] = useState(""); const [year, setYear] = useState(""); const [on, setOn] = useState(today());
  useEffect(() => {
    supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false })
      .then(({ data }) => {
        const m = new Map<string, string>();
        for (const r of (data ?? []) as { school_id: string; official_name: string }[]) if (!m.has(r.school_id)) m.set(r.school_id, r.official_name);
        const list = [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
        setSchools(list);
        if (list.length === 1) setSchool(list[0]!.id);
      });
    readYears().then((ys) => { setYears(ys); const open = ys.filter((y) => y.state === "aberto"); if (open.length === 1) setYear(open[0]!.id); }).catch(() => setYears([]));
  }, []);
  const ready = school && year && on;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria Escolar" title="O que precisa de você hoje"
        description="Só a sua escola. Comece pelos itens em destaque." />
      <section aria-label="Contexto" className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Escola
          <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">{schools === null ? "Carregando…" : "Escolha a escola"}</option>
            {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="text-sm">Ano letivo
          <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Escolha o ano</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label} — {yearStateLabel(y.state)}</option>)}
          </select></label>
        <label className="text-sm">Data de referência<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      </section>
      {ready ? <Station key={`${school}|${year}|${on}`} school={school} year={year} on={on} />
        : <EmptyState title="Escolha escola, ano e data" description="A estação mostra apenas a escola escolhida; não há lista da rede." />}
    </div>
  );
}

function Count({ label, value, helper }: { label: string; value: number | null | undefined; helper?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function WorkCard({ tone, value, title, hint }: { tone: "attention" | "ok"; value: number | null | undefined; title: string; hint: string }) {
  return (
    <div className={tone === "attention" ? "rounded-2xl border-2 border-warning bg-card p-5 shadow-panel" : "rounded-2xl border border-border bg-card p-5"}>
      <p className="font-display text-4xl font-semibold tabular-nums">{value ?? "—"}</p>
      <p className="mt-1 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{value === 0 ? "Nada a fazer aqui." : hint}</p>
    </div>
  );
}

function Station({ school, year, on }: { school: string; year: string; on: string }) {
  const [ov, setOv] = useState<SecretariatOverview | null>(null);
  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const load = () => {
    setErr(null);
    readOverview(school, year, on).then(setOv, (e) => setErr(errText(e)));
    readPending(school, year, on).then(setPending, () => setPending([]));
  };
  useEffect(load, [school, year, on]);
  if (err) return <StatePanel tone="warning" title="Painel indisponível" description={err} />;
  if (!ov) return <p className="text-sm text-muted-foreground" role="status">Carregando painel…</p>;
  const movements = Object.entries(ov.movements);
  const decisions = Object.entries(ov.transition_decisions);
  return (
    <div className="space-y-6">
      <section aria-labelledby="ano" className="flex flex-wrap items-center gap-2 text-sm">
        <h2 id="ano" className="font-semibold">{ov.year.label ?? year}</h2>
        <StatusBadge tone={ov.year.state === "aberto" ? "success" : "neutral"}>{yearStateLabel(ov.year.state)}</StatusBadge>
        {ov.year.state !== "aberto" ? <span className="text-muted-foreground">Somente consulta: gravações exigem ano aberto pelo ato próprio.</span> : null}
      </section>
      <section aria-label="Trabalho de hoje" className="grid gap-4 sm:grid-cols-3">
        <WorkCard tone={ov.allocations.enrollments_without_class ? "attention" : "ok"} value={ov.allocations.enrollments_without_class}
          title="Alunos sem turma" hint="Abra o aluno na lista abaixo e use Enturmar." />
        <WorkCard tone={pending?.length ? "attention" : "ok"} value={pending?.length ?? null}
          title="Pendências de cadastro" hint="Cada item mostra o que falta para concluir." />
        <WorkCard tone={ov.enrollments.start_unknown ? "attention" : "ok"} value={ov.enrollments.start_unknown}
          title="Matrículas sem data de início" hint="Não entram na contagem de ativos até ter a data." />
      </section>
      <section aria-label="Ações rápidas" className="flex flex-wrap gap-3">
        <Button asChild size="lg"><Link to="/matriculas/nova">Nova matrícula</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/documentos-escolares" search={{ escola: school }}>Emitir documento</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/mapa-estatistico">Mapa do mês</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/turmas">Turmas</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/secretaria/vagas">Vagas</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/secretaria/livro-matricula">Livro de Matrícula</Link></Button>
      </section>
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Ver números da escola</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Count label="Matrículas registradas" value={ov.enrollments.total} />
          <Count label="Ativas na data" value={ov.enrollments.active} helper="com data de início" />
          <Count label="Encerradas" value={ov.enrollments.ended} />
          <Count label="Começam depois" value={ov.enrollments.not_started} />
          <Count label="Alunos em turma" value={ov.allocations.active_episodes} />
          <Count label="Turmas com alunos" value={ov.allocations.classes_with_students} />
        </div>
      </details>
      <section aria-labelledby="mov" className="grid gap-4 sm:grid-cols-2 text-sm">
        <div><h2 id="mov" className="font-semibold">Movimentações no ano</h2>
          {movements.length ? <ul>{movements.map(([k, n]) => <li key={k}>{k}: {n}</li>)}</ul> : <p className="text-muted-foreground">Nenhuma movimentação registrada.</p>}</div>
        <div><h2 className="font-semibold">Decisões de renovação para este ano</h2>
          {decisions.length ? <ul>{decisions.map(([k, n]) => <li key={k}>{k}: {n}</li>)}</ul> : <p className="text-muted-foreground">Nenhuma decisão registrada.</p>}</div>
      </section>
      <section aria-labelledby="pend" className="space-y-2">
        <h2 id="pend" className="font-semibold">Pendências de cadastro</h2>
        {pending === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pendência nesta data.</p>
          : <ul className="max-h-80 divide-y divide-border overflow-auto rounded-md border border-border text-sm">
              {pending.slice(0, 200).map((p) => (
                <li key={p.enrollment_id} className="flex items-center justify-between gap-2 p-2">
                  <span>{p.display_name} — {issueLabel(p.issue)}</span>
                  <Button size="sm" variant="outline" onClick={() => setStudent({ id: p.student_id, name: p.display_name })}>Abrir</Button>
                </li>))}
              {pending.length > 200 ? <li className="p-2 text-muted-foreground">Mais {pending.length - 200} pendências; use a busca exata.</li> : null}
            </ul>}
      </section>
      <Lookup school={school} year={year} onFound={setStudent} />
      {student ? <SchoolLife key={student.id} school={school} year={year} on={on} student={student} onChanged={load} /> : null}
    </div>
  );
}

function Lookup({ school, year, onFound }: { school: string; year: string; onFound: (s: { id: string; name: string }) => void }) {
  const [kind, setKind] = useState<StudentLookupKind>("cpf"); const [value, setValue] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setMsg(null);
    const v = normalizeStudentLookup(kind, value);
    if (!v) { setMsg(lookupMessage("entrada-invalida")); return; }
    try {
      const r = await locateStudent(school, kind, v, year);
      if (r.outcome === "encontrado" && r.student_id) onFound({ id: r.student_id, name: r.display_name ?? "Estudante" });
      else setMsg(lookupMessage(r.outcome));
    } catch (e) { setMsg(errText(e)); }
  }
  return (
    <section aria-labelledby="busca" className="space-y-2">
      <h2 id="busca" className="font-semibold">Encontrar um aluno</h2>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Identificador" className="rounded-md border border-input bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as StudentLookupKind)}>
          <option value="cpf">CPF</option><option value="inep">INEP</option></select>
        <Input className="max-w-xs" aria-label="Valor" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button onClick={go}>Localizar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Sem busca por nome. Cada busca é registrada sem guardar o valor.</p>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
    </section>
  );
}

function SchoolLife({ school, year, on, student, onChanged }: { school: string; year: string; on: string; student: { id: string; name: string }; onChanged: () => void }) {
  const [rows, setRows] = useState<LifeEvent[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = () => readSchoolLife(school, student.id).then((r) => setRows(orderLife(r)), (e) => setErr(errText(e)));
  useEffect(() => { void load(); }, []);
  const current = rows?.find((r) => r.kind === "vinculo-anual" && !r.superseded && r.school_id === school && (r.detail as { ano?: string }).ano === year);
  // Turma atual = última entrada em turma desta escola sem saída registrada; o banco revalida e recusa episódio encerrado.
  const ended = new Set(rows?.filter((r) => r.kind === "saida-turma").map((r) => r.ref_id));
  const episode = rows?.filter((r) => r.kind === "turma" && !r.superseded && r.school_id === school && !ended.has(r.ref_id)).at(-1)?.ref_id ?? null;
  return (
    <section aria-labelledby="vida" className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="vida" className="font-semibold">Vida escolar — {student.name}</h2>
        <Button asChild size="sm" variant="outline"><Link to="/documentos-escolares" search={{ escola: school, aluno: student.id }}>Documentos</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/preparacao-ano">Renovar matrícula</Link></Button>
      </div>
      {err ? <StatePanel tone="warning" title="Vida escolar indisponível" description={err} />
        : rows === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : <ol className="space-y-1 text-sm">{rows.map((r) => (
            <li key={`${r.kind}:${r.ref_id}`} className={r.superseded ? "text-muted-foreground line-through" : ""}>
              <span className="font-medium">{lifeKindLabel(r.kind)}</span> · {r.occurred_on ?? "data não declarada"} · {r.label}
              {r.school_id && r.school_id !== school ? " (outra escola)" : ""}
            </li>))}</ol>}
      <p className="text-xs text-muted-foreground">Transferência encerra a origem e registra o destino; a história nunca é movida. O destino constitui o próprio vínculo.</p>
      {current ? <Actions school={school} year={year} enrollment={current.ref_id} episode={episode} on={on} onDone={() => { void load(); onChanged(); }} /> : null}
      {rows ? <DocumentPendenciesPanel school={school} student={student.id} enrollment={current?.ref_id ?? null} on={on} /> : null}
    </section>
  );
}

function Actions({ school, year, enrollment, episode, on, onDone }: { school: string; year: string; enrollment: string; episode: string | null; on: string; onDone: () => void }) {
  const [classId, setClassId] = useState(""); const [classes, setClasses] = useState<ClassOption[] | null>(null);
  useEffect(() => { listInstitutionalClasses({ validOn: on }).then((l) => setClasses(eligibleClassOptions(l, school, year)), () => setClasses([])); }, [school, year, on]); const [from, setFrom] = useState(on); const [reason, setReason] = useState("");
  const [types, setTypes] = useState<{ id: string; version: number; label: string }[] | null>(null);
  const [type, setType] = useState(""); const [dest, setDest] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { readMovementTypes().then(setTypes); }, []);
  async function run(f: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try { await f(); setMsg(ok); onDone(); } catch (e) { setMsg(errText(e)); }
  }
  const t = types?.find((x) => `${x.id}@${x.version}` === type);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="space-y-2 rounded-md border border-border p-3 text-sm">
        <legend className="font-medium">Enturmar</legend>
        {classes === null ? <p className="text-muted-foreground">Carregando turmas…</p>
          : classes.length === 0 ? <p className="text-muted-foreground">Nenhuma turma ativa desta escola e ano na data escolhida.</p>
          : <div role="radiogroup" aria-label="Turma" className="max-h-56 space-y-1 overflow-y-auto">
            {classes.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 has-[:checked]:border-primary">
                <input type="radio" name="turma" value={c.id} checked={classId === c.id} onChange={() => setClassId(c.id)} className="mt-1" />
                <span><span className="font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">Capacidade não informada</span></span>
              </label>))}
          </div>}
        <DateInput aria-label="A partir de" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Button size="sm" disabled={!classId.trim()} onClick={() => run(() => allocateToClass({ enrollment, classId: classId.trim(), validFrom: from, reason: reason.trim() || null }), "Enturmação registrada.")}>Registrar enturmação</Button>
        {episode ? <Button size="sm" variant="outline" disabled={!classId.trim() || !reason.trim()} onClick={() => run(() => reassignClass({ episode, toClass: classId.trim(), effectiveOn: from, reason: reason.trim() }), "Remanejamento registrado: a turma anterior termina na véspera e o histórico foi preservado.")}>Remanejar para esta turma</Button> : null}
      </fieldset>
      <fieldset className="space-y-2 rounded-md border border-border p-3 text-sm">
        <legend className="font-medium">Saída ou transferência</legend>
        {types === null ? <p className="text-muted-foreground">Carregando tipos…</p>
          : types.length === 0 ? <p className="text-muted-foreground">Nenhum tipo de movimentação homologado. A saída fica indisponível até a homologação.</p>
          : <>
            <select aria-label="Tipo" className="w-full rounded-md border border-input bg-background p-2" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Tipo homologado</option>{types.map((x) => <option key={`${x.id}@${x.version}`} value={`${x.id}@${x.version}`}>{x.label}</option>)}</select>
            <Input aria-label="Escola de destino" placeholder="Escola de destino (opcional)" value={dest} onChange={(e) => setDest(e.target.value)} />
            <Button size="sm" variant="destructive" disabled={!t || !reason.trim()} onClick={() => t && run(() => recordExit({ enrollment, effectiveOn: from, movementType: t.id, typeVersion: t.version, destinationSchool: dest.trim() || null, reason: reason.trim() }), "Saída registrada; a origem foi preservada.")}>Registrar saída</Button>
          </>}
      </fieldset>
      <label className="text-sm sm:col-span-2">Motivo (obrigatório na saída e no remanejamento)<Input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {msg ? <p role="status" className="text-sm sm:col-span-2">{msg}</p> : null}
    </div>
  );
}
