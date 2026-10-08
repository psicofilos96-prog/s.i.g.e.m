import { confirmAction } from "@/components/sigem/confirm-action";
import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { AttendanceCalendarNoticePanel } from "@/features/calendar/institutional-calendar-notices";
import { isDiaryCloud } from "./diary-persistence-mode";
import { recordAttendanceInCloud } from "./diary-cloud";
import { formatDateRange } from "@/lib/academic-date";
import { Fragment, useEffect, useMemo, useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CircleDashed, ClipboardCheck, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { InformationPair } from "@/components/sigem/operational";
import {
  AttendanceQuickBar,
  AttendanceQuickSearch,
  AttendanceRow,
  filterSpeedRoster,
  speedHomonymIds,
  useSpeedDraft,
  useSpeedKeyboard,
  type SpeedMarkOption,
  type SpeedMarks,
  type SpeedRosterPerson,
} from "@/components/sigem/attendance-speed";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { cn } from "@/lib/utils";
import { DiaryHeader } from "./diary-context";
import { DiaryQueryFilters } from "./diary-query-filters";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, type DiarySearch } from "./diary-data";
import { AttendanceCorrectionPanel } from "./attendance-correction-panel";
import { attendanceDemonstrationActor } from "./attendance-closing";
import { useAttendanceClosingStore } from "./attendance-closing-store";
import { ContextConflictState } from "./lesson-record-form";
import {
  allFixtureLessons,
  findLessonEntry,
  fixtureEntry,
  lessonEntries,
  useLocalLessonRecords,
  type LessonEntry,
} from "./lesson-records";
import {
  ATTENDANCE_LOCAL_NOTE,
  attendanceBlocker,
  attendanceCounts,
  attendanceSlots,
  attendanceStatus,
  attendanceStore,
  eligibleStudents,
  frequencyIndicators,
  frequencyPreview,
  ineligibleStudents,
  recentlyAllocated,
  useLocalAttendance,
  type AttendanceMark,
  type AttendanceMarks,
  type AttendanceStatus,
} from "./attendance";

const TONE = {
  "Sem chamada": "neutral",
  Rascunho: "info",
  "Parcialmente preenchida": "warning",
  Concluída: "success",
} as const;

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <StatusBadge tone={TONE[status]}>Chamada: {status}</StatusBadge>;
}

function useAttendanceRecord(entryId: string) {
  const local = useLocalAttendance();
  return local.find((item) => item.entryId === entryId) ?? attendanceStore.get(entryId);
}

function MarkLabel({ mark }: { mark: AttendanceMark | null | undefined }) {
  if (mark === "Presente")
    return (
      <span className="inline-flex items-center gap-1 text-foreground">
        <Check className="size-4" aria-hidden /> Presente (P)
      </span>
    );
  if (mark === "Ausente")
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <X className="size-4" aria-hidden /> Ausente (F)
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <CircleDashed className="size-4" aria-hidden /> Sem marcação
    </span>
  );
}

