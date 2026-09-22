import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Search, TriangleAlert, UserPlus } from "lucide-react";
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
import { demonstrationUnits } from "@/features/units/units-data";
import {
  ENROLLMENT_SCOPE_NOTE,
  ENROLLMENT_WORKSPACE_SECTIONS,
  ENTRY_FORM_OPTIONS,
  IDENTITY_STEP_NOTE,
  NEW_ENROLLMENT_IDENTIFIER_NOTE,
  academicLinkCount,
  createBlankEnrollmentDraft,
  enrollmentIssueFor,
  findUnitRelation,
  getRegistryResult,
  isEnrollmentDraftDirty,
  searchMasterRegistry,
  unitName,
  validateEnrollmentDraft,
  type EnrollmentDraft,
  type EnrollmentIssue,
  type EnrollmentIssueField,
  type MasterRegistryResult,
} from "@/features/enrollments/enrollment-draft";

function FieldError({ issue }: { issue?: EnrollmentIssue | undefined }) {
  if (!issue || issue.severity !== "erro") return null;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {issue.message}
    </span>
  );
}

export function EnrollmentWorkspacePage({ studentId }: { studentId?: string | undefined }) {
  const initialDraft = useMemo(
    () => createBlankEnrollmentDraft(studentId),

    [studentId],
  );
  const [draft, setDraft] = useState<EnrollmentDraft>(initialDraft);
  const [searched, setSearched] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    if (draft.studentId) {
      void navigate({ to: "/alunos/$id", params: { id: draft.studentId } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<EnrollmentDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  const results = searched ? searchMasterRegistry(draft.query) : [];
  const selected: MasterRegistryResult | null = draft.studentId
    ? getRegistryResult(draft.studentId)
    : null;
  const relation =
    draft.studentId && draft.unitId ? findUnitRelation(draft.studentId, draft.unitId) : null;
  const issues = validateEnrollmentDraft(draft, relation);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "aviso");
  const dirty = isEnrollmentDraftDirty(draft, initialDraft);

  const canCreate = relation?.scenario === "primeiro-ingresso";
  const primaryLabel =
    relation?.scenario === "matricula-existente"
      ? "Utilizar matrícula existente"
      : relation?.scenario === "retorno"
        ? "Utilizar matrícula anterior"
        : "Criar matrícula escolar";
  const blockingErrors = errors.filter((issue) => issue.field !== "duplicidade");
  const primaryDisabled = blockingErrors.length > 0;

  function issueOf(field: EnrollmentIssueField) {
    return enrollmentIssueFor(issues, field);
  }

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Ingresso e matrícula escolar (demonstrativo)"
        description="Localize o aluno já existente, selecione a unidade escolar e verifique a relação anterior. A matrícula escolar é o vínculo permanente entre aluno e unidade; nada é persistido nesta etapa."
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
            <Button size="sm" disabled={primaryDisabled} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 /> {primaryLabel}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Ingresso demonstrativo</StatusBadge>
        <span className="text-muted-foreground">
          Pessoa → Aluno → Matrícula Escolar. Vínculo letivo, participação e turma pertencem a
          fluxos posteriores.
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
        <nav aria-label="Etapas do ingresso" className="min-w-0">
          <ul className="sticky top-20 space-y-1 text-xs">
            {ENROLLMENT_WORKSPACE_SECTIONS.map((section) => (
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
          {/* 1. LOCALIZAR ALUNO */}
          <section id="localizar" aria-labelledby="localizar-title">
            <DetailSection
              title="Localizar aluno"
              description="A matrícula escolar pressupõe uma pessoa/aluno já existente. Pesquise por nome, identificador SIGEM, matrícula escolar existente ou identificador externo. Apenas o mínimo necessário é exibido."
              titleId="localizar-title"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                  <Label htmlFor="registry-query">Pesquisar no cadastro mestre</Label>
                  <Input
                    id="registry-query"
                    className="mt-1 h-9"
                    value={draft.query}
                    placeholder="Nome, SIGEM-AL-…, ME-DEMO-… ou identificador externo"
                    onChange={(event) => {
                      update({ query: event.target.value });
                      setSearched(false);
                    }}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => setSearched(true)}>
                  <Search /> Pesquisar
                </Button>
              </div>

              {searched ? (
                results.length ? (
                  <ul
                    className="mt-4 divide-y divide-border border border-border text-xs"
                    aria-label="Resultados do cadastro mestre"
                  >
                    {results.map((result) => (
                      <li
                        key={result.studentId}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                      >
                        <span className="font-medium">{result.displayName}</span>
                        <span className="font-mono text-tabular text-muted-foreground">
                          {result.sigemId}
                        </span>
                        <span className="text-muted-foreground">
                          Nascimento {result.birthDate} · CPF {result.maskedCpf}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          onClick={() =>
                            update({ studentId: result.studentId, identityConfirmed: false })
                          }
                        >
                          Selecionar aluno
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 border border-border bg-muted/40 px-3 py-3 text-xs">
                    <p className="font-medium">Nenhum aluno correspondente no cadastro mestre.</p>
                    <p className="mt-1 text-muted-foreground">{IDENTITY_STEP_NOTE}</p>
                    <Button asChild size="sm" variant="outline" className="mt-2">
                      <Link to="/alunos/novo">
                        <UserPlus /> Cadastrar nova pessoa/aluno
                      </Link>
                    </Button>
                  </div>
                )
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  A pesquisa utiliza apenas dados fictícios e não exibe CPF completo, endereço,
                  filiação, contatos ou dados sensíveis.
                </p>
              )}
              <FieldError issue={issueOf("studentId")} />
            </DetailSection>
          </section>

          {/* 2. CONFIRMAR IDENTIDADE */}
          <section id="identidade" aria-labelledby="identidade-title">
            <DetailSection
              title="Confirmar identidade"
              description="Confirmação mínima para desambiguação. O identificador SIGEM do aluno é permanente e não é matrícula escolar."
              titleId="identidade-title"
            >
              {selected ? (
                <>
                  <DefinitionList
                    items={[
                      { term: "Aluno", detail: selected.displayName },
                      {
                        term: "Identificador SIGEM do aluno",
                        detail: <span className="font-mono text-tabular">{selected.sigemId}</span>,
                      },
                      { term: "Nascimento", detail: selected.birthDate },
                      { term: "Situação cadastral contextual", detail: selected.situationNote },
                      {
                        term: "Matrículas escolares registradas",
                        detail: selected.enrollmentNumbers.length
                          ? selected.enrollmentNumbers.join(" · ")
                          : "Nenhuma matrícula escolar registrada",
                      },
                    ]}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-medium">É este o aluno?</span>
                    <Button
                      size="sm"
                      variant={draft.identityConfirmed ? "default" : "outline"}
                      onClick={() => update({ identityConfirmed: true })}
                    >
                      Sim, confirmar identidade
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        update({ studentId: null, identityConfirmed: false, unitId: null })
                      }
                    >
                      Não, escolher outro aluno
                    </Button>
                    {draft.identityConfirmed ? (
                      <StatusBadge tone="success">Identidade confirmada</StatusBadge>
                    ) : null}
                  </div>
                  <FieldError issue={issueOf("identityConfirmed")} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione um aluno na etapa anterior para confirmar a identidade.
                </p>
              )}
            </DetailSection>
          </section>

          {/* 3. SELECIONAR UNIDADE */}
          <section id="unidade" aria-labelledby="unidade-title">
            <DetailSection
              title="Selecionar unidade escolar"
              description="A unidade é tratada como instituição. Prédio, anexo, sala e turma não são definidos aqui."
              titleId="unidade-title"
            >
              <div className="max-w-xl">
                <Label htmlFor="unit-select">Unidade escolar de destino</Label>
                <Select
                  value={draft.unitId ?? ""}
                  onValueChange={(value) => update({ unitId: value })}
                >
                  <SelectTrigger id="unit-select" className="mt-1 h-9">
                    <SelectValue placeholder="Selecione a unidade escolar" />
                  </SelectTrigger>
                  <SelectContent>
                    {demonstrationUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.currentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError issue={issueOf("unitId")} />
              </div>
            </DetailSection>
          </section>

          {/* 4. VERIFICAR RELAÇÃO ANTERIOR */}
          <section id="relacao" aria-labelledby="relacao-title">
            <DetailSection
              title="Verificar relação anterior com a unidade"
              description="Verificação demonstrativa da matrícula escolar do aluno nesta unidade. A matrícula escolar é permanente e não termina ao final do ano."
              titleId="relacao-title"
            >
              {relation ? (
                <div className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge
                      tone={
                        relation.scenario === "primeiro-ingresso"
                          ? "info"
                          : relation.scenario === "retorno"
                            ? "warning"
                            : "success"
                      }
                    >
                      {relation.label}
                    </StatusBadge>
                    <span className="font-medium">{relation.message}</span>
                  </div>
                  <p className="text-muted-foreground">{relation.detail}</p>

                  {relation.enrollment ? (
                    <div className="border border-border px-3 py-2">
                      <DefinitionList
                        items={[
                          {
                            term: "Identificador da matrícula escolar",
                            detail: (
                              <span className="font-mono text-tabular">
                                {relation.enrollment.number}
                              </span>
                            ),
                          },
                          {
                            term: "Unidade registrada",
                            detail: relation.enrollment.unitNameAtTime,
                          },
                          {
                            term: "Situação da matrícula escolar",
                            detail: `${relation.enrollment.situation} · aberta em ${relation.enrollment.openedAt}${
                              relation.enrollment.closedAt
                                ? ` · encerrada em ${relation.enrollment.closedAt}`
                                : ""
                            }`,
                          },
                          {
                            term: "Vínculos letivos já registrados",
                            detail: `${academicLinkCount(relation.enrollment)} vínculo(s) letivo(s) dentro desta mesma matrícula escolar`,
                          },
                          {
                            term: "Próximo passo conceitual",
                            detail:
                              "A abertura de vínculo letivo, participação e alocação em turma pertence a fluxo posterior, ainda não implementado.",
                          },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="border border-border px-3 py-2">
                      <p className="font-medium">
                        Será preparado: Aluno → Matrícula Escolar → {unitName(draft.unitId)}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Identificador da matrícula escolar: {NEW_ENROLLMENT_IDENTIFIER_NOTE}
                      </p>
                    </div>
                  )}

                  {relation.otherUnits.length ? (
                    <div className="border border-border bg-muted/40 px-3 py-2" role="note">
                      <p className="font-medium">
                        {issueOf("outraUnidade")?.message ?? "Relação em outra unidade"}
                      </p>
                      <ul className="mt-1 space-y-1" aria-label="Relações em outras unidades">
                        {relation.otherUnits.map((enrollment) => (
                          <li key={enrollment.id} className="text-muted-foreground">
                            <span className="font-mono text-tabular">{enrollment.number}</span> ·{" "}
                            {enrollment.unitNameAtTime} · {enrollment.situation}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-muted-foreground">
                        Nenhuma transferência é assumida, nada é encerrado automaticamente e nada é
                        bloqueado por esta tela.
                      </p>
                    </div>
                  ) : null}

                  {relation.scenario === "matricula-existente" ? (
                    <p className="text-destructive" role="alert">
                      {issueOf("duplicidade")?.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione o aluno e a unidade escolar para verificar a relação anterior.
                </p>
              )}
            </DetailSection>
          </section>

          {/* 5. DEFINIR INGRESSO */}
          <section id="ingresso" aria-labelledby="ingresso-title">
            <DetailSection
              title="Definir ingresso"
              description="Contexto demonstrativo do ingresso. Nenhuma regra municipal de calendário e nenhuma taxonomia oficial de origem é assumida."
              titleId="ingresso-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="entry-date">Data de ingresso (dd/mm/aaaa)</Label>
                  <Input
                    id="entry-date"
                    className="mt-1 h-9"
                    placeholder="dd/mm/aaaa"
                    value={draft.entryDate}
                    onChange={(event) => update({ entryDate: event.target.value })}
                  />
                  <FieldError issue={issueOf("entryDate")} />
                </div>
                <div>
                  <Label htmlFor="entry-form">Forma de ingresso (demonstrativa)</Label>
                  <Select
                    value={draft.entryForm}
                    onValueChange={(value) => update({ entryForm: value })}
                  >
                    <SelectTrigger id="entry-form" className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRY_FORM_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="context-note">Observação de contexto (opcional)</Label>
                <Textarea
                  id="context-note"
                  className="mt-1"
                  value={draft.contextNote}
                  onChange={(event) => update({ contextNote: event.target.value })}
                />
              </div>
            </DetailSection>
          </section>

          {/* DOCUMENTAÇÃO — área futura */}
          <section id="documentacao" aria-labelledby="documentacao-title">
            <DetailSection
              title="Documentação de ingresso (área futura)"
              description="Nenhuma lista oficial de documentos é definida nesta etapa e nada bloqueia a conclusão por documentação."
              titleId="documentacao-title"
            >
              <FutureAreaLink>Documentação de ingresso</FutureAreaLink>
            </DetailSection>
          </section>

          {/* 6. REVISÃO */}
          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisar e concluir"
              description="Resumo antes da conclusão demonstrativa."
              titleId="revisao-title"
            >
              <DefinitionList
                items={[
                  { term: "Aluno selecionado", detail: selected?.displayName ?? "Não selecionado" },
                  {
                    term: "Identificador SIGEM do aluno",
                    detail: selected ? (
                      <span className="font-mono text-tabular">{selected.sigemId}</span>
                    ) : (
                      "Não selecionado"
                    ),
                  },
                  {
                    term: "Identidade confirmada",
                    detail: draft.identityConfirmed ? "Sim" : "Ainda não confirmada",
                  },
                  { term: "Unidade escolar", detail: unitName(draft.unitId) },
                  {
                    term: "Matrícula escolar anterior nesta unidade",
                    detail: relation
                      ? relation.enrollment
                        ? `${relation.enrollment.number} (${relation.enrollment.situation})`
                        : "Nenhuma matrícula escolar anterior nesta unidade"
                      : "Verificação pendente",
                  },
                  {
                    term: "Matrícula escolar resultante",
                    detail: relation
                      ? canCreate
                        ? "Nova matrícula escolar demonstrativa será preparada"
                        : `Matrícula escolar existente ${relation.enrollment?.number ?? ""} será reutilizada`
                      : "Indefinida",
                  },
                  {
                    term: "Contexto do ingresso",
                    detail: `${draft.entryDate.trim() || "Data não informada"} · ${draft.entryForm}`,
                  },
                ]}
              />

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
                {ENROLLMENT_SCOPE_NOTE}
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
              descartado e nenhuma matrícula escolar existente é alterada.
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
                : canCreate
                  ? "Criar matrícula escolar (demonstrativo)"
                  : "Utilizar matrícula escolar existente (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? canCreate
                  ? "Matrícula escolar demonstrativa preparada. Nenhum vínculo letivo ou enturmação foi criado e nada foi persistido."
                  : "Matrícula escolar existente mantida. Nenhuma segunda matrícula permanente foi criada, nenhum vínculo letivo ou enturmação foi criado e nada foi persistido."
                : ENROLLMENT_SCOPE_NOTE}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {unitName(draft.unitId)} · {relation?.label ?? "Relação não verificada"} ·{" "}
            {warnings.length} aviso(s).
          </div>
          <DialogFooter>
            {concluded ? (
              <>
                {draft.studentId && relation?.enrollment ? (
                  <Button asChild variant="outline">
                    <Link
                      to="/vinculos-letivos/novo"
                      search={{ aluno: draft.studentId, matricula: relation.enrollment.id }}
                    >
                      Criar vínculo letivo
                    </Link>
                  </Button>
                ) : null}
                <Button onClick={leave}>
                  {draft.studentId ? "Voltar para o aluno" : "Voltar para alunos"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Continuar editando
                </Button>
                <Button onClick={() => setConcluded(true)}>
                  {canCreate ? "Confirmar criação" : "Confirmar uso da matrícula existente"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
