import { useMemo, useState } from "react";
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
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InformationPair } from "@/components/sigem/operational";
import { EmptyState, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import { DiaryHeader, FutureFeatureState } from "./diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  DIARY_DEMONSTRATION_NOTE,
  diaryContext,
  type DiarySearch,
} from "./diary-data";
import { DraftIndicator, LessonRecordForm } from "./lesson-record-form";
import { AttendanceSummaryCard } from "./attendance-pages";
import { InfantExperienceDetail, InfantExperienceRegisterPage } from "./infant-experience-pages";
import {
  infantExperienceStore,
  isInfantAssignment,
  useLocalInfantExperiences,
} from "./infant-experiences";
import {
  LOCAL_RECORD_NOTE,
  dailyAgenda,
  emptyLessonInput,
  findLessonEntry,
  isInputDirty,
  lessonEntries,
  localLessonStore,
  plannedLessonsFor,
  shiftDate,
  useLocalLessonRecords,
  type AgendaItem,
  type LessonEntry,
  type LessonRecordInput,
} from "./lesson-records";

export type RegisterSearch = DiarySearch & { atuacao?: string; bloco?: string; registro?: string };

const STATE_TONE = {
  Registrada: "success",
  "Rascunho em elaboração": "warning",
  Prevista: "neutral",
} as const;

