/**
 * TRANSFERÊNCIA ESCOLAR — jornada guiada (13UX · 6B.2.2).
 *
 * Passos curtos, linguagem humana no primeiro nível, conferência antes do ato.
 * O domínio permanece intacto: o plano de encerramento/preservação/criação, a
 * atomicidade, os conflitos fortes, a continuidade acadêmica, a resolução da
 * matrícula no destino e os avisos documentais continuam vindo de
 * `transfer-draft.ts`. Nada foi apagado: o texto institucional foi reposicionado
 * para o Nível 2/3.
 */
import { formatAcademicDate } from "@/lib/academic-date";
import { DateInput } from "@/components/sigem/date-input";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BadgeInfo, CheckCircle2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  ACADEMIC_COMPATIBILITY_NOTE,
  ATOMICITY_NOTE,
  COMPLEMENTARY_DECISION_NOTE,
  DATA_MINIMIZATION_TRANSFER_NOTE,
  DESTINATION_PERIOD_OPTIONS,
  DOCUMENTATION_NOTE,
  DOCUMENTATION_STATES,
  EXTERNAL_DESTINATION_UNKNOWN_LABEL,
  EXTERNAL_ENTRY_NOTE,
  EXTERNAL_REFERENCE_NOTE,
  INTERNAL_DESTINATION_UNITS,
  NOT_ALLOCATED_NOTE,
  NO_TRANSFERABLE_ORIGIN_NOTE,
  ORIGIN_ENROLLMENT_NOTE,
  ORIGIN_PRESERVATION_NOTE,
  TRANSFER_IS_NOT_ALLOCATION_NOTE,
  TRANSFER_KINDS,
  TRANSFER_NOT_FIELD_CHANGE_NOTE,
  TRANSFER_TRANSACTION_STEPS,
  VERSION_CONFLICT_NOTE,
  assessAcademicContinuity,
  buildTransferPlan,
  createBlankTransferDraft,
  destinationOfferLabel,
  destinationOffers,
  destinationOrganizations,
  entryStudentOptions,
  findRegularParticipationConflicts,
  getTransferOrigin,
  isTransferDraftDirty,
  listTransferOrigins,
  resolveDestinationEnrollment,
  transferActionLabel,
  transferFeedback,
  transferIssueFor,
  transferOriginsForStudent,
  unitName,
  validateTransferDraft,
  type TransferDraft,
  type TransferIssue,
  type TransferIssueField,
  type TransferKind,
} from "@/features/transfers/transfer-draft";
import {
  TRANSFER_STEPS,
  HUMAN_KIND_DETAIL,
  humanTransferIssue,
  stepOfTransferIssue,
  transferGuidance,
  type TransferStepId,
} from "@/features/transfers/transfer-presentation";

function fieldA11y(issue: TransferIssue | undefined, id: string) {
  const bad = !!issue && issue.severity === "erro";
  return bad ? { "aria-invalid": true as const, "aria-describedby": id } : {};
}

function FieldError({ issue, id }: { issue?: TransferIssue | undefined; id?: string }) {
  if (!issue || issue.severity !== "erro") return null;
  return <FieldMessage id={id}>{humanTransferIssue(issue)}</FieldMessage>;
}

