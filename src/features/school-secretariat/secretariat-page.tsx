import { EnrollmentFormDialog } from "./enrollment-form/enrollment-form-dialog";
import { ConsentPanel } from "./consent-panel";
import { AbsenceJustificationPanel } from "./absence-justification-panel";
import { HomeHospitalCarePanel } from "./home-hospital-care-panel";
import { ProtectionPanel } from "./protection-panel";
import { DeathRecordPanel, ReceiveTransferPanel, RenewalBatchPanel, TransferDeclarationButton, VaccinationPanel } from "./movement-panels";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { Search, UserPlus, Users, ArrowRightLeft, FileText, BookOpen, ClipboardList, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SECRETARIAT_TASKS } from "./secretariat-tasks";
import { formatAcademicDateNumeric, operationalToday } from "@/lib/academic-date";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useState } from "react";
import { useActiveYear } from "@/features/academic-year/active-year";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { readYears, locateStudent, locateStudentByName, type StudentNameMatch, type YearOption } from "@/features/year-transition/year-transition-source";
import { lookupMessage, normalizeStudentLookup, type StudentLookupKind } from "@/features/year-transition/year-transition";
import {
  decisionLabel, issueLabel, lifeKindLabel, movementTypeLabel, orderLife, secretariatMessage,
  type LifeEvent, type PendingRow, type SecretariatOverview,
} from "./secretariat";
import { listInstitutionalClasses } from "@/features/classes/institutional-class-source";
import { eligibleClassOptions, type ClassOption } from "./secretariat";
import { allocateToClass, readMovementTypes, readOverview, readPending, reassignClass, readSchoolLife, recordExit } from "./secretariat-source";
import { DocumentPendenciesPanel } from "./document-pendencies-panel";
import { SECRETARIAT_READ_CAPABILITY } from "./school-context";

const today = () => operationalToday();
const errText = (e: unknown) => secretariatMessage(e instanceof Error ? e.message : String(e));

