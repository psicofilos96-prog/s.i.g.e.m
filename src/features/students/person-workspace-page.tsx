import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, TriangleAlert } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
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
import { getDemonstrationStudent } from "@/features/students/students-data";
import {
  ADMINISTRATIVE_SEX_OPTIONS,
  IDENTITY_VERIFICATION_LABEL,
  PERSON_SCOPE_NOTE,
  PERSON_WORKSPACE_SECTIONS,
  RESPONSIBILITY_RELATIONS,
  SENSITIVE_DATA_NOTE,
  createBlankPersonDraft,
  createPersonDraftFrom,
  findPossibleMatches,
  getPersonByStudentId,
  isPersonDraftDirty,
  maskIdentifier,
  personDraftChanges,
  personIssueFor,
  validatePersonDraft,
  type PersonDraft,
  type PersonDraftIssue,
  type PersonMatch,
} from "@/features/students/person-draft";

export type PersonWorkspaceMode = "novo" | "edicao";

function FieldError({ issue }: { issue?: PersonDraftIssue | undefined }) {
  if (!issue) return null;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {issue.message}
    </span>
  );
}

export function PersonWorkspacePage({
  mode,
  originId,
}: {
  mode: PersonWorkspaceMode;
  originId?: string;
}) {
  const originStudent = originId ? getDemonstrationStudent(originId) : undefined;
  const originPerson = originId ? getPersonByStudentId(originId) : undefined;
  const initialDraft = useMemo<PersonDraft | null>(() => {
    if (mode === "novo") return createBlankPersonDraft();
    if (!originPerson) return null;
    return createPersonDraftFrom(originPerson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, originId]);

  const [draft, setDraft] = useState<PersonDraft | null>(initialDraft);
  const [reviewMatch, setReviewMatch] = useState<PersonMatch | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    void navigate({ to: "/alunos" });
  }

  if (!draft || !initialDraft) {
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Cadastro não encontrado"
          description="O identificador informado não corresponde às pessoas fictícias disponíveis no cadastro mestre."
          action={
            <Button asChild variant="outline">
              <Link to="/alunos">Voltar para alunos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const current: PersonDraft = draft;
  const matches = findPossibleMatches(draft);
  const issues = validatePersonDraft(draft, matches);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "aviso");
  const dirty = isPersonDraftDirty(draft, initialDraft);
  const changes = personDraftChanges(draft, initialDraft);

  function update(patch: Partial<PersonDraft>) {
    setDraft({ ...current, ...patch });
  }

  function dismissMatch(match: PersonMatch) {
    update({ dismissedMatchIds: [...current.dismissedMatchIds, match.person.id] });
    setReviewMatch(null);
  }

  const title =
    mode === "novo"
      ? "Novo aluno (cadastro demonstrativo de pessoa)"
      : `Editar cadastro — ${originPerson?.fullName ?? "pessoa"}`;

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={title}
        description="Workspace por seções da identidade Pessoa/Aluno. Esta etapa não trata de matrícula escolar, vínculo letivo, participação ou turma, e nada é persistido."
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
              <CheckCircle2 /> {mode === "novo" ? "Concluir cadastro" : "Concluir alterações"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Cadastro demonstrativo</StatusBadge>
        <span className="text-muted-foreground">
          {mode === "novo"
            ? "Pessoa em cadastro, ainda sem identidade registrada no SIGEM"
            : `Identificador permanente ${originStudent?.sigemId ?? "—"} preservado`}
        </span>
        {matches.length ? (
          <StatusBadge tone="info">{IDENTITY_VERIFICATION_LABEL}</StatusBadge>
        ) : null}
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
        <nav aria-label="Seções do cadastro" className="min-w-0">
          <ul className="sticky top-20 space-y-1 text-xs">
            {PERSON_WORKSPACE_SECTIONS.map((section) => (
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
          <section id="identificacao" aria-labelledby="identificacao-title">
            <DetailSection
              title="Identificação"
              description="A pessoa é a identidade humana canônica; o aluno é o papel educacional dessa pessoa no SIGEM. Mudança de escola, turma, período letivo ou retorno à rede não gera nova pessoa."
              titleId="identificacao-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="full-name">Nome completo</Label>
                  <Input
                    id="full-name"
                    className="mt-1 h-9"
                    value={draft.fullName}
                    onChange={(event) => update({ fullName: event.target.value })}
                  />
                  <FieldError issue={personIssueFor(issues, "fullName")} />
                </div>
                <div>
                  <Label htmlFor="social-name">Nome social (quando aplicável)</Label>
                  <Input
                    id="social-name"
                    className="mt-1 h-9"
                    value={draft.socialName}
                    onChange={(event) => update({ socialName: event.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    O nome social passa a ser o nome de tratamento sem sugerir que documentos
                    antigos foram emitidos com ele.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <DefinitionList
                  items={[
                    {
                      term: "Identificador SIGEM",
                      detail:
                        mode === "edicao" && originStudent ? (
                          <span className="font-mono text-tabular">{originStudent.sigemId}</span>
                        ) : (
                          "Gerado pelo SIGEM após conclusão do cadastro"
                        ),
                    },
                    {
                      term: "Natureza",
                      detail:
                        "Permanente e interno: não é matrícula escolar, não é matrícula anual e não é INEP ou outro identificador externo. Não muda quando a pessoa troca de escola.",
                    },
                  ]}
                />
              </div>
            </DetailSection>
          </section>

          <section id="pessoais" aria-labelledby="pessoais-title">
            <DetailSection
              title="Dados pessoais"
              description="Somente o necessário ao cadastro administrativo. Nenhum dado sensível é solicitado aqui."
              titleId="pessoais-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="birth-date">Data de nascimento (dd/mm/aaaa)</Label>
                  <Input
                    id="birth-date"
                    className="mt-1 h-9"
                    value={draft.birthDate}
                    placeholder="dd/mm/aaaa"
                    onChange={(event) => update({ birthDate: event.target.value })}
                  />
                  <FieldError issue={personIssueFor(issues, "birthDate")} />
                </div>
                <div>
                  <Label htmlFor="admin-sex">Sexo cadastral (uso administrativo)</Label>
                  <Select
                    {...(draft.administrativeSex ? { value: draft.administrativeSex } : {})}
                    onValueChange={(value) => update({ administrativeSex: value })}
                  >
                    <SelectTrigger id="admin-sex" aria-label="Sexo cadastral" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione quando necessário" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADMINISTRATIVE_SEX_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opções demonstrativas; nenhuma enumeração definitiva é assumida.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground" role="note">
                {SENSITIVE_DATA_NOTE}
              </p>
            </DetailSection>
          </section>

          <section id="identificadores" aria-labelledby="identificadores-title">
            <DetailSection
              title="Documentação e identificadores"
              description="Cada identificador tem significado próprio. Não existe campo genérico de documento, e nenhum identificador é requisito universal."
              titleId="identificadores-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cpf">CPF (quando existente)</Label>
                  <Input
                    id="cpf"
                    className="mt-1 h-9"
                    value={draft.cpf}
                    placeholder="000.000.000-00"
                    onChange={(event) => update({ cpf: event.target.value })}
                  />
                  <FieldError issue={personIssueFor(issues, "cpf")} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    CPF não é a identidade primária do aluno e não é exigido para concluir o
                    cadastro.
                  </p>
                </div>
                <div>
                  <Label htmlFor="external-id">Identificador educacional externo</Label>
                  <Input
                    id="external-id"
                    className="mt-1 h-9"
                    value={draft.educationalExternalId}
                    onChange={(event) => update({ educationalExternalId: event.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Externo à rede; distinto do identificador SIGEM.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="civil-registry">Documento civil cadastral</Label>
                  <Input
                    id="civil-registry"
                    className="mt-1 h-9"
                    value={draft.civilRegistry}
                    onChange={(event) => update({ civilRegistry: event.target.value })}
                  />
                </div>
              </div>
            </DetailSection>
          </section>

          <section id="contato" aria-labelledby="contato-title">
            <DetailSection
              title="Contato"
              description="Contato mínimo da pessoa. Relações de responsabilidade não são modeladas aqui."
              titleId="contato-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Telefone de contato</Label>
                  <Input
                    id="phone"
                    className="mt-1 h-9"
                    value={draft.contactPhone}
                    onChange={(event) => update({ contactPhone: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contact-note">Observação de contato (opcional)</Label>
                  <Textarea
                    id="contact-note"
                    className="mt-1"
                    rows={2}
                    value={draft.contactNote}
                    onChange={(event) => update({ contactNote: event.target.value })}
                  />
                </div>
              </div>
            </DetailSection>
          </section>

          <section id="duplicidade" aria-labelledby="duplicidade-title">
            <DetailSection
              title="Verificação de duplicidade"
              description="Verificação demonstrativa por combinações de nome, data de nascimento e identificadores. Nenhuma fusão automática ocorre e nenhum cadastro existente é sobrescrito."
              titleId="duplicidade-title"
            >
              {matches.length === 0 ? (
                <p className="text-xs text-muted-foreground" role="note">
                  Nenhum cadastro correspondente encontrado nos dados fictícios com as informações
                  atuais.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Encontramos possíveis cadastros correspondentes.
                  </p>
                  <ul
                    className="mt-3 divide-y divide-border border-y border-border"
                    aria-label="Possíveis cadastros correspondentes"
                  >
                    {matches.map((match) => (
                      <li key={match.person.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {match.person.fullName}
                          </span>
                          <StatusBadge tone={match.strength === "homonimo" ? "neutral" : "warning"}>
                            {match.strength === "homonimo"
                              ? "Possível homônimo"
                              : IDENTITY_VERIFICATION_LABEL}
                          </StatusBadge>
                          <span className="font-mono text-xs text-tabular text-muted-foreground">
                            {match.person.identifiers.sigemId}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{match.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nascimento {match.person.birthDate} · CPF{" "}
                          {maskIdentifier(match.person.identifiers.cpf)} · externo{" "}
                          {maskIdentifier(match.person.identifiers.educationalExternalId)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setReviewMatch(match)}>
                            Revisar possível cadastro
                          </Button>
                          {match.person.studentId ? (
                            <Button asChild size="sm" variant="ghost">
                              <Link to="/alunos/$id" params={{ id: match.person.studentId }}>
                                Abrir cadastro
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" disabled>
                              Cadastro sem papel de aluno
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => dismissMatch(match)}>
                            Não é a mesma pessoa
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => (dirty ? setExitOpen(true) : leave())}
                    >
                      Interromper este cadastro
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        update({ identityNeedsVerification: !current.identityNeedsVerification })
                      }
                    >
                      {draft.identityNeedsVerification
                        ? "Remover marcação de verificação"
                        : `Marcar como "${IDENTITY_VERIFICATION_LABEL}"`}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nomes iguais não caracterizam a mesma pessoa. Casos ambíguos seguem para
                    reconciliação humana, sem bloqueio automático.
                  </p>
                </>
              )}
              {draft.dismissedMatchIds.length ? (
                <p className="mt-3 text-xs text-muted-foreground" role="status">
                  {draft.dismissedMatchIds.length} candidato(s) marcados pelo operador como pessoa
                  diferente. Nenhum cadastro foi alterado.
                </p>
              ) : null}
            </DetailSection>
          </section>

          <section id="responsaveis" aria-labelledby="responsaveis-title">
            <DetailSection
              title="Responsáveis e relações (área futura)"
              description="Modelagem ainda não definida. Estas relações não são necessariamente a mesma pessoa e não serão reduzidas a um campo único de responsável."
              titleId="responsaveis-title"
            >
              <ul className="space-y-1 text-xs" aria-label="Relações de responsabilidade previstas">
                {RESPONSIBILITY_RELATIONS.map((relation) => (
                  <li key={relation} className="text-muted-foreground">
                    {relation} — relação própria, a ser modelada em etapa futura.
                  </li>
                ))}
              </ul>
              <div className="mt-3 max-w-xs">
                <FutureAreaLink>Cadastro de responsáveis</FutureAreaLink>
              </div>
            </DetailSection>
          </section>

          <section id="contextos" aria-labelledby="contextos-title">
            <DetailSection
              title="Necessidades e contextos específicos (área futura)"
              description="Fora do cadastro básico de identidade."
              titleId="contextos-title"
            >
              <p className="text-xs text-muted-foreground">{SENSITIVE_DATA_NOTE}</p>
              <div className="mt-3 max-w-xs">
                <FutureAreaLink>Contextos específicos</FutureAreaLink>
              </div>
            </DetailSection>
          </section>

          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisão"
              description="Resumo do cadastro antes da conclusão demonstrativa."
              titleId="revisao-title"
            >
              <DefinitionList
                items={[
                  { term: "Nome completo", detail: draft.fullName || "Não informado" },
                  { term: "Nome social", detail: draft.socialName || "Não informado" },
                  { term: "Nascimento", detail: draft.birthDate || "Não informado" },
                  { term: "Sexo cadastral", detail: draft.administrativeSex || "Não informado" },
                  {
                    term: "Identificador SIGEM",
                    detail:
                      mode === "edicao" && originStudent
                        ? originStudent.sigemId
                        : "Gerado pelo SIGEM após conclusão do cadastro",
                  },
                  { term: "CPF", detail: maskIdentifier(draft.cpf || null) },
                  {
                    term: "Identificador externo",
                    detail: maskIdentifier(draft.educationalExternalId || null),
                  },
                  { term: "Documento civil", detail: maskIdentifier(draft.civilRegistry || null) },
                  {
                    term: "Correspondências analisadas",
                    detail: `${matches.length} em aberto · ${draft.dismissedMatchIds.length} marcadas como pessoa diferente`,
                  },
                ]}
              />

              {mode === "edicao" ? (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold">Alterações do cadastro</h3>
                  {changes.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhuma alteração em relação ao cadastro atual.
                    </p>
                  ) : (
                    <ul
                      className="mt-2 divide-y divide-border border-y border-border text-xs"
                      aria-label="Alterações do cadastro"
                    >
                      {changes.map((change) => (
                        <li key={change.field} className="py-2">
                          <span className="font-medium">{change.field}</span>{" "}
                          <StatusBadge
                            tone={
                              change.nature === "Alteração histórica relevante" ? "warning" : "info"
                            }
                          >
                            {change.nature}
                          </StatusBadge>
                          <span className="mt-1 block text-muted-foreground">
                            {change.from} → {change.to}
                          </span>
                          {change.note ? (
                            <span className="block text-muted-foreground">{change.note}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Alterações ficam preparadas para auditoria futura: nada reescreve
                    silenciosamente o que já foi registrado.
                  </p>
                </div>
              ) : null}

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
                {PERSON_SCOPE_NOTE}
              </p>
            </DetailSection>
          </section>
        </div>
      </div>

      <Dialog
        open={Boolean(reviewMatch)}
        onOpenChange={(open) => (open ? null : setReviewMatch(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar possível cadastro correspondente</DialogTitle>
            <DialogDescription>
              Comparação mínima para decisão humana. Nenhuma fusão ocorre e o cadastro existente não
              é alterado por esta tela.
            </DialogDescription>
          </DialogHeader>
          {reviewMatch ? (
            <DefinitionList
              items={[
                { term: "Cadastro existente", detail: reviewMatch.person.fullName },
                { term: "Identificador SIGEM", detail: reviewMatch.person.identifiers.sigemId },
                { term: "Nascimento", detail: reviewMatch.person.birthDate },
                { term: "CPF", detail: maskIdentifier(reviewMatch.person.identifiers.cpf) },
                {
                  term: "Identificador externo",
                  detail: maskIdentifier(reviewMatch.person.identifiers.educationalExternalId),
                },
                { term: "Situação da identidade", detail: reviewMatch.person.roleNote },
                { term: "Motivo da correspondência", detail: reviewMatch.reason },
              ]}
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewMatch(null)}>
              Voltar ao cadastro
            </Button>
            {reviewMatch ? (
              <Button variant="ghost" onClick={() => dismissMatch(reviewMatch)}>
                Não é a mesma pessoa
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              O workspace não salva nem armazena dados nesta etapa. Ao sair, o preenchimento é
              descartado e nenhum cadastro existente é alterado.
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
                ? "Cadastro demonstrativo concluído"
                : mode === "novo"
                  ? "Concluir cadastro (demonstrativo)"
                  : "Concluir alterações (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Cadastro demonstrativo concluído. Nenhuma matrícula escolar foi criada, nenhum vínculo letivo foi aberto, nenhuma turma foi atribuída e nada foi persistido."
                : PERSON_SCOPE_NOTE}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {matches.length} correspondência(s) em aberto · {warnings.length} aviso(s) ·{" "}
            {changes.length} alteração(ões) registradas para auditoria futura.
          </div>
          <DialogFooter>
            {concluded ? (
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  leave();
                }}
              >
                Voltar para alunos
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Continuar editando
                </Button>
                <Button onClick={() => setConcluded(true)}>Confirmar conclusão</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