function PlanList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      {items.length === 0 ? (
        <p className="mt-1 text-base text-muted-foreground">Nenhum registro nesta categoria.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-base text-muted-foreground" aria-label={label}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TransferWorkspacePage({
  studentId,
  enrollmentId,
  participationId,
}: {
  studentId?: string | undefined;
  enrollmentId?: string | undefined;
  participationId?: string | undefined;
}) {
  const origins = useMemo(() => {
    const base = studentId ? transferOriginsForStudent(studentId) : listTransferOrigins();
    if (!enrollmentId) return base;
    const filtered = base.filter((origin) => origin.enrollmentId === enrollmentId);
    return filtered.length ? filtered : base;
  }, [studentId, enrollmentId]);

  const initialDraft = useMemo(() => {
    const preselected =
      (participationId && origins.find((origin) => origin.id === participationId)?.id) ??
      (origins.length === 1 ? origins[0]!.id : null);
    return createBlankTransferDraft(preselected);
  }, [participationId, origins]);

  const [draft, setDraft] = useState<TransferDraft>(initialDraft);
  const [stepId, setStepId] = useState<TransferStepId>("aluno");
  const [furthest, setFurthest] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  const origin = getTransferOrigin(draft.originId);
  const isInternal = draft.kind === "interna";
  const isExit = draft.kind === "saida-externa";
  const isEntry = draft.kind === "entrada-externa";
  const needsInternalDestination = isInternal || isEntry;
  const issues = validateTransferDraft(draft);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const dirty = isTransferDraftDirty(draft, initialDraft);
  const conflicts = findRegularParticipationConflicts(origin);
  const plan = buildTransferPlan(draft);
  const destinationStudentId = isEntry ? draft.entryStudentId : (origin?.studentId ?? null);
  const resolution = resolveDestinationEnrollment(destinationStudentId, draft.destinationUnitId);
  const continuity = assessAcademicContinuity(
    isEntry ? null : origin,
    draft.destinationOrganization,
  );
  const offers = destinationOffers(draft.destinationUnitId);
  const organizations = destinationOrganizations(draft.destinationOfferId);
  const primaryLabel = transferActionLabel(draft.kind);
  // Ação institucional inválida permanece indisponível; a causa fica visível.
  const primaryDisabled = errors.length > 0;

  function leave() {
    const id = destinationStudentId ?? studentId;
    if (id) {
      void navigate({ to: "/alunos/$id", params: { id } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<TransferDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  function goTo(index: number) {
    const next = TRANSFER_STEPS[index];
    if (!next) return;
    setStepId(next.id);
    setFurthest((value) => Math.max(value, index));
  }

  function issueOf(field: TransferIssueField) {
    return transferIssueFor(issues, field);
  }

  const stepIndex = TRANSFER_STEPS.findIndex((step) => step.id === stepId);
  const step = TRANSFER_STEPS[stepIndex]!;
  const stepErrors = errors.filter((issue) => stepOfTransferIssue(issue) === stepId);
  const pendingRequirement =
    stepId === "conferencia" ? transferGuidance(errors[0]) : transferGuidance(stepErrors[0]);

  const studentLabel = isEntry
    ? (entryStudentOptions().find((option) => option.value === draft.entryStudentId)?.label ??
      "o aluno")
    : (origin?.studentName ?? "o aluno");

  /* ------------------------------------------------------------ conclusão */

  if (concluded) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <div className="surface-float p-6 sm:p-8">
          <ToneTag tone="sucesso">Concluído</ToneTag>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">
            {isExit ? "Saída da rede registrada" : "Transferência preparada"}
          </h1>
          <p className="mt-2 max-w-prose text-base text-muted-foreground">
            {transferFeedback(draft.kind)}
          </p>

          <h2 className="mt-7 font-display text-lg font-semibold text-foreground">
            O que você quer fazer agora?
          </h2>
          <div className="mt-3 grid gap-3">
            {isInternal || isEntry ? (
              <Button asChild className="min-h-12 justify-start text-base">
                <Link
                  to="/enturmacoes/nova"
                  search={destinationStudentId ? { aluno: destinationStudentId } : {}}
                >
                  Colocar o aluno em uma turma no destino
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" className="min-h-12 justify-start text-base" onClick={leave}>
              Ver ficha do aluno
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <InstitutionalDetails summary="Ver registro institucional desta conclusão">
              <p>{ORIGIN_ENROLLMENT_NOTE}</p>
              {isInternal || isEntry ? <p className="mt-1">{NOT_ALLOCATED_NOTE}</p> : null}
              <p className="mt-1">{ATOMICITY_NOTE}</p>
              <p className="mt-1">Nada é persistido nesta etapa demonstrativa.</p>
            </InstitutionalDetails>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ passo 1 */

  const passoAluno = (
    <div className="space-y-5">
      <TaskFieldset legend={TRANSFER_STEPS[0]!.label} instruction={TRANSFER_STEPS[0]!.instruction}>
        <div className="sm:col-span-2">
          <RadioGroup
            value={draft.kind}
            onValueChange={(value) =>
              update({
                kind: value as TransferKind,
                destinationUnitId: "",
                destinationOfferId: "",
                destinationOrganization: "",
              })
            }
            aria-label="Tipo de transferência"
            className="gap-2"
          >
            {TRANSFER_KINDS.map((option) => (
              <div
                key={option.value}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/70 p-4"
              >
                <RadioGroupItem
                  value={option.value}
                  id={`kind-${option.value}`}
                  aria-label={option.label}
                  className="mt-1"
                />
                <Label htmlFor={`kind-${option.value}`} className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-foreground">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {HUMAN_KIND_DETAIL[option.value] ?? option.detail}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {isEntry ? (
          <>
            <div>
              <Label htmlFor="entry-student" className="text-base">
                Aluno que está chegando
              </Label>
              <Select
                value={draft.entryStudentId ?? ""}
                onValueChange={(value) => update({ entryStudentId: value })}
              >
                <SelectTrigger {...fieldA11y(issueOf("entryStudentId"), "tr-err-entryStudentId")}
                  id="entry-student"
                  aria-label="Aluno que está chegando"
                  className="mt-1.5 h-12 text-base"
                >
                  <SelectValue placeholder="Localizar aluno já cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {entryStudentOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>Ainda não cadastrado? Cadastre o aluno antes de continuar.</FieldHint>
              <FieldError issue={issueOf("entryStudentId")} id="tr-err-entryStudentId" />
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link to="/alunos/novo">Cadastrar aluno</Link>
              </Button>
            </div>
            <div>
              <Label htmlFor="external-origin" className="text-base">
                Escola de onde ele vem
              </Label>
              <Input
                id="external-origin"
                className="mt-1.5 h-12 text-base"
                value={draft.externalOriginName}
                onChange={(event) => update({ externalOriginName: event.target.value })}
              />
              <FieldHint>
                Serve apenas como referência: nenhuma Unidade Escolar do SIGEM é criada para
                representá-la.
              </FieldHint>
            </div>
          </>
        ) : origins.length === 0 ? (
          <div className="sm:col-span-2">
            <FeedbackNote
              tone="impedimento"
              title="Ainda não há relação escolar que possa ser transferida."
            >
              <p>
                Matrícula escolar, vínculo letivo e participação não são criados aqui apenas para
                permitir a operação.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/matriculas/nova" search={studentId ? { aluno: studentId } : {}}>
                    Matricular em uma escola
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/vinculos-letivos/novo" search={studentId ? { aluno: studentId } : {}}>
                    Registrar o ano letivo do aluno
                  </Link>
                </Button>
              </div>
              <InstitutionalDetails summary="Ver diagnóstico institucional">
                <p>{NO_TRANSFERABLE_ORIGIN_NOTE}</p>
              </InstitutionalDetails>
            </FeedbackNote>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <Label htmlFor="origin-select" className="text-base">
              Aluno e escola de origem
            </Label>
            <Select
              value={draft.originId ?? ""}
              onValueChange={(value) => update({ originId: value })}
            >
              <SelectTrigger {...fieldA11y(issueOf("originId"), "tr-err-originId")}
                id="origin-select"
                aria-label="Aluno e escola de origem"
                className="mt-1.5 h-12 text-base"
              >
                <SelectValue placeholder="Selecione o aluno" />
              </SelectTrigger>
              <SelectContent>
                {origins.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.studentName} · {item.unitNameAtTime} · {item.periodLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError issue={issueOf("originId")} id="tr-err-originId" />
          </div>
        )}

        {origin ? (
          <div className="sm:col-span-2 rounded-lg border border-border p-4">
            <PlainFacts
              items={[
                {
                  term: "Aluno",
                  detail: (
                    <Link
                      to="/alunos/$id"
                      params={{ id: origin.studentId }}
                      className="text-primary hover:underline"
                    >
                      {origin.studentName}
                    </Link>
                  ),
                },
                {
                  term: "Código SIGEM",
                  detail: <span className="font-mono text-tabular">{origin.sigemId}</span>,
                },
                { term: "Escola atual", detail: origin.unitNameAtTime },
                {
                  term: "Matrícula",
                  detail: <span className="font-mono text-tabular">{origin.enrollmentNumber}</span>,
                },
                { term: "Ano letivo", detail: origin.periodLabel },
                { term: "Etapa ou ano", detail: origin.academicOrganization },
                {
                  term: "Turma atual",
                  detail: origin.allocation ? (
                    origin.allocation.classId ? (
                      <Link
                        to="/turmas/$id"
                        params={{ id: origin.allocation.classId }}
                        className="text-primary hover:underline"
                      >
                        {origin.allocation.classLabel} (início{" "}
                        {formatAcademicDate(origin.allocation.from)})
                      </Link>
                    ) : (
                      `${origin.allocation.classLabel} (início ${formatAcademicDate(origin.allocation.from)})`
                    )
                  ) : (
                    "Sem alocação vigente em turma"
                  ),
                },
              ]}
            />
            <InstitutionalDetails summary="Ver contexto institucional da origem">
              <p>
                {origin.participationLabel} · {origin.offerLabel} · {origin.periodNote}
              </p>
              <p className="mt-1">{DATA_MINIMIZATION_TRANSFER_NOTE}</p>
            </InstitutionalDetails>
          </div>
        ) : null}
      </TaskFieldset>

      {conflicts.length > 0 ? (
        <FeedbackNote tone="impedimento" title="Este aluno tem matrícula ativa em outra escola.">
          <ul aria-label="Conflitos de participação regular" className="space-y-1">
            {conflicts.map((conflict) => (
              <li key={`${conflict.unitName}-${conflict.periodLabel}`}>
                Participação regular ativa em {conflict.unitName} · {conflict.participationLabel} ·{" "}
                {conflict.periodLabel}. Nenhuma segunda participação regular sobreposta é criada
                silenciosamente.
              </li>
            ))}
          </ul>
          <p className="mt-2">
            A transferência precisa dizer quais relações serão encerradas. Nada é resolvido
            automaticamente.
          </p>
          <InstitutionalDetails summary="Ver diagnóstico institucional">
            <p>{issueOf("conflito")?.message}</p>
          </InstitutionalDetails>
        </FeedbackNote>
      ) : null}

      {origin && origin.complementary.length > 0 ? (
        <div className="surface-quiet p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Atendimentos além da turma regular
          </h2>
          <ul
            className="mt-2 space-y-2 text-base text-muted-foreground"
            aria-label="Participações complementares da origem"
          >
            {origin.complementary.map((participation) => (
              <li key={participation.id}>
                <span className="font-medium text-foreground">{participation.label}</span> — Requer
                decisão/validação.
                <span className="block text-sm">{participation.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground" role="note">
            {COMPLEMENTARY_DECISION_NOTE}
          </p>
        </div>
      ) : null}
    </div>
  );

  /* ------------------------------------------------------------ passo 2 */

  const passoDestino = (
    <div className="space-y-5">
      <TaskFieldset legend={TRANSFER_STEPS[1]!.label} instruction={TRANSFER_STEPS[1]!.instruction}>
        {isExit ? (
          <div className="sm:col-span-2 space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="external-known"
                checked={draft.externalDestinationKnown}
                onCheckedChange={(checked) => update({ externalDestinationKnown: checked === true })}
              />
              <Label htmlFor="external-known" className="text-base font-normal">
                Sei para qual escola o aluno vai
              </Label>
            </div>
            {draft.externalDestinationKnown ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="external-institution" className="text-base">
                    Escola de destino
                  </Label>
                  <Input {...fieldA11y(issueOf("externalDestino"), "tr-err-externalDestino")}
                    id="external-institution"
                    className="mt-1.5 h-12 text-base"
                    value={draft.externalInstitutionName}
                    onChange={(event) => update({ externalInstitutionName: event.target.value })}
                  />
                  <FieldError issue={issueOf("externalDestino")} id="tr-err-externalDestino" />
                </div>
                <div>
                  <Label htmlFor="external-location" className="text-base">
                    Município e estado{" "}
                    <span className="font-normal text-muted-foreground">(se souber)</span>
                  </Label>
                  <Input
                    id="external-location"
                    className="mt-1.5 h-12 text-base"
                    value={draft.externalLocation}
                    onChange={(event) => update({ externalLocation: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="external-reference" className="text-base">
                    Número do documento de transferência{" "}
                    <span className="font-normal text-muted-foreground">(se houver)</span>
                  </Label>
                  <Input
                    id="external-reference"
                    className="mt-1.5 h-12 text-base"
                    value={draft.externalReference}
                    onChange={(event) => update({ externalReference: event.target.value })}
                  />
                </div>
              </div>
            ) : (
              <p className="text-base text-muted-foreground">
                {EXTERNAL_DESTINATION_UNKNOWN_LABEL}: a saída pode ser registrada sem destino
                declarado. Nenhuma unidade escolar interna é criada para representar o destino.
              </p>
            )}
            <InstitutionalDetails summary="Ver observação institucional">
              <p>{EXTERNAL_REFERENCE_NOTE}</p>
            </InstitutionalDetails>
          </div>
        ) : null}

        {needsInternalDestination ? (
          <>
            <div>
              <Label htmlFor="destination-unit" className="text-base">
                Escola de destino
              </Label>
              <Select
                value={draft.destinationUnitId}
                onValueChange={(value) =>
                  update({
                    destinationUnitId: value,
                    destinationOfferId: "",
                    destinationOrganization: "",
                  })
                }
              >
                <SelectTrigger {...fieldA11y(issueOf("destinationUnitId"), "tr-err-destinationUnitId")}
                  id="destination-unit"
                  aria-label="Escola de destino"
                  className="mt-1.5 h-12 text-base"
                >
                  <SelectValue placeholder="Selecione a escola" />
                </SelectTrigger>
                <SelectContent>
                  {INTERNAL_DESTINATION_UNITS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError issue={issueOf("destinationUnitId")} id="tr-err-destinationUnitId" />
            </div>
            <div>
              <Label htmlFor="destination-period" className="text-base">
                Ano letivo no destino
              </Label>
              <Select
                value={draft.destinationPeriodLabel}
                onValueChange={(value) => update({ destinationPeriodLabel: value })}
              >
                <SelectTrigger
                  id="destination-period"
                  aria-label="Ano letivo no destino"
                  className="mt-1.5 h-12 text-base"
                >
                  <SelectValue placeholder="Selecione o ano letivo" />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATION_PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="destination-offer" className="text-base">
                Oferta educacional do destino
              </Label>
              <Select
                value={draft.destinationOfferId}
                onValueChange={(value) =>
                  update({ destinationOfferId: value, destinationOrganization: "" })
                }
              >
                <SelectTrigger {...fieldA11y(issueOf("destinationOfferId"), "tr-err-destinationOfferId")}
                  id="destination-offer"
                  aria-label="Oferta educacional do destino"
                  className="mt-1.5 h-12 text-base"
                >
                  <SelectValue placeholder="Selecione a oferta" />
                </SelectTrigger>
                <SelectContent>
                  {offers.map((offer) => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.stage} · {offer.organization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError issue={issueOf("destinationOfferId")} id="tr-err-destinationOfferId" />
            </div>
            <div>
              <Label htmlFor="destination-organization" className="text-base">
                Etapa ou ano no destino
              </Label>
              <Select
                value={draft.destinationOrganization}
                onValueChange={(value) => update({ destinationOrganization: value })}
              >
                <SelectTrigger {...fieldA11y(issueOf("destinationOrganization"), "tr-err-destinationOrganization")}
                  id="destination-organization"
                  aria-label="Etapa ou ano no destino"
                  className="mt-1.5 h-12 text-base"
                >
                  <SelectValue placeholder="Selecione a etapa ou o ano" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError issue={issueOf("destinationOrganization")} id="tr-err-destinationOrganization" />
            </div>
          </>
        ) : null}
      </TaskFieldset>

      {needsInternalDestination && resolution ? (
        <FeedbackNote
          tone={resolution.state === "nova" ? "informacao" : "atencao"}
          title={resolution.label}
        >
          <p>{resolution.message}</p>
          <p className="mt-1">{resolution.detail}</p>
          {resolution.number ? (
            <p className="mt-1 font-mono text-tabular">{resolution.number}</p>
          ) : null}
          <InstitutionalDetails summary="Ver observação institucional">
            <p>{ORIGIN_ENROLLMENT_NOTE}</p>
          </InstitutionalDetails>
        </FeedbackNote>
      ) : null}

      {needsInternalDestination ? (
        <FeedbackNote
          tone={continuity.state === "equivalente" ? "informacao" : "atencao"}
          title={continuity.label}
        >
          <p>{continuity.message}</p>
          <p className="mt-1">
            O aluno ainda não fica em uma turma: a turma do destino será escolhida posteriormente
            pelo fluxo de enturmação.
          </p>
          <InstitutionalDetails summary="Ver observação institucional">
            <p>{NOT_ALLOCATED_NOTE}</p>
            <p className="mt-1">{TRANSFER_IS_NOT_ALLOCATION_NOTE}</p>
            <p className="mt-1">
              {ACADEMIC_COMPATIBILITY_NOTE} A transferência não é mecanismo de reclassificação.
            </p>
          </InstitutionalDetails>
        </FeedbackNote>
      ) : null}
    </div>
  );

  /* ------------------------------------------------------------ passo 3 */

  const passoQuando = (
    <TaskFieldset legend={TRANSFER_STEPS[2]!.label} instruction={TRANSFER_STEPS[2]!.instruction}>
      <div>
        <Label htmlFor="effective-date" className="text-base">
          Data da transferência
        </Label>
        <DateInput {...fieldA11y(issueOf("effectiveDate"), "tr-err-effectiveDate")}
          id="effective-date"
          className="mt-1.5 h-12 text-base"
          value={draft.effectiveDate}
          onChange={(event) => update({ effectiveDate: event.target.value })}
        />
        <FieldHint>Dia, mês e ano. Exemplo: 03/08/2026.</FieldHint>
        <FieldError issue={issueOf("effectiveDate")} id="tr-err-effectiveDate" />
      </div>

      <div>
        <Label htmlFor="documentation-state" className="text-base">
          Situação dos documentos
        </Label>
        <Select
          value={draft.documentationState}
          onValueChange={(value) => update({ documentationState: value })}
        >
          <SelectTrigger
            id="documentation-state"
            aria-label="Situação dos documentos"
            className="mt-1.5 h-12 text-base"
          >
            <SelectValue placeholder="Selecione a situação" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENTATION_STATES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldHint>Documento pendente não impede a transferência.</FieldHint>
        <InstitutionalDetails summary="Ver observação institucional">
          <p>{DOCUMENTATION_NOTE}</p>
        </InstitutionalDetails>
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="transfer-note" className="text-base">
          Observação <span className="font-normal text-muted-foreground">(se precisar)</span>
        </Label>
        <Textarea
          id="transfer-note"
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
      <ReviewSection title="O que será alterado">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Origem
            </h3>
            <PlainFacts
              items={[
                { term: "Escola", detail: origin?.unitNameAtTime ?? "Não aplicável" },
                { term: "Matrícula", detail: origin?.enrollmentNumber ?? "—" },
                { term: "Ano letivo", detail: origin?.periodLabel ?? "—" },
                {
                  term: "Turma",
                  detail: origin?.allocation?.classLabel ?? "Sem alocação vigente",
                },
                {
                  term: "Vigência",
                  detail: origin?.allocation
                    ? `${formatAcademicDate(origin.allocation.from)} — ${formatAcademicDate(origin.allocation.until, "sem término definido")}`
                    : "—",
                },
              ]}
            />
          </div>
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Destino
            </h3>
            {isExit ? (
              <PlainFacts
                items={[
                  {
                    term: "Escola de destino",
                    detail:
                      draft.externalDestinationKnown && draft.externalInstitutionName.trim()
                        ? draft.externalInstitutionName.trim()
                        : EXTERNAL_DESTINATION_UNKNOWN_LABEL,
                  },
                  { term: "Município e estado", detail: draft.externalLocation || "Não informado" },
                  {
                    term: "Documento de transferência",
                    detail: draft.externalReference || "Não informado",
                  },
                  { term: "Unidade interna", detail: "Nenhuma unidade interna é criada" },
                ]}
              />
            ) : (
              <PlainFacts
                items={[
                  { term: "Escola", detail: unitName(draft.destinationUnitId) },
                  {
                    term: "Matrícula",
                    detail: resolution
                      ? resolution.state === "nova"
                        ? "Nova matrícula escolar no destino"
                        : `Reutilizada: ${resolution.number ?? "matrícula existente"}`
                      : "Não resolvida",
                  },
                  { term: "Ano letivo", detail: draft.destinationPeriodLabel || "Não informado" },
                  {
                    term: "Oferta",
                    detail: draft.destinationOfferId
                      ? destinationOfferLabel(draft.destinationOfferId)
                      : "Não selecionada",
                  },
                  {
                    term: "Etapa ou ano",
                    detail: draft.destinationOrganization || "Não selecionada",
                  },
                  { term: "Turma", detail: "Aluno ainda não enturmado no destino" },
                  {
                    term: "Escola de origem externa",
                    detail: isEntry
                      ? draft.externalOriginName.trim() || "Referência externa não informada"
                      : "Não aplicável",
                  },
                ]}
              />
            )}
          </div>
        </div>
        <PlainFacts
          items={[
            {
              term: "Data da transferência",
              detail: draft.effectiveDate
                ? formatAcademicDate(draft.effectiveDate)
                : "Não informada",
            },
            { term: "Tipo", detail: primaryLabel },
            { term: "Documentos", detail: draft.documentationState },
          ]}
        />
      </ReviewSection>

      <ReviewSection title="O que encerra e o que fica preservado">
        <div className="grid gap-4 sm:grid-cols-2">
          <PlanList label="Será encerrado na origem" items={plan.ended} />
          <PlanList label="Permanece preservado" items={plan.preserved} />
          <PlanList label="Registros criados" items={plan.created} />
          <PlanList label="Registros reutilizados" items={plan.reused} />
          <PlanList label="Mantidos pendentes" items={plan.pending} />
        </div>
        <p className="mt-3 text-base text-muted-foreground">
          Nenhum registro é apagado: notas, faltas e documentos da escola anterior continuam
          guardados.
        </p>
        <InstitutionalDetails summary="Ver escopo institucional desta operação">
          <p>{ORIGIN_ENROLLMENT_NOTE}</p>
          <p className="mt-1">{ORIGIN_PRESERVATION_NOTE}</p>
          <p className="mt-1">{ATOMICITY_NOTE}</p>
          <ol className="mt-2 space-y-1" aria-label="Sequência transacional conceitual">
            {TRANSFER_TRANSACTION_STEPS.map((item, index) => (
              <li key={item}>
                {index + 1}. {item}
              </li>
            ))}
          </ol>
        </InstitutionalDetails>
      </ReviewSection>

      {issues.length ? (
        <ReviewSection title="Pendências e avisos">
          <ul className="space-y-2 text-base" aria-label="Conflitos e pendências">
            {issues.map((issue) => (
              <li key={issue.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {issue.severity === "erro" ? "Falta informar:" : "Para você saber:"}
                </span>{" "}
                {humanTransferIssue(issue)}
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
      ) : (
        <p className="text-base text-muted-foreground">Nenhum conflito demonstrativo identificado.</p>
      )}

      <div className="surface-quiet p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Verificação de concorrência (demonstrativo)
        </h2>
        <div className="mt-2 flex items-start gap-2">
          <Checkbox
            id="version-conflict"
            checked={draft.simulateVersionConflict}
            onCheckedChange={(checked) => update({ simulateVersionConflict: checked === true })}
          />
          <Label htmlFor="version-conflict" className="text-base font-normal">
            Simular alteração concorrente durante a operação
          </Label>
        </div>
        <InstitutionalDetails summary="Ver observação institucional">
          <p>{VERSION_CONFLICT_NOTE}</p>
        </InstitutionalDetails>
      </div>
    </div>
  );

  const stepContent =
    stepId === "aluno"
      ? passoAluno
      : stepId === "destino"
        ? passoDestino
        : stepId === "quando"
          ? passoQuando
          : passoConferencia;

  /* ------------------------------------------------------------------ tela */

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Transferir aluno de escola
        </h1>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          A transferência não altera simplesmente a escola do aluno: ela encerra a situação na escola
          atual e prepara a nova, preservando todo o histórico.
        </p>

        <div className="mt-6 sm:mt-7">
          <StepRail
            steps={TRANSFER_STEPS}
            currentId={stepId}
            furthestIndex={furthest}
            onSelect={goTo}
            label="Etapas da transferência"
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

          {step.id === "conferencia" ? (
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
              <SheetDescription>
                Natureza histórica da transferência e limites desta operação.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p>{TRANSFER_NOT_FIELD_CHANGE_NOTE}</p>
              <p>{ORIGIN_ENROLLMENT_NOTE}</p>
              <p>{ORIGIN_PRESERVATION_NOTE}</p>
              <p>{ATOMICITY_NOTE}</p>
              <p>{TRANSFER_IS_NOT_ALLOCATION_NOTE}</p>
              <p>{EXTERNAL_ENTRY_NOTE}</p>
              <p>{EXTERNAL_REFERENCE_NOTE}</p>
              <p>{DATA_MINIMIZATION_TRANSFER_NOTE}</p>
              <p>Nada é persistido nesta etapa demonstrativa.</p>
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
              nenhuma matrícula escolar, vínculo letivo, participação ou alocação é alterada.
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
              {isExit
                ? `Registrar a saída de ${studentLabel} da rede?`
                : `Transferir ${studentLabel} para ${unitName(draft.destinationUnitId)}?`}
            </DialogTitle>
            <DialogDescription>
              A situação na escola atual é encerrada e a nova é preparada na mesma operação. O
              histórico é preservado.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <InstitutionalDetails summary="Ver escopo institucional desta conclusão">
              <p>{ATOMICITY_NOTE}</p>
              <p className="mt-1">
                A implementação real futura deverá ser transacional e revalidar o estado antes de
                concluir: não existe cenário concluído com origem encerrada e destino falho.
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
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
