import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  ACADEMIC_LINK_PERIOD_OPTIONS,
  ACADEMIC_LINK_SCOPE_NOTE,
  ACADEMIC_LINK_SECTIONS,
  NO_ENROLLMENT_NOTE,
  PARTICIPATION_CATALOGUE,
  PERIOD_NOT_CIVIL_YEAR_NOTE,
  RECLASSIFICATION_NOTE,
  REGULAR_PARTICIPATION_LABEL,
  academicLinkIssueFor,
  assessContinuity,
  coexistenceLabel,
  contextualMatrix,
  createBlankAcademicLinkDraft,
  findRegularConflicts,
  getEnrollmentOrigin,
  isAcademicLinkDraftDirty,
  isPhaseOrganization,
  listEnrollmentOrigins,
  offersForOrigin,
  organizationOptions,
  originsForStudent,
  participationNature,
  participationNote,
  validateAcademicLinkDraft,
  type AcademicLinkDraft,
  type AcademicLinkIssue,
  type AcademicLinkIssueField,
} from "@/features/academic-links/academic-link-draft";

function FieldError({ issue }: { issue?: AcademicLinkIssue | undefined }) {
  if (!issue || issue.severity !== "erro") return null;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {issue.message}
    </span>
  );
}

export function AcademicLinkWorkspacePage({
  studentId,
  enrollmentId,
}: {
  studentId?: string | undefined;
  enrollmentId?: string | undefined;
}) {
  const origins = useMemo(
    () => (studentId ? originsForStudent(studentId) : listEnrollmentOrigins()),
    [studentId],
  );
  const initialDraft = useMemo(() => {
    const preselected =
      (enrollmentId && origins.find((origin) => origin.id === enrollmentId)?.id) ??
      (studentId && origins.length === 1 ? origins[0]!.id : null);
    return createBlankAcademicLinkDraft(preselected);
  }, [enrollmentId, studentId, origins]);

  const [draft, setDraft] = useState<AcademicLinkDraft>(initialDraft);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<AcademicLinkDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  const origin = getEnrollmentOrigin(draft.originId);
  const continuity = assessContinuity(origin, draft.periodLabel);
  const conflicts = findRegularConflicts(origin, draft.periodLabel);
  const offers = offersForOrigin(origin, draft.periodLabel);
  const organizations = draft.offerId ? organizationOptions(draft.offerId) : [];
  const contextual = draft.offerId ? contextualMatrix(draft.offerId) : null;
  const issues = validateAcademicLinkDraft(draft, continuity, conflicts);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const dirty = isAcademicLinkDraftDirty(draft, initialDraft);
  const dispatchDisabled = errors.length > 0;

  function issueOf(field: AcademicLinkIssueField) {
    return academicLinkIssueFor(issues, field);
  }

  function toggleParticipation(label: string, checked: boolean) {
    const next = checked
      ? [...draft.participationLabels, label]
      : draft.participationLabels.filter((item) => item !== label);
    update({ participationLabels: next });
  }

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Vínculo letivo e participação (demonstrativo)"
        description="A partir de uma matrícula escolar existente, defina o contexto acadêmico do período letivo e as participações educacionais. A matrícula escolar permanece a mesma; nada é persistido nesta etapa."
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
            <Button size="sm" disabled={dispatchDisabled} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 /> Concluir vínculo letivo
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Vínculo letivo demonstrativo</StatusBadge>
        <span className="text-muted-foreground">
          Matrícula Escolar → Vínculo Letivo → Participação. A alocação em turma pertence a fluxo
          posterior.
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
        <nav aria-label="Etapas do vínculo letivo" className="min-w-0">
          <ul className="sticky top-20 space-y-1 text-xs">
            {ACADEMIC_LINK_SECTIONS.map((section) => (
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
          {/* 1. MATRÍCULA ESCOLAR */}
          <section id="matricula" aria-labelledby="matricula-title">
            <DetailSection
              title="Matrícula escolar de origem"
              description="O vínculo letivo parte de uma matrícula escolar existente. Nenhuma pessoa, aluno ou matrícula escolar é criada neste workspace."
              titleId="matricula-title"
            >
              {origins.length === 0 ? (
                <div className="border border-border bg-muted/40 px-3 py-3 text-xs">
                  <p className="font-medium">Nenhuma matrícula escolar encontrada.</p>
                  <p className="mt-1 text-muted-foreground">{NO_ENROLLMENT_NOTE}</p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link to="/matriculas/nova">Registrar ingresso e matrícula escolar</Link>
                  </Button>
                </div>
              ) : (
                <div className="max-w-2xl">
                  <Label htmlFor="origin-select">Matrícula escolar existente</Label>
                  <Select
                    value={draft.originId ?? ""}
                    onValueChange={(value) =>
                      update({
                        originId: value,
                        periodLabel: "",
                        offerId: "",
                        academicOrganization: "",
                      })
                    }
                  >
                    <SelectTrigger id="origin-select" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione a matrícula escolar" />
                    </SelectTrigger>
                    <SelectContent>
                      {origins.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.enrollmentNumber} · {item.studentName} · {item.unitNameAtTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={issueOf("originId")} />
                </div>
              )}

              {origin ? (
                <div className="mt-4">
                  <DefinitionList
                    items={[
                      { term: "Aluno", detail: origin.studentName },
                      {
                        term: "Identificador SIGEM do aluno",
                        detail: <span className="font-mono text-tabular">{origin.sigemId}</span>,
                      },
                      { term: "Unidade escolar", detail: origin.unitNameAtTime },
                      {
                        term: "Identificador da matrícula escolar",
                        detail: (
                          <span className="font-mono text-tabular">{origin.enrollmentNumber}</span>
                        ),
                      },
                      {
                        term: "Situação da matrícula escolar",
                        detail: `${origin.enrollmentSituation} · aberta em ${origin.openedAt}`,
                      },
                      {
                        term: "Vínculos letivos já registrados",
                        detail: `${origin.links.length} vínculo(s) letivo(s) nesta mesma matrícula escolar`,
                      },
                    ]}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Somente as informações necessárias à identificação operacional são exibidas:
                    nenhum endereço, filiação, CPF completo, dado de saúde, laudo ou dado familiar.
                  </p>
                </div>
              ) : null}
            </DetailSection>
          </section>

          {/* 2. PERÍODO LETIVO */}
          <section id="periodo" aria-labelledby="periodo-title">
            <DetailSection
              title="Período letivo"
              description={PERIOD_NOT_CIVIL_YEAR_NOTE}
              titleId="periodo-title"
            >
              <div className="max-w-xl">
                <Label htmlFor="period-select">Período letivo do vínculo</Label>
                <Select
                  value={draft.periodLabel}
                  onValueChange={(value) =>
                    update({ periodLabel: value, offerId: "", academicOrganization: "" })
                  }
                >
                  <SelectTrigger id="period-select" className="mt-1 h-9">
                    <SelectValue placeholder="Selecione o período letivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACADEMIC_LINK_PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError issue={issueOf("periodLabel")} />
              </div>

              {origin && draft.periodLabel ? (
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge
                      tone={
                        continuity.state === "vinculo-existente"
                          ? "danger"
                          : continuity.state === "renovacao"
                            ? "warning"
                            : "info"
                      }
                    >
                      {continuity.label}
                    </StatusBadge>
                    <span className="font-medium">{continuity.message}</span>
                  </div>
                  <p className="text-muted-foreground">{continuity.detail}</p>

                  {continuity.existingLink ? (
                    <div className="border border-border px-3 py-2">
                      <p className="font-medium">
                        Vínculo letivo existente: {continuity.existingLink.periodLabel} ·{" "}
                        {continuity.existingLink.academicOrganization}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {continuity.existingLink.situationNote}
                      </p>
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link to="/alunos/$id" params={{ id: origin.studentId }}>
                          Consultar vínculo letivo existente
                        </Link>
                      </Button>
                    </div>
                  ) : null}

                  {continuity.previousLink ? (
                    <div className="border border-border px-3 py-2">
                      <p className="font-medium">
                        Vínculo letivo anterior: {continuity.previousLink.periodLabel} ·{" "}
                        {continuity.previousLink.academicOrganization}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        O vínculo anterior permanece histórico e imutável: a renovação cria novo
                        contexto temporal e não sobrescreve o passado.
                      </p>
                    </div>
                  ) : null}

                  {continuity.historicalLinks.length ? (
                    <ul
                      className="space-y-1 border border-border px-3 py-2"
                      aria-label="Vínculos letivos históricos desta matrícula escolar"
                    >
                      {continuity.historicalLinks.map((link) => (
                        <li key={link.id} className="text-muted-foreground">
                          {link.periodLabel} — {link.academicOrganization} · {link.situation}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="text-muted-foreground" role="note">
                    {RECLASSIFICATION_NOTE}
                  </p>
                </div>
              ) : null}
            </DetailSection>
          </section>

          {/* 3. OFERTA EDUCACIONAL */}
          <section id="oferta" aria-labelledby="oferta-title">
            <DetailSection
              title="Oferta educacional"
              description="Ofertas da unidade da matrícula escolar, contextualizadas pelo período letivo. Os exemplos são demonstrativos e não constituem enumeração definitiva."
              titleId="oferta-title"
            >
              {origin && draft.periodLabel ? (
                offers.length ? (
                  <div className="max-w-2xl">
                    <Label htmlFor="offer-select">Oferta educacional da unidade</Label>
                    <Select
                      value={draft.offerId}
                      onValueChange={(value) =>
                        update({ offerId: value, academicOrganization: "" })
                      }
                    >
                      <SelectTrigger id="offer-select" className="mt-1 h-9">
                        <SelectValue placeholder="Selecione a oferta educacional" />
                      </SelectTrigger>
                      <SelectContent>
                        {offers.map((offer) => (
                          <SelectItem key={offer.id} value={offer.id}>
                            {offer.stage} · {offer.organization}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError issue={issueOf("offerId")} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma oferta demonstrativa disponível nesta unidade para o período
                    selecionado.
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione a matrícula escolar e o período letivo para listar as ofertas.
                </p>
              )}
            </DetailSection>
          </section>

          {/* 4. ORGANIZAÇÃO ACADÊMICA */}
          <section id="organizacao" aria-labelledby="organizacao-title">
            <DetailSection
              title="Organização acadêmica"
              description="Período da Educação Infantil, ano do Ensino Fundamental ou fase da EJA, conforme a oferta. Nada é chamado genericamente de série e nenhuma turma é definida aqui."
              titleId="organizacao-title"
            >
              {draft.offerId ? (
                <div className="max-w-2xl">
                  <Label htmlFor="organization-select">Organização acadêmica da oferta</Label>
                  <Select
                    value={draft.academicOrganization}
                    onValueChange={(value) => update({ academicOrganization: value })}
                  >
                    <SelectTrigger id="organization-select" className="mt-1 h-9">
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
                  <FieldError issue={issueOf("academicOrganization")} />
                  {isPhaseOrganization(draft.offerId) ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      A EJA organiza-se em fases próprias e não utiliza anos escolares regulares.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione a oferta educacional para definir a organização acadêmica.
                </p>
              )}
            </DetailSection>
          </section>

          {/* 5. PARTICIPAÇÃO */}
          <section id="participacao" aria-labelledby="participacao-title">
            <DetailSection
              title="Participação"
              description="A participação é distinta do vínculo letivo e mais de uma participação pode coexistir. Os exemplos são demonstrativos e nenhuma alocação em turma é criada."
              titleId="participacao-title"
            >
              <ul className="space-y-3" aria-label="Participações do vínculo letivo">
                {PARTICIPATION_CATALOGUE.map((item) => {
                  const checked = draft.participationLabels.includes(item.label);
                  const id = `participation-${item.label}`;
                  return (
                    <li key={item.label} className="flex items-start gap-3">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(value) => toggleParticipation(item.label, value === true)}
                      />
                      <div className="min-w-0">
                        <Label htmlFor={id} className="text-xs font-medium">
                          {item.label}
                        </Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Natureza: {item.nature}. {item.note}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <FieldError issue={issueOf("participationLabels")} />

              <p className="mt-4 border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                {coexistenceLabel(draft.participationLabels)}
              </p>

              {draft.participationLabels.includes(REGULAR_PARTICIPATION_LABEL) ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  A participação regular representa a escolarização principal neste contexto. As
                  participações complementares não a substituem automaticamente.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhuma participação regular selecionada: a arquitetura admite participações que
                  poderão não depender de participação regular simultânea.
                </p>
              )}

              {conflicts.length ? (
                <div className="mt-4 border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
                  <p className="font-medium text-destructive" role="alert">
                    {issueOf("conflito")?.message}
                  </p>
                  <ul
                    className="mt-1 space-y-1 text-muted-foreground"
                    aria-label="Participações regulares em outras unidades"
                  >
                    {conflicts.map((conflict) => (
                      <li key={`${conflict.enrollmentNumber}-${conflict.periodLabel}`}>
                        <span className="font-mono text-tabular">{conflict.enrollmentNumber}</span>{" "}
                        · {conflict.unitNameAtTime} · {conflict.periodLabel} ·{" "}
                        {conflict.participationLabel}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-muted-foreground">
                    Nada é transferido, encerrado ou resolvido automaticamente. A movimentação entre
                    unidades pertence a fluxo futuro de transferência.
                  </p>
                </div>
              ) : null}
            </DetailSection>
          </section>

          {/* 6. MATRIZ CURRICULAR CONTEXTUAL */}
          <section id="matriz" aria-labelledby="matriz-title">
            <DetailSection
              title="Matriz curricular contextual"
              description="A matriz é apenas consultada no contexto da oferta; não é editada nem duplicada neste fluxo."
              titleId="matriz-title"
            >
              {contextual ? (
                <div className="text-xs">
                  <DefinitionList
                    items={[
                      { term: "Matriz da oferta", detail: contextual.offer.matrixLabel },
                      { term: "Organização da matriz", detail: contextual.matrix.organization },
                      {
                        term: "Vigência demonstrativa",
                        detail: `${contextual.matrix.effectiveFrom} — ${contextual.matrix.effectiveUntil ?? "sem encerramento registrado"}`,
                      },
                    ]}
                  />
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/matrizes-curriculares/$id" params={{ id: contextual.matrix.id }}>
                      <BookOpen /> Consultar matriz
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione a oferta educacional para consultar a matriz curricular contextual.
                </p>
              )}
            </DetailSection>
          </section>

          {/* ALOCAÇÃO EM TURMA — área futura */}
          <section id="alocacao" aria-labelledby="alocacao-title">
            <DetailSection
              title="Alocação em turma (área futura)"
              description="A alocação da participação em uma turma pertence a fluxo posterior e não é executada nesta etapa."
              titleId="alocacao-title"
            >
              <FutureAreaLink>Alocação em turma</FutureAreaLink>
            </DetailSection>
          </section>

          {/* 7. REVISÃO */}
          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisar e concluir"
              description="Resumo antes da conclusão demonstrativa."
              titleId="revisao-title"
            >
              <DefinitionList
                items={[
                  { term: "Aluno", detail: origin?.studentName ?? "Não selecionado" },
                  {
                    term: "Matrícula escolar",
                    detail: origin ? (
                      <span className="font-mono text-tabular">{origin.enrollmentNumber}</span>
                    ) : (
                      "Não selecionada"
                    ),
                  },
                  { term: "Unidade escolar", detail: origin?.unitNameAtTime ?? "Não selecionada" },
                  { term: "Período letivo", detail: draft.periodLabel || "Não selecionado" },
                  {
                    term: "Oferta educacional",
                    detail: contextual
                      ? `${contextual.offer.stage} · ${contextual.offer.organization}`
                      : "Não selecionada",
                  },
                  {
                    term: "Organização acadêmica",
                    detail: draft.academicOrganization || "Não selecionada",
                  },
                  {
                    term: "Vínculo letivo anterior",
                    detail: continuity.previousLink
                      ? `${continuity.previousLink.periodLabel} — ${continuity.previousLink.academicOrganization} (preservado como histórico)`
                      : "Nenhum vínculo letivo anterior registrado",
                  },
                  {
                    term: "Novo contexto",
                    detail:
                      continuity.state === "vinculo-existente"
                        ? "Nenhum novo vínculo letivo será preparado neste contexto"
                        : `Novo vínculo letivo demonstrativo em ${draft.periodLabel || "período não selecionado"}`,
                  },
                  {
                    term: "Participações",
                    detail: draft.participationLabels.length
                      ? draft.participationLabels
                          .map(
                            (label) =>
                              `${label} (${participationNature(label) ?? "Natureza a definir"})`,
                          )
                          .join(" · ")
                      : "Nenhuma participação definida",
                  },
                  {
                    term: "Matriz contextual",
                    detail: contextual ? contextual.offer.matrixLabel : "Não aplicável",
                  },
                  {
                    term: "Conflitos identificados",
                    detail: conflicts.length
                      ? `${conflicts.length} participação(ões) regular(es) em outra unidade no mesmo período`
                      : "Nenhum conflito demonstrativo identificado",
                  },
                ]}
              />

              {draft.participationLabels.length ? (
                <ul className="mt-4 space-y-1 text-xs" aria-label="Notas das participações">
                  {draft.participationLabels.map((label) => (
                    <li key={label} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{label}:</span>{" "}
                      {participationNote(label)}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-5">
                <Label htmlFor="link-note">Observação de contexto (opcional)</Label>
                <Textarea
                  id="link-note"
                  className="mt-1"
                  value={draft.note}
                  onChange={(event) => update({ note: event.target.value })}
                />
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Pendências e avisos</h3>
                {issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma pendência identificada nesta demonstração.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs" aria-label="Pendências e avisos">
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
              </div>

              <p className="mt-5 border border-border bg-muted/40 px-3 py-2 text-xs" role="note">
                {ACADEMIC_LINK_SCOPE_NOTE}
              </p>
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
              descartado; nenhum vínculo letivo, participação ou matrícula escolar existente é
              alterado.
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
                : "Concluir vínculo letivo (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Vínculo letivo demonstrativo preparado. Nenhuma alocação em turma foi criada e nada foi persistido."
                : ACADEMIC_LINK_SCOPE_NOTE}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {concluded
              ? "A matrícula escolar permanece a mesma e os vínculos letivos anteriores permanecem preservados como fatos históricos."
              : "Será preparado um novo vínculo letivo associado à matrícula escolar existente, com as participações selecionadas."}
          </div>
          <DialogFooter>
            {concluded ? (
              <Button size="sm" onClick={() => setConfirmOpen(false)}>
                Fechar
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
                  Voltar
                </Button>
                <Button size="sm" onClick={() => setConcluded(true)}>
                  Confirmar vínculo letivo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
