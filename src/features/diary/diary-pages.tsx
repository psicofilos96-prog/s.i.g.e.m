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
import { JourneyLink, PendingSection, ResumeSection } from "./diary-journey-view";
import { usePrimaryJourneyAction } from "./diary-journey-hooks";
import { InfantChildObservations, InfantExperiencesTimeline } from "./infant-experience-pages";
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
        title={`Olá, ${context.personName.split(" ")[2] ?? "professor"}`}
        description="O que fazer agora e onde você parou, no contexto selecionado."
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
      <ContextControls search={search} base="/diario" />
      {selected ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selected.unitName}</span> ·{" "}
          {selected.className} · {selected.field} · Vínculo {selected.record.linkId}
        </p>
      ) : null}
      {!context.assignments.length ? (
        <StatePanel
          tone="warning"
          title="Sem atuação pedagógica vigente"
          description="Não há atuação vigente para esta data. O Diário só apresenta turmas associadas a atuações pedagógicas válidas; lotação na escola não concede acesso a turmas."
        />
      ) : null}
      <ResumeSection search={journeySearch} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(17rem,.8fr)]">
        <DailyAgenda search={search} />
        <PendingSection search={journeySearch} />
      </div>
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
                    {item.unitName} · {item.stage} · {item.record.role} · Vínculo{" "}
                    {item.record.linkId}
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

const areas = [
  { id: "overview", label: "Visão geral", available: true },
  { id: "students", label: "Alunos", available: true },
  { id: "lessons", label: "Aulas e conteúdos", available: false },
  { id: "attendance", label: "Frequência", available: false },
  { id: "assessments", label: "Avaliações", available: false },
  { id: "followup", label: "Acompanhamento", available: false },
  { id: "documents", label: "Documentos", available: true },
] as const;
export function ClassDiaryPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const context = useDiary(search);
  const item = context.assignments.find((entry) => entry.classId === classId);
  const klass = getDemonstrationClass(classId);
  const lessons = lessonsForProfessional(context.professionalId).filter(
    (lesson) => lesson.classId === classId,
  );
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
      <nav
        aria-label="Áreas do Diário"
        className="flex gap-1 overflow-x-auto border-b border-border pb-2"
      >
        {areas.map((area) =>
          area.available ? (
            <Button
              key={area.id}
              asChild
              variant={area.id === "overview" ? "secondary" : "ghost"}
              size="sm"
            >
              {area.id === "students" ? (
                <Link
                  to="/diario/turmas/$turmaId/alunos"
                  params={{ turmaId: classId }}
                  search={search}
                >
                  {area.label}
                </Link>
              ) : area.id === "documents" ? (
                <Link to="/diario/documentos" search={diarySearch(search, { turma: classId })}>
                  {area.label}
                </Link>
              ) : (
                <Link to="/diario/turmas/$turmaId" params={{ turmaId: classId }} search={search}>
                  {area.label}
                </Link>
              )}
            </Button>
          ) : (
            <Button key={area.id} variant="ghost" size="sm" disabled>
              {area.label}
            </Button>
          ),
        )}
      </nav>
      <ContextFacts item={item} />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="surface-panel p-4">
          <SectionHeader
            title="Próximas aulas previstas"
            description="Planejamento semanal; não representa aula ministrada."
            action={
              <Button asChild size="sm">
                <Link
                  to="/diario/registrar"
                  search={{ ...search, turma: classId, atuacao: item.record.id }}
                >
                  Registrar aula
                </Link>
              </Button>
            }
          />
          <div className="mt-3 space-y-2">
            {item.blocks.length ? (
              item.blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{block.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {dayLabel(block.day)} · {block.start}–{block.end}
                    </p>
                  </div>
                  <StatusBadge tone="info">Planejada</StatusBadge>
                </div>
              ))
            ) : (
              <EmptyState
                title="Sem aulas previstas"
                description="A grade não possui blocos associados a esta atuação."
                compact
              />
            )}
          </div>
        </section>
        <section className="surface-panel p-4">
          <SectionHeader
            title="Registros recentes"
            description="Aulas efetivamente registradas, separadas do planejamento."
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
      <section>
        <SectionHeader
          title="Áreas em preparação"
          description={
            diaryStageForClass(classId) === "Educação Infantil"
              ? "Acompanhamento qualitativo, experiências, frequência e observações de desenvolvimento."
              : "Aula e chamada, frequência, avaliações e acompanhamento serão desenvolvidos em etapas próprias."
          }
        />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <StatePanel
            tone="info"
            title="Chamada"
            description="Disponível a partir de cada aula registrada (agenda, detalhe do registro e histórico de chamadas)."
          />
          <FutureFeatureState
            title={
              diaryStageForClass(classId) === "Educação Infantil"
                ? "Acompanhamento qualitativo"
                : "Avaliações"
            }
            description="Nenhuma nota, média ou decisão acadêmica é simulada."
          />
          <StatePanel
            tone="info"
            title="Frequência"
            description="Quantitativos demonstrativos em Diário › Frequência; sem cálculo oficial nem regras homologadas."
          />
        </div>
      </section>
    </div>
  );
}

