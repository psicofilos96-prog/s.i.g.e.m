import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, LockKeyhole } from "lucide-react";
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
import {
  ASSIGNMENT_AUTHORIZATION_NOTE,
  ASSIGNMENT_CLOSE_SECTIONS,
  ASSIGNMENT_VERSION_CONFLICT,
  assignmentSituationLabel,
  blankCloseDraft,
  getAssignmentContext,
  isAssignmentDirty,
  validateCloseDraft,
} from "./assignment-draft";
import { Field } from "./posting-form-fields";

export function AssignmentClosePage({
  professionalId,
  linkId,
  assignmentId,
}: {
  professionalId: string;
  linkId: string;
  assignmentId: string;
}) {
  const { professional, link, assignment } = getAssignmentContext(
    professionalId,
    linkId,
    assignmentId,
  );
  const initial = useMemo(() => blankCloseDraft(), []);
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();
  if (!professional || !link || !assignment)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Atribuição de função não encontrada"
          description="A atribuição não pertence ao vínculo funcional informado ou não existe nos dados fictícios."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id" params={{ id: professionalId }}>
                Voltar ao profissional
              </Link>
            </Button>
          }
        />
      </div>
    );
  const dirty = isAssignmentDirty(draft, initial);
  const errors = validateCloseDraft(draft, assignment);
  const leave = () =>
    void navigate({
      to: "/profissionais/$id/vinculos/$vinculoId/funcoes",
      params: { id: professionalId, vinculoId: linkId },
    });
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Encerrar atribuição de função"
        description="Encerramento demonstrativo que define término e preserva o histórico. Não encerra o Vínculo, não encerra a Lotação e não altera o Cargo."
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
            <Button size="sm" disabled={errors.length > 0} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 />
              Encerrar atribuição de função
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
        <nav aria-label="Seções do encerramento" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {ASSIGNMENT_CLOSE_SECTIONS.map(([id, label], index) => (
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
          <section id="atribuicao">
            <DetailSection
              title="Atribuição a encerrar"
              description="Situação, contexto e vigência atuais da atribuição."
            >
              <DefinitionList
                items={[
                  { term: "Profissional", detail: professional.personName },
                  {
                    term: "Vínculo",
                    detail: link.functionalIdentifier || "Sem matrícula funcional",
                  },
                  { term: "Cargo (somente leitura)", detail: link.cargo },
                  { term: "Função", detail: assignment.name },
                  { term: "Contexto institucional", detail: assignment.context },
                  { term: "Início", detail: assignment.start },
                  { term: "Situação atual", detail: assignmentSituationLabel(assignment) },
                ]}
              />
            </DetailSection>
          </section>
          <section id="termino">
            <DetailSection
              title="Término"
              description="O encerramento define o término da atribuição e não apaga o registro."
            >
              <div className="max-w-64">
                <Field
                  id="close-end"
                  label="Data de término"
                  value={draft.endDate}
                  onChange={(endDate) => setDraft((current) => ({ ...current, endDate }))}
                  type="date"
                />
              </div>
            </DetailSection>
          </section>
          <section id="referencia">
            <DetailSection
              title="Referência administrativa"
              description="Referência ao ato ou documento é opcional."
            >
              <div className="max-w-md">
                <Field
                  id="close-reference"
                  label="Referência ao ato ou documento (opcional)"
                  value={draft.administrativeReference}
                  onChange={(administrativeReference) =>
                    setDraft((current) => ({ ...current, administrativeReference }))
                  }
                  hint="Nenhuma portaria fictícia é exigida. Exoneração e dispensa jurídicas não estão implementadas."
                />
              </div>
            </DetailSection>
          </section>
          <section id="efeitos">
            <DetailSection
              title="Efeitos preservados"
              description="O que permanece intacto após o encerramento."
            >
              <ul aria-label="Efeitos preservados do encerramento" className="space-y-1 text-sm">
                <li>O histórico da atribuição é preservado e permanece consultável.</li>
                <li>O Vínculo Funcional não é encerrado.</li>
                <li>A Lotação não é encerrada.</li>
                <li>O Cargo não é alterado.</li>
                <li>Pessoa e Profissional não são excluídos.</li>
                <li>
                  Nenhum retorno automático a uma atuação pedagógica específica é presumido; o
                  profissional pode retornar às atividades anteriores sem recriação de registros.
                </li>
              </ul>
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão DE / PARA"
              description="Mudança de função é encerramento da atribuição anterior e criação de outra quando pertinente."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">DE</h3>
                  <p className="mt-1 text-sm">{assignment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.context} · início {assignment.start} · término{" "}
                    {assignment.end ?? "sem término informado"}
                  </p>
                </div>
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">PARA</h3>
                  <p className="mt-1 text-sm">Atribuição encerrada</p>
                  <p className="text-xs text-muted-foreground">
                    Término {draft.endDate || "a informar"} ·{" "}
                    {draft.administrativeReference || "sem referência administrativa"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm">
                Esta operação encerra a atribuição selecionada, preserva o histórico e não altera
                Cargo, Lotação nem Atuação Pedagógica. Nova designação, quando pertinente, é
                registrada como outra atribuição.
              </p>
              {errors.length ? (
                <ul aria-label="Pendências do encerramento" className="mt-4 space-y-1 text-xs">
                  {errors.map((error) => (
                    <li key={error} className="flex gap-2">
                      <CircleAlert className="size-3.5 text-destructive" />
                      {error}
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
              O preenchimento demonstrativo será descartado; nenhuma atribuição será encerrada.
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
                ? "Encerramento demonstrativo preparado"
                : "Encerrar atribuição de função (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Encerramento demonstrativo preparado. O histórico da atribuição foi preservado."
                : "A operação não persiste dados, não encerra o vínculo, não encerra a lotação e não altera o cargo."}
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
                <Button onClick={() => setConcluded(true)}>Confirmar encerramento</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
