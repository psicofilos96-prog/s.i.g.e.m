/**
 * COLOCAR ALUNO EM TURMA e TROCAR DE TURMA — jornadas guiadas (13UX · 6B.2.2).
 *
 * Mesma gramática de `/alunos/novo`: passos curtos, linguagem humana no
 * primeiro nível, orientação junto da ação, conferência antes do ato.
 *
 * O domínio permanece intacto: elegibilidade de turma, agrupamento exigido,
 * atomicidade da movimentação, continuidade temporal, conflito de alocação
 * vigente e avisos de capacidade continuam vindo de `allocation-draft.ts`.
 * O texto institucional não foi apagado — foi reposicionado para o Nível 2/3.
 */
import { formatAcademicDate } from "@/lib/academic-date";
import { DateInput } from "@/components/sigem/date-input";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BadgeInfo,
  CheckCircle2,
} from "lucide-react";
import {
  FieldHint,
  FieldMessage,
  ReviewSection,
  StepGuidance,
  StepRail,
  TaskFieldset,
} from "@/components/sigem/human-workflow";
import {
  FeedbackNote,
  InstitutionalDetails,
  PlainFacts,
  ToneTag,
} from "@/components/sigem/workspace-ui";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  ATOMICITY_NOTE,
  DATA_MINIMIZATION_ALLOCATION_NOTE,
  MOVEMENT_NOT_TRANSFER_NOTE,
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
import {
  allocationGuidance,
  humanAllocationIssue,
  stepOfAllocationIssue,
  stepsFor,
  type AllocationStepId,
} from "@/features/allocations/allocation-presentation";

function FieldError({ issue }: { issue?: AllocationIssue | undefined }) {
  if (!issue || issue.severity !== "erro") return null;
  return <FieldMessage>{humanAllocationIssue(issue)}</FieldMessage>;
}