export function ClassStudentsPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const context = useDiary(search);
  const klass = getDemonstrationClass(classId);
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
        description={`${klass?.name ?? classId} · participação válida em ${context.referenceDate}`}
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
  const student = getDemonstrationStudent(studentId);
  const klass = getDemonstrationClass(classId);
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
                  {entry.allocation.from} — {entry.allocation.until ?? "em andamento"}
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
            <FutureFeatureState
              title="Avaliações"
              description="Sem notas, médias ou indicadores oficiais nesta etapa."
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
        <InfantChildObservations studentId={studentId} classId={classId} search={search} />
      ) : null}
      <p className="text-xs text-muted-foreground">{DIARY_PRIVACY_NOTE}</p>
    </div>
  );
}

export function LessonsHistoryPage({ search }: { search: DiarySearch }) {
  const context = useDiary(search);
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

const documents = [
  {
    name: "Diário de Classe",
    icon: BookOpenCheck,
    available: true,
    note: "Consulta demonstrativa dos registros compartilhados.",
  },
  {
    name: "Registros de frequência",
    icon: CalendarCheck2,
    available: false,
    note: "Chamadas demonstrativas disponíveis no Diário; documento oficial depende de regras homologadas.",
  },
  {
    name: "Planilha de Acompanhamento Pedagógico",
    icon: ClipboardList,
    available: true,
    note: "Referência visual; sem preenchimento paralelo.",
  },
  {
    name: "Folha Final",
    icon: FileBarChart,
    available: false,
    note: "Depende de fechamento acadêmico e dados ainda indisponíveis.",
  },
  {
    name: "Boletim",
    icon: FileText,
    available: false,
    note: "Depende de avaliações e frequência.",
  },
  {
    name: "Ficha Individual",
    icon: GraduationCap,
    available: true,
    note: "Consulta contextual, não documento oficial.",
  },
  {
    name: "Observações",
    icon: Sparkles,
    available: false,
    note: "Área pedagógica futura, sem dados sensíveis fictícios.",
  },
];
export function DiaryDocumentsPage({ search }: { search: DiarySearch }) {
  const context = useDiary(search);
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Documentos e relatórios"
        description="Biblioteca contextual derivada dos registros acadêmicos compartilhados, sem emissão oficial."
        context={context}
      />
      <ContextControls search={search} base="/diario/documentos" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((doc) => {
          const Icon = doc.icon;
          return (
            <article key={doc.name} className="surface-panel flex min-h-44 flex-col p-4">
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="size-5" />
                </span>
                <StatusBadge tone={doc.available ? "info" : "neutral"}>
                  {doc.available ? "Consulta disponível" : "Dados indisponíveis"}
                </StatusBadge>
              </div>
              <h2 className="mt-4 font-semibold text-foreground">{doc.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{doc.note}</p>
              <Button
                className="mt-auto self-start"
                variant="ghost"
                size="sm"
                disabled={!doc.available}
              >
                {doc.available ? "Consultar referência" : "Indisponível nesta etapa"}
              </Button>
            </article>
          );
        })}
      </div>
      <StatePanel
        tone="neutral"
        title="Documentos demonstrativos"
        description="Nenhum item desta biblioteca possui valor oficial, é publicado ou gera arquivo nesta etapa."
      />
    </div>
  );
}
