import { formatAcademicDate } from "@/lib/academic-date";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ALLOCATION_SCOPE_NOTE,
  ALLOCATION_SECTIONS,
  ATOMICITY_NOTE,
  DATA_MINIMIZATION_ALLOCATION_NOTE,
  MOVEMENT_NOT_TRANSFER_NOTE,
  MOVEMENT_SECTIONS,
  NO_CURRENT_ALLOCATION_LABEL,
  NO_PARTICIPATION_NOTE,
  allocationIssueFor,
  blockedClassOptions,
  createBlankAllocationDraft,
  currentAllocation,
  formatBrDate,
  getClassOption,
  getParticipationTarget,
  historicalAllocations,
  isAllocationDraftDirty,
  listParticipationTargets,
  movableTargets,
  movementPreview,
  requiresGroupingChoice,
  selectableClassOptions,
  targetsForStudent,
  validateAllocationDraft,
  type AllocationDraft,
  type AllocationIssue,
  type AllocationIssueField,
  type AllocationMode,
  type ClassOption,
} from "@/features/allocations/allocation-draft";

function FieldError({ issue }: { issue?: AllocationIssue | undefined }) {
  if (!issue || issue.severity !== "erro") return null;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {issue.message}
    </span>
  );
}

function ClassOptionSummary({ option }: { option: ClassOption }) {
  const { item } = option;
  return (
    <div className="min-w-0 text-xs">
      <p className="text-sm font-medium text-foreground">
        {item.name}{" "}
        <span className="font-mono text-tabular text-muted-foreground">{item.code}</span>
      </p>
      <p className="mt-0.5 text-muted-foreground">
        Organização acadêmica: {item.academicOrganization}
      </p>
      <ul className="mt-1 space-y-0.5" aria-label={`Agrupamentos de ${item.name}`}>
        {item.groupings.map((group) => (
          <li key={group.id} className="text-muted-foreground">
            {group.kind}: {group.label}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-muted-foreground">Turno: {item.shift}</p>
      <p className="text-muted-foreground">Jornada: {item.journey}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <StatusBadge tone={item.situation === "Em atividade" ? "success" : "neutral"}>
          {item.situation}
        </StatusBadge>
        {option.eligibility === "incerta" ? (
          <StatusBadge tone="warning">Compatibilidade incerta</StatusBadge>
        ) : null}
      </p>
      <p className="mt-1 text-muted-foreground">{option.capacityNote}</p>
      <p className="mt-1 text-muted-foreground">{option.reason}</p>
      <Link
        to="/turmas/$id"
        params={{ id: item.id }}
        className="mt-1 inline-block text-primary hover:underline"
      >
        Consultar turma
      </Link>
    </div>
  );
}

export function AllocationWorkspacePage({
  mode,
  studentId,
  participationId,
  classId,
}: {
  mode: AllocationMode;
  studentId?: string | undefined;
  participationId?: string | undefined;
  classId?: string | undefined;
}) {
  const isMovement = mode === "movimentacao";

  const targets = useMemo(() => {
    const base = studentId ? targetsForStudent(studentId) : listParticipationTargets();
    if (!isMovement) return base;
    const movable = movableTargets();
    return base.filter((target) => movable.some((candidate) => candidate.id === target.id));
  }, [studentId, isMovement]);

  const initialDraft = useMemo(() => {
    const preselected =
      (participationId && targets.find((target) => target.id === participationId)?.id) ??
      (targets.length === 1 ? targets[0]!.id : null);
    return createBlankAllocationDraft(preselected, isMovement ? "" : (classId ?? ""));
  }, [participationId, targets, classId, isMovement]);

  const [draft, setDraft] = useState<AllocationDraft>(initialDraft);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    if (target?.studentId ?? studentId) {
      void navigate({ to: "/alunos/$id", params: { id: target?.studentId ?? studentId ?? "" } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<AllocationDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  const target = getParticipationTarget(draft.targetId);
  const active = currentAllocation(target);
  const history = historicalAllocations(target);
  const options = selectableClassOptions(target);
  const blocked = blockedClassOptions(target);
  const selected = target && draft.classId ? getClassOption(target, draft.classId) : null;
  const needsGrouping = requiresGroupingChoice(selected?.item);
  const issues = validateAllocationDraft(draft, mode, target);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const dirty = isAllocationDraftDirty(draft, initialDraft);
  const preview = isMovement ? movementPreview(active, draft.startDate) : null;
  const sections = isMovement ? MOVEMENT_SECTIONS : ALLOCATION_SECTIONS;

  function issueOf(field: AllocationIssueField) {
    return allocationIssueFor(issues, field);
  }

  const singleGrouping = selected && !needsGrouping ? (selected.item.groupings[0] ?? null) : null;
  const effectiveGrouping = needsGrouping ? draft.groupingLabel : (singleGrouping?.label ?? "");

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={
          isMovement
            ? "Movimentação entre turmas (demonstrativo)"
            : "Enturmação — alocação em turma (demonstrativo)"
        }
        description={
          isMovement
            ? "Operação única que encerra a alocação atual e cria uma nova alocação da mesma participação, preservando o histórico. Nada é persistido nesta etapa."
            : "A alocação em turma é a relação temporal entre uma participação existente e uma turma. O aluno não possui turma como atributo permanente e nada é persistido nesta etapa."
        }
        parent={{ label: "Alunos", to: "/alunos" }}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (dirty ? setExitOpen(true) : leave())}
            >
              Sair do workspace
            </Button>
            <Button size="sm" disabled={errors.length > 0} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 /> {isMovement ? "Concluir movimentação" : "Concluir enturmação"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">
          {isMovement ? "Movimentação demonstrativa" : "Enturmação demonstrativa"}
        </StatusBadge>
        <span className="text-muted-foreground">
          Participação → Alocação → Turma. A alocação possui vigência própria e não é atributo do
          aluno.
        </span>
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

      <div className="grid gap-7 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label={isMovement ? "Etapas da movimentação" : "Etapas da enturmação"}
          className="min-w-0"
        >
          <ul className="sticky top-20 space-y-1 text-xs">
            {sections.map((section) => (
              <li key={section.id}>
                {section.available ? (
                  <a
                    href={`#${section.id}`}
                    className="block px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {section.label}
                  </a>
                ) : (
                  <span className="block px-2 py-1.5 text-muted-foreground/60">
                    {section.label} (área futura)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {/* 1. PARTICIPAÇÃO DE ORIGEM E CONTEXTO DO ALUNO */}
          <section id="participacao" aria-labelledby="participacao-title">
            <DetailSection
              title="Participação de origem"
              description="A alocação parte de uma participação já existente. Nenhuma participação, vínculo letivo ou matrícula escolar é criada aqui."
              titleId="participacao-title"
            >
              {targets.length === 0 ? (
                <div className="border border-border bg-muted/40 px-3 py-3 text-xs">
                  <p className="font-medium">Nenhuma participação disponível.</p>
                  <p className="mt-1 text-muted-foreground">{NO_PARTICIPATION_NOTE}</p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link
                      to="/vinculos-letivos/novo"
                      search={studentId ? { aluno: studentId } : {}}
                    >
                      Registrar vínculo letivo e participação
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="max-w-3xl">
                  <Label htmlFor="target-select">Participação existente</Label>
                  <Select
                    value={draft.targetId ?? ""}
                    onValueChange={(value) =>
                      update({ targetId: value, classId: "", groupingLabel: "" })
                    }
                  >
                    <SelectTrigger id="target-select" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione a participação" />
                    </SelectTrigger>
                    <SelectContent>
                      {targets.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.studentName} · {item.participationLabel} · {item.periodLabel} ·{" "}
                          {item.unitNameAtTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={issueOf("targetId")} />
                </div>
              )}

              {target ? (
                <div className="mt-4 text-xs">
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={target.nature === "Regular" ? "info" : "neutral"}>
                      {target.nature === "Regular"
                        ? "Participação regular"
                        : "Participação complementar"}
                    </StatusBadge>
                    <span className="font-medium text-foreground">{target.participationLabel}</span>
                    <span className="text-muted-foreground">{target.participationSituation}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{target.participationNote}</p>
                  {target.nature !== "Regular" ? (
                    <p className="mt-2 border border-border bg-muted/40 px-3 py-2" role="note">
                      Compatibilidade requer validação. As regras de alocação de AEE e de atividades
                      complementares não são definidas nesta etapa.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </DetailSection>
          </section>

          <section id="aluno" aria-labelledby="aluno-title">
            <DetailSection
              title="Aluno e contexto"
              description="Identificação operacional mínima do aluno e do contexto acadêmico da participação."
              titleId="aluno-title"
            >
              {target ? (
                <>
                  <DefinitionList
                    items={[
                      { term: "Aluno", detail: target.studentName },
                      {
                        term: "Identificador SIGEM do aluno",
                        detail: <span className="font-mono text-tabular">{target.sigemId}</span>,
                      },
                      { term: "Unidade escolar", detail: target.unitNameAtTime },
                      {
                        term: "Matrícula escolar",
                        detail: (
                          <span className="font-mono text-tabular">{target.enrollmentNumber}</span>
                        ),
                      },
                      {
                        term: "Vínculo letivo",
                        detail: `${target.periodLabel} — ${target.offerLabel}`,
                      },
                      { term: "Período letivo", detail: target.periodLabel },
                      { term: "Oferta educacional", detail: target.offerLabel },
                      {
                        term: "Organização acadêmica",
                        detail: target.academicOrganization,
                      },
                    ]}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {DATA_MINIMIZATION_ALLOCATION_NOTE}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione a participação para ver o contexto do aluno.
                </p>
              )}
            </DetailSection>
          </section>

          {/* ALOCAÇÃO ATUAL / SEM TURMA */}
          <section id="atual" aria-labelledby="atual-title">
            <DetailSection
              title="Alocação atual"
              description="A alocação é a relação temporal entre a participação e a turma. O aluno permanece aluno mesmo sem turma atual."
              titleId="atual-title"
            >
              {!target ? (
                <p className="text-xs text-muted-foreground">
                  Selecione a participação para ler a alocação atual.
                </p>
              ) : active ? (
                <div className="border border-border px-3 py-2 text-xs">
                  <p className="font-medium text-foreground">
                    {active.classId ? (
                      <Link
                        to="/turmas/$id"
                        params={{ id: active.classId }}
                        className="text-primary hover:underline"
                      >
                        {active.classLabel}
                      </Link>
                    ) : (
                      active.classLabel
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Vigência atual: início {formatAcademicDate(active.from)} —{" "}
                    {formatAcademicDate(active.until, "sem término definido")}
                  </p>
                  <p className="mt-1 text-muted-foreground">{active.note}</p>
                </div>
              ) : (
                <p className="text-xs font-medium text-foreground">{NO_CURRENT_ALLOCATION_LABEL}</p>
              )}

              {history.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-foreground">
                    Histórico de alocações desta participação
                  </p>
                  <ul
                    className="mt-1 space-y-1 text-xs"
                    aria-label="Histórico de alocações desta participação"
                  >
                    {history.map((allocation) => (
                      <li key={allocation.id} className="text-muted-foreground">
                        {allocation.classId ? (
                          <Link
                            to="/turmas/$id"
                            params={{ id: allocation.classId }}
                            className="text-primary hover:underline"
                          >
                            {allocation.classLabel}
                          </Link>
                        ) : (
                          allocation.classLabel
                        )}{" "}
                        · {formatAcademicDate(allocation.from)} —{" "}
                        {formatAcademicDate(allocation.until, "em curso")} ·{" "}
                        {allocation.situation}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A turma anterior permanece registrada e navegável: a movimentação nunca
                    substitui a alocação anterior nos registros históricos.
                  </p>
                </div>
              ) : null}

              {target && !active && isMovement ? (
                <div className="mt-3 border border-border bg-muted/40 px-3 py-2 text-xs">
                  <p className="font-medium">{NO_CURRENT_ALLOCATION_LABEL}</p>
                  <p className="mt-1 text-muted-foreground">
                    Sem alocação vigente não há movimentação a representar. A enturmação inicial é a
                    operação apropriada.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link
                      to="/enturmacoes/nova"
                      search={{ aluno: target.studentId, participacao: target.id }}
                    >
                      Ir para enturmação inicial
                    </Link>
                  </Button>
                </div>
              ) : null}

              {target && active && !isMovement ? (
                <div className="mt-3 border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
                  <p className="font-medium text-destructive" role="alert">
                    {issueOf("conflito")?.message}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link
                      to="/enturmacoes/movimentar"
                      search={{ aluno: target.studentId, participacao: target.id }}
                    >
                      <ArrowLeftRight /> Ir para movimentação entre turmas
                    </Link>
                  </Button>
                </div>
              ) : null}
            </DetailSection>
          </section>

          {/* TURMA DE DESTINO */}
          <section id="turma" aria-labelledby="turma-title">
            <DetailSection
              title="Turma de destino"
              description="Turmas demonstrativamente compatíveis com a unidade, o período letivo, a oferta, a organização acadêmica e o contexto da participação. Não existe motor definitivo de elegibilidade."
              titleId="turma-title"
            >
              {!target ? (
                <p className="text-xs text-muted-foreground">
                  Selecione a participação para listar as turmas do contexto.
                </p>
              ) : (
                <>
                  {options.length ? (
                    <RadioGroup
                      value={draft.classId}
                      onValueChange={(value) => update({ classId: value, groupingLabel: "" })}
                      aria-label="Turmas compatíveis com o contexto"
                      className="gap-0 divide-y divide-border border border-border"
                    >
                      {options.map((option) => (
                        <div key={option.item.id} className="flex items-start gap-3 p-3">
                          <RadioGroupItem
                            value={option.item.id}
                            id={`class-${option.item.id}`}
                            aria-label={option.item.name}
                            className="mt-1"
                          />
                          <Label htmlFor={`class-${option.item.id}`} className="min-w-0 flex-1">
                            <ClassOptionSummary option={option} />
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma turma demonstrativamente compatível neste contexto.
                    </p>
                  )}
                  <FieldError issue={issueOf("classId")} />

                  {blocked.length ? (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-foreground">
                        Turmas não apresentadas como opção
                      </h3>
                      <ul
                        className="mt-1 divide-y divide-border border border-border"
                        aria-label="Turmas não apresentadas como opção"
                      >
                        {blocked.map((option) => (
                          <li key={option.item.id} className="p-3 text-xs">
                            <p className="font-medium text-foreground">
                              {option.item.name}{" "}
                              <span className="font-mono text-tabular text-muted-foreground">
                                {option.item.code}
                              </span>
                            </p>
                            <p className="mt-0.5 text-muted-foreground">{option.reason}</p>
                            <Link
                              to="/turmas/$id"
                              params={{ id: option.item.id }}
                              className="mt-1 inline-block text-primary hover:underline"
                            >
                              Consultar turma (somente histórico e contexto)
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </DetailSection>
          </section>

          {/* AGRUPAMENTO */}
          <section id="agrupamento" aria-labelledby="agrupamento-title">
            <DetailSection
              title="Agrupamento e contexto acadêmico"
              description="Turma com um único agrupamento não exige campo redundante. Turma multisseriada/multietapa exige registrar o agrupamento correspondente ao contexto acadêmico do aluno."
              titleId="agrupamento-title"
            >
              {!selected ? (
                <p className="text-xs text-muted-foreground">
                  Selecione a turma de destino para definir o agrupamento.
                </p>
              ) : needsGrouping ? (
                <div className="max-w-xl">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Turma multisseriada/multietapa com {selected.item.groupings.length}{" "}
                    agrupamentos. Os agrupamentos permanecem distintos e não são concatenados em uma
                    série única.
                  </p>
                  <Label htmlFor="grouping-select">Agrupamento correspondente ao aluno</Label>
                  <Select
                    value={draft.groupingLabel}
                    onValueChange={(value) => update({ groupingLabel: value })}
                  >
                    <SelectTrigger id="grouping-select" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione o agrupamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {selected.item.groupings.map((group) => (
                        <SelectItem key={group.id} value={group.label}>
                          {group.kind}: {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={issueOf("groupingLabel")} />
                </div>
              ) : (
                <div className="text-xs">
                  <p className="font-medium text-foreground">
                    Agrupamento determinado pela organização da turma:{" "}
                    {singleGrouping ? `${singleGrouping.kind}: ${singleGrouping.label}` : "—"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Associação direta: a turma atende um único agrupamento e nenhum campo adicional
                    de série é solicitado.
                  </p>
                </div>
              )}

              {selected?.item.groupings.some((group) => group.kind === "Fase") ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Turma de EJA: a organização permanece por fase própria e não é convertida em
                  ano/série regular.
                </p>
              ) : null}
            </DetailSection>
          </section>

          {/* VIGÊNCIA */}
          <section id="vigencia" aria-labelledby="vigencia-title">
            <DetailSection
              title={isMovement ? "Data da movimentação" : "Vigência da alocação"}
              description={
                isMovement
                  ? "A data efetiva organiza a continuidade temporal: a alocação anterior é encerrada no dia anterior e a nova começa na data informada. Nenhuma regra municipal de calendário é aplicada."
                  : "A alocação possui contexto temporal próprio e não pressupõe durar todo o período letivo. Uma alocação atual pode permanecer sem término definido."
              }
              titleId="vigencia-title"
            >
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="start-date">
                    {isMovement ? "Data efetiva da movimentação" : "Início da alocação"}
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    className="mt-1"
                    value={draft.startDate}
                    onChange={(event) => update({ startDate: event.target.value })}
                  />
                  <FieldError issue={issueOf("startDate")} />
                </div>
                {!isMovement ? (
                  <div>
                    <Label htmlFor="end-date">Término (quando aplicável)</Label>
                    <Input
                      id="end-date"
                      type="date"
                      className="mt-1"
                      value={draft.endDate}
                      onChange={(event) => update({ endDate: event.target.value })}
                    />
                    <FieldError issue={issueOf("endDate")} />
                  </div>
                ) : null}
              </div>

              {isMovement ? (
                <div className="mt-4 text-xs">
                  <p className="border border-border bg-muted/40 px-3 py-2" role="note">
                    {ATOMICITY_NOTE}
                  </p>
                  {preview && active ? (
                    <ul className="mt-3 space-y-1" aria-label="Continuidade temporal demonstrativa">
                      <li>
                        <span className="font-medium text-foreground">{active.classLabel}:</span>{" "}
                        {preview.previousFrom} → {preview.previousUntil}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          {selected?.item.name ?? "Turma de destino"}:
                        </span>{" "}
                        {preview.nextFrom} → atual
                      </li>
                    </ul>
                  ) : null}
                  <p className="mt-2 text-muted-foreground" role="note">
                    {MOVEMENT_NOT_TRANSFER_NOTE}
                  </p>
                </div>
              ) : null}
            </DetailSection>
          </section>

          {/* CONFLITOS */}
          <section id="conflitos" aria-labelledby="conflitos-title">
            <DetailSection
              title="Conflitos e avisos"
              description="Conflitos evidentes são apresentados sem correção automática. Nenhuma alocação é encerrada silenciosamente fora do fluxo explícito de movimentação."
              titleId="conflitos-title"
            >
              {issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum conflito demonstrativo identificado.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs" aria-label="Conflitos e avisos">
                  {issues.map((issue) => (
                    <li key={issue.id} className="flex items-start gap-2">
                      {issue.severity === "erro" ? (
                        <CircleAlert
                          className="mt-0.5 size-3.5 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                      ) : (
                        <TriangleAlert
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        <span className="font-medium uppercase">{issue.severity}:</span>{" "}
                        {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground" role="note">
                A troca de turma não é mecanismo de reclassificação: alteração de organização
                acadêmica requer operação específica.
              </p>
            </DetailSection>
          </section>

          {/* REVISÃO */}
          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisar e concluir"
              description={
                isMovement
                  ? "Comparação entre a alocação atual e a nova alocação antes da conclusão demonstrativa."
                  : "Resumo da alocação antes da conclusão demonstrativa."
              }
              titleId="revisao-title"
            >
              {isMovement ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="border border-border p-3">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">De</h3>
                    <DefinitionList
                      items={[
                        { term: "Turma", detail: active?.classLabel ?? "Sem turma atual" },
                        {
                          term: "Agrupamento",
                          detail:
                            active?.classId && getClassOption(target, active.classId)
                              ? getClassOption(target, active.classId)!
                                  .item.groupings.map((group) => `${group.kind}: ${group.label}`)
                                  .join(" · ")
                              : "Agrupamento registrado na alocação anterior",
                        },
                        {
                          term: "Vigência atual",
                          detail: active
                            ? `${formatAcademicDate(active.from)} — ${preview ? preview.previousUntil : formatAcademicDate(active.until, "sem término definido")}`
                            : "Não aplicável",
                        },
                      ]}
                    />
                  </div>
                  <div className="border border-border p-3">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">Para</h3>
                    <DefinitionList
                      items={[
                        { term: "Turma", detail: selected?.item.name ?? "Não selecionada" },
                        {
                          term: "Agrupamento",
                          detail: effectiveGrouping || "Não definido",
                        },
                        {
                          term: "Nova vigência",
                          detail: draft.startDate
                            ? `${formatBrDate(draft.startDate)} — sem término definido`
                            : "Data efetiva não informada",
                        },
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <DefinitionList
                  items={[
                    { term: "Aluno", detail: target?.studentName ?? "Não selecionado" },
                    {
                      term: "Participação",
                      detail: target
                        ? `${target.participationLabel} (${target.nature})`
                        : "Não selecionada",
                    },
                    {
                      term: "Unidade escolar",
                      detail: target?.unitNameAtTime ?? "Não selecionada",
                    },
                    { term: "Período letivo", detail: target?.periodLabel ?? "Não selecionado" },
                    {
                      term: "Organização acadêmica",
                      detail: target?.academicOrganization ?? "Não selecionada",
                    },
                    { term: "Turma", detail: selected?.item.name ?? "Não selecionada" },
                    {
                      term: "Agrupamento",
                      detail: effectiveGrouping || "Não aplicável",
                    },
                    {
                      term: "Início da alocação",
                      detail: draft.startDate ? formatBrDate(draft.startDate) : "Não informado",
                    },
                    {
                      term: "Término",
                      detail: draft.endDate ? formatBrDate(draft.endDate) : "Sem término definido",
                    },
                    {
                      term: "Avisos",
                      detail: issues.length
                        ? `${issues.length} pendência(s) ou aviso(s) demonstrativo(s)`
                        : "Nenhum aviso demonstrativo",
                    },
                  ]}
                />
              )}

              <div className="mt-5">
                <Label htmlFor="allocation-note">Observação de contexto (opcional)</Label>
                <Textarea
                  id="allocation-note"
                  className="mt-1"
                  value={draft.note}
                  onChange={(event) => update({ note: event.target.value })}
                />
              </div>

              <p className="mt-5 border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                {isMovement
                  ? "Esta operação encerrará a alocação anterior e criará uma nova alocação, preservando o histórico."
                  : ALLOCATION_SCOPE_NOTE}
              </p>
            </DetailSection>
          </section>

          {!isMovement ? (
            <section id="horarios" aria-labelledby="horarios-title">
              <DetailSection
                title="Horários e atribuição docente (área futura)"
                description="Horários, atribuição docente, diário, notas e frequência não pertencem a esta etapa."
                titleId="horarios-title"
              >
                <FutureAreaLink>Horários e atribuição docente</FutureAreaLink>
              </DetailSection>
            </section>
          ) : null}
        </div>
      </div>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              O workspace não salva nem armazena dados nesta etapa. Ao sair, o preenchimento é
              descartado; nenhuma alocação, participação, vínculo letivo ou matrícula escolar é
              alterada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Descartar alterações e sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {concluded
                ? "Operação demonstrativa concluída"
                : isMovement
                  ? "Concluir movimentação (demonstrativo)"
                  : "Concluir enturmação (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? isMovement
                  ? "Movimentação demonstrativa preparada. A alocação anterior seria encerrada e a nova alocação criada na mesma operação, preservando o histórico. Nada foi persistido."
                  : "Alocação em turma preparada. Nada foi persistido."
                : isMovement
                  ? ATOMICITY_NOTE
                  : ALLOCATION_SCOPE_NOTE}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {isMovement
              ? "A implementação real futura deverá ser transacional: não existe sucesso parcial entre encerrar a alocação anterior e criar a nova."
              : "A conclusão prepara uma nova alocação da participação selecionada; matrícula escolar, vínculo letivo e participação permanecem inalterados."}
          </div>
          <DialogFooter>
            {concluded ? (
              <Button size="sm" onClick={leave}>
                Voltar para o aluno
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
                  Voltar
                </Button>
                <Button size="sm" onClick={() => setConcluded(true)}>
                  {isMovement ? "Confirmar movimentação" : "Confirmar enturmação"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