function ClassOptionSummary({ option }: { option: ClassOption }) {
  const { item } = option;
  return (
    <div className="min-w-0">
      <p className="text-base font-semibold text-foreground">
        {item.name} <span className="font-mono text-tabular text-muted-foreground">{item.code}</span>
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Turno: {item.shift} · Jornada: {item.journey}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{option.capacityNote}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Organização acadêmica: {item.academicOrganization}
      </p>
      <ul className="mt-0.5 text-sm text-muted-foreground" aria-label={`Agrupamentos de ${item.name}`}>
        {item.groupings.map((group) => (
          <li key={group.id}>
            {group.kind}: {group.label}
          </li>
        ))}
      </ul>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {item.situation}
        {option.eligibility === "incerta" ? " · compatibilidade a conferir" : ""}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{option.reason}</p>
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
  const steps = stepsFor(mode);

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
  const [stepId, setStepId] = useState<AllocationStepId>("aluno");
  const [furthest, setFurthest] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  const target = getParticipationTarget(draft.targetId);

  function leave() {
    const id = target?.studentId ?? studentId;
    if (id) {
      void navigate({ to: "/alunos/$id", params: { id } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<AllocationDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  function goTo(index: number) {
    const next = steps[index];
    if (!next) return;
    setStepId(next.id);
    setFurthest((value) => Math.max(value, index));
  }

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

  function issueOf(field: AllocationIssueField) {
    return allocationIssueFor(issues, field);
  }

  const singleGrouping = selected && !needsGrouping ? (selected.item.groupings[0] ?? null) : null;
  const effectiveGrouping = needsGrouping ? draft.groupingLabel : (singleGrouping?.label ?? "");
  const primaryLabel = isMovement ? "Concluir movimentação" : "Concluir enturmação";
  // Ação institucional inválida permanece indisponível; a causa fica visível.
  const primaryDisabled = errors.length > 0;

  const stepIndex = steps.findIndex((step) => step.id === stepId);
  const stepErrors = errors.filter((issue) => stepOfAllocationIssue(issue, mode) === stepId);
  const pendingRequirement =
    stepId === "conferencia" ? allocationGuidance(errors[0]) : allocationGuidance(stepErrors[0]);

  const studentLabel = target?.studentName ?? "este aluno";
  const dateLabel = isMovement ? "Primeiro dia na nova turma" : "Primeiro dia na turma";

  /* ------------------------------------------------------------ conclusão */

  if (concluded) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <div className="surface-float p-6 sm:p-8">
          <ToneTag tone="sucesso">Concluído</ToneTag>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">
            {isMovement ? "Aluno movimentado de turma" : "Aluno colocado em turma"}
          </h1>
          <p className="mt-2 max-w-prose text-base text-muted-foreground">
            {isMovement
              ? `${studentLabel} passa a estudar em ${selected?.item.name ?? "a nova turma"} a partir de ${draft.startDate ? formatBrDate(draft.startDate) : "a data informada"}. A turma anterior continua registrada no histórico.`
              : `${studentLabel} passa a estudar em ${selected?.item.name ?? "a turma escolhida"} a partir de ${draft.startDate ? formatBrDate(draft.startDate) : "a data informada"}.`}
          </p>

          <h2 className="mt-7 font-display text-lg font-semibold text-foreground">
            O que você quer fazer agora?
          </h2>
          <div className="mt-3 grid gap-3">
            {selected ? (
              <Button asChild className="min-h-12 justify-start text-base">
                <Link to="/turmas/$id" params={{ id: selected.item.id }}>
                  Ver a turma
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" className="min-h-12 justify-start text-base" onClick={leave}>
              {target ? "Ver ficha do aluno" : "Voltar para a lista de alunos"}
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <InstitutionalDetails summary="Ver registro institucional desta conclusão">
              <p>
                {isMovement
                  ? "Movimentação demonstrativa preparada. A alocação anterior seria encerrada e a nova alocação criada na mesma operação, preservando o histórico. Nada foi persistido."
                  : "Alocação em turma preparada. Nada foi persistido."}
              </p>
              <p className="mt-2">{isMovement ? ATOMICITY_NOTE : ALLOCATION_SCOPE_NOTE}</p>
              <p className="mt-2">
                {isMovement
                  ? "A implementação real futura deverá ser transacional: não existe sucesso parcial entre encerrar a alocação anterior e criar a nova."
                  : "A conclusão prepara uma nova alocação da participação selecionada; matrícula escolar, vínculo letivo e participação permanecem inalterados."}
              </p>
            </InstitutionalDetails>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ passo 1 */

  const passoAluno = (
    <div className="space-y-5">
      <TaskFieldset legend={steps[0]!.label} instruction={steps[0]!.instruction}>
        <div className="sm:col-span-2">
          {targets.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-base font-semibold text-foreground">
                Nenhuma participação disponível.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{NO_PARTICIPATION_NOTE}</p>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link to="/vinculos-letivos/novo" search={studentId ? { aluno: studentId } : {}}>
                  Registrar vínculo letivo e participação
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <Label htmlFor="target-select" className="text-base">
                Aluno e inscrição no ano letivo
              </Label>
              <Select
                value={draft.targetId ?? ""}
                onValueChange={(value) =>
                  update({ targetId: value, classId: "", groupingLabel: "" })
                }
              >
                <SelectTrigger
                  id="target-select"
                  aria-label="Aluno e inscrição no ano letivo"
                  className="mt-1.5 h-12 text-base"
                >
                  <SelectValue placeholder="Selecione o aluno" />
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
              <FieldHint>
                A turma vale para a inscrição do aluno neste ano letivo, e não para sempre.
              </FieldHint>
              <FieldError issue={issueOf("targetId")} />
            </>
          )}
        </div>

        {target ? (
          <div className="sm:col-span-2 rounded-lg border border-border p-4">
            <PlainFacts
              items={[
                { term: "Aluno", detail: target.studentName },
                {
                  term: "Código SIGEM",
                  detail: <span className="font-mono text-tabular">{target.sigemId}</span>,
                },
                { term: "Escola", detail: target.unitNameAtTime },
                { term: "Ano letivo", detail: target.periodLabel },
                { term: "Etapa ou ano", detail: target.academicOrganization },
                {
                  term: "Turma atual",
                  detail: active ? (
                    active.classId ? (
                      <Link
                        to="/turmas/$id"
                        params={{ id: active.classId }}
                        className="text-primary hover:underline"
                      >
                        {active.classLabel}
                      </Link>
                    ) : (
                      active.classLabel
                    )
                  ) : (
                    NO_CURRENT_ALLOCATION_LABEL
                  ),
                },
                ...(active
                  ? [
                      {
                        term: "Desde",
                        detail: `Vigência atual: início ${formatAcademicDate(active.from)} — ${formatAcademicDate(active.until, "sem término definido")}`,
                      },
                    ]
                  : []),
              ]}
            />
            <InstitutionalDetails summary="Ver contexto institucional desta participação">
              <p>
                {target.participationLabel} ({target.nature}) · {target.participationSituation} ·
                matrícula escolar {target.enrollmentNumber} · vínculo letivo {target.periodLabel} —{" "}
                {target.offerLabel}
              </p>
              <p className="mt-1">{target.participationNote}</p>
              <p className="mt-1">{active?.note}</p>
              <p className="mt-1">{DATA_MINIMIZATION_ALLOCATION_NOTE}</p>
            </InstitutionalDetails>
            {target.nature !== "Regular" ? (
              <p className="mt-3 text-sm text-muted-foreground" role="note">
                Compatibilidade requer validação. As regras de alocação de AEE e de atividades
                complementares não são definidas nesta etapa.
              </p>
            ) : null}
          </div>
        ) : null}
      </TaskFieldset>

      {target && active && !isMovement ? (
        <FeedbackNote tone="impedimento" title={`Este aluno já está em ${active.classLabel}.`}>
          <p>Para trocar de turma, faça uma movimentação: assim o histórico não se perde.</p>
          <Button asChild variant="outline" className="mt-3 min-h-11">
            <Link
              to="/enturmacoes/movimentar"
              search={{ aluno: target.studentId, participacao: target.id }}
            >
              <ArrowLeftRight aria-hidden="true" /> Mudar de turma
            </Link>
          </Button>
          <InstitutionalDetails summary="Ver diagnóstico institucional">
            <p>{issueOf("conflito")?.message}</p>
          </InstitutionalDetails>
        </FeedbackNote>
      ) : null}

      {target && !active && isMovement ? (
        <FeedbackNote tone="atencao" title={NO_CURRENT_ALLOCATION_LABEL}>
          <p>Sem turma atual não há movimentação a fazer. Use a enturmação inicial.</p>
          <Button asChild variant="outline" className="mt-3 min-h-11">
            <Link
              to="/enturmacoes/nova"
              search={{ aluno: target.studentId, participacao: target.id }}
            >
              Ir para enturmação inicial
            </Link>
          </Button>
          <InstitutionalDetails summary="Ver diagnóstico institucional">
            <p>
              Sem alocação vigente não há movimentação a representar. A enturmação inicial é a
              operação apropriada.
            </p>
          </InstitutionalDetails>
        </FeedbackNote>
      ) : null}

      {history.length ? (
        <div className="surface-quiet p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Turmas anteriores deste aluno
          </h2>
          <ul
            className="mt-2 space-y-1 text-base text-muted-foreground"
            aria-label="Histórico de alocações desta participação"
          >
            {history.map((allocation) => (
              <li key={allocation.id}>
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
                {formatAcademicDate(allocation.until, "em curso")} · {allocation.situation}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            A turma anterior permanece registrada e navegável: a movimentação nunca substitui a
            alocação anterior nos registros históricos.
          </p>
        </div>
      ) : null}
    </div>
  );

  /* ------------------------------------------------------------ passo 2 */

  const passoTurma = (
    <div className="space-y-5">
      <TaskFieldset legend={steps[1]!.label} instruction={steps[1]!.instruction}>
        <div className="sm:col-span-2">
          {!target ? (
            <p className="text-base text-muted-foreground">
              Escolha o aluno no passo anterior para ver as turmas.
            </p>
          ) : options.length ? (
            <RadioGroup
              value={draft.classId}
              onValueChange={(value) => update({ classId: value, groupingLabel: "" })}
              aria-label="Turmas compatíveis com o contexto"
              className="gap-2"
            >
              {options.map((option) => (
                <div
                  key={option.item.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card/70 p-4"
                >
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
            <p className="text-base text-muted-foreground">
              Nenhuma turma demonstrativamente compatível neste contexto.
            </p>
          )}
          <FieldError issue={issueOf("classId")} />
        </div>

        {selected ? (
          <div className="sm:col-span-2">
            {needsGrouping ? (
              <>
                <Label htmlFor="grouping-select" className="text-base">
                  Agrupamento correspondente ao aluno
                </Label>
                <Select
                  value={draft.groupingLabel}
                  onValueChange={(value) => update({ groupingLabel: value })}
                >
                  <SelectTrigger
                    id="grouping-select"
                    aria-label="Agrupamento correspondente ao aluno"
                    className="mt-1.5 h-12 text-base"
                  >
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
                <FieldHint>
                  Turma multisseriada/multietapa com {selected.item.groupings.length} agrupamentos.
                  Os agrupamentos permanecem distintos e não são concatenados em uma série única.
                </FieldHint>
                <FieldError issue={issueOf("groupingLabel")} />
              </>
            ) : (
              <p className="text-base text-muted-foreground">
                Agrupamento determinado pela organização da turma:{" "}
                {singleGrouping ? `${singleGrouping.kind}: ${singleGrouping.label}` : "—"}
              </p>
            )}
            {selected.item.groupings.some((group) => group.kind === "Fase") ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Turma de EJA: a organização permanece por fase própria e não é convertida em
                ano/série regular.
              </p>
            ) : null}
          </div>
        ) : null}
      </TaskFieldset>

      {target && blocked.length ? (
        <details className="surface-quiet p-5">
          <summary className="cursor-pointer text-base font-medium text-foreground">
            Turmas não apresentadas como opção ({blocked.length})
          </summary>
          <ul className="mt-3 space-y-3" aria-label="Turmas não apresentadas como opção">
            {blocked.map((option) => (
              <li key={option.item.id}>
                <p className="text-base font-medium text-foreground">
                  {option.item.name}{" "}
                  <span className="font-mono text-tabular text-muted-foreground">
                    {option.item.code}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{option.reason}</p>
                <Link
                  to="/turmas/$id"
                  params={{ id: option.item.id }}
                  className="mt-1 inline-block text-sm text-primary hover:underline"
                >
                  Consultar turma (somente histórico e contexto)
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );

  /* ------------------------------------------------------------ passo 3 */

  const passoData = (
    <TaskFieldset legend={steps[2]!.label} instruction={steps[2]!.instruction}>
      <div>
        <Label htmlFor="start-date" className="text-base">
          {dateLabel}
        </Label>
        <DateInput
          id="start-date"
          className="mt-1.5 h-12 text-base"
          value={draft.startDate}
          onChange={(event) => update({ startDate: event.target.value })}
        />
        <FieldHint>Dia, mês e ano. Exemplo: 09/02/2026.</FieldHint>
        <FieldError issue={issueOf("startDate")} />
      </div>

      {!isMovement ? (
        <div>
          <Label htmlFor="end-date" className="text-base">
            Último dia <span className="font-normal text-muted-foreground">(se já souber)</span>
          </Label>
          <DateInput
            id="end-date"
            className="mt-1.5 h-12 text-base"
            value={draft.endDate}
            onChange={(event) => update({ endDate: event.target.value })}
          />
          <FieldHint>
            Normalmente fica em branco: uma alocação atual pode permanecer aberta e não pressupõe
            durar todo o período letivo.
          </FieldHint>
          <FieldError issue={issueOf("endDate")} />
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <Label htmlFor="allocation-note" className="text-base">
          Observação <span className="font-normal text-muted-foreground">(se precisar)</span>
        </Label>
        <Textarea
          id="allocation-note"
          className="mt-1.5 text-base"
          value={draft.note}
          onChange={(event) => update({ note: event.target.value })}
        />
      </div>
    </TaskFieldset>
  );

  /* ------------------------------------------------------------ passo 4 */

  const passoConferencia = (
    <div className="space-y-5">
      {isMovement ? (
        <ReviewSection title="O que será alterado">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Turma atual
              </h3>
              <p className="mt-1 text-base font-semibold text-foreground">
                {active?.classLabel ?? "Sem turma atual"}
              </p>
              <p className="mt-1 text-base text-muted-foreground">
                {active
                  ? `${formatAcademicDate(active.from)} — ${preview ? preview.previousUntil : formatAcademicDate(active.until, "sem término definido")}`
                  : "Não aplicável"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Deixa de valer na véspera da data informada.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Nova turma
              </h3>
              <p className="mt-1 text-base font-semibold text-foreground">
                {selected?.item.name ?? "Não selecionada"}
              </p>
              <p className="mt-1 text-base text-muted-foreground">
                {draft.startDate
                  ? `${formatBrDate(draft.startDate)} — sem término definido`
                  : "Data efetiva não informada"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Agrupamento: {effectiveGrouping || "Não definido"}
              </p>
            </div>
          </div>

          {preview && active ? (
            <ul
              className="mt-4 space-y-1 text-base text-muted-foreground"
              aria-label="Continuidade temporal demonstrativa"
            >
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

          <ul className="mt-4 space-y-2 text-base text-muted-foreground" aria-label="Efeitos da ação">
            <li>As notas e as faltas já lançadas na turma anterior continuam registradas.</li>
            <li>A matrícula do aluno na escola e o ano letivo dele não mudam.</li>
            <li>Esta não é uma transferência de escola.</li>
          </ul>

          <InstitutionalDetails summary="Ver escopo institucional desta operação">
            <p>
              Esta operação encerrará a alocação anterior e criará uma nova alocação, preservando o
              histórico.
            </p>
            <p className="mt-1">{ATOMICITY_NOTE}</p>
            <p className="mt-1">{MOVEMENT_NOT_TRANSFER_NOTE}</p>
            <p className="mt-1">
              A troca de turma não é mecanismo de reclassificação: alteração de organização acadêmica
              requer operação específica.
            </p>
          </InstitutionalDetails>
        </ReviewSection>
      ) : (
        <>
          <ReviewSection title="Quem" onEdit={() => goTo(0)}>
            <PlainFacts
              items={[
                { term: "Aluno", detail: target?.studentName ?? "Não selecionado" },
                { term: "Escola", detail: target?.unitNameAtTime ?? "Não selecionada" },
                { term: "Ano letivo", detail: target?.periodLabel ?? "Não selecionado" },
                { term: "Etapa ou ano", detail: target?.academicOrganization ?? "Não selecionada" },
              ]}
            />
          </ReviewSection>

          <ReviewSection title="Turma e período" onEdit={() => goTo(1)}>
            <PlainFacts
              items={[
                { term: "Turma", detail: selected?.item.name ?? "Não selecionada" },
                { term: "Agrupamento", detail: effectiveGrouping || "Não aplicável" },
                {
                  term: dateLabel,
                  detail: draft.startDate ? formatBrDate(draft.startDate) : "Não informado",
                },
                {
                  term: "Último dia",
                  detail: draft.endDate ? formatBrDate(draft.endDate) : "Sem término definido",
                },
              ]}
            />
          </ReviewSection>

          <ReviewSection title="O que esta ação fará">
            <ul className="space-y-2 text-base text-muted-foreground" aria-label="Efeitos da ação">
              <li>
                Coloca {studentLabel} em {selected?.item.name ?? "a turma escolhida"} a partir da
                data informada.
              </li>
              <li>Não altera a matrícula do aluno na escola nem o ano letivo dele.</li>
              <li>Não define horários, professores, notas nem faltas.</li>
            </ul>
            <InstitutionalDetails summary="Ver escopo institucional desta operação">
              <p>{ALLOCATION_SCOPE_NOTE}</p>
              <p className="mt-1">
                Horários, atribuição docente, diário, notas e frequência não pertencem a esta etapa.
              </p>
              <p className="mt-1">
                A troca de turma não é mecanismo de reclassificação: alteração de organização
                acadêmica requer operação específica.
              </p>
            </InstitutionalDetails>
          </ReviewSection>
        </>
      )}

      {issues.length ? (
        <ReviewSection title="Pendências e avisos">
          <ul className="space-y-2 text-base" aria-label="Conflitos e avisos">
            {issues.map((issue) => (
              <li key={issue.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {issue.severity === "erro" ? "Falta informar:" : "Para você saber:"}
                </span>{" "}
                {humanAllocationIssue(issue)}
              </li>
            ))}
          </ul>
          <InstitutionalDetails summary="Ver diagnóstico institucional completo">
            <ul className="space-y-1.5" aria-label="Diagnóstico institucional">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <span className="font-medium">
                    {issue.severity === "erro" ? "Requisito" : "Aviso"}:
                  </span>{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          </InstitutionalDetails>
        </ReviewSection>
      ) : null}
    </div>
  );

  const stepContent =
    stepId === "aluno"
      ? passoAluno
      : stepId === "turma"
        ? passoTurma
        : stepId === "data"
          ? passoData
          : passoConferencia;

  /* ------------------------------------------------------------------ tela */

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {isMovement ? "Mudar o aluno de turma" : "Colocar aluno em uma turma"}
        </h1>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          {isMovement
            ? "A turma anterior é encerrada e a nova começa na data que você informar. Nada do histórico é apagado."
            : "Escolha a turma em que o aluno começará a estudar neste ano letivo."}
        </p>

        <div className="mt-6 sm:mt-7">
          <StepRail
            steps={steps}
            currentId={stepId}
            furthestIndex={furthest}
            onSelect={goTo}
            label={isMovement ? "Etapas da movimentação" : "Etapas da enturmação"}
          />
        </div>
      </header>

      {stepContent}

      <div className="calm-stack gap-3">
        <StepGuidance requirement={pendingRequirement} />

        <div className="flex flex-wrap items-center gap-3">
          {stepIndex > 0 ? (
            <Button
              variant="outline"
              className="min-h-12 text-base"
              onClick={() => goTo(stepIndex - 1)}
            >
              <ArrowLeft aria-hidden="true" /> Voltar
            </Button>
          ) : null}

          {stepId === "conferencia" ? (
            <Button
              className="min-h-12 text-base"
              disabled={primaryDisabled}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 aria-hidden="true" /> {primaryLabel}
            </Button>
          ) : (
            <Button
              className="min-h-12 text-base"
              disabled={stepErrors.length > 0}
              onClick={() => goTo(stepIndex + 1)}
            >
              Continuar <ArrowRight aria-hidden="true" />
            </Button>
          )}

          <Button
            variant="ghost"
            className="min-h-12 text-base"
            onClick={() => (dirty ? setExitOpen(true) : leave())}
          >
            Sair sem concluir
          </Button>
        </div>

        {dirty ? (
          <p className="text-xs text-muted-foreground/80" role="status">
            Alterações não salvas: se você sair antes de concluir, o preenchimento é descartado.
          </p>
        ) : null}
      </div>

      <div className="pt-1">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground/90 underline underline-offset-4 transition-colors hover:text-foreground"
            >
              <BadgeInfo className="size-3.5" aria-hidden="true" /> Informações institucionais
            </button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Informações institucionais</SheetTitle>
              <SheetDescription>Escopo, natureza da alocação e limites desta operação.</SheetDescription>
            </SheetHeader>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p>
                Cadeia institucional: Participação → Alocação → Turma. A alocação possui vigência
                própria e não é atributo do aluno.
              </p>
              <p>{ALLOCATION_SCOPE_NOTE}</p>
              <p>{MOVEMENT_NOT_TRANSFER_NOTE}</p>
              {isMovement ? <p>{ATOMICITY_NOTE}</p> : null}
              <p>
                Conflitos evidentes são apresentados sem correção automática. Nenhuma alocação é
                encerrada silenciosamente fora do fluxo explícito de movimentação.
              </p>
              <p>{DATA_MINIMIZATION_ALLOCATION_NOTE}</p>
              {!isMovement ? (
                <div>
                  <h3 className="font-semibold text-foreground">
                    Horários e atribuição docente (área futura)
                  </h3>
                  <p className="mt-1">
                    Horários, atribuição docente, diário, notas e frequência não pertencem a esta
                    etapa.
                  </p>
                </div>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sair sem concluir?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              O que você preencheu ainda não foi guardado. Ao sair, o preenchimento é descartado;
              nenhuma alocação, participação, vínculo letivo ou matrícula escolar é alterada.
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
              {isMovement
                ? `Mudar ${studentLabel} para ${selected?.item.name ?? "a nova turma"}?`
                : `Colocar ${studentLabel} em ${selected?.item.name ?? "a turma escolhida"}?`}
            </DialogTitle>
            <DialogDescription>
              {isMovement
                ? `A turma atual deixa de valer na véspera de ${draft.startDate ? formatBrDate(draft.startDate) : "a data informada"} e a nova começa nessa data. O histórico é preservado.`
                : "Esta operação não altera a matrícula escolar, o vínculo letivo nem a participação."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <InstitutionalDetails summary="Ver escopo institucional desta conclusão">
              <p>{isMovement ? ATOMICITY_NOTE : ALLOCATION_SCOPE_NOTE}</p>
              <p className="mt-1">
                {isMovement
                  ? "A implementação real futura deverá ser transacional: não existe sucesso parcial entre encerrar a alocação anterior e criar a nova."
                  : "A conclusão prepara uma nova alocação da participação selecionada; matrícula escolar, vínculo letivo e participação permanecem inalterados."}
              </p>
            </InstitutionalDetails>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar e revisar
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setConcluded(true);
              }}
            >
              {isMovement ? "Confirmar movimentação" : "Confirmar enturmação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