export function SecretariatPage() {
  const own = useOwnSchoolId();
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [years, setYears] = useState<YearOption[]>([]);
  const [school, setSchool] = useState(""); const [year, setYear] = useState(""); const [on, setOn] = useState(today());
  const active = useActiveYear();
  useEffect(() => { if (active.id) setYear(active.id); }, [active.id]);
  useEffect(() => {
    void Promise.all([readCurrentSchoolNames(), (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)("school_capability_schools", { _capability: SECRETARIAT_READ_CAPABILITY })]).then(([m, a]) => {
        const ok = new Set(((a.data ?? []) as unknown[]).map((x) => (typeof x === "string" ? x : (Object.values(x as object)[0] as string))));
        const list = sortedSchoolOptions(m).filter((x) => ok.has(x.id));
        setSchools(list);
        if (list.length === 1 && list[0]) setSchool(list[0].id);
      });
    readYears().then(setYears).catch(() => setYears([]));
  }, []);
  useEffect(() => { if (own) setSchool(own); }, [own]);
  const ready = school && year && on;
  return (
    <div className="space-y-6">
      <section aria-label="Contexto da unidade" className="flex flex-wrap items-center gap-3 text-sm">
        {own || schools?.length === 1 ? <strong className="min-w-0 text-base">{schools?.find((s) => s.id === school)?.name ?? "Minha escola"}</strong> : <label className="flex items-center gap-2 font-medium">Escola
          <select className="rounded-md border border-input bg-card px-3 py-2 font-normal" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">{schools === null ? "Carregando…" : "Escolha a escola"}</option>
            {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>}
        <span className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">Ano letivo: {active.label}</span>
      </section>
      {ready ? <Station key={`${school}|${year}|${on}`} school={school} year={year} on={on} onDateChange={setOn} /> : <EmptyState title="Selecione a escola e aguarde o ano letivo" description="A busca e as ações da Secretaria serão exibidas para a unidade autorizada." />}
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

function WorkCard({ value, title, hint, onClick }: { value: number | null | undefined; title: string; hint: string; onClick: () => void }) {
  return <div className="flex items-center gap-1">
    <Button variant="outline" className={`h-auto gap-2 rounded-md px-3 py-2 text-sm ${value ? "border-warning/40 bg-warning/10 text-warning-foreground" : "bg-card text-muted-foreground"}`} onClick={onClick}>
      <span className="font-semibold tabular-nums">{value ?? "—"}</span><span>{title}</span>
    </Button><ContextHint text={hint} label={`Sobre ${title}`} />
  </div>;
}

function Station({ school, year, on, onDateChange }: { school: string; year: string; on: string; onDateChange: (value: string) => void }) {
  const navigate = useNavigate();
  const [ov, setOv] = useState<SecretariatOverview | null>(null);
  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [movement, setMovement] = useState<"transfer" | "renewal" | null>(null);
  const [showPending, setShowPending] = useState(false);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const load = () => {
    setErr(null);
    readOverview(school, year, on).then(setOv, (e) => setErr(errText(e)));
    readPending(school, year, on).then(setPending, () => setPending(null));
  };
  useEffect(load, [school, year, on]);
  const [movTypes, setMovTypes] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => { readMovementTypes().then(setMovTypes, () => setMovTypes([])); }, []);
  if (err) return <StatePanel tone="warning" title="Painel indisponível" description={err} />;
  if (!ov) return <SkeletonState label="Carregando painel" />;
  const movements = Object.entries(ov.movements);
  const decisions = Object.entries(ov.transition_decisions);
  const hasAttention = ov.allocations.enrollments_without_class > 0
    || ov.enrollments.start_unknown > 0
    || (pending !== null && pending.length > 0);
  const quickActions = [
    { id: "matricular", title: "Matricular aluno", hint: "Registrar uma nova matrícula", icon: UserPlus, run: () => { void navigate({ to: "/matriculas/nova" }); } },
    { id: "achar", title: "Achar aluno", hint: "Localizar pelo nome, CPF ou INEP", icon: Search, run: () => document.getElementById("busca-valor")?.focus() },
    { id: "trocar-turma", title: "Trocar de turma", hint: "Localize o aluno e escolha outra turma", icon: Users, run: () => document.getElementById("busca-valor")?.focus() },
    { id: "transferir", title: "Transferir ou dar saída", hint: "Localize o aluno para registrar a movimentação", icon: ArrowRightLeft, run: () => document.getElementById("busca-valor")?.focus() },
    { id: "renovar", title: "Renovar matrícula", hint: "Preparar a continuidade no próximo ano", icon: RotateCcw, run: () => { void navigate({ to: "/preparacao-ano" }); } },
    { id: "vagas", title: "Ver vagas", hint: "Consultar vagas disponíveis nas turmas", icon: ClipboardList, run: () => { void navigate({ to: "/secretaria/vagas" }); } },
  ];
  const secondaryTasks = SECRETARIAT_TASKS.filter((t) => !["matricular", "achar", "trocar-turma", "transferir", "renovar", "vagas"].includes(t.id));
  return (
    <div className="space-y-6">
      <Lookup school={school} year={year} onFound={setStudent} />
      {hasAttention ? <section aria-label="Atenção necessária" className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <h2 className="font-semibold">Atenção necessária</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {ov.allocations.enrollments_without_class > 0 ? <Button variant="outline" className="h-auto justify-start gap-2 bg-card px-3 py-3" onClick={() => document.getElementById("busca-valor")?.focus()}><strong className="tabular-nums">{ov.allocations.enrollments_without_class}</strong><span>Alunos sem turma</span></Button> : null}
          {pending && pending.length > 0 ? <Button variant="outline" className="h-auto justify-start gap-2 bg-card px-3 py-3" onClick={() => setShowPending((v) => !v)}><strong className="tabular-nums">{pending.length}</strong><span>Pendências de cadastro</span></Button> : null}
          {ov.enrollments.start_unknown > 0 ? <Button variant="outline" className="h-auto justify-start gap-2 bg-card px-3 py-3" onClick={() => { void navigate({ to: "/secretaria/livro-matricula" }); }}><strong className="tabular-nums">{ov.enrollments.start_unknown}</strong><span>Matrículas sem data</span></Button> : null}
        </div>
      </section> : null}
      {showPending && <section aria-label="Pendências de cadastro" className="space-y-2">
        <h2 className="font-semibold">Pendências de cadastro</h2>
        {pending === null ? <p className="text-sm text-muted-foreground">Não foi possível consultar as pendências agora.</p> : !pending.length ? <p className="text-sm text-muted-foreground">Nenhuma pendência nesta data.</p> : <ul className="max-h-64 divide-y overflow-auto rounded-lg border bg-card">{pending.map((p) => <li key={p.enrollment_id} className="flex items-center justify-between gap-3 p-3 text-sm"><span>{p.display_name} · {issueLabel(p.issue)}</span><Button size="sm" variant="outline" onClick={() => setStudent({ id: p.student_id, name: p.display_name })}>Abrir</Button></li>)}</ul>}
      </section>}
      <section aria-labelledby="tarefas" className="space-y-3">
        <h2 id="tarefas" className="font-semibold">Ações rápidas</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return <li key={action.id}><Button variant="outline" className="h-full min-h-24 w-full justify-start gap-3 whitespace-normal rounded-xl border-border bg-card p-4 text-left shadow-none hover:bg-accent" onClick={action.run}>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <span className="min-w-0"><span className="block font-semibold">{action.title}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{action.hint}</span></span>
            </Button></li>;
          })}
        </ul>
      </section>
      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Outros acessos da Secretaria</summary>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {secondaryTasks.map((t) => {
            const Icon = t.id === "documento" || t.id === "oficios" || t.id === "docserv" ? FileText : t.id === "alimentacao-especial" ? BookOpen : ClipboardList;
            return <li key={t.id}>
              {t.target.kind === "route"
                ? <Button asChild variant="outline" className="h-auto min-h-14 w-full justify-start gap-2 whitespace-normal text-left"><Link to={t.target.to}>{t.title}</Link></Button>
                : <Button variant="outline" className="h-auto min-h-14 w-full justify-start gap-2 whitespace-normal text-left" onClick={() => document.getElementById("busca-valor")?.focus()}><Icon className="size-4" />{t.title}</Button>}
            </li>;
          })}
          <li><Button variant="outline" className="h-auto min-h-14 w-full justify-start gap-2 text-left" onClick={() => setMovement("transfer")}><ArrowRightLeft className="size-4" />Receber transferência</Button></li>
          <li><Button variant="outline" className="h-auto min-h-14 w-full justify-start gap-2 text-left" onClick={() => setMovement("renewal")}><RotateCcw className="size-4" />Rematrícula em lote</Button></li>
          <li><Button asChild variant="outline" className="h-auto min-h-14 w-full justify-start gap-2 text-left"><Link to="/secretaria/modelos-de-texto" search={{ documento: undefined }}><BookOpen className="size-4" />Modelos de texto</Link></Button></li>
          <li><EnrollmentFormDialog kind="branco" schoolId={school} yearLabel={ov.year.label} trigger={<Button variant="outline" className="h-auto min-h-14 w-full justify-start gap-2 text-left"><FileText className="size-4" />Ficha de Matrícula em branco</Button>} /></li>
        </ul>
      </details>
      <Dialog open={movement !== null} onOpenChange={(open) => { if (!open) setMovement(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{movement === "transfer" ? "Receber transferência" : "Rematrícula em lote"}</DialogTitle></DialogHeader>{movement === "transfer" ? <ReceiveTransferPanel school={school} year={year} on={on} /> : movement === "renewal" ? <RenewalBatchPanel school={school} /> : null}</DialogContent></Dialog>
      <details className="rounded-xl border border-border bg-card p-4">
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
      <details className="border-t border-border pt-3 text-sm"><summary className="cursor-pointer font-medium">Movimentações e renovações</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h2 className="font-semibold">Movimentações no ano</h2>{movements.length ? <ul>{movements.map(([k, n]) => <li key={k}>{movementTypeLabel(k, movTypes)}: {n}</li>)}</ul> : <p className="text-muted-foreground">Nenhuma movimentação registrada.</p>}</div><div><h2 className="font-semibold">Renovações</h2>{decisions.length ? <ul>{decisions.map(([k, n]) => <li key={k}>{decisionLabel(k)}: {n}</li>)}</ul> : <p className="text-muted-foreground">Nenhuma decisão registrada.</p>}</div></div></details>
      <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium">Data de referência</summary><div className="mt-3 max-w-xs"><DateInput aria-label="Data de referência" value={on} onChange={(e) => onDateChange(e.target.value)} /></div></details>
      {student ? <SchoolLife key={student.id} school={school} year={year} on={on} student={student} onChanged={load} /> : null}
    </div>
  );
}

function Lookup({ school, year, onFound }: { school: string; year: string; onFound: (s: { id: string; name: string }) => void }) {
  const [kind, setKind] = useState<StudentLookupKind | "nome">("nome"); const [value, setValue] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [matches, setMatches] = useState<StudentNameMatch[] | null>(null);
  async function go() {
    setMsg(null); setMatches(null);
    if (kind === "nome") {
      if (value.trim().split(/\\s+/).length < 2) { setMsg("Digite nome e sobrenome."); return; }
      try { const r = await locateStudentByName(school, value.trim(), null); setMatches(r); if (!r.length) setMsg("Nenhum aluno encontrado com esse nome."); }
      catch (e) { setMsg(errText(e)); }
      return;
    }
    const v = normalizeStudentLookup(kind, value);
    if (!v) { setMsg(lookupMessage("entrada-invalida")); return; }
    try {
      const r = await locateStudent(school, kind, v, year);
      if (r.outcome === "encontrado" && r.student_id) onFound({ id: r.student_id, name: r.display_name ?? "Estudante" });
      else setMsg(lookupMessage(r.outcome));
    } catch (e) { setMsg(errText(e)); }
  }
  return (
    <section aria-labelledby="busca" className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="busca-valor" className="mb-2 block text-sm font-semibold">Buscar aluno</label>
          <Input id="busca-valor" className="h-12 w-full text-base" aria-label={kind === "nome" ? "Nome do aluno" : "Número do documento"} placeholder={kind === "nome" ? "Digite o nome e sobrenome do aluno" : kind === "cpf" ? "Digite o CPF do aluno" : "Digite o INEP do aluno"} inputMode={kind === "nome" ? "text" : "numeric"} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void go(); }} />
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="busca-tipo" className="mb-2 block text-sm font-medium text-muted-foreground">Buscar por</label>
          <select id="busca-tipo" aria-label="Buscar por" className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(e) => { setKind(e.target.value as StudentLookupKind | "nome"); setMatches(null); setMsg(null); }}>
            <option value="nome">Nome</option><option value="cpf">CPF</option><option value="inep">INEP</option>
          </select>
        </div>
        <Button className="h-12 px-6" onClick={go}><Search className="size-4" />Buscar</Button>
      </div>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
      {matches && matches.length > 0 ? (
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-md border border-border text-sm">
          {matches.slice(0, 50).map((m) => (
            <li key={m.student_id}>
              <Button variant="ghost" type="button" className="flex h-auto w-full flex-wrap items-baseline justify-between gap-2 p-3 text-left hover:bg-accent" onClick={() => onFound({ id: m.student_id, name: m.display_name })}>
                <span className="font-medium">{m.display_name}</span>
                <span className="text-xs text-muted-foreground">{[m.birth_date ? formatAcademicDateNumeric(m.birth_date as never) : null, m.mother_name ? `mãe: ${m.mother_name}` : null, m.last_class].filter(Boolean).join(" · ")}</span>
              </Button>
            </li>))}
        </ul>) : null}
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
        : rows === null ? <SkeletonState label="Carregando" />
        : <ol className="space-y-1 text-sm">{rows.map((r) => (
            <li key={`${r.kind}:${r.ref_id}`} className={r.superseded ? "text-muted-foreground line-through" : ""}>
              <span className="font-medium">{lifeKindLabel(r.kind)}</span> · {r.occurred_on ?? "data não declarada"} · {r.label}
              {r.school_id && r.school_id !== school ? " (outra escola)" : ""}
            </li>))}</ol>}
      <p className="text-xs text-muted-foreground">Na transferência, a matrícula aqui é encerrada e a história do aluno fica guardada.</p>
      {current ? <Actions school={school} year={year} enrollment={current.ref_id} episode={episode} on={on} onDone={() => { void load(); onChanged(); }} /> : null}
      {rows ? <DeathRecordPanel enrollment={current?.ref_id ?? null} student={student.id} onDone={() => { void load(); onChanged(); }} /> : null}
      {rows ? <ProtectionPanel school={school} student={student.id} /> : null}
      {rows ? <VaccinationPanel school={school} student={student.id} /> : null}
      {rows ? <ConsentPanel school={school} student={student.id} studentName={student.name} /> : null}
      {rows ? <AbsenceJustificationPanel school={school} student={student.id} /> : null}
      {rows ? <HomeHospitalCarePanel school={school} student={student.id} /> : null}
      {rows ? <DocumentPendenciesPanel school={school} student={student.id} enrollment={current?.ref_id ?? null} on={on} /> : null}
    </section>
  );
}

