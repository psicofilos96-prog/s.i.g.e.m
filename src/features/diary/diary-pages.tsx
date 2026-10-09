import { CompositionLine } from "@/features/classes/class-composition-views";
import { todayIso } from "@/features/classes/institutional-class-source";
import { rosterStudents } from "@/features/students/institutional-roster";
import { isDiaryCloud } from "./diary-persistence-mode";
import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  DOCUMENT_AVAILABILITY_LABEL,
  documentAvailability,
  documentDependenciesForSession,
  type DocumentAvailability,
} from "@/features/assessment/document-dependencies";
import { diaryClassCalendar, useComposedCalendarRefresh } from "./diary-calendar";
import { diaryReference } from "./diary-session-state";
import { NextLessonCard } from "./next-lesson-card";
import { TEACHER_DAY_STEPS } from "./teacher-day";
import { TeachingSupportNotice } from "@/features/teacher-diary/teaching-support-notice";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  ClipboardList,
  FileBarChart,
  FileText,
  GraduationCap,
  History,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { AuditTimeline, DetailSection } from "@/components/sigem/operational";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { getDemonstrationStudent } from "@/features/students/students-data";
import { cn } from "@/lib/utils";
import {
  AcademicContextSelector,
  ClassCard,
  ContextFacts,
  DiaryHeader,
  FutureFeatureState,
  LessonSummary,
  PedagogicalAssignmentIdentity,
  StudentList,
} from "./diary-context";
import { DailyAgenda, LessonsTimelineSection } from "./lesson-pages";
import { DiaryQueryFilters } from "./diary-query-filters";
import { JourneyLink, PendingSection, ResumeSection } from "./diary-journey-view";
import { usePrimaryJourneyAction } from "./diary-journey-hooks";
import { InfantChildObservations, InfantExperiencesTimeline } from "./infant-experience-pages";
import { InfantDescriptiveReportPanel } from "./infant-descriptive-report-panel";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  DIARY_DEMONSTRATION_NOTE,
  DIARY_PRIVACY_NOTE,
  dayLabel,
  diaryContext,
  diarySearch,
  diaryStageForClass,
  lessonsForProfessional,
  studentsForClassOn,
  type DiarySearch,
} from "./diary-data";

function useDiary(search: DiarySearch) {
  return diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
}
function filteredAssignments(search: DiarySearch) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  return context.assignments.filter(
    (item) =>
      (!search.unidade || item.unitId === search.unidade) &&
      (!search.turma || item.classId === search.turma) &&
      (!search.componente || item.field === search.componente) &&
      (!search.ano || item.periodLabel.includes(search.ano)) &&
      (!search.periodo || item.periodLabel === search.periodo),
  );
}
function ContextControls({
  search,
  base,
}: {
  search: DiarySearch;
  base: "/diario" | "/diario/turmas" | "/diario/aulas" | "/diario/documentos";
}) {
  const context = useDiary(search);
  const navigate = useNavigate();
  return (
    <AcademicContextSelector
      context={context}
      search={search}
      hideDate={base === "/diario"}
      onChange={(next) => void navigate({ to: base, search: next })}
    />
  );
}