/** Resumo da chamada exibido no detalhe do registro e após concluir a aula. */
export function AttendanceSummaryCard({
  entry,
  search,
}: {
  entry: LessonEntry;
  search: DiarySearch;
}) {
  const record = useAttendanceRecord(entry.id);
  const status = attendanceStatus(entry, record);
  const counts = attendanceCounts(entry, record?.marks ?? {});
  const draftLesson = entry.status === "Rascunho local";
  return (
    <section className="surface-panel space-y-2 p-4" aria-label="Resumo da chamada">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <h2 className="text-sm font-semibold text-foreground">Chamada</h2>
        <AttendanceStatusBadge status={status} />
      </div>
      {draftLesson ? (
        <p className="text-xs text-muted-foreground">
          O registro desta aula ainda está em elaboração. A chamada pode ser feita agora; o
          fechamento oficial do período é que depende do registro concluído.
        </p>
      ) : null}
      {(
        <>

          <p className="text-sm text-foreground">
            {counts.marked} de {counts.total} marcações · {counts.present} presença(s) ·{" "}
            {counts.absent} falta(s) · {counts.pending} pendente(s)
          </p>
          <Button
            asChild
            className="w-full"
            variant={status === "Concluída" ? "outline" : "default"}
          >
            <Link
              to="/diario/chamada/$registroId"
              params={{ registroId: entry.id }}
              search={search}
            >
              <ClipboardCheck />{" "}
              {status === "Concluída"
                ? "Ver lista nominal"
                : status === "Sem chamada"
                  ? "Fazer chamada"
                  : "Continuar chamada"}
            </Link>
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Nenhuma presença ou falta é gerada automaticamente pela aula prevista.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tela de chamada
// ---------------------------------------------------------------------------

export function AttendancePage({
  registroId,
  search,
}: {
  registroId: string;
  search: DiarySearch;
}) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const context = diaryContext(professionalId, search.data);
  const localLessons = useLocalLessonRecords();
  const localAttendance = useLocalAttendance();
  const entry = findLessonEntry(registroId, localLessons);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!entry)
    return (
      <div className="space-y-5">
        <DiaryHeader
          title="Chamada indisponível"
          description="Registro não encontrado."
          context={context}
        />
        <EmptyState
          title="Registro de aula não encontrado"
          description="Registros locais deixam de existir ao recarregar a página."
          action={
            <Button asChild variant="outline">
              <Link to="/diario/chamadas" search={search}>
                Histórico de chamadas
              </Link>
            </Button>
          }
        />
      </div>
    );

  if (!ready)
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando chamada demonstrativa">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  const blocker = attendanceBlocker(entry, professionalId, localLessons, localAttendance);
  return (
    <AttendanceWorkspace
      key={entry.id}
      entry={entry}
      search={search}
      blocker={blocker}
      context={context}
    />
  );
}

/**
 * Marcações admitidas pelo domínio da frequência. A interface não inventa
 * nenhuma outra (nada de "falta justificada").
 */
const MARK_OPTIONS: readonly SpeedMarkOption[] = [
  { value: "Presente", label: "Presente", shortLabel: "P", shortcut: "p" },
  { value: "Ausente", label: "Ausente", shortLabel: "F", shortcut: "f" },
];

/**
 * Attendance Workspace 2.0 (6D.1.3). Quatro zonas: contexto compacto → balanço
 * → lista nominal → barra de conclusão. O professor cai dentro da lista; nada
 * explica o modelo acadêmico antes do trabalho.
 */
function AttendanceWorkspace({
  entry,
  search,
  blocker,
}: {
  entry: LessonEntry;
  search: DiarySearch;
  blocker: ReturnType<typeof attendanceBlocker>;
  context: ReturnType<typeof diaryContext>;
}) {
  const record = useAttendanceRecord(entry.id);
  const closingStore = useAttendanceClosingStore();
  const concluded = Boolean(record?.concluded);
  const readOnly = concluded || Boolean(blocker);
  const slots = attendanceSlots(entry);
  const students = eligibleStudents(entry);
  const excluded = ineligibleStudents(entry);
  const initial = useMemo(() => record?.marks ?? {}, [record]);
  const [marks, setMarks] = useState<AttendanceMarks>(initial);
  const [activeSlot, setActiveSlot] = useState(slots[0]?.key ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const dirty = !readOnly && JSON.stringify(marks) !== JSON.stringify(initial);
  const counts = attendanceCounts(entry, marks, students);
  const status = attendanceStatus(entry, record);
  const historical = entry.date < "2026-01-01";
  const responsible =
    teachingPersonName(entry.professionalId) ?? entry.professionalName;

  useBlocker({
    shouldBlockFn: async () =>
      dirty &&
      !(await confirmAction({ title: "Sair sem concluir?", consequence: "Há alterações nesta chamada que ainda não foram concluídas. Sair agora descarta as marcações feitas nesta aba.", actionLabel: "Sair e descartar", destructive: true })),
    enableBeforeUnload: dirty,
  });

  const people = useMemo<readonly SpeedRosterPerson[]>(
    () =>
      students.map((item, index) => ({
        id: item.student.id,
        order: index + 1,
        name: item.student.personName,
        code: item.student.sigemId,
        ...(recentlyAllocated(item, entry.date) ? { detail: "Recém-enturmado" } : {}),
      })),
    [entry.date, students],
  );

  const activeIndex = slots.findIndex((slot) => slot.key === activeSlot);
  const current = slots[activeIndex] ?? slots[0];
  const previous = activeIndex > 0 ? slots[activeIndex - 1] : undefined;
  const previousMarks = previous ? marks[previous.key] : undefined;
  const slotPending = (key: string) =>
    students.filter((item) => !marks[key]?.[item.student.id]).length;

  const conclude = async () => {
    if (isDiaryCloud()) {
      // Rascunho nunca vai ao banco; concluir grava a versão oficial da chamada.
      const saved = await recordAttendanceInCloud(entry.id, marks);
      setFeedback(saved.ok ? "Chamada registrada na base institucional." : saved.message);
      return;
    }
    attendanceStore.save(entry.id, marks, true);
    setFeedback("Chamada concluída nesta aba (demonstração). Não há validação institucional.");
  };
  const saveDraft = () => {
    attendanceStore.save(entry.id, marks, false);
    setFeedback("Rascunho mantido nesta aba (não salvo permanentemente).");
  };
  const discard = () => {
    if (record?.origin === "local") attendanceStore.discard(entry.id);
    setMarks(record?.origin === "local" ? {} : initial);
    setFeedback("Alterações descartadas.");
  };

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Chamada</h1>
      <AttendanceCalendarNoticePanel date={entry.date} classId={entry.classId} />
      {/* Zona 1 — contexto compacto: só o necessário para não fazer chamada no contexto errado. */}
      <header className="space-y-0.5">
        <div className="-ml-2 flex flex-wrap items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link to="/diario" search={{ ...search, data: entry.date }}>
              <ArrowLeft /> Meu Diário
            </Link>
          </Button>
          <AttendanceStatusBadge
            status={dirty ? (counts.marked ? "Parcialmente preenchida" : "Rascunho") : status}
          />
          {historical ? <StatusBadge tone="neutral">Consulta histórica</StatusBadge> : null}
        </div>
        <h2 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">
          {entry.className} · {entry.field}
        </h2>
        <p className="text-xs text-muted-foreground">
          {formatAcademicDate(entry.date)}
          {current ? ` · ${current.time} · ${current.label}` : null}
        </p>
        {slots.length > 1 ? (
          <div role="tablist" aria-label="Aulas deste registro" className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <Button
                key={slot.key}
                role="tab"
                aria-selected={activeSlot === slot.key}
                variant={activeSlot === slot.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSlot(slot.key)}
              >
                {slot.label} · {slot.time}
                <span className="ml-1 text-xs">({slotPending(slot.key)} sem marcação)</span>
              </Button>
            ))}
          </div>
        ) : null}
      </header>

      {blocker ? <ContextConflictState message={blocker.message} /> : null}
      {concluded ? (
        <StatePanel
          tone="success"
          title={`Chamada concluída${record?.version && record.version > 1 ? ` · versão ${record.version}` : ""}`}
          description={`${students.length} estudante(s) · ${record?.origin === "fixture" ? "dado fictício histórico" : "concluída nesta aba (demonstração)"}. Uma chamada concluída não é sobrescrita: a correção produz uma nova versão.`}
        />
      ) : null}

      {students.length === 0 ? (
        <EmptyState
          title="Nenhum aluno com alocação na data"
          description="Não há participação aplicável nesta turma na data da aula; nenhuma frequência é fabricada."
        />
      ) : (
        <AttendanceSlotBoard
          key={activeSlot}
          people={people}
          initialMarks={(marks[activeSlot] ?? {}) as SpeedMarks}
          onChange={(next) =>
            setMarks((cur) => ({ ...cur, [activeSlot]: next as Record<string, AttendanceMark> }))
          }
          readOnly={readOnly}
          {...(previous && previousMarks && Object.keys(previousMarks).length
            ? { previousLabel: previous.label, previousMarks: previousMarks as SpeedMarks }
            : {})}
        />
      )}

      {/* Zona 4 — conclusão sempre visível. */}
      {!readOnly && students.length ? (
        <div className="sticky bottom-0 z-20 space-y-2 border-t bg-background/95 px-3 py-2 backdrop-blur">
          <p className="text-sm font-medium text-foreground" aria-live="polite">
            {counts.present} presente(s) · {counts.absent} ausente(s) · {counts.pending} sem marcação
          </p>
          {counts.pending > 0 ? (
            <p className="text-xs text-muted-foreground">
              {counts.pending === 1
                ? "1 estudante ainda está sem marcação"
                : `${counts.pending} estudantes ainda estão sem marcação`}
              {slots.length > 1 ? " nas aulas deste registro" : ""}. Marque cada estudante ou use
              “Marcar pendentes como presentes”. Sem marcação não vira presença sozinha.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={counts.pending > 0} onClick={conclude}>
              <ClipboardCheck /> Concluir chamada
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={saveDraft}
              disabled={!counts.marked}
            >
              Manter rascunho
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="min-h-11"
                  disabled={!dirty && record?.origin !== "local"}
                >
                  Descartar alterações
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Descartar alterações da chamada?</AlertDialogTitle>
                  <AlertDialogDescription>
                    As marcações desta aba serão perdidas. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={discard}>Descartar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {feedback ? (
            <p role="status" className="text-sm text-muted-foreground">
              {feedback}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{ATTENDANCE_LOCAL_NOTE}</p>
        </div>
      ) : null}

      {concluded ? (
        <nav aria-label="Continuar o trabalho" className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/diario" search={{ ...search, data: entry.date }}>
              Voltar para Meu Diário
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/diario/registros/$registroId"
              params={{ registroId: entry.id }}
              search={search}
            >
              Registro da aula
            </Link>
          </Button>
        </nav>
      ) : null}
      {concluded && record ? (
        <AttendanceCorrectionPanel
          entry={entry}
          record={record}
          actor={attendanceDemonstrationActor(search.perfil ?? "perfil-docente")}
          operatingProfessionalId={search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID}
          closings={closingStore.allRecords()}
        />
      ) : null}

      {excluded.length ? (
        <section className="surface-panel p-4" aria-label="Alunos sem participação aplicável">
          <SectionHeader
            title="Fora desta chamada"
            description="A lista atual da turma não reescreve chamadas: estes alunos não tinham alocação na data."
          />
          <ul className="mt-2 space-y-1 text-sm">
            {excluded.map((item) => (
              <li key={item.id}>
                <span className="font-medium text-foreground">{item.name}</span> ·{" "}
                <span className="text-muted-foreground">{item.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Informações do registro</summary>
        <dl className="info-list mt-2 divide-y divide-border/60">
          {(
            [
              ["Registro", entry.id],
              ["Escola", entry.unitName],
              ["Data", formatAcademicDate(entry.date)],
              ["Horários", slots.map((slot) => slot.time).join(" · ")],
              ["Responsável", `${responsible} (${entry.role} · ${entry.assignmentId})`],
            ] as Array<[string, string]>
          ).map(([label, text]) => (
            <InformationPair key={label} label={label} value={text} className="py-1.5" />
          ))}
        </dl>
        {entry.extraordinary ? (
          <p className="mt-2">
            Aula fora da previsão · {entry.extraordinary.start}–{entry.extraordinary.end} ·{" "}
            {entry.extraordinary.justification} Nenhuma aprovação administrativa é presumida.
          </p>
        ) : null}
      </details>
    </div>
  );
}

/** Zonas 2 e 3 de uma aula: balanço e busca fixos, depois a lista nominal. */
function AttendanceSlotBoard({
  people,
  initialMarks,
  onChange,
  readOnly,
  previousLabel,
  previousMarks,
}: {
  people: readonly SpeedRosterPerson[];
  initialMarks: SpeedMarks;
  onChange: (next: SpeedMarks) => void;
  readOnly: boolean;
  previousLabel?: string | undefined;
  previousMarks?: SpeedMarks | undefined;
}) {
  const draft = useSpeedDraft({ people, markOptions: MARK_OPTIONS, initialMarks, onChange });
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterSpeedRoster(people, query), [people, query]);
  const homonyms = useMemo(() => speedHomonymIds(people), [people]);
  const keyboard = useSpeedKeyboard({
    people: visible,
    markOptions: MARK_OPTIONS,
    onMark: draft.setMark,
    onClear: draft.clearMark,
  });
  const searching = query.trim().length >= 2;
  const offerPrevious =
    !readOnly &&
    Boolean(previousLabel && previousMarks && Object.keys(previousMarks).length) &&
    Object.keys(draft.marks).length === 0;

  const focusFirst = keyboard.focus;
  const firstId = visible[0]?.id;
  useEffect(() => {
    // Desktop: a lista já é o ponto de partida do teclado, sem exigir clique.
    if (readOnly) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(min-width: 768px)")?.matches) return;
    focusFirst(firstId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-label="Lista nominal da chamada" className="surface-panel overflow-hidden">
      <AttendanceQuickBar
        balance={draft.balance}
        {...(readOnly
          ? {}
          : {
              bulkMark: MARK_OPTIONS[0],
              onBulkMark: () => draft.markUnmarkedAs("Presente"),
              onUndo: draft.undo,
              canUndo: draft.canUndo,
              lastOperationLabel: draft.lastOperationLabel,
            })}
      >
        <AttendanceQuickSearch
          value={query}
          onChange={setQuery}
          onSubmit={() => keyboard.focus(visible[0]?.id)}
          resultCount={visible.length}
        />
      </AttendanceQuickBar>
      {offerPrevious && previousMarks ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
          <span>As marcações da {previousLabel} estão disponíveis.</span>
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() =>
              draft.applyMarks(`Marcações da ${previousLabel} aplicadas`, previousMarks)
            }
          >
            Usar marcações anteriores
          </Button>
        </div>
      ) : null}
      {!readOnly && !draft.canUndo ? (
        <p className="hidden px-3 py-1 text-xs text-muted-foreground md:block">
          ↑↓ navegar · P presente · F ausente · Del limpar
        </p>
      ) : null}
      <div role="table" aria-label="Estudantes desta aula">
        {visible.map((person) => (
          <AttendanceRow
            key={person.id}
            person={person}
            mark={draft.marks[person.id]}
            markOptions={MARK_OPTIONS}
            showCode={searching || homonyms.includes(person.id)}
            focused={keyboard.focusedId === person.id}
            disabled={readOnly}
            onMark={(value) => draft.setMark(person.id, value)}
            onClear={() => draft.clearMark(person.id)}
            onFocus={() => keyboard.setFocusedId(person.id)}
            onKeyDown={keyboard.handleKeyDown(person.id)}
            rowRef={keyboard.registerRow(person.id)}
          />
        ))}
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Nenhum estudante desta turma corresponde à busca. Limpe a busca para ver a lista
            completa.
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Histórico de chamadas
// ---------------------------------------------------------------------------

export type AttendanceHistorySearch = DiarySearch & {
  de?: string;
  ate?: string;
  estado?: string;
};

function useAllEntries() {
  const local = useLocalLessonRecords();
  const ids = [
    ...new Set([
      ...allFixtureLessons.map((item) => item.professionalId),
      ...local.map((item) => item.professionalId),
    ]),
  ];
  return ids.flatMap((id) => lessonEntries(id, local)).sort((a, b) => b.date.localeCompare(a.date));
}

export function AttendanceHistoryPage({ search }: { search: AttendanceHistorySearch }) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const entries = useAllEntries().filter((entry) => entry.status !== "Rascunho local");
  const local = useLocalAttendance();
  const navigate = useNavigate({ from: "/diario/chamadas" });
  const withStatus = entries.map((entry) => ({
    entry,
    status: attendanceStatus(
      entry,
      local.find((item) => item.entryId === entry.id) ?? attendanceStore.get(entry.id),
    ),
  }));
  const opts = (pick: (entry: LessonEntry) => [string, string]) => [
    ...new Map(entries.map((entry) => pick(entry))).entries(),
  ];
  const rows = withStatus.filter(
    ({ entry, status }) =>
      (!search.de || entry.date >= search.de) &&
      (!search.ate || entry.date <= search.ate) &&
      (!search.unidade || entry.unitId === search.unidade) &&
      (!search.turma || entry.classId === search.turma) &&
      (!search.componente || entry.field === search.componente) &&
      (!search.professor || entry.professionalId === search.professor) &&
      (!search.estado || status === search.estado),
  );
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Histórico de chamadas"
        description="Chamadas vinculadas às aulas registradas. Consulta histórica é somente leitura; a operação ocorre no contexto do responsável."
        context={context}
      />
      <DiaryQueryFilters
        search={search}
        onChange={(next) => void navigate({ search: next })}
        secondary={[
          { key: "unidade", label: "Escola", options: opts((e) => [e.unitId, e.unitName]) },
          { key: "turma", label: "Turma", options: opts((e) => [e.classId, e.className]) },
          {
            key: "componente",
            label: "Componente/campo",
            options: opts((e) => [e.field, e.field]),
          },
          {
            key: "professor",
            label: "Profissional",
            options: opts((e) => [e.professionalId, e.professionalName]),
          },
          {
            key: "estado",
            label: "Estado da chamada",
            options: (
              ["Sem chamada", "Rascunho", "Parcialmente preenchida", "Concluída"] as const
            ).map((s) => [s, s]),
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma chamada encontrada"
          description="Ajuste os filtros para ampliar a consulta."
        />
      ) : (
        <ul className="space-y-2" aria-label="Chamadas">
          {rows.map(({ entry, status }) => {
            const counts = attendanceCounts(
              entry,
              (local.find((item) => item.entryId === entry.id) ?? attendanceStore.get(entry.id))
                ?.marks ?? {},
            );
            return (
              <li
                key={entry.id}
                className="surface-panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {formatAcademicDate(entry.date)} · {entry.className} · {entry.field}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.unitName} · {entry.professionalName} · {attendanceSlots(entry).length}{" "}
                    aula(s) · {counts.marked}/{counts.total} marcações
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AttendanceStatusBadge status={status} />
                  {entry.date < "2026-01-01" ? (
                    <StatusBadge tone="neutral">Consulta histórica</StatusBadge>
                  ) : null}
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/diario/chamada/$registroId"
                      params={{ registroId: entry.id }}
                      search={{ ...search, professor: entry.professionalId }}
                      aria-label={`Abrir chamada ${entry.id}`}
                    >
                      Abrir <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{ATTENDANCE_LOCAL_NOTE}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frequência e indicadores (prévia demonstrativa)
// ---------------------------------------------------------------------------

export function FrequencyPage({ search }: { search: AttendanceHistorySearch }) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const context = diaryContext(professionalId, search.data);
  const navigate = useNavigate({ from: "/diario/frequencia" });
  const from = search.de ?? "2026-09-01";
  const to = search.ate ?? context.referenceDate;
  const [open, setOpen] = useState<string | null>(null);
  const entries = useAllEntries();
  const local = useLocalAttendance();
  const scopes = frequencyIndicators(professionalId, from, to, entries, local);
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Frequência"
        description="Quantitativos demonstrativos rastreáveis até cada chamada. Nenhum percentual é frequência oficial."
        context={context}
      />
      <DiaryQueryFilters
        search={{ ...search, de: from, ate: to }}
        onChange={(next) => void navigate({ search: next })}
      />
      <StatePanel
        tone="warning"
        title="Regras de contabilização não homologadas"
        description="Ausências justificadas, abonos, arredondamentos, Educação Infantil, AEE e atividades complementares dependem de confirmação normativa. Percentuais aparecem apenas como prévia sem pendências."
      />
      {scopes.length === 0 ? (
        <EmptyState
          title="Sem aulas no período"
          description="Não há aulas previstas ou registradas para este profissional no período."
        />
      ) : (
        scopes.map((scope) => (
          <section
            key={scope.assignmentId}
            className="surface-panel space-y-3 p-4"
            aria-label={`${scope.className} · ${scope.field}`}
          >
            <SectionHeader
              title={`${scope.className} · ${scope.field}`}
              description={`${scope.stage} · atuação ${scope.assignmentId} · ${formatDateRange(from, to)}`}
            />
            <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
              {[
                ["Aulas previstas", scope.planned === null ? "Informação indisponível" : scope.planned],
                ["Efetivamente ministradas", scope.taught],
                ["Com chamada concluída", scope.withConcluded],
                ["Sem chamada concluída", scope.pendingLessons],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 border-l border-border/80 pl-3 first:border-l-0 first:pl-0"
                >
                  <dt className="[overflow-wrap:anywhere] text-xs text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {scope.plannedUnavailableReason ? (
              <p className="text-sm text-muted-foreground" data-testid="planned-unavailable-reason">
                {scope.plannedUnavailableReason}
              </p>
            ) : null}
            {scope.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum aluno aplicável nas aulas registradas.
              </p>
            ) : (
              <div className="max-w-full overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label="Resumo de frequência por aluno">
                <table className="w-full min-w-[40rem] text-sm" data-n1025="attendance-summary">
                  <caption className="sr-only">Resumo de frequência por aluno</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-2">Aluno</th>
                      <th scope="col" className="px-2">Aulas aplicáveis</th>
                      <th scope="col" className="px-2">Presenças</th>
                      <th scope="col" className="px-2">Faltas</th>
                      <th scope="col" className="px-2">Pendentes</th>
                      <th scope="col" className="px-2">Prévia demonstrativa</th>
                      <th scope="col" className="px-2">Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scope.students.map((student) => {
                      const preview = frequencyPreview(scope, student);
                      const key = `${scope.assignmentId}:${student.studentId}`;
                      return (
                        <Fragment key={key}>
                          <tr className="border-b border-border">
                            <td className="py-2 pr-2 font-medium text-foreground">
                              {student.name}
                            </td>
                            <td className="px-2 tabular-nums">{student.applicable}</td>
                            <td className="px-2 tabular-nums">{student.present}</td>
                            <td className="px-2 tabular-nums">{student.absent}</td>
                            <td className="px-2 tabular-nums">{student.pending}</td>
                            <td className="px-2 text-xs">
                              {preview.available
                                ? `${preview.percent}% (${preview.numerator} presenças ÷ ${preview.denominator} aulas com chamada concluída) · não oficial`
                                : preview.reason}
                            </td>
                            <td className="px-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-expanded={open === key}
                                onClick={() => setOpen(open === key ? null : key)}
                              >
                                {open === key ? "Ocultar" : "Ver"}
                              </Button>
                            </td>
                          </tr>
                          {open === key ? (
                            <tr>
                              <td colSpan={7} className="bg-muted/40 p-2">
                                <ul className="space-y-1 text-xs">
                                  {student.launches.map((launch, i) => (
                                    <li key={i} className="flex flex-wrap items-center gap-2">
                                      <Link
                                        className="text-primary underline-offset-2 hover:underline"
                                        to="/diario/chamada/$registroId"
                                        params={{ registroId: launch.entryId }}
                                        search={search}
                                      >
                                        {launch.entryId}
                                      </Link>
                                      {formatAcademicDate(launch.date)} · {launch.slot} ·{" "}
                                      <MarkLabel mark={launch.mark} />
                                      {!launch.concluded ? (
                                        <span className="text-muted-foreground">
                                          (chamada não concluída)
                                        </span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
      <p className={cn("text-xs text-muted-foreground")}>{ATTENDANCE_LOCAL_NOTE}</p>
    </div>
  );
}
