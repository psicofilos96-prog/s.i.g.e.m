import { useMemo, useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, LockKeyhole, TriangleAlert } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ASSIGNMENT_AUTHORIZATION_NOTE,
  ASSIGNMENT_SECTIONS,
  ASSIGNMENT_VERSION_CONFLICT,
  assessAssignmentConflicts,
  assessAssignmentHours,
  assignmentChanges,
  assignmentSituationLabel,
  blankAssignmentDraft,
  draftFromAssignment,
  getAssignmentContext,
  isAssignmentDirty,
  validateAssignmentDraft,
  type AssignmentDraft,
} from "./assignment-draft";
import {
  AssignmentContextPicker,
  ContextualHoursField,
  FunctionPicker,
  RelatedPostingPicker,
} from "./assignment-form-fields";
import { ConflictPanel, Field } from "./posting-form-fields";
import { linkIsClosed, postingSituationLabel } from "./posting-draft";

export function AssignmentWorkspacePage({
  mode,
  professionalId,
  linkId,
  assignmentId,
}: {
  mode: "nova" | "edicao";
  professionalId: string;
  linkId: string;
  assignmentId?: string;
}) {
  const { professional, link, assignment, identity } = getAssignmentContext(
    professionalId,
    linkId,
    assignmentId,
  );
  const initial = useMemo(
    () =>
      mode === "edicao" && assignment ? draftFromAssignment(assignment) : blankAssignmentDraft(),
    [mode, assignment],
  );
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();
  if (!professional || !link || (mode === "edicao" && !assignment))
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title={
            link ? "Atribuição de função não encontrada" : "Vínculo funcional existente obrigatório"
          }
          description={
            link
              ? "A atribuição informada não pertence a este vínculo funcional."
              : "Não é possível criar Atribuição de Função sem Vínculo Funcional. Registre o vínculo antes de designar a função."
          }
          action={
            <Button asChild variant="outline">
              <Link
                to={
                  link
                    ? "/profissionais/$id/vinculos/$vinculoId/funcoes"
                    : "/profissionais/$id/vinculos/novo"
                }
                params={
                  link
                    ? { id: professionalId, vinculoId: linkId }
                    : ({ id: professionalId } as never)
                }
              >
                {link ? "Voltar às atribuições" : "Ir para novo vínculo funcional"}
              </Link>
            </Button>
          }
        />
      </div>
    );
  const update = (patch: Partial<AssignmentDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const dirty = isAssignmentDirty(draft, initial);
  const errors = validateAssignmentDraft(draft);
  const conflicts = assessAssignmentConflicts(link, draft, {
    excludeAssignmentId: assignment?.id,
  });
  const strongConflict = conflicts.some((item) => item.level === "forte");
  const hours = assessAssignmentHours(link, draft);
  const changes = assignmentChanges(draft, initial);
  const designationChange =
    mode === "edicao" &&
    (draft.functionName !== initial.functionName || draft.context !== initial.context);
  const leave = () =>
    void navigate({
      to: "/profissionais/$id/vinculos/$vinculoId/funcoes",
      params: { id: professionalId, vinculoId: linkId },
    });
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={mode === "nova" ? "Nova atribuição de função" : "Editar atribuição de função"}
        description="Workspace demonstrativo de Atribuição de Função a partir de Pessoa → Profissional → Vínculo Funcional existentes. Não altera Cargo ou Lotação e não cria Atuação Pedagógica."
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (dirty ? setExitOpen(true) : leave())}
            >
              Sair do workspace
            </Button>
            <Button
              size="sm"
              disabled={errors.length > 0 || strongConflict}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 />
              {mode === "nova" ? "Registrar atribuição de função" : "Concluir edição"}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3 text-xs">
        <StatusBadge tone={dirty ? "warning" : "neutral"}>
          {dirty ? "Alterações não salvas" : "Sem alterações"}
        </StatusBadge>
        <span className="text-muted-foreground">Demonstração sem persistência</span>
      </div>
      <div className="grid gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Seções da atribuição" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {ASSIGNMENT_SECTIONS.map(([id, label], index) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <span className="mr-2 font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0">
          <section id="profissional">
            <DetailSection
              title="Profissional e vínculo"
              description="Nenhuma Pessoa ou papel Profissional será criado nesta operação; o Cargo é somente leitura."
            >
              <DefinitionList
                items={[
                  { term: "Pessoa", detail: professional.personName },
                  {
                    term: "Identificador SIGEM",
                    detail: identity?.sigemId ?? professional.personId,
                  },
                  { term: "Profissional", detail: professional.professionalId },
                  {
                    term: "Matrícula funcional",
                    detail: link.functionalIdentifier || "Não informada neste contexto",
                  },
                  { term: "Cargo (somente leitura)", detail: link.cargo },
                  {
                    term: "Vigência do vínculo",
                    detail: `${formatAcademicDate(link.start)} — ${formatAcademicDate(link.end, "em andamento")}`,
                  },
                  { term: "Carga do vínculo", detail: link.weeklyHours ?? "Não informada" },
                ]}
              />
              {linkIsClosed(link) ? (
                <p role="note" className="mt-3 border border-border bg-muted/40 p-3 text-xs">
                  Vínculo funcional encerrado. As atribuições históricas permanecem consultáveis e
                  nova atribuição posterior ao término não é aceita.
                </p>
              ) : null}
            </DetailSection>
          </section>
          <section id="funcao">
            <DetailSection
              title="Função"
              description="A Função tem identidade própria; a Atribuição é o seu exercício em um contexto e intervalo."
            >
              <FunctionPicker
                value={draft.functionName}
                onChange={(functionName) => update({ functionName })}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Exemplo demonstrativo: Cargo {link.cargo} com função atribuída{" "}
                {draft.functionName || "a selecionar"}. A atribuição não altera o Cargo.
              </p>
            </DetailSection>
          </section>
          <section id="contexto">
            <DetailSection
              title="Contexto institucional"
              description="Unidade escolar, órgão central, setor administrativo ou outro contexto organizacional."
            >
              <AssignmentContextPicker
                contextKind={draft.contextKind}
                context={draft.context}
                onContextKind={(contextKind) => update({ contextKind })}
                onContext={(context) => update({ context })}
              />
            </DetailSection>
          </section>
          <section id="lotacao">
            <DetailSection
              title="Lotação relacionada"
              description="As lotações orientam a atribuição; nenhuma lotação é criada ou movimentada aqui."
            >
              {link.allocations.length ? (
                <ul
                  className="mb-4 divide-y divide-border border-y border-border"
                  aria-label="Lotações atuais e históricas do vínculo"
                >
                  {link.allocations.map((posting) => (
                    <li key={posting.id} className="py-2 text-xs">
                      <strong>{postingSituationLabel(posting)}:</strong> {posting.place} ·{" "}
                      {formatAcademicDate(posting.start)} —{" "}
                      {formatAcademicDate(posting.end, "em andamento")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4 text-sm text-muted-foreground">
                  Nenhuma lotação registrada neste vínculo. A função pode ser atribuída sem lotação
                  específica.
                </p>
              )}
              <RelatedPostingPicker
                postings={link.allocations}
                value={draft.postingId}
                onChange={(postingId) => update({ postingId })}
              />
            </DetailSection>
          </section>
          <section id="vigencia">
            <DetailSection
              title="Vigência"
              description="Cada atribuição tem temporalidade própria, compatível com a vigência do vínculo."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="assignment-start"
                  label="Data de início"
                  value={draft.start}
                  onChange={(start) => update({ start })}
                  type="date"
                />
                <Field
                  id="assignment-end"
                  label="Data de término (opcional)"
                  value={draft.end}
                  onChange={(end) => update({ end })}
                  type="date"
                />
              </div>
            </DetailSection>
          </section>
          <section id="carga">
            <DetailSection
              title="Carga contextual"
              description="Não se presume que a função consome toda a carga horária do vínculo."
            >
              <ContextualHoursField
                hoursMode={draft.hoursMode}
                hours={draft.contextualHours}
                onHoursMode={(hoursMode) => update({ hoursMode })}
                onHours={(contextualHours) => update({ contextualHours })}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {hours.title} Nenhuma folha, gratificação ou distribuição oficial de carga é
                calculada.
              </p>
            </DetailSection>
          </section>
          <section id="referencia">
            <DetailSection
              title="Referência administrativa"
              description="Área opcional para o ato ou documento que fundamenta a atribuição."
            >
              <div className="max-w-md">
                <Field
                  id="assignment-reference"
                  label="Referência ao ato ou documento (opcional)"
                  value={draft.administrativeReference}
                  onChange={(administrativeReference) => update({ administrativeReference })}
                  hint="Função, Atribuição, referência documental e período de vigência são conceitos distintos. Nenhuma portaria fictícia é exigida e nenhum motor de atos administrativos foi implementado."
                />
              </div>
            </DetailSection>
          </section>
          <section id="existentes">
            <DetailSection
              title="Atribuições existentes"
              description="Nova designação não reescreve atribuições históricas."
            >
              {link.functions.length ? (
                <ul
                  className="divide-y divide-border border-y border-border"
                  aria-label="Atribuições existentes do vínculo"
                >
                  {link.functions.map((item) => (
                    <li key={item.id} className="py-2 text-xs">
                      <strong>{assignmentSituationLabel(item)}:</strong> {item.name} ·{" "}
                      {item.context} · {item.start} — {formatAcademicDate(item.end, "em andamento")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma atribuição de função registrada para este vínculo.
                </p>
              )}
            </DetailSection>
          </section>
          <section id="conflitos">
            <DetailSection
              title="Conflitos e avisos"
              description="Conflito forte apenas para incompatibilidade estrutural; os demais são avisos de validação."
            >
              <ConflictPanel conflicts={conflicts} label="Conflitos e avisos da atribuição" />
              <p className="mt-3 text-xs text-muted-foreground">{hours.detail}</p>
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão"
              description="Profissional, vínculo, cargo, função, contexto, lotação, vigência, carga, referência e avisos."
            >
              <DefinitionList
                items={[
                  {
                    term: "Profissional",
                    detail: `${professional.personName} · ${professional.professionalId}`,
                  },
                  {
                    term: "Vínculo",
                    detail: `${link.functionalIdentifier || "Sem matrícula funcional"} · ${formatAcademicDate(link.start)} — ${formatAcademicDate(link.end, "em andamento")}`,
                  },
                  { term: "Cargo", detail: `${link.cargo} (não alterado por esta operação)` },
                  { term: "Função", detail: draft.functionName || "Função pendente" },
                  {
                    term: "Contexto institucional",
                    detail: draft.context || "Contexto pendente",
                  },
                  {
                    term: "Lotação relacionada",
                    detail:
                      link.allocations.find((item) => item.id === draft.postingId)?.place ??
                      "Sem lotação específica relacionada",
                  },
                  {
                    term: "Vigência",
                    detail: `${formatAcademicDate(draft.start, "início pendente")} — ${formatAcademicDate(draft.end, "sem término")}`,
                  },
                  { term: "Carga contextual", detail: hours.title },
                  {
                    term: "Referência administrativa",
                    detail: draft.administrativeReference || "Não informada (opcional)",
                  },
                  {
                    term: "Atribuições simultâneas",
                    detail: link.functions.filter((item) => item.status === "Atual").length
                      ? link.functions
                          .filter((item) => item.status === "Atual")
                          .map((item) => `${item.name} · ${item.context}`)
                          .join("; ")
                      : "Nenhuma atribuição atual neste vínculo",
                  },
                  {
                    term: "Avisos e pendências",
                    detail: conflicts.length
                      ? conflicts.map((item) => item.title).join(" ")
                      : "Nenhum aviso identificado nesta demonstração.",
                  },
                  {
                    term: "Escopo",
                    detail:
                      "Esta operação não altera Cargo ou Lotação e não cria Atuação Pedagógica.",
                  },
                ]}
              />
              {mode === "edicao" ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Natureza da alteração</h3>
                  <RadioGroup
                    value={draft.changeNature}
                    onValueChange={(value) =>
                      update({ changeNature: value as "correcao" | "designacao" })
                    }
                    className="mt-2"
                  >
                    <Label className="flex items-center gap-2">
                      <RadioGroupItem value="correcao" />
                      Correção administrativa da atribuição
                    </Label>
                    <Label className="flex items-center gap-2">
                      <RadioGroupItem value="designacao" />
                      Alteração que representa nova designação
                    </Label>
                  </RadioGroup>
                  {designationChange ? (
                    <div
                      role="alert"
                      className="mt-3 border border-warning/40 bg-warning/10 p-3 text-sm"
                    >
                      <TriangleAlert className="mr-2 inline size-4" />
                      Alterar Função ou contexto institucional representa nova designação. A edição
                      comum não deve substituir silenciosamente a atribuição histórica: encerre a
                      atribuição atual e registre outra, preservando o registro anterior.
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/encerrar"
                            params={{
                              id: professional.id,
                              vinculoId: link.id,
                              atribuicaoId: assignment?.id ?? "",
                            }}
                          >
                            Ir para encerramento da atribuição
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/profissionais/$id/vinculos/$vinculoId/funcoes/nova"
                            params={{ id: professional.id, vinculoId: link.id }}
                          >
                            Registrar nova atribuição
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {changes.length ? (
                    <ul aria-label="Alterações da atribuição" className="mt-3 space-y-1 text-xs">
                      {changes.map((item) => (
                        <li key={item.field}>
                          {item.field}: {item.from} → {item.to} ({item.nature})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setVersionConflict(true)}
                  >
                    Simular conflito de versão
                  </Button>
                  {versionConflict ? (
                    <p role="alert" className="mt-2 border border-border p-3 text-sm">
                      {ASSIGNMENT_VERSION_CONFLICT} A futura implementação deverá revalidar versão e
                      estado temporal antes da conclusão.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {errors.length ? (
                <ul aria-label="Pendências da atribuição" className="mt-4 space-y-1 text-xs">
                  {errors.map((error) => (
                    <li key={error} className="flex gap-2">
                      <CircleAlert className="size-3.5 text-destructive" />
                      {error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </DetailSection>
          </section>
          <section id="conclusao">
            <DetailSection
              title="Conclusão demonstrativa"
              description="Nenhum dado será persistido."
            >
              <p className="text-sm">{ASSIGNMENT_AUTHORIZATION_NOTE}</p>
              <Button className="mt-3" variant="outline" disabled>
                <LockKeyhole />
                Próxima ação: Atuação Pedagógica
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Atuação Pedagógica será tratada na Etapa 9E.
              </p>
            </DetailSection>
          </section>
        </div>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              O preenchimento demonstrativo será descartado; nenhuma atribuição será alterada.
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
                ? "Atribuição de função demonstrativa preparada"
                : mode === "nova"
                  ? "Registrar atribuição de função (demonstrativo)"
                  : "Concluir edição (demonstrativa)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Atribuição de função demonstrativa preparada. Nenhum cargo, lotação ou atuação pedagógica foi alterado."
                : "A operação não persiste dados e preserva Pessoa, Profissional, Vínculo, Cargo, Lotações e o histórico."}
            </DialogDescription>
          </DialogHeader>
          {concluded ? (
            <div className="border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Próxima ação: Atuação Pedagógica.</p>
              <p className="mt-1 text-xs text-muted-foreground">Preparada para a Etapa 9E.</p>
            </div>
          ) : null}
          <DialogFooter>
            {concluded ? (
              <Button onClick={leave}>Voltar às atribuições</Button>
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
