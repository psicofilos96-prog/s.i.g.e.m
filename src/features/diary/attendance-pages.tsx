import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
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
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { cn } from "@/lib/utils";
import { DiaryHeader, FutureFeatureState } from "./diary-context";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, type DiarySearch } from "./diary-data";
import { ContextConflictState } from "./lesson-record-form";
import {
  allFixtureLessons,
  findLessonEntry,
  fixtureEntry,
  localEntry,
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Chamada</h2>
        <AttendanceStatusBadge status={status} />
      </div>
      {draftLesson ? (
        <p className="text-xs text-muted-foreground">
          Aula em rascunho não gera chamada. Conclua o registro primeiro.
        </p>
      ) : (
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
    ["Data", entry.date],
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
      <dl className="surface-panel grid gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, text]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words font-medium text-foreground">{text}</dd>
          </div>
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
  return [...allFixtureLessons.map(fixtureEntry), ...local.map(localEntry)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  const id = `f-${label.replace(/\W/g, "")}`;
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AttendanceHistoryPage({ search }: { search: AttendanceHistorySearch }) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const entries = useAllEntries().filter((entry) => entry.status !== "Rascunho local");
  const local = useLocalAttendance();
  const [filters, setFilters] = useState({
    de: search.de ?? "",
    ate: search.ate ?? "",
    unidade: "",
    turma: "",
    componente: "",
    profissional: "",
    estado: search.estado ?? "",
  });
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
      (!filters.de || entry.date >= filters.de) &&
      (!filters.ate || entry.date <= filters.ate) &&
      (!filters.unidade || entry.unitId === filters.unidade) &&
      (!filters.turma || entry.classId === filters.turma) &&
      (!filters.componente || entry.field === filters.componente) &&
      (!filters.profissional || entry.professionalId === filters.profissional) &&
      (!filters.estado || status === filters.estado),
  );
  const set = (key: keyof typeof filters) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Histórico de chamadas"
        description="Chamadas vinculadas às aulas registradas. Consulta histórica é somente leitura; a operação ocorre no contexto do responsável."
        context={context}
      />
      <section
        className="surface-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filtros"
      >
        <div className="space-y-1">
          <label htmlFor="f-de" className="text-xs font-medium text-muted-foreground">
            De
          </label>
          <Input
            id="f-de"
            type="date"
            value={filters.de}
            onChange={(e) => set("de")(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="f-ate" className="text-xs font-medium text-muted-foreground">
            Até
          </label>
          <Input
            id="f-ate"
            type="date"
            value={filters.ate}
            onChange={(e) => set("ate")(e.target.value)}
          />
        </div>
        <FilterSelect
          label="Escola"
          value={filters.unidade}
          onChange={set("unidade")}
          options={opts((e) => [e.unitId, e.unitName])}
        />
        <FilterSelect
          label="Turma"
          value={filters.turma}
          onChange={set("turma")}
          options={opts((e) => [e.classId, e.className])}
        />
        <FilterSelect
          label="Componente/campo"
          value={filters.componente}
          onChange={set("componente")}
          options={opts((e) => [e.field, e.field])}
        />
        <FilterSelect
          label="Profissional"
          value={filters.profissional}
          onChange={set("profissional")}
          options={opts((e) => [e.professionalId, e.professionalName])}
        />
        <FilterSelect
          label="Estado da chamada"
          value={filters.estado}
          onChange={set("estado")}
          options={(
            ["Sem chamada", "Rascunho", "Parcialmente preenchida", "Concluída"] as const
          ).map((s) => [s, s])}
        />
      </section>
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
                    {entry.date} · {entry.className} · {entry.field}
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
  const [from, setFrom] = useState(search.de ?? "2026-09-01");
  const [to, setTo] = useState(search.ate ?? context.referenceDate);
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
      <section className="surface-panel grid gap-3 p-4 sm:grid-cols-2" aria-label="Período">
        <div className="space-y-1">
          <label htmlFor="fr-de" className="text-xs font-medium text-muted-foreground">
            Período: de
          </label>
          <Input id="fr-de" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="fr-ate" className="text-xs font-medium text-muted-foreground">
            até
          </label>
          <Input id="fr-ate" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </section>
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
              description={`${scope.stage} · atuação ${scope.assignmentId} · ${from} a ${to}`}
            />
            <dl className="grid gap-2 text-sm sm:grid-cols-4">
              {[
                ["Aulas previstas", scope.planned],
                ["Efetivamente ministradas", scope.taught],
                ["Com chamada concluída", scope.withConcluded],
                ["Sem chamada concluída", scope.pendingLessons],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {scope.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum aluno aplicável nas aulas registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                                      {launch.date} · {launch.slot} ·{" "}
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
