import { formatDateRange } from "@/lib/academic-date";
import { Fragment, useEffect, useMemo, useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  ClipboardCheck,
  Copy,
  X,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { InformationPair } from "@/components/sigem/operational";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { cn } from "@/lib/utils";
import { DiaryHeader, FutureFeatureState } from "./diary-context";
import { DiaryQueryFilters } from "./diary-query-filters";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, type DiarySearch } from "./diary-data";
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

function AttendanceWorkspace({
  entry,
  search,
  blocker,
  context,
}: {
  entry: LessonEntry;
  search: DiarySearch;
  blocker: ReturnType<typeof attendanceBlocker>;
  context: ReturnType<typeof diaryContext>;
}) {
  const record = useAttendanceRecord(entry.id);
  const concluded = Boolean(record?.concluded);
  const readOnly = concluded || Boolean(blocker);
  const slots = attendanceSlots(entry);
  const students = eligibleStudents(entry);
  const excluded = ineligibleStudents(entry);
  const initial = useMemo(() => record?.marks ?? {}, [record]);
  const [marks, setMarks] = useState<AttendanceMarks>(initial);
  const [active, setActive] = useState(slots[0]?.key ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dirty = !readOnly && JSON.stringify(marks) !== JSON.stringify(initial);
  const counts = attendanceCounts(entry, marks, students);
  const status = attendanceStatus(entry, record);
  const historical = entry.date < "2026-01-01";
  const responsible =
    getDemonstrationProfessional(entry.professionalId)?.personName ?? entry.professionalName;

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("Há marcações não salvas nesta chamada. Deseja sair e perdê-las?"),
    enableBeforeUnload: dirty,
  });

  const setMark = (slot: string, studentId: string, mark: AttendanceMark | null) => {
    if (readOnly) return;
    setReviewing(false);
    setMarks((current) => {
      const slotMarks = { ...(current[slot] ?? {}) };
      if (mark) slotMarks[studentId] = mark;
      else delete slotMarks[studentId];
      return { ...current, [slot]: slotMarks };
    });
  };
  const slotPending = (key: string) =>
    students.filter((item) => !marks[key]?.[item.student.id]).length;
  const markPendingPresent = () => {
    setMarks((current) => {
      const slotMarks = { ...(current[active] ?? {}) };
      for (const item of students) slotMarks[item.student.id] ??= "Presente";
      return { ...current, [active]: slotMarks };
    });
  };
  const replicate = () => {
    setMarks((current) => {
      const source = current[active] ?? {};
      return Object.fromEntries(slots.map((slot) => [slot.key, { ...source }]));
    });
    setFeedback("Marcações replicadas. Revise cada aula antes de concluir.");
  };
  const saveDraft = () => {
    attendanceStore.save(entry.id, marks, false);
    setFeedback("Rascunho mantido nesta aba (não salvo permanentemente).");
  };
  const conclude = () => {
    attendanceStore.save(entry.id, marks, true);
    setReviewing(false);
    setFeedback("Chamada concluída localmente (demonstração). Não há validação institucional.");
  };
  const discard = () => {
    if (record?.origin === "local") attendanceStore.discard(entry.id);
    setMarks(record?.origin === "local" ? {} : initial);
    setFeedback("Alterações descartadas.");
  };

  const summary: Array<[string, string]> = [
    ["Escola", entry.unitName],
    ["Turma", entry.className],
    ["Componente/campo", entry.field],
    ["Data", formatAcademicDate(entry.date)],
    ["Horários", slots.map((slot) => slot.time).join(" · ")],
    ["Responsável", `${responsible} (${entry.role} · ${entry.assignmentId})`],
    ["Aulas registradas", String(slots.length)],
  ];

  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Chamada"
        description={`Registro ${entry.id} · frequência vinculada às aulas efetivamente ministradas.`}
        context={context}
      >
        <AttendanceStatusBadge
          status={dirty ? (counts.marked ? "Parcialmente preenchida" : "Rascunho") : status}
        />
        {historical ? <StatusBadge tone="neutral">Consulta histórica</StatusBadge> : null}
      </DiaryHeader>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link
            to="/diario/registros/$registroId"
            params={{ registroId: entry.id }}
            search={search}
          >
            <ArrowLeft /> Registro da aula
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/diario/chamadas" search={search}>
            Histórico de chamadas
          </Link>
        </Button>
      </div>
      <dl className="surface-panel info-list divide-y divide-border/60 p-4 text-sm">
        {summary.map(([label, text]) => (
          <InformationPair
            key={label}
            label={label}
            value={<span className="font-medium">{text}</span>}
            className="py-2"
          />
        ))}
      </dl>
      {entry.extraordinary ? (
        <StatePanel
          tone="info"
          title={`Aula fora da previsão · ${entry.extraordinary.start}–${entry.extraordinary.end}`}
          description={`${entry.extraordinary.justification} Contexto preservado do registro; nenhuma aprovação administrativa é presumida.`}
        />
      ) : null}
      {blocker ? <ContextConflictState message={blocker.message} /> : null}
      {concluded ? (
        <StatePanel
          tone="success"
          title="Chamada concluída"
          description={`${record?.origin === "fixture" ? "Dado fictício histórico." : "Concluída nesta aba (demonstração)."} Uma chamada concluída não é sobrescrita.`}
        />
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
              Ver registro
            </Link>
          </Button>
        </nav>
      ) : null}

      {students.length === 0 ? (
        <EmptyState
          title="Nenhum aluno com alocação na data"
          description="Não há participação aplicável nesta turma na data da aula; nenhuma frequência é fabricada."
        />
      ) : (
        <section className="surface-panel p-4" aria-labelledby="attendance-list">
          <SectionHeader
            title="Lista nominal"
            description="Somente alunos cuja alocação abrange a data da aula. Sem marcação não significa presença nem falta."
          />
          <h2 id="attendance-list" className="sr-only">
            Lista nominal da chamada
          </h2>
          {slots.length > 1 ? (
            <div
              role="tablist"
              aria-label="Aulas do registro"
              className="mt-3 flex flex-wrap gap-2"
            >
              {slots.map((slot) => (
                <Button
                  key={slot.key}
                  role="tab"
                  aria-selected={active === slot.key}
                  variant={active === slot.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActive(slot.key)}
                >
                  {slot.label} · {slot.time}
                  <span className="ml-1 text-xs">({slotPending(slot.key)} pendente(s))</span>
                </Button>
              ))}
            </div>
          ) : null}
          {!readOnly ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={markPendingPresent}>
                <Check /> Marcar pendentes desta aula como presentes
              </Button>
              {slots.length > 1 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Copy /> Replicar para as demais aulas
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Replicar marcações?</AlertDialogTitle>
                      <AlertDialogDescription>
                        As marcações da aula selecionada substituirão as das demais aulas deste
                        registro. Você poderá revisar cada aula antes de concluir.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={replicate}>
                        Confirmar replicação
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          ) : null}
          <ul className="mt-3 divide-y divide-border" aria-label="Alunos">
            {students.map((item, index) => {
              const mark = marks[active]?.[item.student.id];
              return (
                <li
                  key={item.student.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  onKeyDown={(event) => {
                    const key = event.key.toLowerCase();
                    if (key === "p") setMark(active, item.student.id, "Presente");
                    if (key === "f") setMark(active, item.student.id, "Ausente");
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {index + 1}. {item.student.personName}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.student.sigemId}
                      {recentlyAllocated(item, entry.date) ? (
                        <StatusBadge tone="info">Recém-enturmado</StatusBadge>
                      ) : null}
                      <MarkLabel mark={mark} />
                    </p>
                  </div>
                  <div
                    className="flex gap-2"
                    role="group"
                    aria-label={`Frequência de ${item.student.personName}`}
                  >
                    <Button
                      size="sm"
                      variant={mark === "Presente" ? "default" : "outline"}
                      aria-pressed={mark === "Presente"}
                      disabled={readOnly}
                      onClick={() => setMark(active, item.student.id, "Presente")}
                    >
                      <Check /> Presente
                    </Button>
                    <Button
                      size="sm"
                      variant={mark === "Ausente" ? "destructive" : "outline"}
                      aria-pressed={mark === "Ausente"}
                      disabled={readOnly}
                      onClick={() => setMark(active, item.student.id, "Ausente")}
                    >
                      <X /> Ausente
                    </Button>
                    {!readOnly && mark ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Limpar marcação de ${item.student.personName}`}
                        onClick={() => setMark(active, item.student.id, null)}
                      >
                        Limpar
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Teclado: Tab navega entre alunos; P marca presente e F marca ausente na linha em foco.
          </p>
        </section>
      )}

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

      <section className="surface-panel space-y-3 p-4" aria-label="Situação da chamada">
        <p className="text-sm font-medium text-foreground" aria-live="polite">
          {counts.marked} marcação(ões) concluída(s) · {counts.pending} pendente(s) ·{" "}
          {counts.present} presença(s) · {counts.absent} falta(s)
        </p>
        {feedback ? (
          <p role="status" className="text-sm text-muted-foreground">
            {feedback}
          </p>
        ) : null}
        {reviewing && counts.pending > 0 ? (
          <div
            role="alert"
            className="flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>
              Não é possível concluir: {counts.pending} marcação(ões) pendente(s). Marque todos os
              alunos em cada aula ou mantenha como rascunho.
            </span>
          </div>
        ) : null}
        {reviewing && counts.pending === 0 ? (
          <div
            role="region"
            aria-label="Revisão da chamada"
            className="rounded-md border border-border p-3 text-sm"
          >
            <p className="font-medium text-foreground">Revisão</p>
            <ul className="mt-1 space-y-0.5">
              {slots.map((slot) => {
                const values = Object.values(marks[slot.key] ?? {});
                return (
                  <li key={slot.key}>
                    {slot.label} ({slot.time}): {values.filter((v) => v === "Presente").length} P ·{" "}
                    {values.filter((v) => v === "Ausente").length} F
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {!readOnly && students.length ? (
          <div className="flex flex-wrap gap-2">
            {reviewing && counts.pending === 0 ? (
              <Button onClick={conclude}>
                <ClipboardCheck /> Concluir chamada (demonstração)
              </Button>
            ) : (
              <Button onClick={() => setReviewing(true)}>Revisar e concluir</Button>
            )}
            <Button variant="outline" onClick={saveDraft} disabled={!counts.marked}>
              Manter rascunho
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" disabled={!dirty && record?.origin !== "local"}>
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
        ) : null}
        {concluded ? (
          <FutureFeatureState
            title="Solicitar alteração"
            description="Correção de chamada concluída dependerá de regras ainda não definidas. Nenhuma aprovação ou trilha de auditoria é simulada."
          />
        ) : null}
        <p className="text-xs text-muted-foreground">{ATTENDANCE_LOCAL_NOTE}</p>
      </section>
    </div>
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
                ["Aulas previstas", scope.planned],
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
            {scope.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum aluno aplicável nas aulas registradas.
              </p>
            ) : (
              <div className="max-w-full overflow-x-auto overscroll-x-contain" tabIndex={0}>
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2">Aluno</th>
                      <th className="px-2">Aulas aplicáveis</th>
                      <th className="px-2">Presenças</th>
                      <th className="px-2">Faltas</th>
                      <th className="px-2">Pendentes</th>
                      <th className="px-2">Prévia demonstrativa</th>
                      <th className="px-2">Lançamentos</th>
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