/** NDOC.UX — o dia em sequência: cada passo leva à seção da própria tela. */
function TeacherDaySteps() {
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    (el.closest("[tabindex]") as HTMLElement | null ?? el).focus?.({ preventScroll: true });
  };
  return (
    <nav aria-label="Seu dia de aula">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TEACHER_DAY_STEPS.map((step, i) => {
          const body = (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{step.label}</span>
                <span className="block text-xs text-muted-foreground">{step.hint}</span>
              </span>
            </>
          );
          const cls = "flex min-h-11 w-full items-center gap-2 rounded-md border border-border/70 bg-card p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
          return (
            <li key={step.id}>
              {step.to ? (
                <Link to={step.to} className={cls}>{body}</Link>
              ) : (
                <a href={`#${step.anchor}`} className={cls} onClick={(e) => { e.preventDefault(); go(step.anchor!); }}>{body}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DiaryHomePage({ search }: { search: DiarySearch }) {
  const context = useDiary(search);
  const assignments = filteredAssignments(search);
  const journeySearch = { ...search, professor: context.professionalId };
  const primary = usePrimaryJourneyAction(journeySearch, context.referenceDate);
  const selected = search.turma
    ? assignments.find((item) => item.classId === search.turma)
    : undefined;
  return (
    <div className="space-y-6">
      <DiaryHeader
        title={`Olá, ${context.personName.trim().split(/\s+/)[0] || "professor"}`}
        description="Sua aula agora, o que falta registrar e onde você parou."
        context={context}
      >
        {primary ? (
          <JourneyLink action={primary.action} variant="default" />
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/diario/turmas" search={search}>
              Minhas turmas
            </Link>
          </Button>
        )}
      </DiaryHeader>
      <TeacherDaySteps />
      {selected ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selected.unitName}</span> ·{" "}
          {selected.className} · {selected.field}
        </p>
      ) : null}
      <details className="rounded-md border border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Trocar escola, turma ou componente
        </summary>
        <div className="pt-3">
          <ContextControls search={search} base="/diario" />
        </div>
      </details>
      {!context.assignments.length ? (
        <StatePanel
          tone="warning"
          title="Sem atuação pedagógica vigente"
          description="Não há atuação vigente para esta data. O Diário só apresenta turmas associadas a atuações pedagógicas válidas; lotação na escola não concede acesso a turmas."
        />
      ) : null}
      <div id="proxima-aula" tabIndex={-1} className="scroll-mt-20 focus:outline-none">
        <NextLessonCard assignments={context.assignments} date={context.referenceDate} />
      </div>
      <TeachingSupportNotice date={context.referenceDate} classes={context.assignments} />
      <ResumeSection search={journeySearch} />
      <DailyAgenda search={search} />
      <section aria-labelledby="plan-title" className="flex flex-col gap-2 rounded-md border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="plan-title" className="text-base font-semibold text-foreground">Planejamento</h2>
          <p className="text-sm text-muted-foreground">Prepare as próximas aulas. Planejar não marca conteúdo como dado.</p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/planejamento">Abrir planejamento <ArrowRight /></Link>
        </Button>
      </section>
      <PendingSection search={journeySearch} />
      <section>
        <SectionHeader
          title="Turmas sob sua responsabilidade"
          description="Atuações vigentes na data consultada."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/diario/turmas" search={search}>
                Ver todas <ArrowRight />
              </Link>
            </Button>
          }
        />
        {assignments.length ? (
          <ul
            className="mt-2 divide-y divide-border/70"
            aria-label="Turmas sob sua responsabilidade"
          >
            {assignments.map((item) => (
              <li
                key={item.record.id}
                className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium text-foreground">
                    {item.className}{" "}
                    <span className="font-normal text-muted-foreground">· {item.field}</span>
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {item.unitName} · {item.stage} · {item.record.role}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to="/diario/turmas/$turmaId"
                    params={{ turmaId: item.classId }}
                    search={diarySearch(search, {
                      turma: item.classId,
                      unidade: item.unitId,
                      componente: item.field,
                    })}
                  >
                    Abrir turma <ArrowRight />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={UsersRound}
            title="Sem turmas neste contexto"
            description="Nenhuma atuação pedagógica vigente foi encontrada para os filtros selecionados."
            compact
          />
        )}
      </section>
      <p className="text-xs text-muted-foreground">{DIARY_DEMONSTRATION_NOTE}</p>
    </div>
  );
}

export function MyClassesPage({ search }: { search: DiarySearch }) {
  const context = useDiary(search);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const items = filteredAssignments(search).filter((item) =>
    `${item.className} ${item.unitName} ${item.field}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Minhas turmas"
        description="Troque de escola, turma ou componente sem perder o contexto da consulta."
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario" search={search}>
            Meu Diário
          </Link>
        </Button>
      </DiaryHeader>
      <ContextControls search={search} base="/diario/turmas" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar turma"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar turma, escola ou componente"
            className="pl-9"
          />
        </label>
        <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "list")}>
          <TabsList aria-label="Modo de visualização">
            <TabsTrigger value="cards">
              <LayoutGrid /> Cartões
            </TabsTrigger>
            <TabsTrigger value="list">
              <List /> Lista
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {!items.length ? (
        <EmptyState
          icon={UsersRound}
          title="Nenhuma turma encontrada"
          description="Ajuste a busca ou os filtros do contexto acadêmico."
        />
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ClassCard key={item.record.id} item={item} search={search} />
          ))}
        </div>
      ) : (
        <div className="surface-panel divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.record.id}
              className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <h2 className="font-semibold text-foreground">{item.className}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.unitName} · {item.stage} · {item.field}
                </p>
                <PedagogicalAssignmentIdentity item={item} />
                {isDiaryCloud() ? <CompositionLine classId={item.classId} on={todayIso()} /> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.studentCount} alunos</span>
                <Button asChild size="sm">
                  <Link
                    to="/diario/turmas/$turmaId"
                    params={{ turmaId: item.classId }}
                    search={diarySearch(search, {
                      turma: item.classId,
                      unidade: item.unitId,
                      componente: item.field,
                    })}
                  >
                    Abrir
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClassDiaryPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const context = useDiary(search);
  const item = context.assignments.find((entry) => entry.classId === classId);
  const klass = teachingClass(classId);
  const lessons = lessonsForProfessional(context.professionalId).filter(
    (lesson) => lesson.classId === classId,
  );
  const classSearch = diarySearch(search, {
    professor: context.professionalId,
    turma: classId,
    ...(item ? { unidade: item.unitId, componente: item.field } : {}),
  });
  const primary = usePrimaryJourneyAction(classSearch, context.referenceDate);
  if (!klass)
    return (
      <StatePanel
        tone="danger"
        title="Turma não encontrada"
        description="O identificador informado não corresponde a uma turma fictícia disponível."
      />
    );
  if (!item)
    return (
      <div className="space-y-5">
        <DiaryHeader
          title={klass.name}
          description="Esta turma não integra a atuação do professor na data consultada."
          context={context}
        />
        <StatePanel
          tone="warning"
          title="Contexto indisponível"
          description="A atuação pode estar fora da vigência, pertencer a outro professor ou não existir."
        />
      </div>
    );
  return (
    <div className="space-y-5">
      <DiaryHeader
        title={klass.name}
        description={`${item.unitName} · ${item.field}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas" search={search}>
            Trocar turma
          </Link>
        </Button>
      </DiaryHeader>
      <ContextFacts item={item} />
      <section className="grid gap-4 border-y border-border/70 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Próxima ação</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {primary?.action.label ?? "Agenda concluída neste contexto"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.stage === "Educação Infantil"
              ? "Experiência, observações e chamada permanecem registros distintos."
              : "Registro e chamada seguem vinculados à atuação e à data selecionadas."}
          </p>
        </div>
        {primary ? <JourneyLink action={primary.action} variant="default" /> : null}
      </section>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
        <section>
          <SectionHeader
            title={
              item.stage === "Educação Infantil" ? "Agenda de experiências" : "Agenda da turma"
            }
            description="Previsto, registrado e chamada são apresentados como estados distintos."
          />
          <DailyAgenda search={classSearch} />
        </section>
        <section>
          <SectionHeader
            title="Registros recentes"
            description={
              item.stage === "Educação Infantil"
                ? "Experiências realizadas neste contexto."
                : "Aulas efetivamente registradas."
            }
            action={
              <Button asChild size="sm" variant="ghost">
                <Link to="/diario/aulas" search={classSearch}>
                  Ver histórico <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="mt-2">
            {lessons.length ? (
              lessons.map((lesson) => <LessonSummary key={lesson.id} lesson={lesson} />)
            ) : (
              <EmptyState
                title="Sem registros de aula"
                description="Nenhuma aula registrada neste contexto demonstrativo."
                compact
              />
            )}
          </div>
        </section>
      </div>
      <section className="border-t border-border/70 pt-4">
        <SectionHeader
          title="Acompanhamento da turma"
          description="Acessos de consulta preservam esta turma, atuação e data."
        />
        <nav aria-label="Acompanhamento da turma" className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link
              to="/diario/turmas/$turmaId/alunos"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              <UsersRound /> Alunos
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/diario/chamadas" search={classSearch}>
              <CalendarCheck2 /> Chamadas
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/diario/frequencia" search={classSearch}>
              <FileBarChart /> Frequência demonstrativa
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              to="/diario/turmas/$turmaId/avaliacao"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              <ClipboardList /> Estrutura avaliativa
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/diario/documentos" search={classSearch}>
              <FileText /> Documentos
            </Link>
          </Button>
        </nav>
      </section>
    </div>
  );
}

export function ClassStudentsPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const context = useDiary(search);
  const klass = teachingClass(classId);
  const students = studentsForClassOn(classId, context.referenceDate);
  const [query, setQuery] = useState("");
  const visible = students.filter((entry) =>
    `${entry.student.personName} ${entry.student.sigemId}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Alunos da turma"
        description={`${klass?.name ?? classId} · participação válida em ${formatAcademicDate(context.referenceDate)}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId" params={{ turmaId: classId }} search={search}>
            Visão geral
          </Link>
        </Button>
      </DiaryHeader>
      <div className="surface-panel p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            title={`${visible.length} alunos no contexto`}
            description="A lista respeita as datas de ingresso, saída e movimentação."
          />
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar aluno"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou SIGEM"
              className="pl-9"
            />
          </label>
        </div>
        <StudentList students={visible} classId={classId} search={search} />
      </div>
      <p className="text-xs text-muted-foreground">{DIARY_PRIVACY_NOTE}</p>
    </div>
  );
}

export function ContextualStudentPage({
  classId,
  studentId,
  search,
}: {
  classId: string;
  studentId: string;
  search: DiarySearch;
}) {
  const context = useDiary(search);
  const entry = studentsForClassOn(classId, context.referenceDate).find(
    (item) => item.student.id === studentId,
  );
  // 6D.FINAL.5 — com sessão, só o roster institucional; nunca o cadastro demonstrativo.
  const student = isDiaryCloud() ? rosterStudents().find((s) => s.id === studentId) : getDemonstrationStudent(studentId);
  const klass = teachingClass(classId);
  if (!student)
    return (
      <StatePanel
        tone="danger"
        title="Aluno não encontrado"
        description="O identificador não corresponde a um registro fictício."
      />
    );
  if (!entry)
    return (
      <StatePanel
        tone="warning"
        title="Aluno fora deste contexto"
        description="Não há participação do aluno nesta turma na data consultada."
      />
    );
  const stage = diaryStageForClass(classId);
  return (
    <div className="space-y-5">
      <DiaryHeader
        title={student.personName}
        description={`${student.sigemId} · acompanhamento em ${klass?.name ?? classId}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId/alunos" params={{ turmaId: classId }} search={search}>
            Voltar aos alunos
          </Link>
        </Button>
      </DiaryHeader>
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <section className="surface-panel p-4">
          <DetailSection title="Participação acadêmica">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Participação</dt>
                <dd className="font-medium">{entry.participation.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Período de alocação</dt>
                <dd className="font-medium">
                  {formatAcademicDate(entry.allocation.from)} —{" "}
                  {formatAcademicDate(entry.allocation.until, "em andamento")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Vínculo letivo</dt>
                <dd className="font-medium">{entry.academicLink.periodLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Situação contextual</dt>
                <dd>
                  <StatusBadge tone="success">Participação na data</StatusBadge>
                </dd>
              </div>
            </dl>
          </DetailSection>
          <DetailSection title="Registros recentes">
            <AuditTimeline
              items={student.trajectory
                .filter((event) => !event.classId || event.classId === classId)
                .slice(-3)
                .reverse()
                .map((event) => ({
                  id: event.id,
                  title: event.title,
                  description: event.description,
                  meta: event.contextLabel,
                  timestamp: event.timestamp,
                }))}
              emptyMessage="Nenhum registro contextual disponível."
            />
          </DetailSection>
        </section>
        <aside className="space-y-3">
          <FutureFeatureState
            title="Frequência"
            description="Apenas a estrutura de consulta está preparada."
          />
          {stage === "Educação Infantil" ? (
            <StatePanel
              tone="info"
              title="Desenvolvimento e experiências"
              description="Acompanhamento qualitativo demonstrativo disponível abaixo, sem médias ou classificação numérica."
            />
          ) : (
            <StatePanel
              tone="info"
              title="Percurso avaliativo"
              description="Instrumentos e lançamentos do aluno por período, sem médias ou resultado."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/diario/turmas/$turmaId/alunos/$alunoId/avaliacao"
                    params={{ turmaId: classId, alunoId: studentId }}
                    search={search}
                  >
                    Abrir percurso avaliativo
                  </Link>
                </Button>
              }
            />
          )}
          {stage === "Educação Infantil" ? (
            <StatePanel
              tone="info"
              title="Observações pedagógicas"
              description="Consulta demonstrativa e discreta; nenhuma observação é um registro oficial."
            />
          ) : (
            <FutureFeatureState
              title="Observações pedagógicas"
              description="Nenhuma observação sensível ou registro real foi criado."
            />
          )}
        </aside>
      </div>
      {stage === "Educação Infantil" ? (
        <>
          <InfantChildObservations studentId={studentId} classId={classId} search={search} />
          <InfantDescriptiveReportPanel studentId={studentId} classId={classId} search={search} />
        </>
      ) : null}
      <p className="text-xs text-muted-foreground">{DIARY_PRIVACY_NOTE}</p>
    </div>
  );
}

export function LessonsHistoryPage({ search }: { search: DiarySearch }) {
  const context = useDiary(search);
  const navigate = useNavigate({ from: "/diario/aulas" });
  const infantContext = search.turma
    ? diaryStageForClass(search.turma) === "Educação Infantil"
    : false;
  return (
    <div className="space-y-5">
      <DiaryHeader
        title={infantContext ? "Histórico de experiências" : "Histórico de aulas"}
        description={
          infantContext
            ? "Linha do tempo qualitativa da Educação Infantil; planejamento, realização, observação e chamada permanecem distintos."
            : "Linha do tempo de aulas efetivamente registradas; planejamento e realização permanecem distintos."
        }
        context={context}
      />
      <ContextControls search={search} base="/diario/aulas" />
      <DiaryQueryFilters
        search={search}
        showQuery
        onChange={(next) => void navigate({ search: next })}
      />
      {infantContext ? (
        <InfantExperiencesTimeline search={search} />
      ) : (
        <LessonsTimelineSection search={search} />
      )}
      {!search.turma ? <InfantExperiencesTimeline search={search} /> : null}
      <StatePanel
        tone="info"
        title="Correções em preparação"
        description="Rascunhos locais podem ser editados. Registros concluídos não são sobrescritos: a solicitação de alteração será definida em etapa própria."
      />
    </div>
  );
}

const documentIcons: Record<string, typeof FileText> = {
  "Diário de Classe": BookOpenCheck,
  "Registros de Frequência": CalendarCheck2,
  "Planilha de Acompanhamento Pedagógico": ClipboardList,
  Boletim: FileText,
  "Ficha Individual": GraduationCap,
  "Folha Final": FileBarChart,
  Observações: Sparkles,
};
const availabilityTone: Record<DocumentAvailability, "success" | "info" | "warning" | "neutral"> = {
  disponivel: "success",
  "parcialmente-disponivel": "info",
  "depende-homologacao": "warning",
  indisponivel: "neutral",
};
export function DiaryDocumentsPage({ search }: { search: DiarySearch }) {
  const context = useDiary(search);
  const institutional = isDiaryCloud();
  const ref = diaryReference();
  useComposedCalendarRefresh();
  // Base de documento: turma explícita da busca ⇒ decisão do servidor por alocação; sem turma ⇒ nada é contado.
  const calendarReason = institutional
    ? search.turma
      ? diaryClassCalendar(search.turma, ref ? { start: ref.validOn, end: ref.validOn } : null).reason
      : "Calendário institucional por turma: escolha uma turma; o resultado é decidido por estudante/alocação e nada foi contado."
    : null;
  const documentDependencies = documentDependenciesForSession(institutional, calendarReason);
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Documentos e relatórios"
        description="Biblioteca contextual derivada dos registros acadêmicos compartilhados, sem emissão oficial."
        context={context}
      />
      <ContextControls search={search} base="/diario/documentos" />
      <ul
        aria-label="Documentos e dependências"
        className="divide-y divide-border/70 border-y border-border/70"
      >
        {documentDependencies.map((doc) => {
          const Icon = documentIcons[doc.document] ?? FileText;
          const availability = documentAvailability(doc);
          return (
            <li
              key={doc.document}
              className="grid min-w-0 gap-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <span className="hidden size-10 place-items-center rounded-md bg-secondary text-secondary-foreground sm:grid">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold break-words text-foreground">{doc.document}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {availability.satisfied} de {availability.total} fontes de dados {institutional ? "estão verificadas para este documento" : "existem no laboratório"}.
                </p>
                {availability.blocking.length ? (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline focus-visible:underline">
                      Por que ainda não está disponível
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      {availability.blocking.map((item) => (
                        <li key={item} className="break-words">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
              <div className="sm:justify-self-end">
                <StatusBadge tone={availabilityTone[availability.state]}>
                  {DOCUMENT_AVAILABILITY_LABEL[availability.state]}
                </StatusBadge>
              </div>
            </li>
          );
        })}
      </ul>
      {institutional ? <DiaryPrintsPanel classId={search.turma} assignmentId={context.assignments.find((a) => a.classId === search.turma)?.record.id} periodId={search.periodo} /> : null}
      <StatePanel
        tone="neutral"
        title={institutional ? "Emissão oficial indisponível" : "Documentos demonstrativos"}
        description="Nenhum item desta biblioteca possui valor oficial, é publicado ou gera arquivo nesta etapa."
      />
    </div>
  );
}
