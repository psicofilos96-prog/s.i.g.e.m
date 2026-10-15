import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Copy,
  FileBarChart, FileText, ListChecks, MessageSquareText, NotebookPen, Plus, Search, UsersRound, XCircle,
} from "lucide-react";
import { AbsenceState } from "@/components/sigem/states";
import { cn } from "@/lib/utils";
import { diaryContext, DEFAULT_DIARY_PROFESSIONAL_ID, studentsForClassOn, diaryToday, type DiarySearch } from "../diary-data";
import { dailyAgenda, findLessonEntry, useLocalLessonRecords, type AgendaItem } from "../lesson-records";
import { attendanceSlots, attendanceStore, useLocalAttendance } from "../attendance";
import {
  CLASS_DIARY_TABS, bnccCodes, dayChipLabel, dayResume, initials, resolveTab, share, weekDays, weekRangeLabel,
  type ClassDiaryTab,
} from "./class-diary-model";

export type ClassDiarySearch = DiarySearch & { aba?: string };

const TAB_ICON: Record<ClassDiaryTab, typeof BookOpen> = {
  aulas: UsersRound, frequencia: CalendarDays, conteudos: NotebookPen,
  avaliacoes: ClipboardCheck, observacoes: MessageSquareText, relatorios: FileBarChart,
};

