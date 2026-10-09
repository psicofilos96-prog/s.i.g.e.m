import { confirmAction } from "@/components/sigem/confirm-action";
import { isDiaryCloud } from "./diary-persistence-mode";
import { concludeLessonInCloud, newLogicalId } from "./diary-cloud";
import { useEffect, useMemo, useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import { DateInput } from "@/components/sigem/date-input";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InformationPair } from "@/components/sigem/operational";
import { EmptyState, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import { DiaryHeader } from "./diary-context";
import { LessonCorrectionPanel } from "./lesson-correction-panel";
import {
  lessonEntryFacts,
  lessonVersionStore,
  useLessonVersions,
} from "./lesson-correction-config";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  DIARY_DEMONSTRATION_NOTE,
  diaryContext,
  type DiarySearch,
} from "./diary-data";
import { DraftIndicator, LessonRecordForm } from "./lesson-record-form";
import { LessonDraftRecovery, LessonDraftStatus, useLessonServerDraft } from "./use-lesson-server-draft";
import { AttendanceSummaryCard } from "./attendance-pages";
import { JourneyAgenda } from "./diary-journey-view";
import { InfantExperienceDetail, InfantExperienceRegisterPage } from "./infant-experience-pages";
import {
  infantExperienceStore,
  isInfantAssignment,
  useLocalInfantExperiences,
} from "./infant-experiences";
import {
  LOCAL_RECORD_NOTE,
  emptyLessonInput,
  findLessonEntry,
  isInputDirty,
  lessonEntries,
  localLessonStore,
  plannedContentFor,
  scheduleBlocksFor,
  shiftDate,
  useLocalLessonRecords,
  type LessonEntry,
  type LessonRecordInput,
} from "./lesson-records";
import {
  LessonWorkspace,
  lessonBlockGroup,
  lessonBlockGroups,
  type PreviousLessonMemory,
} from "./lesson-workspace";

export type RegisterSearch = DiarySearch & { atuacao?: string; bloco?: string; registro?: string };

/** Agenda diária: projeção única da jornada (diary-journey). */
export function DailyAgenda({ search }: { search: DiarySearch }) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const date = diaryContext(professionalId, search.data).referenceDate;
  return <JourneyAgenda search={{ ...search, professor: professionalId }} date={date} />;
}

export function RegisterLessonPage({ search }: { search: RegisterSearch }) {
  // W.1: com conta, o registro oficial é só em "Meus diários" (regência canônica); este fluxo legado não grava.
  if (isDiaryCloud()) {
    return (
      <StatePanel
        tone="info"
        title="Registre aulas em “Meus diários”"
        description="Com sua conta, a aula é registrada a partir da sua regência vigente."
        action={<Button asChild><Link to="/meus-diarios">Abrir Meus diários</Link></Button>}
      />
    );
  }
  if (isInfantAssignment(search.atuacao)) {
    return (
      <InfantExperienceRegisterPage
        search={search}
        initialAssignmentId={search.atuacao}
        initialDate={search.data}
      />
    );
  }
  return <StandardLessonRegisterPage search={search} />;
}