function Actions({ school, year, enrollment, episode, on, onDone }: { school: string; year: string; enrollment: string; episode: string | null; on: string; onDone: () => void }) {
  const [classId, setClassId] = useState(""); const [classes, setClasses] = useState<ClassOption[] | null>(null);
  useEffect(() => { listInstitutionalClasses({ validOn: on }).then((l) => setClasses(eligibleClassOptions(l, school, year)), () => setClasses([])); }, [school, year, on]); const [from, setFrom] = useState(on); const [reason, setReason] = useState("");
  const [types, setTypes] = useState<{ id: string; version: number; label: string }[] | null>(null);
  const [type, setType] = useState(""); const [dest, setDest] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [transferred, setTransferred] = useState<string | null>(null);
  useEffect(() => { readMovementTypes().then(setTypes); }, []);
  async function run(f: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try { await f(); setMsg(ok); onDone(); } catch (e) { setMsg(errText(e)); }
  }
  const t = types?.find((x) => `${x.id}@${x.version}` === type);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="space-y-2 rounded-md border border-border p-3 text-sm">
        <legend className="font-medium">Colocar em turma ou trocar de turma</legend>
        {classes === null ? <SkeletonState label="Carregando turmas" />
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
        {types === null ? <SkeletonState label="Carregando tipos" />
          : types.length === 0 ? <p className="text-muted-foreground">Os tipos de saída ainda não foram cadastrados. Peça à SEMED para cadastrá-los.</p>
          : <>
            <select aria-label="Tipo" className="w-full rounded-md border border-input bg-background p-2" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Escolha o tipo de saída</option>{types.map((x) => <option key={`${x.id}@${x.version}`} value={`${x.id}@${x.version}`}>{x.label}</option>)}</select>
            <Input aria-label="Escola de destino" placeholder="Escola de destino (opcional)" value={dest} onChange={(e) => setDest(e.target.value)} />
            <Button size="sm" variant="destructive" disabled={!t || !reason.trim()} onClick={() => t && run(async () => { await recordExit({ enrollment, effectiveOn: from, movementType: t.id, typeVersion: t.version, destinationSchool: dest.trim() || null, reason: reason.trim() }); if (t.id === "transferencia") setTransferred(enrollment); }, "Saída registrada; a origem foi preservada.")}>Registrar saída</Button>
            {transferred ? <TransferDeclarationButton enrollment={transferred} /> : null}
          </>}
      </fieldset>
      <label className="text-sm sm:col-span-2">Motivo (obrigatório na saída e no remanejamento)<Input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {msg ? <p role="status" className="text-sm sm:col-span-2">{msg}</p> : null}
    </div>
  );
}
