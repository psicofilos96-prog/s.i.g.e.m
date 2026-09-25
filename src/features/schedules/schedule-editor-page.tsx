import { formatAcademicDate } from "@/lib/academic-date";
/**
 * EDITOR VISUAL DE GRADE SEMANAL — Etapa 10B, integralmente demonstrativo.
 *
 * Nada é publicado nem persistido. A jornada é referência e não é alterada; o
 * Calendário Escolar não é tocado; nenhum registro de Diário de Classe é criado.
 * Profissionais entram apenas por Atuação Pedagógica existente.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  FileQuestion,
  Lock,
  Plus,
  Redo2,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { PEDAGOGICAL_ROLES } from "@/features/pedagogical/pedagogical-data";
import { SchoolJourneyPanel } from "./school-journey-panel";
import {
  WEEK_DAYS,
  getJourneyForClass,
  getScheduleForClass,
  scheduleSituationTone,
  scheduleStateTone,
  type ScheduleBlock,
  type WeekDayId,
} from "./schedules-data";
import {
  DRAFT_BLOCK_KINDS,
  DRAFT_BLOCK_STATUSES,
  DRAFT_DURATION_PRESETS,
  EDITOR_AUTHORIZATION_NOTE,
  EDITOR_CAPABILITIES,
  EDITOR_CONCLUSION_MESSAGE,
  EDITOR_JOURNEY_NOTE,
  EDITOR_PRIVACY_NOTE,
  EDITOR_PUBLICATION_STEPS,
  EDITOR_PUBLISHED_WARNING,
  EDITOR_VERSION_CONFLICT_MESSAGE,
  addBlock,
  assignmentOption,
  assignmentOptionsForClass,
  blockDuration,
  classGroupingLabels,
  coresponsibilityNotes,
  createScheduleDraft,
  dayLabel,
  draftAlerts,
  draftSituation,
  duplicateBlock,
  editorPreconditions,
  formatDuration,
  isScheduleDraftDirty,
  journeyDayFor,
  matrixFieldOptions,
  matrixReferenceLabel,
  minutesToTime,
  plannedLoad,
  professionalsPendingAssignment,
  removeBlock,
  repositionBlock,
  updateBlock,
  type ScheduleDraft,
  type ScheduleDraftMode,
} from "./schedule-draft";
import { timeToMinutes } from "./schedules-data";

const DEMO_STATES = [
  { value: "editor", label: "Editor (estado normal)" },
  { value: "loading", label: "Carregando" },
  { value: "empty", label: "Sem blocos (vazio)" },
  { value: "error", label: "Erro de carregamento" },
  { value: "denied", label: "Permissão negada" },
  { value: "version", label: "Conflito de versão" },
] as const;
type DemoState = (typeof DEMO_STATES)[number]["value"];

const NO_FIELD = "Bloco sem componente definido";

export function ScheduleEditorPage({
  classId,
  mode,
}: {
  classId: string;
  mode: ScheduleDraftMode;
}) {
  const klass = getDemonstrationClass(classId);
  const journey = getJourneyForClass(classId);
  const existing = getScheduleForClass(classId);
  const initialDraft = useMemo(
    () => createScheduleDraft(classId, mode),

    [classId, mode],
  );
  const [draft, setDraft] = useState<ScheduleDraft>(initialDraft as ScheduleDraft);
  const [past, setPast] = useState<ScheduleDraft[]>([]);
  const [future, setFuture] = useState<ScheduleDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("editor");
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  if (!klass || !draft || !initialDraft)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Turma não encontrada"
          description="O identificador informado não corresponde às turmas fictícias disponíveis. O editor não cria turma nem jornada silenciosamente."
          action={
            <Button asChild variant="outline">
              <Link to="/horarios/turmas">Voltar para grades de turmas</Link>
            </Button>
          }
        />
      </div>
    );

  if (mode === "edicao" && existing?.state === "Histórica")
    return (
      <div className="space-y-4 pb-5">
        <OperationalPageHeader
          title={`Grade histórica — ${klass.name}`}
          description="O histórico oficial não é reescrito nesta etapa."
          parent={{ label: "Horários de turmas", to: "/horarios/turmas" }}
        />
        <div className="surface-panel">
          <EmptyState
            icon={Lock}
            title="Somente leitura"
            description="A distribuição registrada permanece como estava no período correspondente. Alterações retroativas não são oferecidas pelo editor demonstrativo."
            action={
              <Button asChild variant="outline">
                <Link to="/horarios/turmas/$turmaId" params={{ turmaId: klass.id }}>
                  Consultar a grade
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    );

  const current = draft;
  const dirty = isScheduleDraftDirty(draft, initialDraft);
  const alerts = draftAlerts(draft);
  const coresponsibility = coresponsibilityNotes(draft);
  const situation = draftSituation(draft);
  const load = plannedLoad(draft);
  const preconditions = editorPreconditions(classId);
  const fieldOptions = matrixFieldOptions(classId);
  const assignments = assignmentOptionsForClass(classId);
  const pendingProfessionals = professionalsPendingAssignment(classId);
  const selected = draft.blocks.find((item) => item.id === selectedId);
  const editorDays = WEEK_DAYS.filter(
    (day) =>
      journeyDayFor(journey, day.id) !== undefined ||
      draft.blocks.some((item) => item.day === day.id),
  );
  const visibleDays = editorDays.length ? editorDays : WEEK_DAYS.slice(0, 5);

  function commit(next: ScheduleDraft) {
    setPast((items) => [...items, current]);
    setFuture([]);
    setDraft(next);
  }
  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [current, ...items]);
    setDraft(previous);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, current]);
    setDraft(next);
  }
  function leave() {
    void navigate({ to: "/horarios/turmas/$turmaId", params: { turmaId: classId } });
  }
  function handleAdd(day: WeekDayId) {
    const declared = journeyDayFor(journey, day);
    const last = draft.blocks
      .filter((item) => item.day === day)
      .sort((a, b) => timeToMinutes(b.end) - timeToMinutes(a.end))[0];
    const start = last?.end ?? declared?.start ?? "07:00";
    const next = addBlock(draft, { day, start, end: minutesToTime(timeToMinutes(start) + 50) });
    const created = next.blocks[next.blocks.length - 1];
    commit(next);
    setSelectedId(created?.id ?? null);
  }
  function patchSelected(patch: Partial<Omit<ScheduleBlock, "id">>) {
    if (!selected) return;
    commit(updateBlock(draft, selected.id, patch));
  }
  function toggleAssignment(assignmentId: string) {
    if (!selected) return;
    const active = selected.assignmentIds.includes(assignmentId);
    patchSelected({
      assignmentIds: active
        ? selected.assignmentIds.filter((item) => item !== assignmentId)
        : [...selected.assignmentIds, assignmentId],
    });
  }
  const selectValue = (value: string | undefined) => (value ? { value } : {});

  const title =
    mode === "nova" ? `Nova grade semanal — ${klass.name}` : `Editar grade semanal — ${klass.name}`;

  return (
    <div className="space-y-4 pb-6">
      <OperationalPageHeader
        title={title}
        description="Editor visual demonstrativo: blocos com horários reais e durações variáveis. Nenhuma publicação, versão definitiva ou persistência ocorre nesta etapa."
        parent={{ label: "Horários de turmas", to: "/horarios/turmas" }}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (dirty ? setExitOpen(true) : leave())}
            >
              Sair do editor
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 /> Preparar grade demonstrativa
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="neutral">{klass.code}</StatusBadge>
        <StatusBadge tone="info">{getClassUnitName(klass.unitId)}</StatusBadge>
        <StatusBadge tone="neutral">Período letivo: {klass.academicPeriod.label}</StatusBadge>
        <StatusBadge tone={scheduleStateTone(draft.state)}>
          Situação da grade: {draft.state}
        </StatusBadge>
        <StatusBadge tone={scheduleSituationTone(situation)}>{situation}</StatusBadge>
        <span className="ml-auto inline-flex items-center gap-1.5">
          {dirty ? (
            <>
              <TriangleAlert className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span role="status">Alterações não salvas</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nenhuma alteração registrada</span>
          )}
        </span>
      </div>

      {existing?.state === "Publicada" ? (
        <StatePanel tone="warning" title="Grade publicada" description={EDITOR_PUBLISHED_WARNING} />
      ) : null}
      {concluded ? (
        <StatePanel
          tone="success"
          title="Grade demonstrativa preparada"
          description={EDITOR_CONCLUSION_MESSAGE}
        />
      ) : null}

      <DetailSection
        title="Pré-condições"
        description="Turma, unidade e período letivo precisam ser conhecidos; a ausência de jornada é registrada como pendência."
      >
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Pré-condições do editor">
          {preconditions.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              <span>
                <span className="font-medium">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {!journey ? (
          <div className="mt-3">
            <StatePanel
              tone="warning"
              title="Dados insuficientes"
              description="A jornada escolar desta turma não está disponível. O editor não cria jornada; os blocos ficam sem referência de funcionamento até que a jornada seja declarada."
            />
          </div>
        ) : null}
      </DetailSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-4" id="editor">
          <DetailSection
            title="Área de edição semanal"
            description="Blocos com horários reais, durações livres, dias não uniformes e intervalos próprios. Nenhum número fixo de aulas é imposto."
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={undo} disabled={!past.length}>
                <Undo2 /> Desfazer
              </Button>
              <Button size="sm" variant="outline" onClick={redo} disabled={!future.length}>
                <Redo2 /> Refazer
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="demo-state" className="text-xs text-muted-foreground">
                  Estado demonstrativo
                </Label>
                <Select
                  value={demoState}
                  onValueChange={(value) => setDemoState(value as DemoState)}
                >
                  <SelectTrigger
                    id="demo-state"
                    aria-label="Estado demonstrativo"
                    className="h-8 w-56"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_STATES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {demoState === "loading" ? (
              <div className="space-y-2" role="status" aria-label="Carregando grade demonstrativa">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : demoState === "error" ? (
              <StatePanel
                tone="danger"
                title="Erro de carregamento"
                description="Não foi possível carregar a grade demonstrativa. Nenhuma alteração foi aplicada."
              />
            ) : demoState === "denied" ? (
              <StatePanel
                tone="warning"
                title="Permissão negada"
                description="A capacidade de editar grades desta unidade não foi concedida a este contexto funcional. Visualizar, criar, editar, revisar, publicar e retificar serão capacidades distintas."
              />
            ) : demoState === "version" ? (
              <StatePanel
                tone="danger"
                title="Conflito de versão"
                description={EDITOR_VERSION_CONFLICT_MESSAGE}
              />
            ) : demoState === "empty" || !draft.blocks.length ? (
              <EmptyState
                compact
                title="Nenhum bloco planejado"
                description="A turma possui jornada, mas a distribuição semanal ainda não foi iniciada. Use “Adicionar bloco” em um dia de funcionamento."
              />
            ) : null}

            {demoState === "editor" ? (
              <div className="mt-3 overflow-x-auto border border-border bg-card">
                <div
                  className="grid min-w-[820px] divide-x divide-border"
                  style={{
                    gridTemplateColumns: `repeat(${visibleDays.length}, minmax(9.5rem, 1fr))`,
                  }}
                  aria-label="Grade semanal em edição"
                  role="group"
                >
                  {visibleDays.map((day) => {
                    const declared = journeyDayFor(journey, day.id);
                    return (
                      <section key={day.id} aria-labelledby={`editor-day-${day.id}`}>
                        <header className="border-b border-border bg-muted px-2 py-2">
                          <h3
                            id={`editor-day-${day.id}`}
                            className="text-xs font-semibold uppercase text-muted-foreground"
                          >
                            {day.label}
                          </h3>
                          <p className="font-mono text-[0.6875rem] text-muted-foreground">
                            {declared
                              ? `${declared.start}–${declared.end}`
                              : "Sem funcionamento declarado"}
                          </p>
                        </header>
                        <div className="min-h-56 space-y-2 p-2">
                          {draft.blocks
                            .filter((item) => item.day === day.id)
                            .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
                            .map((item) => {
                              const isSelected = item.id === selectedId;
                              const people = item.assignmentIds
                                .map((id) => assignmentOption(id))
                                .filter(Boolean);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => setSelectedId(item.id)}
                                  className={`w-full border-l-4 p-2 text-left ${
                                    isSelected
                                      ? "border-primary bg-primary/10"
                                      : item.kind === "Intervalo"
                                        ? "border-warning bg-warning/10"
                                        : "border-border bg-muted/40"
                                  }`}
                                >
                                  <span className="block font-mono text-xs font-semibold">
                                    {item.start}–{item.end}
                                  </span>
                                  <span className="mt-1 block text-xs font-semibold leading-snug">
                                    {item.label}
                                  </span>
                                  <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                                    {item.kind} · {formatDuration(blockDuration(item))}
                                  </span>
                                  {people.map((entry) =>
                                    entry ? (
                                      <span
                                        key={entry.assignment.id}
                                        className="mt-1 block text-[0.6875rem] leading-snug"
                                      >
                                        {entry.professionalName} · {entry.role}
                                      </span>
                                    ) : null,
                                  )}
                                </button>
                              );
                            })}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleAdd(day.id)}
                          >
                            <Plus /> Adicionar bloco em {day.short}
                          </Button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Seleção por clique e formulário acessível: toda operação está disponível sem arrastar
              e soltar.
            </p>
          </DetailSection>

          <DetailSection
            title="Bloco selecionado"
            description="Formulário acessível para horário, tipo, componente ou campo, profissionais, papel e reposicionamento."
          >
            {!selected ? (
              <EmptyState
                compact
                title="Nenhum bloco selecionado"
                description="Selecione um bloco na área de edição para alterá-lo, ou adicione um novo bloco."
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="block-day">Dia</Label>
                    <Select
                      {...selectValue(selected.day)}
                      onValueChange={(value) =>
                        commit(
                          repositionBlock(draft, selected.id, {
                            day: value as WeekDayId,
                            start: selected.start,
                          }),
                        )
                      }
                    >
                      <SelectTrigger id="block-day" aria-label="Dia" className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEK_DAYS.map((day) => (
                          <SelectItem key={day.id} value={day.id}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="block-start">Início (hh:mm)</Label>
                    <Input
                      id="block-start"
                      className="mt-1 h-9"
                      value={selected.start}
                      onChange={(event) => patchSelected({ start: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="block-end">Término (hh:mm)</Label>
                    <Input
                      id="block-end"
                      className="mt-1 h-9"
                      value={selected.end}
                      onChange={(event) => patchSelected({ end: event.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Duração:</span>
                  {DRAFT_DURATION_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        patchSelected({
                          end: minutesToTime(timeToMinutes(selected.start) + preset),
                        })
                      }
                    >
                      {preset} min
                    </Button>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    Atual: {formatDuration(blockDuration(selected))} — qualquer duração pode ser
                    digitada.
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="block-kind">Tipo de bloco</Label>
                    <Select
                      {...selectValue(selected.kind)}
                      onValueChange={(value) =>
                        patchSelected({ kind: value as ScheduleBlock["kind"] })
                      }
                    >
                      <SelectTrigger
                        id="block-kind"
                        aria-label="Tipo de bloco"
                        className="mt-1 h-9"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DRAFT_BLOCK_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {kind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="block-field">Componente ou campo</Label>
                    <Select
                      {...selectValue(selected.label)}
                      onValueChange={(value) => patchSelected({ label: value })}
                    >
                      <SelectTrigger
                        id="block-field"
                        aria-label="Componente ou campo"
                        className="mt-1 h-9"
                      >
                        <SelectValue placeholder="Selecione o componente ou campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_FIELD}>{NO_FIELD}</SelectItem>
                        <SelectItem value="Intervalo">Intervalo (sem componente)</SelectItem>
                        {fieldOptions.map((option) => (
                          <SelectItem key={option.id} value={option.label}>
                            {option.label} — {option.kind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {matrixReferenceLabel(classId)}. Intervalos não exigem componente curricular.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="block-role">Papel predominante no bloco</Label>
                    <Select
                      {...selectValue(selected.blockRole)}
                      onValueChange={(value) => patchSelected({ blockRole: value })}
                    >
                      <SelectTrigger
                        id="block-role"
                        aria-label="Papel predominante no bloco"
                        className="mt-1 h-9"
                      >
                        <SelectValue placeholder="Papel conforme a atuação" />
                      </SelectTrigger>
                      <SelectContent>
                        {PEDAGOGICAL_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="block-status">Situação do bloco</Label>
                    <Select
                      {...selectValue(selected.status)}
                      onValueChange={(value) =>
                        patchSelected({ status: value as ScheduleBlock["status"] })
                      }
                    >
                      <SelectTrigger
                        id="block-status"
                        aria-label="Situação do bloco"
                        className="mt-1 h-9"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DRAFT_BLOCK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-muted-foreground">
                    Profissionais (somente Atuações Pedagógicas desta turma)
                  </legend>
                  {!assignments.length ? (
                    <p className="mt-2 text-xs text-muted-foreground" role="note">
                      Nenhuma Atuação Pedagógica registrada para esta turma. O editor de horários
                      não cria atuação.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2" aria-label="Atuações pedagógicas disponíveis">
                      {assignments.map((option) => {
                        const inputId = `assignment-${option.assignment.id}`;
                        return (
                          <li key={option.assignment.id} className="flex items-start gap-2">
                            <Checkbox
                              id={inputId}
                              checked={selected.assignmentIds.includes(option.assignment.id)}
                              onCheckedChange={() => toggleAssignment(option.assignment.id)}
                            />
                            <Label htmlFor={inputId} className="text-sm font-normal">
                              {option.professionalName}
                              <span className="block text-xs text-muted-foreground">
                                {option.sigemId} · {option.role} · {option.fieldLabel}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                Vínculo funcional: {option.linkLabel}
                              </span>
                            </Label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mais de um profissional no mesmo bloco representa corresponsabilidade, não
                    conflito. Intervalos não recebem profissional automaticamente.
                  </p>
                </fieldset>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => commit(duplicateBlock(draft, selected.id))}
                  >
                    <Copy /> Duplicar bloco
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      commit(removeBlock(draft, selected.id));
                      setSelectedId(null);
                    }}
                  >
                    <Trash2 /> Remover bloco
                  </Button>
                </div>
              </div>
            )}
          </DetailSection>

          <SchoolJourneyPanel journey={journey} />
          <StatePanel
            tone="info"
            title="Jornada como referência"
            description={EDITOR_JOURNEY_NOTE}
          />

          <DetailSection
            title="Resumo de carga planejada"
            description="Tempo planejado por componente ou campo, total da grade e divergências em relação à referência conhecida. Nenhum cumprimento normativo é declarado."
          >
            <table
              className="w-full border-collapse text-left text-sm"
              aria-label="Carga planejada por componente ou campo"
            >
              <thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Componente ou campo</th>
                  <th className="px-3 py-2">Blocos</th>
                  <th className="px-3 py-2">Tempo planejado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {load.byField.length ? (
                  load.byField.map((row) => (
                    <tr key={row.label}>
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 font-mono">{row.blocks}</td>
                      <td className="px-3 py-2 font-mono">{formatDuration(row.minutes)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-3 text-xs text-muted-foreground" colSpan={3}>
                      Nenhum tempo planejado registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="mt-3">
              <DefinitionList
                items={[
                  { term: "Tempo total da grade", detail: formatDuration(load.totalMinutes) },
                  {
                    term: "Tempo fora de intervalos",
                    detail: formatDuration(load.teachingMinutes),
                  },
                  {
                    term: "Funcionamento declarado na jornada",
                    detail:
                      load.journeyMinutes === null
                        ? "Não disponível"
                        : formatDuration(load.journeyMinutes),
                  },
                  {
                    term: "Períodos marcados sem distribuição",
                    detail: String(load.undistributed),
                  },
                ]}
              />
            </div>
            {load.divergences.length ? (
              <ul
                className="mt-3 space-y-1 text-xs text-muted-foreground"
                aria-label="Divergências de carga"
              >
                {load.divergences.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
          </DetailSection>

          <DetailSection
            title="Revisão"
            description="Conferência antes da conclusão demonstrativa. É possível voltar ao editor para corrigir problemas."
          >
            <DefinitionList
              items={[
                { term: "Turma", detail: `${klass.name} (${klass.code})` },
                { term: "Unidade", detail: getClassUnitName(klass.unitId) },
                { term: "Período letivo", detail: klass.academicPeriod.label },
                {
                  term: "Jornada",
                  detail: journey
                    ? `${journey.shift} · ${journey.days.length} dias declarados`
                    : "Pendência: jornada não declarada",
                },
                { term: "Agrupamentos", detail: classGroupingLabels(klass).join("; ") || "Nenhum" },
                { term: "Blocos planejados", detail: String(draft.blocks.length) },
                {
                  term: "Componentes e campos",
                  detail: load.byField.length
                    ? load.byField.map((row) => row.label).join("; ")
                    : "Nenhum",
                },
                {
                  term: "Profissionais",
                  detail:
                    [
                      ...new Set(
                        draft.blocks.flatMap((item) =>
                          item.assignmentIds
                            .map((id) => assignmentOption(id)?.professionalName)
                            .filter(Boolean),
                        ),
                      ),
                    ].join("; ") || "Nenhum profissional selecionado",
                },
                { term: "Carga planejada", detail: formatDuration(load.totalMinutes) },
                { term: "Conflitos e alertas", detail: String(alerts.length) },
                {
                  term: "Pendências",
                  detail: `${load.divergences.length} divergência(s) de carga · ${pendingProfessionals.length} profissional(is) sem atuação compatível`,
                },
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="#editor">Voltar ao editor</a>
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 /> Preparar grade demonstrativa
              </Button>
            </div>
          </DetailSection>
        </div>

        <aside
          className="min-w-0 space-y-4"
          aria-label="Painel de componentes, profissionais e validações"
        >
          <DetailSection
            title="Componentes e campos da matriz"
            description="Elementos compatíveis com a matriz aplicável à turma. A matriz não é alterada aqui."
          >
            {fieldOptions.length ? (
              <ul className="space-y-2 text-sm" aria-label="Componentes e campos disponíveis">
                {fieldOptions.map((option) => (
                  <li key={option.id}>
                    <span className="font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {option.kind} · {option.helper}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum elemento curricular identificado para esta turma.
              </p>
            )}
          </DetailSection>

          <DetailSection
            title="Validações e alertas"
            description="Classificação demonstrativa: conflito temporal potencial, incompatibilidade estrutural, compatibilidade pendente, informação insuficiente ou sem conflito identificado."
          >
            {alerts.length ? (
              <ul className="space-y-3" aria-label="Alertas da grade em edição">
                {alerts.map((alert) => (
                  <li key={alert.id} className="border-l-2 border-border pl-3">
                    <StatusBadge tone={scheduleSituationTone(alert.classification)}>
                      {alert.classification}
                    </StatusBadge>
                    <p className="mt-1 text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <StatePanel
                tone="success"
                title="Situação sem conflito identificado"
                description="Nenhuma sobreposição ou divergência estrutural foi identificada na projeção demonstrativa atual."
              />
            )}
            {coresponsibility.length ? (
              <ul className="mt-3 space-y-2" aria-label="Corresponsabilidades identificadas">
                {coresponsibility.map((item) => (
                  <li key={item.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.title}:</span> {item.detail}
                  </li>
                ))}
              </ul>
            ) : null}
          </DetailSection>

          <DetailSection
            title="Profissionais sem atuação compatível"
            description="Pendência: o editor de horários não cria Atuação Pedagógica."
          >
            {pendingProfessionals.length ? (
              <ul className="space-y-2 text-sm" aria-label="Profissionais sem atuação compatível">
                {pendingProfessionals.map((row) => (
                  <li key={row.professionalId}>
                    <Link
                      to="/profissionais/$id"
                      params={{ id: row.professionalId }}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.professionalName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{row.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma pendência identificada nesta unidade.
              </p>
            )}
          </DetailSection>

          <DetailSection
            title="Publicação futura"
            description="Interface preparada; as operações pertencem à futura Etapa 10C."
          >
            <div className="flex flex-wrap gap-2">
              {EDITOR_PUBLICATION_STEPS.map((step) => (
                <StatusBadge key={step} tone="neutral">
                  {step}
                </StatusBadge>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Capacidades futuras distintas: {EDITOR_CAPABILITIES.join(" · ")}.{" "}
              {EDITOR_AUTHORIZATION_NOTE}
            </p>
          </DetailSection>

          <StatePanel tone="info" title="Privacidade" description={EDITOR_PRIVACY_NOTE} />
        </aside>
      </div>

      <p className="text-xs text-muted-foreground">
        Dados integralmente fictícios. O editor não publica, não versiona definitivamente, não
        altera o Calendário Escolar e não cria registros de Diário de Classe.
      </p>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Este rascunho demonstrativo não é gravado. Nenhuma alteração foi persistida em banco
              de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Descartar alterações e sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preparar grade demonstrativa</AlertDialogTitle>
            <AlertDialogDescription>{EDITOR_CONCLUSION_MESSAGE}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar ao editor</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConcluded(true);
                setConfirmOpen(false);
              }}
            >
              Confirmar preparação demonstrativa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