function StandardLessonRegisterPage({ search }: { search: RegisterSearch }) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const local = useLocalLessonRecords();
  const existing = search.registro ? local.find((item) => item.id === search.registro) : undefined;
  const initial = useMemo<LessonRecordInput>(() => {
    if (existing) {
      const { id: _id, status: _s, createdAt: _c, ...rest } = existing;
      return rest;
    }
    const date = diaryContext(professionalId, search.data).referenceDate;
    const base = emptyLessonInput(professionalId, date, search.atuacao ?? "");
    const planned = scheduleBlocksFor(professionalId, date);
    const block = planned.find(
      (item) =>
        item.blockId === search.bloco && (!search.atuacao || item.assignmentId === search.atuacao),
    );
    const first = planned.find((item) => !search.turma || item.classId === search.turma);
    const assignmentId = block?.assignmentId ?? base.assignmentId ?? first?.assignmentId ?? "";
    return {
      ...base,
      assignmentId: assignmentId || first?.assignmentId || "",
      blockIds: block ? [block.blockId] : [],
      quantity: block ? 1 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, professionalId, search.data, search.atuacao, search.bloco, search.turma]);
  const [value, setValue] = useState<LessonRecordInput>(initial);
  const [baseline, setBaseline] = useState<LessonRecordInput>(initial);
  const [draftId, setDraftId] = useState<string | undefined>(existing?.id);
  const [concluded, setConcluded] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const serverDraft = useLessonServerDraft(value, isDiaryCloud() && concluded === null);
  /** Com sessão, concluir = versão oficial v1 no banco; sem sessão, laboratório. */
  const concludeRecord = async () => {
    if (isDiaryCloud()) {
      const logicalId = newLogicalId("aula");
      const result = await concludeLessonInCloud(value, logicalId);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      if (draftId) localLessonStore.discard(draftId);
      try { await serverDraft.close(); } catch { setNotice("Aula concluída. O rascunho anterior não pôde ser marcado como encerrado e continuará aparecendo para recuperação."); }
      setBaseline(value);
      setConcluded(logicalId);
      return;
    }
    const record = localLessonStore.upsert(value, "Concluído localmente (demonstração)", draftId);
    setBaseline(value);
    setConcluded(record.id);
  };
  const navigate = useNavigate();

  const context = diaryContext(professionalId, value.date);
  const planned = scheduleBlocksFor(professionalId, value.date);
  const dirty = isInputDirty(value, baseline);

  useBlocker({
    shouldBlockFn: async () =>
      dirty &&
      !(await confirmAction({ title: "Sair sem concluir?", consequence: "Há alterações não concluídas neste registro. Deseja sair e perdê-las?", actionLabel: "Sair e descartar", destructive: true })),
    enableBeforeUnload: dirty,
  });

  const [advanced, setAdvanced] = useState(false);
  const groups = useMemo(() => lessonBlockGroups(planned), [planned]);
  const focusBlock = value.blockIds[0] ?? search.bloco;
  const group =
    advanced || value.extraordinary ? undefined : lessonBlockGroup(planned, focusBlock);
  const groupKey = group ? group.map((item) => item.blockId).join(",") : "";
  const groupIndex = group
    ? groups.findIndex((item) => item[0]!.blockId === group[0]!.blockId)
    : -1;

  useEffect(() => {
    if (!group) return;
    const ids = group.map((item) => item.blockId);
    const assignmentId = group[0]!.assignmentId;
    if (
      value.assignmentId === assignmentId &&
      value.blockIds.join(",") === ids.join(",") &&
      value.quantity === ids.length
    )
      return;
    const next = { ...value, assignmentId, blockIds: ids, quantity: ids.length };
    setValue(next);
    setBaseline((current) => ({ ...current, assignmentId, blockIds: ids, quantity: ids.length }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);



  if (existing && existing.status !== "Rascunho local") {
    return (
      <div className="space-y-5">
        <DiaryHeader
          title="Registro concluído"
          description="Registros concluídos não são editados diretamente."
          context={context}
        />
        <StatePanel
          tone="warning"
          title="Edição direta indisponível"
          description="Correções de registros concluídos exigirão solicitação de alteração, ainda não implementada. O registro original é preservado."
        />
        <Button asChild variant="outline">
          <Link
            to="/diario/registros/$registroId"
            params={{ registroId: existing.id }}
            search={search}
          >
            Ver registro
          </Link>
        </Button>
      </div>
    );
  }

  const changeDate = (date: string) => {
    setValue({ ...emptyLessonInput(professionalId, date), assignmentId: "" });
  };

  if (concluded) {
    return (
      <div className="space-y-5">
        <DiaryHeader
          title="Registro de aula"
          description="Registro demonstrativo concluído."
          context={context}
        />
        <StatePanel
          tone="success"
          title="Aula registrada."
          description={`Registro ${concluded}. ${LOCAL_RECORD_NOTE}`}
        />
        {groupIndex >= 0 && groups[groupIndex + 1] ? (
          <Button
            variant="outline"
            onClick={() => {
              const next = groups[groupIndex + 1]!;
              const base = emptyLessonInput(professionalId, value.date, next[0]!.assignmentId);
              const ready = {
                ...base,
                blockIds: next.map((item) => item.blockId),
                quantity: next.length,
              };
              setValue(ready);
              setBaseline(ready);
              setDraftId(undefined);
              setConcluded(null);
            }}
          >
            Registrar próxima aula <ArrowRight />
          </Button>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/diario/registros/$registroId"
              params={{ registroId: concluded }}
              search={search}
            >
              Ver detalhamento <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/diario" search={{ ...search, data: value.date }}>
              Voltar à agenda
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link
              to="/diario/chamada/$registroId"
              params={{ registroId: concluded }}
              search={search}
            >
              <ClipboardCheck /> Fazer chamada
            </Link>
          </Button>
        </div>
        <StatePanel
          tone="info"
          title="Chamada no mesmo fluxo"
          description="Nenhuma presença ou falta foi registrada automaticamente; a chamada exige marcação explícita de cada aluno."
        />
      </div>
    );
  }

  if (group) {
    const plans = group
      .map((item) => plannedContentFor(value.date, item.blockId, item.assignmentId))
      .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
    const reference = group[0]!;
    const earlier = lessonEntries(professionalId, local).find(
      (entry) =>
        entry.classId === reference.classId &&
        entry.field === reference.field &&
        entry.date < value.date &&
        entry.status !== "Rascunho local",
    );
    const previous: PreviousLessonMemory | undefined = earlier
      ? { id: earlier.id, date: earlier.date, text: earlier.summary }
      : undefined;
    const goToGroup = (next: (typeof groups)[number]) => {
      const base = emptyLessonInput(professionalId, value.date, next[0]!.assignmentId);
      const ready = {
        ...base,
        blockIds: next.map((item) => item.blockId),
        quantity: next.length,
      };
      setValue(ready);
      setBaseline(ready);
      setDraftId(undefined);
      void navigate({ to: "/diario/registrar", search: { ...search, bloco: next[0]!.blockId } });
    };
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/diario" search={{ ...search, data: value.date }}>
            <ArrowLeft /> Agenda do dia
          </Link>
        </Button>
        <LessonWorkspace
          group={group}
          value={value}
          onChange={setValue}
          dirty={dirty}
          dayOrder={planned
            .filter((item) => item.classId === reference.classId)
            .map((item) => item.blockId)}
          plans={plans}
          {...(previous ? { previous } : {})}
          {...(groupIndex > 0 ? { previousGroup: groups[groupIndex - 1]! } : {})}
          {...(groupIndex >= 0 && groups[groupIndex + 1]
            ? { nextGroup: groups[groupIndex + 1]! }
            : {})}
          onGoToGroup={goToGroup}
          onOpenPreviousRecord={(memory) => {
            void navigate({
              to: "/diario/registros/$registroId",
              params: { registroId: memory.id },
              search,
            });
          }}
          onAdvanced={() => setAdvanced(true)}
          onConclude={() => void concludeRecord()}
        />
      </div>
    );
  }



  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Registrar aula"
        description="Registre o que foi efetivamente realizado. A aula prevista no horário não é considerada ministrada sem sua confirmação."
        context={context}
      >
        {isDiaryCloud() ? <LessonDraftStatus draft={serverDraft} /> : <DraftIndicator dirty={dirty} draftId={draftId} />}
      </DiaryHeader>
      <LessonDraftRecovery draft={serverDraft} onRecover={(v) => setValue(v)} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Data da aula</span>
          <DateInput
            aria-label="Data da aula"
            value={value.date}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
            disabled={Boolean(draftId)}
            className="w-44"
          />
        </label>
        <p className="max-w-xl pb-2 text-xs text-muted-foreground">{LOCAL_RECORD_NOTE}</p>
      </div>
      {notice ? (
        <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}
      <LessonRecordForm
        assignments={context.assignments}
        planned={planned}
        value={value}
        onChange={(next) => {
          setNotice(null);
          setValue(next);
        }}
        hasDraft={Boolean(draftId)}
        onKeepDraft={() => {
          const record = localLessonStore.upsert(value, "Rascunho local", draftId);
          setDraftId(record.id);
          setBaseline(value);
          setNotice(
            `Rascunho ${record.id} mantido na memória desta aba. Ele não é salvo permanentemente e se perde ao recarregar.`,
          );
        }}
        onDiscard={() => {
          if (draftId) localLessonStore.discard(draftId);
          setBaseline(value);
          setDraftId(undefined);
          void navigate({ to: "/diario", search: search });
        }}
        onConclude={() => void concludeRecord()}
      />
      <p className="text-xs text-muted-foreground">{DIARY_DEMONSTRATION_NOTE}</p>
    </div>
  );
}

function entryTone(entry: LessonEntry) {
  if (entry.status === "Rascunho local") return "warning" as const;
  if (entry.origin === "local") return "info" as const;
  return "neutral" as const;
}

export function LessonTimeline({
  entries,
  search,
}: {
  entries: LessonEntry[];
  search: DiarySearch;
}) {
  if (!entries.length)
    return (
      <EmptyState
        icon={History}
        title="Sem aulas registradas"
        description="Não há registros de aulas efetivamente realizadas para os filtros escolhidos."
      />
    );
  const dates = [...new Set(entries.map((entry) => entry.date))];
  return (
    <ol className="space-y-5" aria-label="Linha do tempo de aulas">
      {dates.map((date) => (
        <li key={date}>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {formatAcademicDate(date)}
          </h3>
          <ul className="space-y-2 border-l-2 border-border pl-4">
            {entries
              .filter((entry) => entry.date === date)
              .map((entry) => (
                <li key={entry.id} className="surface-panel p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {entry.className} · {entry.field}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.unitName} · {entry.professionalName} ({entry.role}) ·{" "}
                        {entry.quantity} aula(s){entry.extraordinary ? " · fora da previsão" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge tone={entryTone(entry)}>{entry.status}</StatusBadge>
                      <StatusBadge tone="neutral">
                        {entry.origin === "fixture"
                          ? "Dado fictício histórico"
                          : "Criado nesta sessão"}
                      </StatusBadge>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground">{entry.summary}</p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    <Button asChild variant="link" size="sm" className="h-auto px-0">
                      <Link
                        to="/diario/registros/$registroId"
                        params={{ registroId: entry.id }}
                        search={search}
                      >
                        Abrir registro <ArrowRight />
                      </Link>
                    </Button>
                    {entry.status !== "Rascunho local" ? (
                      <Button asChild variant="link" size="sm" className="h-auto px-0">
                        <Link
                          to="/diario/chamada/$registroId"
                          params={{ registroId: entry.id }}
                          search={search}
                        >
                          <ClipboardCheck /> Chamada
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function LessonsTimelineSection({ search }: { search: DiarySearch }) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const local = useLocalLessonRecords();
  const query = search.q ?? "";
  const from = search.de ?? "";
  const until = search.ate ?? "";
  const entries = lessonEntries(professionalId, local).filter(
    (entry) =>
      (!search.turma || entry.classId === search.turma) &&
      (!search.unidade || entry.unitId === search.unidade) &&
      (!search.componente || entry.field === search.componente) &&
      (!from || entry.date >= from) &&
      (!until || entry.date <= until) &&
      `${entry.summary} ${entry.className} ${entry.field}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/diario/registrar" search={search}>
            <PenLine /> Registrar aula
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {entries.length} registro(s) · planejamentos não aparecem aqui, apenas aulas efetivamente
        registradas.
      </p>
      <LessonTimeline entries={entries} search={search} />
    </div>
  );
}

export function LessonDetailPage(props: { registroId: string; search: DiarySearch }) {
  const experience = infantExperienceStore.get(props.registroId);
  return experience ? (
    <InfantExperienceDetail record={experience} search={props.search} />
  ) : (
    <StandardLessonDetailPage {...props} />
  );
}

function StandardLessonDetailPage({
  registroId,
  search,
}: {
  registroId: string;
  search: DiarySearch;
}) {
  const local = useLocalLessonRecords();
  useLocalInfantExperiences();
  useLessonVersions();
  const entry = findLessonEntry(registroId, local);
  const context = diaryContext(
    search.professor ?? entry?.professionalId ?? DEFAULT_DIARY_PROFESSIONAL_ID,
    entry?.date ?? search.data,
  );
  if (!entry)
    return (
      <div className="space-y-5">
        <DiaryHeader
          title="Registro não encontrado"
          description="O registro não existe ou foi descartado."
          context={context}
        />
        <EmptyState
          title="Registro indisponível"
          description="Registros locais deixam de existir ao recarregar a página."
          action={
            <Button asChild variant="outline">
              <Link to="/diario/aulas" search={search}>
                Histórico de aulas
              </Link>
            </Button>
          }
        />
      </div>
    );
  const concluded = entry.status !== "Rascunho local";
  const currentFacts = concluded
    ? (lessonVersionStore
        .chain(entry.id, lessonEntryFacts(entry), `${entry.date}T12:00:00.000Z`)
        .at(-1)?.facts ?? lessonEntryFacts(entry))
    : lessonEntryFacts(entry);
  const optional = Object.entries({
    Objetivos: currentFacts.objectives,
    "Habilidades curriculares": currentFacts.skills,
    "Estratégias e recursos": currentFacts.strategies,
    "Observações pedagógicas": currentFacts.observations,
    Agrupamentos: currentFacts.groupings,
  }).filter(([, text]) => text && text.trim());
  return (
    <div className="space-y-5">
      <DiaryHeader
        title={`Registro ${entry.id}`}
        description={`${entry.className} · ${entry.field} · ${formatAcademicDate(entry.date)}`}
        context={context}
      >
        <StatusBadge tone={entryTone(entry)}>{entry.status}</StatusBadge>
      </DiaryHeader>
      <Button asChild variant="ghost" size="sm">
        <Link to="/diario/aulas" search={search}>
          <ArrowLeft /> Histórico de aulas
        </Link>
      </Button>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18.75rem,25vw,23.75rem)]">
        <div className="min-w-0 space-y-5">
          <section className="surface-panel p-4" aria-labelledby="content-title">
            <SectionHeader title="Conteúdo efetivamente registrado" />
            <h2 id="content-title" className="sr-only">
              Conteúdo
            </h2>
            {currentFacts.contentMode === "individual" ? (
              <ul className="mt-3 space-y-2">
                {currentFacts.blockIds.map((id, index) => (
                  <li key={id} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      {currentFacts.blockIds.length > 1 ? `${index + 1}ª aula deste registro` : "Aula"}
                    </p>
                    <p className="text-foreground">{currentFacts.contents[id]}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 whitespace-pre-line text-foreground">
                {currentFacts.contents["shared"] ?? entry.summary}
              </p>
            )}
            {optional.length ? (
              <dl className="mt-4 grid gap-3 md:grid-cols-2">
                {optional.map(([label, text]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="text-sm text-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
          <section className="surface-panel p-4">
            <SectionHeader
              title="Relação com o planejamento"
              description="Aula prevista, conteúdo planejado e conteúdo registrado permanecem distintos."
            />
            <p className="mt-2 text-sm text-foreground">{currentFacts.planningRelation}</p>
            {entry.extraordinary ? (
              <StatePanel
                tone="info"
                title={`Fora da previsão · ${entry.extraordinary.start}–${entry.extraordinary.end}`}
                description={entry.extraordinary.justification}
              />
            ) : null}
          </section>
          {concluded ? (
            <LessonCorrectionPanel entry={entry} profileId={search.perfil ?? "perfil-docente"} />
          ) : null}
        </div>
        <aside className="space-y-4">
          <section className="surface-panel p-4">
            <SectionHeader title="Contexto e autoria" />
            <dl className="info-list mt-3 divide-y divide-border/60 text-sm">
              {[
                ["Data", formatAcademicDate(entry.date)],
                ["Escola", entry.unitName],
                ["Turma", entry.className],
                ["Componente/campo", entry.field],
                ["Responsável", entry.professionalName],
                ["Atuação", `${entry.role} · ${entry.assignmentId}`],
                [
                  "Aulas",
                  `${entry.quantity}${entry.blockIds.length ? ` · blocos ${entry.blockIds.join(", ")}` : ""}`,
                ],
                [
                  "Origem",
                  entry.origin === "fixture" ? "Dado fictício histórico" : "Criado nesta sessão",
                ],
              ].map(([label, text]) => (
                <InformationPair key={label} label={label} value={text} className="py-2" />
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Nenhuma validação institucional foi realizada sobre este registro demonstrativo.
            </p>
          </section>
          <section className={cn("surface-panel space-y-2 p-4")}>
            {entry.status === "Rascunho local" ? (
              <Button asChild className="w-full">
                <Link to="/diario/registrar" search={{ ...search, registro: entry.id }}>
                  <PenLine /> Editar rascunho
                </Link>
              </Button>
            ) : null}
          </section>
          <AttendanceSummaryCard entry={entry} search={search} />
        </aside>
      </div>
    </div>
  );
}
