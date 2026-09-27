import { formatAcademicDate } from "@/lib/academic-date";
import { DateInput } from "@/components/sigem/date-input";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
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
import { BlockingReason, StatusExplanation } from "@/components/sigem/status-continuity";
import { resolveActionDisclosure, resolveHumanStatus } from "@/lib/human-status";
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
  TRANSFER_SECTIONS,
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

function FieldError({ issue }: { issue?: TransferIssue | undefined }) {
  if (!issue || issue.severity !== "erro") return null;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {issue.message}
    </span>
  );
}

function PlanList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="border border-border p-3">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">{label}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Nenhum registro nesta categoria.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs" aria-label={label}>
          {items.map((item) => (
            <li key={item} className="text-muted-foreground">
              {item}
            </li>
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
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    if (destinationStudentId ?? studentId) {
      void navigate({ to: "/alunos/$id", params: { id: destinationStudentId ?? studentId ?? "" } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<TransferDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

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
  const originMissing = !isEntry && !origin;
  const primaryLabel = transferActionLabel(draft.kind);
  // Ação institucional inválida permanece indisponível; a causa fica visível.
  const disclosure = resolveActionDisclosure(
    errors.length > 0 ? "requisito-pendente" : "disponivel",
    { pendingRequirements: errors.map((issue) => issue.message) },
  );
  // Nenhum responsável é afirmado: a fonte não declara competência para
  // constituir matrícula, vínculo ou participação na origem.
  const noOriginStatus = resolveHumanStatus({
    nature: "requisito-pendente",
    template: {
      nature: "requisito-pendente",
      headline: () => "Ainda não há relação escolar que possa ser transferida.",
      because: () => NO_TRANSFERABLE_ORIGIN_NOTE,
    },
  });

  function issueOf(field: TransferIssueField) {
    return transferIssueFor(issues, field);
  }

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Transferência escolar (demonstrativo)"
        description="Operação histórica: encerra explicitamente relações temporais na origem e prepara relações próprias no destino. Nada é persistido nesta etapa."
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
            <Button size="sm" disabled={!disclosure.enabled} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 /> {primaryLabel}
            </Button>
          </>
        }
      />

      {disclosure.present && !disclosure.enabled ? (
        <BlockingReason
          actionLabel={primaryLabel}
          explanation="Esta ação continua indisponível até que os pontos abaixo estejam informados."
          requirements={errors.map((issue) => issue.message)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Transferência demonstrativa</StatusBadge>
        <span className="text-muted-foreground">{TRANSFER_NOT_FIELD_CHANGE_NOTE}</span>
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
        <nav aria-label="Seções da transferência" className="min-w-0">
          <ul className="sticky top-20 space-y-1 text-xs">
            {TRANSFER_SECTIONS.map((section) => (
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
          {/* 1. ORIGEM */}
          <section id="origem" aria-labelledby="origem-title">
            <DetailSection
              title="Origem"
              description="A transferência parte de uma relação escolar existente na origem: matrícula escolar, vínculo letivo e participação regular vigentes."
              titleId="origem-title"
            >
              {origins.length === 0 ? (
                <StatusExplanation
                  status={noOriginStatus}
                  nextAction={
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/matriculas/nova" search={studentId ? { aluno: studentId } : {}}>
                          Ingresso e matrícula escolar
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/vinculos-letivos/novo"
                          search={studentId ? { aluno: studentId } : {}}
                        >
                          Vínculo letivo e participação
                        </Link>
                      </Button>
                    </div>
                  }
                  details={
                    <p>
                      Matrícula escolar, vínculo letivo e participação não são criados aqui apenas
                      para permitir a transferência.
                    </p>
                  }
                />
              ) : (
                <div className="max-w-3xl">
                  <Label htmlFor="origin-select">Relação escolar de origem</Label>
                  <Select
                    value={draft.originId ?? ""}
                    onValueChange={(value) => update({ originId: value })}
                  >
                    <SelectTrigger id="origin-select" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione a relação escolar de origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {origins.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.studentName} · {item.unitNameAtTime} · {item.periodLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={issueOf("originId")} />
                </div>
              )}

              {origin ? (
                <>
                  <div className="mt-4">
                    <DefinitionList
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
                          term: "Identificador SIGEM",
                          detail: <span className="font-mono text-tabular">{origin.sigemId}</span>,
                        },
                        { term: "Unidade de origem", detail: origin.unitNameAtTime },
                        {
                          term: "Matrícula escolar",
                          detail: (
                            <span className="font-mono text-tabular">
                              {origin.enrollmentNumber}
                            </span>
                          ),
                        },
                        { term: "Vínculo letivo", detail: origin.periodLabel },
                        { term: "Período letivo", detail: origin.periodNote },
                        { term: "Oferta educacional", detail: origin.offerLabel },
                        { term: "Organização acadêmica", detail: origin.academicOrganization },
                        { term: "Participação regular", detail: origin.participationLabel },
                        {
                          term: "Alocação atual em turma",
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
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {DATA_MINIMIZATION_TRANSFER_NOTE}
                  </p>
                </>
              ) : originMissing && origins.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Selecione a relação escolar de origem para ler o contexto da transferência.
                </p>
              ) : null}
            </DetailSection>
          </section>

          {/* 2. TIPO E DESTINO */}
          <section id="tipo" aria-labelledby="tipo-title">
            <DetailSection
              title="Tipo e destino da transferência"
              description="Conceitos de experiência desta etapa; nenhuma enumeração legal definitiva é congelada."
              titleId="tipo-title"
            >
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
                className="gap-0 divide-y divide-border border border-border"
              >
                {TRANSFER_KINDS.map((option) => (
                  <div key={option.value} className="flex items-start gap-3 p-3">
                    <RadioGroupItem
                      value={option.value}
                      id={`kind-${option.value}`}
                      aria-label={option.label}
                      className="mt-1"
                    />
                    <Label htmlFor={`kind-${option.value}`} className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {option.detail}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {isInternal ? (
                <p className="mt-3 border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                  Origem Unidade A → contexto acadêmico vigente → transferência → Destino Unidade B.
                  A matrícula escolar da Unidade A nunca se transforma em matrícula da Unidade B.
                </p>
              ) : null}
              {isEntry ? (
                <p className="mt-3 border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                  {EXTERNAL_ENTRY_NOTE} {EXTERNAL_REFERENCE_NOTE}
                </p>
              ) : null}
            </DetailSection>
          </section>

          {/* 3. DATA EFETIVA */}
          <section id="data" aria-labelledby="data-title">
            <DetailSection
              title="Data efetiva"
              description="Orienta a interrupção temporal dos contextos na origem e a continuidade no destino. Nenhuma regra municipal de calendário é aplicada."
              titleId="data-title"
            >
              <div className="max-w-xs">
                <Label htmlFor="effective-date">Data efetiva da transferência</Label>
                <DateInput
                  id="effective-date"
                  className="mt-1"
                  value={draft.effectiveDate}
                  onChange={(event) => update({ effectiveDate: event.target.value })}
                />
                <FieldError issue={issueOf("effectiveDate")} />
              </div>
            </DetailSection>
          </section>

          {/* 4. IMPACTOS NA ORIGEM */}
          <section id="impactos" aria-labelledby="impactos-title">
            <DetailSection
              title="Impactos na origem"
              description="O que será encerrado e o que será preservado. Nenhum registro é apagado."
              titleId="impactos-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <PlanList label="Será encerrado na origem" items={plan.ended} />
                <PlanList label="Permanece preservado" items={plan.preserved} />
              </div>
              <p className="mt-3 border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                {ORIGIN_ENROLLMENT_NOTE}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{ORIGIN_PRESERVATION_NOTE}</p>

              <div className="mt-4">
                <h3 className="text-xs font-semibold text-foreground">
                  Participações complementares
                </h3>
                {origin && origin.complementary.length > 0 ? (
                  <ul
                    className="mt-1 divide-y divide-border border border-border"
                    aria-label="Participações complementares da origem"
                  >
                    {origin.complementary.map((participation) => (
                      <li key={participation.id} className="p-3 text-xs">
                        <p className="font-medium text-foreground">{participation.label}</p>
                        <p className="mt-0.5 text-muted-foreground">Requer decisão/validação.</p>
                        <p className="mt-0.5 text-muted-foreground">{participation.note}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma participação complementar ativa nesta origem.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground" role="note">
                  {COMPLEMENTARY_DECISION_NOTE}
                </p>
              </div>
            </DetailSection>
          </section>

          {/* 5. CONTEXTO DO DESTINO */}
          <section id="destino" aria-labelledby="destino-title">
            <DetailSection
              title="Contexto do destino"
              description="No destino interno, a matrícula escolar é criada ou reutilizada e o contexto acadêmico é preparado sem cópia automática da origem."
              titleId="destino-title"
            >
              {isEntry ? (
                <div className="mb-4 grid max-w-3xl gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="entry-student">Pessoa/Aluno já cadastrado</Label>
                    <Select
                      value={draft.entryStudentId ?? ""}
                      onValueChange={(value) => update({ entryStudentId: value })}
                    >
                      <SelectTrigger id="entry-student" className="mt-1 h-9">
                        <SelectValue placeholder="Localizar pessoa/aluno" />
                      </SelectTrigger>
                      <SelectContent>
                        {entryStudentOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError issue={issueOf("entryStudentId")} />
                    <Button asChild size="sm" variant="outline" className="mt-2">
                      <Link to="/alunos/novo">Cadastrar pessoa/aluno previamente</Link>
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="external-origin">
                      Instituição de origem externa (referência)
                    </Label>
                    <Input
                      id="external-origin"
                      className="mt-1"
                      value={draft.externalOriginName}
                      onChange={(event) => update({ externalOriginName: event.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{EXTERNAL_REFERENCE_NOTE}</p>
                  </div>
                </div>
              ) : null}

              {isExit ? (
                <div className="max-w-3xl space-y-4">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="external-known"
                      checked={draft.externalDestinationKnown}
                      onCheckedChange={(checked) =>
                        update({ externalDestinationKnown: checked === true })
                      }
                    />
                    <Label htmlFor="external-known" className="text-xs font-normal">
                      Destino externo conhecido e informado
                    </Label>
                  </div>
                  {draft.externalDestinationKnown ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="external-institution">Instituição externa de destino</Label>
                        <Input
                          id="external-institution"
                          className="mt-1"
                          value={draft.externalInstitutionName}
                          onChange={(event) =>
                            update({ externalInstitutionName: event.target.value })
                          }
                        />
                        <FieldError issue={issueOf("externalDestino")} />
                      </div>
                      <div>
                        <Label htmlFor="external-location">Município/UF (quando pertinente)</Label>
                        <Input
                          id="external-location"
                          className="mt-1"
                          value={draft.externalLocation}
                          onChange={(event) => update({ externalLocation: event.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="external-reference">
                          Identificação externa (quando pertinente)
                        </Label>
                        <Input
                          id="external-reference"
                          className="mt-1"
                          value={draft.externalReference}
                          onChange={(event) => update({ externalReference: event.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                      {EXTERNAL_DESTINATION_UNKNOWN_LABEL}: a saída pode ser registrada
                      demonstrativamente sem destino declarado. Nenhuma unidade escolar interna é
                      criada para representar o destino.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{EXTERNAL_REFERENCE_NOTE}</p>
                </div>
              ) : null}

              {needsInternalDestination ? (
                <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="destination-unit">Unidade interna de destino</Label>
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
                      <SelectTrigger id="destination-unit" className="mt-1 h-9">
                        <SelectValue placeholder="Selecione a unidade de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERNAL_DESTINATION_UNITS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError issue={issueOf("destinationUnitId")} />
                  </div>
                  <div>
                    <Label htmlFor="destination-period">Período letivo do destino</Label>
                    <Select
                      value={draft.destinationPeriodLabel}
                      onValueChange={(value) => update({ destinationPeriodLabel: value })}
                    >
                      <SelectTrigger id="destination-period" className="mt-1 h-9">
                        <SelectValue placeholder="Selecione o período letivo" />
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
                    <Label htmlFor="destination-offer">Oferta educacional do destino</Label>
                    <Select
                      value={draft.destinationOfferId}
                      onValueChange={(value) =>
                        update({ destinationOfferId: value, destinationOrganization: "" })
                      }
                    >
                      <SelectTrigger id="destination-offer" className="mt-1 h-9">
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
                    <FieldError issue={issueOf("destinationOfferId")} />
                  </div>
                  <div>
                    <Label htmlFor="destination-organization">
                      Organização acadêmica pretendida
                    </Label>
                    <Select
                      value={draft.destinationOrganization}
                      onValueChange={(value) => update({ destinationOrganization: value })}
                    >
                      <SelectTrigger id="destination-organization" className="mt-1 h-9">
                        <SelectValue placeholder="Selecione a organização acadêmica" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError issue={issueOf("destinationOrganization")} />
                  </div>
                </div>
              ) : null}

              {needsInternalDestination && resolution ? (
                <div className="mt-4 border border-border px-3 py-2 text-xs">
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={resolution.state === "nova" ? "info" : "warning"}>
                      {resolution.label}
                    </StatusBadge>
                    {resolution.number ? (
                      <span className="font-mono text-tabular text-muted-foreground">
                        {resolution.number}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 font-medium text-foreground">{resolution.message}</p>
                  <p className="mt-1 text-muted-foreground">{resolution.detail}</p>
                  <p className="mt-1 text-muted-foreground">{ORIGIN_ENROLLMENT_NOTE}</p>
                </div>
              ) : null}

              {needsInternalDestination ? (
                <>
                  <div className="mt-4 border border-border px-3 py-2 text-xs">
                    <p className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={continuity.state === "equivalente" ? "success" : "warning"}
                      >
                        {continuity.label}
                      </StatusBadge>
                    </p>
                    <p className="mt-1 text-muted-foreground">{continuity.message}</p>
                  </div>
                  <p
                    className="mt-3 border border-border bg-muted/40 px-3 py-2 text-xs"
                    role="note"
                  >
                    {NOT_ALLOCATED_NOTE} {TRANSFER_IS_NOT_ALLOCATION_NOTE}
                  </p>
                </>
              ) : null}
            </DetailSection>
          </section>

          {/* 6. CONFLITOS E PENDÊNCIAS */}
          <section id="conflitos" aria-labelledby="conflitos-title">
            <DetailSection
              title="Conflitos e pendências"
              description="Conflitos evidentes são explicitados sem resolução automática."
              titleId="conflitos-title"
            >
              {conflicts.length > 0 ? (
                <ul
                  className="mb-4 divide-y divide-border border border-destructive/40"
                  aria-label="Conflitos de participação regular"
                >
                  {conflicts.map((conflict) => (
                    <li
                      key={`${conflict.unitName}-${conflict.periodLabel}`}
                      className="p-3 text-xs"
                    >
                      <p className="font-medium text-destructive">
                        Participação regular ativa em {conflict.unitName}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {conflict.participationLabel} · {conflict.periodLabel}. Nenhuma segunda
                        participação regular sobreposta é criada silenciosamente.
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum conflito demonstrativo identificado.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs" aria-label="Conflitos e pendências">
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

              <div className="mt-5 border border-border px-3 py-3 text-xs">
                <h3 className="text-xs font-semibold text-foreground">
                  Conflito de versão (demonstrativo)
                </h3>
                <div className="mt-2 flex items-start gap-2">
                  <Checkbox
                    id="version-conflict"
                    checked={draft.simulateVersionConflict}
                    onCheckedChange={(checked) =>
                      update({ simulateVersionConflict: checked === true })
                    }
                  />
                  <Label htmlFor="version-conflict" className="text-xs font-normal">
                    Simular alteração concorrente durante a operação
                  </Label>
                </div>
                <p className="mt-2 text-muted-foreground">{VERSION_CONFLICT_NOTE}</p>
              </div>

              <p className="mt-3 text-xs text-muted-foreground" role="note">
                {ACADEMIC_COMPATIBILITY_NOTE} A transferência não é mecanismo de reclassificação.
              </p>
            </DetailSection>
          </section>

          {/* 7. DOCUMENTAÇÃO */}
          <section id="documentacao" aria-labelledby="documentacao-title">
            <DetailSection
              title="Documentação da transferência"
              description="Estados demonstrativos apenas; nada é bloqueado por regra documental não definida."
              titleId="documentacao-title"
            >
              <div className="max-w-sm">
                <Label htmlFor="documentation-state">Situação documental demonstrativa</Label>
                <Select
                  value={draft.documentationState}
                  onValueChange={(value) => update({ documentationState: value })}
                >
                  <SelectTrigger id="documentation-state" className="mt-1 h-9">
                    <SelectValue placeholder="Selecione a situação documental" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENTATION_STATES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{DOCUMENTATION_NOTE}</p>
            </DetailSection>
          </section>

          {/* 8. REVISÃO */}
          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisão"
              description="Comparação entre origem, transferência e destino, com os registros encerrados, preservados, criados, reutilizados e pendentes."
              titleId="revisao-title"
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Origem</h3>
                  <DefinitionList
                    items={[
                      { term: "Unidade", detail: origin?.unitNameAtTime ?? "Não aplicável" },
                      { term: "Matrícula escolar", detail: origin?.enrollmentNumber ?? "—" },
                      { term: "Vínculo letivo", detail: origin?.periodLabel ?? "—" },
                      { term: "Participação", detail: origin?.participationLabel ?? "—" },
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
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Transferência
                  </h3>
                  <DefinitionList
                    items={[
                      {
                        term: "Tipo",
                        detail:
                          TRANSFER_KINDS.find((item) => item.value === draft.kind)?.label ?? "—",
                      },
                      { term: "Data efetiva", detail: draft.effectiveDate || "Não informada" },
                      {
                        term: "Avisos",
                        detail: issues.length
                          ? `${issues.length} pendência(s) ou aviso(s) demonstrativo(s)`
                          : "Nenhum aviso demonstrativo",
                      },
                      { term: "Documentação", detail: draft.documentationState },
                    ]}
                  />
                </div>
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Destino</h3>
                  {isExit ? (
                    <DefinitionList
                      items={[
                        {
                          term: "Destino externo",
                          detail:
                            draft.externalDestinationKnown && draft.externalInstitutionName.trim()
                              ? draft.externalInstitutionName.trim()
                              : EXTERNAL_DESTINATION_UNKNOWN_LABEL,
                        },
                        { term: "Município/UF", detail: draft.externalLocation || "Não informado" },
                        {
                          term: "Identificação externa",
                          detail: draft.externalReference || "Não informada",
                        },
                        { term: "Unidade interna", detail: "Nenhuma unidade interna é criada" },
                      ]}
                    />
                  ) : (
                    <DefinitionList
                      items={[
                        { term: "Unidade", detail: unitName(draft.destinationUnitId) },
                        {
                          term: "Matrícula escolar",
                          detail: resolution
                            ? resolution.state === "nova"
                              ? "Nova matrícula escolar no destino"
                              : `Reutilizada: ${resolution.number ?? "matrícula existente"}`
                            : "Não resolvida",
                        },
                        {
                          term: "Período letivo",
                          detail: draft.destinationPeriodLabel || "Não informado",
                        },
                        {
                          term: "Oferta",
                          detail: draft.destinationOfferId
                            ? destinationOfferLabel(draft.destinationOfferId)
                            : "Não selecionada",
                        },
                        {
                          term: "Organização",
                          detail: draft.destinationOrganization || "Não selecionada",
                        },
                        {
                          term: "Participação",
                          detail: "Participação regular pretendida no destino",
                        },
                        { term: "Enturmação", detail: NOT_ALLOCATED_NOTE },
                        {
                          term: "Origem externa",
                          detail: isEntry
                            ? draft.externalOriginName.trim() || "Referência externa não informada"
                            : "Não aplicável",
                        },
                      ]}
                    />
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PlanList label="Registros encerrados" items={plan.ended} />
                <PlanList label="Registros preservados" items={plan.preserved} />
                <PlanList label="Registros criados" items={plan.created} />
                <PlanList label="Registros reutilizados" items={plan.reused} />
                <PlanList label="Mantidos pendentes" items={plan.pending} />
              </div>

              <div className="mt-5">
                <Label htmlFor="transfer-note">Observação administrativa (opcional)</Label>
                <Textarea
                  id="transfer-note"
                  className="mt-1"
                  value={draft.note}
                  onChange={(event) => update({ note: event.target.value })}
                />
              </div>
            </DetailSection>
          </section>

          {/* 9. CONCLUSÃO */}
          <section id="conclusao" aria-labelledby="conclusao-title">
            <DetailSection
              title="Conclusão demonstrativa"
              description="Nada é persistido. A conclusão comunica uma operação completa, nunca sucesso parcial."
              titleId="conclusao-title"
            >
              <p className="border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                {ATOMICITY_NOTE}
              </p>
              <ol className="mt-3 space-y-1 text-xs" aria-label="Sequência transacional conceitual">
                {TRANSFER_TRANSACTION_STEPS.map((step, index) => (
                  <li key={step} className="text-muted-foreground">
                    {index + 1}. {step}
                  </li>
                ))}
              </ol>
              <Button
                className="mt-4"
                size="sm"
                disabled={errors.length > 0}
                onClick={() => setConfirmOpen(true)}
              >
                <CheckCircle2 /> {transferActionLabel(draft.kind)}
              </Button>
            </DetailSection>
          </section>
        </div>
      </div>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              O workspace não salva nem armazena dados nesta etapa. Ao sair, o preenchimento é
              descartado; nenhuma matrícula escolar, vínculo letivo, participação ou alocação é
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
                : `${transferActionLabel(draft.kind)} (demonstrativo)`}
            </DialogTitle>
            <DialogDescription>
              {concluded ? transferFeedback(draft.kind) : ATOMICITY_NOTE}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {concluded
              ? `${ORIGIN_ENROLLMENT_NOTE} ${isInternal || isEntry ? NOT_ALLOCATED_NOTE : ""}`
              : "A implementação real futura deverá ser transacional e revalidar o estado antes de concluir: não existe cenário concluído com origem encerrada e destino falho."}
          </div>
          <DialogFooter>
            {concluded ? (
              <>
                {isInternal || isEntry ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/enturmacoes/nova"
                      search={destinationStudentId ? { aluno: destinationStudentId } : {}}
                    >
                      Ir para enturmação no destino
                    </Link>
                  </Button>
                ) : null}
                <Button size="sm" onClick={leave}>
                  Voltar para o aluno
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
                  Voltar
                </Button>
                <Button size="sm" onClick={() => setConcluded(true)}>
                  Confirmar operação demonstrativa
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