function Field({ label, value, options, onChange }: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-[8.5rem] flex-col gap-1 text-xs font-medium text-dp-ink">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-dp-line bg-card px-3 text-sm text-dp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dp-action"
      >
        {options.length === 0 ? <option value="">Sem opções</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Panel({ icon: Icon, title, children, foot }: { icon: typeof BookOpen; title: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-dp-line bg-card p-4 shadow-dp">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dp-ink"><Icon className="size-4" />{title}</h2>
      <div className="flex-1">{children}</div>
      {foot ? <div className="mt-3 text-xs text-dp-muted">{foot}</div> : null}
    </section>
  );
}

function Metric({ tone, icon: Icon, label, value, sub }: { tone: "ok" | "bad" | "info" | "violet"; icon: typeof BookOpen; label: string; value: string; sub?: string | null }) {
  const toneCls = { ok: "bg-dp-ok-soft text-dp-ok", bad: "bg-dp-bad-soft text-dp-bad", info: "bg-dp-select text-dp-action", violet: "bg-dp-violet-soft text-dp-violet" }[tone];
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-center", toneCls)}>
      <Icon className="size-5" aria-hidden="true" />
      <span className="text-[11px] font-medium text-dp-ink-2">{label}</span>
      <span className="text-xl font-bold">{value}</span>
      {sub ? <span className="text-[11px] text-dp-ink-2">({sub})</span> : null}
    </div>
  );
}

export function ClassDiaryWorkspace({ search }: { search: ClassDiarySearch }) {
  const navigate = useNavigate();
  const tab = resolveTab(search.aba);
  const date = search.data ?? diaryToday();
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, date);
  const local = useLocalLessonRecords();
  useLocalAttendance();
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  const set = (changes: Partial<ClassDiarySearch>) =>
    void navigate({ to: "/diario", search: (prev: ClassDiarySearch) => ({ ...prev, ...changes }) });

  const units = context.units;
  const unitId = search.unidade && units.some((u) => u.value === search.unidade) ? search.unidade : units[0]?.value ?? "";
  const inUnit = context.assignments.filter((a) => a.unitId === unitId);
  const classOpts = [...new Map(inUnit.map((a) => [a.classId, { value: a.classId, label: a.className }])).values()];
  const classId = search.turma && classOpts.some((c) => c.value === search.turma) ? search.turma : classOpts[0]?.value ?? "";
  const inClass = inUnit.filter((a) => a.classId === classId);
  const fieldOpts = [...new Set(inClass.map((a) => a.field))].map((f) => ({ value: f, label: f }));
  const field = search.componente && fieldOpts.some((f) => f.value === search.componente) ? search.componente : fieldOpts[0]?.value ?? "";
  const assignment = inClass.find((a) => a.field === field);
  const yearOpts = (context.years.length ? context.years : [date.slice(0, 4)]).map((y) => ({ value: y, label: y }));

  const days = weekDays(date);
  const agendaByDay = useMemo(
    () =>
      Object.fromEntries(
        days.map((d) => [
          d,
          assignment
            ? dailyAgenda(context.professionalId, d, local).filter((i) => i.assignmentId === assignment.record.id)
            : [],
        ]),
      ) as Record<string, AgendaItem[]>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days.join(), assignment?.record.id, local, context.professionalId],
  );
  const today = agendaByDay[date] ?? [];
  const entryIds = [...new Set(today.map((i) => i.entryId).filter(Boolean))] as string[];
  const entries = entryIds.map((id) => findLessonEntry(id, local)).filter((e) => e !== undefined);
  const entry = entries[0];
  const slots = entries.flatMap((e) => attendanceSlots(e).map((s) => ({ ...s, entryId: e.id })));
  const records = Object.fromEntries(entryIds.map((id) => [id, attendanceStore.get(id)]));

  const students = classId ? studentsForClassOn(classId, date) : [];
  const filtered = students.filter((s) => s.student.personName.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const resume = dayResume(
    entryIds.map((id) => ({ marks: records[id]?.marks ?? null, slotKeys: slots.filter((s) => s.entryId === id).map((s) => s.key) })),
    students.map((s) => s.student.id),
  );
  const marked = resume.present === null ? null : resume.present + (resume.absent ?? 0) + (resume.unmarked ?? 0);
  const registered = today.filter((i) => i.state === "Registrada").length;
  const skills = bnccCodes(entry ? `${entry.optional.skills ?? ""} ${entry.summary}` : "");
  const refDate = date.split("-").reverse().join("/");
  const baseSearch = { professor: search.professor, unidade: unitId, turma: classId, componente: field, data: date };

  return (
    <div className="diary-premium -m-4 min-h-full bg-dp-bg p-4 text-dp-ink sm:-m-6 sm:p-6">
      {/* Cabeçalho do módulo */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-4">
          <BookOpen className="mt-1 size-12 shrink-0 text-dp-navy" strokeWidth={1.75} aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-dp-ink">Diário de Classe</h1>
            <p className="text-sm text-dp-ink-2">Registro de aulas, frequência, conteúdos e avaliações</p>
            <nav aria-label="Caminho" className="mt-2 flex items-center gap-1 text-xs text-dp-muted">
              <Link to="/" className="text-dp-action hover:underline">Início</Link>
              <ChevronRight className="size-3" />Docente<ChevronRight className="size-3" />
              <span className="text-dp-ink-2">Diário de Classe</span>
            </nav>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field label="Ano Letivo" value={search.ano ?? yearOpts[0]!.value} options={yearOpts} onChange={(v) => set({ ano: v })} />
          <Field label="Escola" value={unitId} options={units} onChange={(v) => set({ unidade: v, turma: undefined, componente: undefined })} />
          <Field label="Turma" value={classId} options={classOpts} onChange={(v) => set({ turma: v, componente: undefined })} />
          <Field label="Disciplina" value={field} options={fieldOpts} onChange={(v) => set({ componente: v })} />
        </div>
      </header>

      {/* Abas */}
      <nav role="tablist" aria-label="Seções do Diário" className="mt-5 flex overflow-x-auto rounded-xl border border-dp-line bg-dp-surface-2">
        {CLASS_DIARY_TABS.map((t) => {
          const Icon = TAB_ICON[t.id];
          const active = t.id === tab;
          return (
            <button
              key={t.id} role="tab" aria-selected={active} type="button"
              onClick={() => set({ aba: t.id === "aulas" ? undefined : t.id })}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dp-action",
                active ? "rounded-xl bg-dp-action text-primary-foreground" : "text-dp-ink hover:bg-dp-select",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />{t.label}
            </button>
          );
        })}
      </nav>

      {!context.assignments.length ? (
        <div className="mt-6 rounded-xl border border-dp-line bg-card p-6">
          <AbsenceState kind="nenhum-registro" title="Nenhuma turma sua nesta data" description="Quando houver turma atribuída a você, ela aparece aqui." />
        </div>
      ) : tab === "aulas" ? (
        <>
          {/* Semana */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Semana anterior" onClick={() => days[0] && set({ data: shiftWeek(days[0], -7) })} className="grid size-10 place-items-center rounded-lg border border-dp-line bg-card hover:bg-dp-select"><ChevronLeft className="size-4" /></button>
            <span className="px-2 text-sm font-semibold">{weekRangeLabel(days)}</span>
            <button type="button" aria-label="Próxima semana" onClick={() => days[0] && set({ data: shiftWeek(days[0], 7) })} className="grid size-10 place-items-center rounded-lg border border-dp-line bg-card hover:bg-dp-select"><ChevronRight className="size-4" /></button>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => {
                const n = agendaByDay[d]?.length ?? 0;
                const sel = d === date;
                return (
                  <button key={d} type="button" aria-pressed={sel} onClick={() => set({ data: d })}
                    className={cn("flex h-12 w-24 flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                      sel ? "border-dp-action bg-dp-select font-semibold" : "border-dp-line bg-card hover:bg-dp-surface-2")}>
                    <span>{dayChipLabel(d)}</span>
                    <span className="text-[11px] text-dp-muted">{n ? `${n} ${n === 1 ? "aula" : "aulas"}` : "sem aula"}</span>
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex gap-2">
              <Link to="/diario/registrar" search={{ ...baseSearch, ...(assignment ? { atuacao: assignment.record.id } : {}) }}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-dp-action/40 bg-card px-4 text-sm font-medium text-dp-action hover:bg-dp-select">
                <Copy className="size-4" />Copiar aula
              </Link>
              <Link to="/diario/registrar" search={{ ...baseSearch, ...(assignment ? { atuacao: assignment.record.id } : {}), ...(today[0] ? { bloco: today[0].blockId } : {}) }}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-dp-action px-4 text-sm font-semibold text-primary-foreground hover:bg-dp-action-hover">
                <Plus className="size-4" />Nova aula
              </Link>
            </div>
          </div>

          {/* Cartão da aula */}
          <section className="mt-4 grid gap-4 rounded-xl border border-dp-line bg-card p-4 shadow-dp lg:grid-cols-[9rem_1.3fr_1.3fr_1fr]">
            <div>
              <span className="inline-block rounded-lg bg-dp-select px-4 py-2 text-sm font-semibold text-dp-action">
                {today.length ? `${today.length}ª aula${today.length > 1 ? "s" : ""}`.replace(/^1ª aula$/, "1ª aula") : "Sem aula"}
              </span>
              <p className="mt-3 text-sm text-dp-ink-2">{today[0] ? `${today[0].block.start} - ${today[today.length - 1]!.block.end}` : "Sem horário nesta data"}</p>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold">Conteúdo da aula</h3>
              <p className="min-h-10 rounded-lg border border-dp-line px-3 py-2 text-sm">{entry ? entry.summary : <span className="text-dp-muted">Ainda não registrado</span>}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.length ? <span className="rounded-md bg-dp-surface-2 px-2 py-1 text-xs font-semibold">BNCC</span> : null}
                {skills.map((c) => <span key={c} className="rounded-md bg-dp-surface-2 px-2 py-1 text-xs">{c}</span>)}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold">Metodologia / Observações da aula</h3>
              <p className="min-h-16 rounded-lg border border-dp-line px-3 py-2 text-sm">
                {entry && (entry.optional.strategies || entry.optional.observations)
                  ? [entry.optional.strategies, entry.optional.observations].filter(Boolean).join(" ")
                  : <span className="text-dp-muted">Ainda não registrado</span>}
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold">Recursos utilizados</h3>
                <LessonBadge items={today} />
              </div>
              <fieldset disabled className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-dp-muted" aria-describedby="recursos-nota">
                {["Lousa", "Projetor", "Livro didático", "Vídeo", "Atividade impressa", "Outro"].map((r) => (
                  <label key={r} className="flex items-center gap-2"><input type="checkbox" className="size-4" />{r}</label>
                ))}
              </fieldset>
              <p id="recursos-nota" className="mt-1 text-[11px] text-dp-muted">Ainda não disponível.</p>
              {entry ? (
                <Link to="/diario/registros/$registroId" params={{ registroId: entry.id }} className="mt-2 inline-block text-xs font-medium text-dp-action hover:underline">Abrir registro</Link>
              ) : null}
            </div>
          </section>

          {/* Tabela */}
          <section className="mt-4 overflow-hidden rounded-xl border border-dp-line bg-card shadow-dp">
            <div className="flex flex-wrap items-center gap-2 border-b border-dp-line p-3">
              <label className="relative flex-1 sm:max-w-xs">
                <span className="sr-only">Pesquisar estudante</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dp-muted" />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Pesquisar estudante"
                  className="h-9 w-full rounded-lg border border-dp-line pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dp-action" />
              </label>
              {entryIds[0] ? (
                <Link to="/diario/chamada/$registroId" params={{ registroId: entryIds[0] }} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-dp-action px-3 text-sm font-medium text-primary-foreground hover:bg-dp-action-hover">
                  <ListChecks className="size-4" />Fazer chamada
                </Link>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="bg-dp-head text-left text-xs font-semibold">
                  <tr>
                    <th rowSpan={2} className="w-12 px-3 py-2">Nº</th>
                    <th rowSpan={2} className="px-3 py-2">Estudante ({students.length})</th>
                    <th colSpan={Math.max(1, slots.length)} className="border-l border-dp-line px-3 py-1 text-center">Frequência</th>
                    <th rowSpan={2} className="border-l border-dp-line px-3 py-2">Avaliações</th>
                    <th rowSpan={2} className="w-24 px-3 py-2 text-center">Ações</th>
                  </tr>
                  <tr>
                    {slots.length
                      ? slots.map((s) => <th key={`${s.entryId}-${s.key}`} className="border-l border-dp-line px-2 py-1 text-center font-medium">{s.label.replace("Aula ", "")}ª aula</th>)
                      : <th className="border-l border-dp-line px-2 py-1 text-center font-medium text-dp-muted">sem aula registrada</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s, i) => (
                    <tr key={s.student.id} className="border-t border-dp-line odd:bg-card even:bg-dp-surface-2/50 hover:bg-dp-select/60">
                      <td className="px-3 py-2 text-center">{current * pageSize + i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-dp-select text-[11px] font-semibold text-dp-navy" aria-hidden="true">{initials(s.student.personName)}</span>
                          {s.student.personName}
                        </span>
                      </td>
                      {slots.length ? slots.map((sl) => {
                        const mark = records[sl.entryId]?.marks[sl.key]?.[s.student.id];
                        return (
                          <td key={`${sl.entryId}-${sl.key}`} className="border-l border-dp-line px-2 py-2 text-center">
                            {mark === "Presente" ? <CheckCircle2 className="mx-auto size-5 text-dp-ok" aria-label="Presente" />
                              : mark === "Ausente" ? <XCircle className="mx-auto size-5 text-dp-bad" aria-label="Ausente" />
                              : <span className="text-dp-muted" title="Não registrada">—</span>}
                          </td>
                        );
                      }) : <td className="border-l border-dp-line px-2 py-2 text-center text-dp-muted">—</td>}
                      <td className="border-l border-dp-line px-3 py-2">
                        <button type="button" onClick={() => set({ aba: "avaliacoes" })} className="text-xs text-dp-action hover:underline">Ver notas</button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link to="/diario/turmas/$turmaId/alunos/$alunoId" params={{ turmaId: classId, alunoId: s.student.id }} aria-label={`Abrir ficha de ${s.student.personName}`} className="inline-grid size-8 place-items-center rounded-md hover:bg-dp-select">
                          <FileText className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!students.length ? <div className="p-6"><AbsenceState kind="nenhum-registro" title="Nenhum estudante nesta turma na data" compact /></div>
                : !filtered.length ? <div className="p-6"><AbsenceState kind="nenhum-resultado" compact /></div> : null}
            </div>
            <div className="flex items-center gap-3 border-t border-dp-line p-3 text-sm text-dp-ink-2">
              <select aria-label="Estudantes por página" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-9 rounded-lg border border-dp-line bg-card px-2">
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              de {filtered.length} estudantes
              <div className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid size-8 place-items-center rounded-md hover:bg-dp-select disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                {Array.from({ length: pages }, (_, n) => (
                  <button key={n} type="button" aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)}
                    className={cn("size-8 rounded-md text-sm", n === current ? "bg-dp-action text-primary-foreground" : "hover:bg-dp-select")}>{n + 1}</button>
                )).slice(0, 7)}
                <button type="button" aria-label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid size-8 place-items-center rounded-md hover:bg-dp-select disabled:opacity-40"><ChevronRight className="size-4" /></button>
              </div>
            </div>
          </section>

          {/* Quadros */}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel icon={BookOpen} title={`Resumo da Turma - ${refDate}`} foot={resume.present === null ? "Sem chamada registrada nesta data." : null}>
              <div className="grid grid-cols-4 gap-2">
                <Metric tone="ok" icon={UsersRound} label="Presentes" value={resume.present === null ? "—" : String(resume.present)} sub={share(resume.present, marked)} />
                <Metric tone="bad" icon={XCircle} label="Ausentes" value={resume.absent === null ? "—" : String(resume.absent)} sub={share(resume.absent, marked)} />
                <Metric tone="info" icon={ClipboardCheck} label="Aulas registradas" value={today.length ? `${registered} de ${today.length}` : "—"} />
                <Metric tone="violet" icon={NotebookPen} label="Conteúdos" value={entry ? String(entries.length) : "—"} />
              </div>
            </Panel>
            <Panel icon={ListChecks} title="Habilidades BNCC trabalhadas">
              {skills.length ? <ul className="space-y-2">{skills.map((c) => <li key={c} className="rounded-md bg-dp-surface-2 px-2 py-1 text-xs font-semibold">{c}</li>)}</ul>
                : <p className="text-sm text-dp-muted">Nenhuma habilidade registrada nesta aula.</p>}
            </Panel>
            <Panel icon={CalendarDays} title="Próximas Avaliações">
              <p className="text-sm text-dp-muted">As avaliações cadastradas ficam na aba Avaliações.</p>
              <button type="button" onClick={() => set({ aba: "avaliacoes" })} className="mt-2 text-sm font-medium text-dp-action hover:underline">Ver avaliações</button>
            </Panel>
            <Panel icon={FileText} title="Observações Gerais da Turma">
              <p className="rounded-lg bg-dp-surface-2 p-3 text-sm">{entry?.optional.observations || <span className="text-dp-muted">Nenhuma observação registrada nesta data.</span>}</p>
            </Panel>
          </div>
        </>
      ) : (
        <TabLinks tab={tab} classId={classId} search={baseSearch} />
      )}
    </div>
  );
}

function shiftWeek(monday: string, delta: number) {
  const d = new Date(`${monday}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function LessonBadge({ items }: { items: AgendaItem[] }) {
  if (!items.length) return null;
  const state = items.every((i) => i.state === "Registrada") ? "Aula registrada"
    : items.some((i) => i.state === "Rascunho em elaboração") ? "Rascunho" : "Pendente";
  const cls = state === "Aula registrada" ? "bg-dp-ok-soft text-dp-ok" : state === "Rascunho" ? "bg-dp-warn-soft text-dp-warn" : "bg-dp-surface-2 text-dp-ink-2";
  return <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", cls)}>{state}</span>;
}

/** Abas que levam às telas oficiais do Diário mantendo escola, turma, disciplina e data. */
function TabLinks({ tab, classId, search }: { tab: ClassDiaryTab; classId: string; search: DiarySearch }) {
  const card = "flex items-center gap-3 rounded-xl border border-dp-line bg-card p-4 shadow-dp hover:bg-dp-select";
  const items: Record<Exclude<ClassDiaryTab, "aulas">, React.ReactNode> = {
    frequencia: <>
      <Link to="/diario/chamadas" search={search} className={card}><ListChecks className="size-5 text-dp-action" />Chamadas da turma</Link>
      <Link to="/diario/frequencia" search={search} className={card}><CalendarDays className="size-5 text-dp-action" />Frequência acumulada</Link>
    </>,
    conteudos: <>
      <Link to="/diario/aulas" search={search} className={card}><NotebookPen className="size-5 text-dp-action" />Aulas e conteúdos registrados</Link>
      <Link to="/planejamento" className={card}><BookOpen className="size-5 text-dp-action" />Planejamento</Link>
    </>,
    avaliacoes: classId
      ? <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} className={card}><ClipboardCheck className="size-5 text-dp-action" />Avaliações e notas da turma</Link>
      : <AbsenceState kind="nenhum-registro" title="Escolha uma turma" compact />,
    observacoes: classId
      ? <Link to="/diario/turmas/$turmaId/alunos" params={{ turmaId: classId }} className={card}><MessageSquareText className="size-5 text-dp-action" />Estudantes e observações</Link>
      : <AbsenceState kind="nenhum-registro" title="Escolha uma turma" compact />,
    relatorios: <Link to="/diario/documentos" search={search} className={card}><FileBarChart className="size-5 text-dp-action" />Documentos e relatórios do Diário</Link>,
  };
  return <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items[tab as Exclude<ClassDiaryTab, "aulas">]}</div>;
}