/** Agenda diária compacta: previstas, rascunhos, registradas e atenção. */
export function DailyAgenda({ search }: { search: DiarySearch }) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const context = diaryContext(professionalId, search.data);
  const date = context.referenceDate;
  const local = useLocalLessonRecords();
  const items = dailyAgenda(professionalId, date, local).filter(
    (item) =>
      (!search.unidade || item.unitId === search.unidade) &&
      (!search.turma || item.classId === search.turma) &&
      (!search.componente || item.field === search.componente),
  );
  const drafts = local.filter(
    (item) => item.professionalId === professionalId && item.status === "Rascunho local",
  );
  return (
    <section aria-labelledby="agenda-title" className="surface-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="agenda-title" className="text-base font-semibold text-foreground">
            Agenda do dia
          </h2>
          <p className="text-xs text-muted-foreground">
            {date} · aulas previstas no horário; o registro depende da sua confirmação.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Dia anterior">
            <Link to="/diario" search={{ ...search, data: shiftDate(date, -1) }}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Próximo dia">
            <Link to="/diario" search={{ ...search, data: shiftDate(date, 1) }}>
              <ChevronRight />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/diario/registrar" search={{ ...search, data: date }}>
              <PenLine /> Registrar aula
            </Link>
          </Button>
        </div>
      </div>
      {items.length ? (
        <ol className="mt-3 divide-y divide-border" aria-label="Aulas do dia">
          {items.map((item) => (
            <AgendaRow key={item.key} item={item} search={search} />
          ))}
        </ol>
      ) : (
        <div className="mt-3">
          <EmptyState
            icon={CalendarCheck2}
            title="Nenhuma aula prevista neste dia"
            description="Se uma atividade ocorreu fora do horário, registre-a como aula fora da previsão."
            compact
          />
        </div>
      )}
      {drafts.length ? (
        <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">
            Atenção: {drafts.length} rascunho(s) em elaboração nesta aba
          </p>
          <ul className="mt-1 space-y-1">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  className="text-primary underline-offset-2 hover:underline"
                  to="/diario/registrar"
                  search={{ ...search, data: draft.date, registro: draft.id }}
                >
                  Continuar {draft.id} · {draft.date}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function AgendaRow({ item, search }: { item: AgendaItem; search: DiarySearch }) {
  return (
    <li className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="w-24 shrink-0 font-semibold tabular-nums text-foreground">
          {item.block.start}–{item.block.end}
        </span>
        <div className="min-w-0">
          <p className="break-words font-medium text-foreground">{item.className}</p>
          <p className="break-words text-xs text-muted-foreground">
            {item.field} · {item.unitName}
            {item.plan ? " · possui planejamento" : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={STATE_TONE[item.state]}>
          {item.state === "Prevista" ? "Prevista · sem registro" : item.state}
        </StatusBadge>
        {item.state === "Prevista" ? (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/registrar"
              search={{
                ...search,
                data: item.date,
                atuacao: item.assignmentId,
                bloco: item.blockId,
              }}
              aria-label={`Registrar aula das ${item.block.start} em ${item.className}`}
            >
              Registrar
            </Link>
          </Button>
        ) : item.entryId && item.state === "Registrada" ? (
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/diario/registros/$registroId"
              params={{ registroId: item.entryId }}
              search={search}
            >
              Ver
            </Link>
          </Button>
        ) : null}
        {item.entryId && item.state === "Registrada" ? (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/chamada/$registroId"
              params={{ registroId: item.entryId }}
              search={search}
              aria-label={`Chamada das ${item.block.start} em ${item.className}`}
            >
              Chamada
            </Link>
          </Button>
        ) : item.entryId ? (
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/diario/registrar"
              search={{ ...search, data: item.date, registro: item.entryId }}
            >
              Continuar
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function RegisterLessonPage({ search }: { search: RegisterSearch }) {
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
    const planned = plannedLessonsFor(professionalId, date);
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
  const navigate = useNavigate();

  const context = diaryContext(professionalId, value.date);
  const planned = plannedLessonsFor(professionalId, value.date);
  const dirty = isInputDirty(value, baseline);

  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm("Há alterações não concluídas neste registro. Deseja sair e perdê-las?"),
    enableBeforeUnload: dirty,
  });

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
          title={`Registro ${concluded} concluído apenas nesta demonstração`}
          description={LOCAL_RECORD_NOTE}
        />
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

  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Registrar aula"
        description="Registre o que foi efetivamente realizado. A aula prevista no horário não é considerada ministrada sem sua confirmação."
        context={context}
      >
        <DraftIndicator dirty={dirty} draftId={draftId} />
      </DiaryHeader>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Data da aula</span>
          <Input
            type="date"
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
        onConclude={() => {
          const record = localLessonStore.upsert(
            value,
            "Concluído localmente (demonstração)",
            draftId,
          );
          setBaseline(value);
          setConcluded(record.id);
        }}
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
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{date}</h3>
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
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative block min-w-0 flex-1 basis-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar aula"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conteúdo, turma ou componente"
            className="pl-9"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">De</span>
          <Input
            type="date"
            aria-label="Data inicial"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
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
  const optional = Object.entries({
    Objetivos: entry.optional.objectives,
    "Habilidades curriculares": entry.optional.skills,
    "Estratégias e recursos": entry.optional.strategies,
    "Observações pedagógicas": entry.optional.observations,
    Agrupamentos: entry.optional.groupings,
  }).filter(([, text]) => text && text.trim());
  return (
    <div className="space-y-5">
      <DiaryHeader
        title={`Registro ${entry.id}`}
        description={`${entry.className} · ${entry.field} · ${entry.date}`}
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
            {entry.contentMode === "individual" ? (
              <ul className="mt-3 space-y-2">
                {entry.blockIds.map((id) => (
                  <li key={id} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Aula {id}</p>
                    <p className="text-foreground">{entry.contents[id]}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 whitespace-pre-line text-foreground">
                {entry.contents["shared"] ?? entry.summary}
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
            <p className="mt-2 text-sm text-foreground">{entry.planningRelation}</p>
            {entry.extraordinary ? (
              <StatePanel
                tone="info"
                title={`Fora da previsão · ${entry.extraordinary.start}–${entry.extraordinary.end}`}
                description={entry.extraordinary.justification}
              />
            ) : null}
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <FutureFeatureState
              title="Histórico de alterações"
              description="A trilha de alterações será exibida quando houver contrato de auditoria. Nenhuma trilha é fabricada."
            />
            <FutureFeatureState
              title="Solicitar alteração"
              description="Correção de registro concluído exigirá solicitação e regras ainda não aprovadas. O original é preservado."
            />
          </div>
        </div>
        <aside className="space-y-4">
          <section className="surface-panel p-4">
            <SectionHeader title="Contexto e autoria" />
            <dl className="info-list mt-3 divide-y divide-border/60 text-sm">
              {[
                ["Data", entry.date],
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
