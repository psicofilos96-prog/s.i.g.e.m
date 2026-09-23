import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleAlert, FileQuestion } from "lucide-react";
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
  MOVEMENT_SECTIONS,
  POSTING_AUTHORIZATION_NOTE,
  POSTING_VERSION_CONFLICT,
  assessMovementConflicts,
  blankMovementDraft,
  currentPostings,
  getPostingContext,
  isPostingDirty,
  postingSituationLabel,
  validateMovementDraft,
  type MovementDraft,
} from "./posting-draft";
import {
  ConflictPanel,
  DestinationPicker,
  DistributedHoursField,
  Field,
} from "./posting-form-fields";

export function PostingMovementPage({
  professionalId,
  linkId,
}: {
  professionalId: string;
  linkId: string;
}) {
  const { professional, link } = getPostingContext(professionalId, linkId);
  const initial = blankMovementDraft();
  const [draft, setDraft] = useState<MovementDraft>(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();
  if (!professional || !link)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Vínculo funcional existente obrigatório"
          description="A movimentação funcional exige Pessoa, Profissional e Vínculo Funcional existentes."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id/vinculos/novo" params={{ id: professionalId }}>
                Ir para novo vínculo funcional
              </Link>
            </Button>
          }
        />
      </div>
    );
  const update = (patch: Partial<MovementDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const origins = currentPostings(link);
  const origin = link.allocations.find((item) => item.id === draft.originId);
  const dirty = isPostingDirty(draft, initial);
  const errors = validateMovementDraft(draft);
  const conflicts = assessMovementConflicts(link, draft);
  const strongConflict = conflicts.some((item) => item.level === "forte");
  const preserved = origins.filter((item) => item.id !== draft.originId);
  const leave = () =>
    void navigate({
      to: "/profissionais/$id/vinculos/$vinculoId/lotacoes",
      params: { id: professionalId, vinculoId: linkId },
    });
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Movimentação funcional"
        description="Movimentar encerra uma lotação específica e cria outra em continuidade, preservando o histórico. Não é edição destrutiva nem lotação adicional."
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
              Concluir movimentação
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
      <div className="grid gap-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Seções da movimentação" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {MOVEMENT_SECTIONS.map(([id, label], index) => (
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
          <section id="origem">
            <DetailSection
              title="Lotação de origem"
              description="A operação exige uma lotação de origem explícita; as demais lotações do vínculo não são encerradas."
            >
              {origins.length ? (
                <RadioGroup
                  value={draft.originId}
                  onValueChange={(originId) => update({ originId })}
                  className="space-y-2"
                >
                  {origins.map((item) => (
                    <Label
                      key={item.id}
                      className="flex items-start gap-2 border border-border p-3 font-normal"
                    >
                      <RadioGroupItem value={item.id} aria-label={`Origem ${item.place}`} />
                      <span>
                        <span className="text-sm font-medium">{item.place}</span>
                        <span className="block text-xs text-muted-foreground">
                          {postingSituationLabel(item)} · {item.start} —{" "}
                          {item.end ?? "em andamento"} ·{" "}
                          {item.distributedHours ?? "Distribuição de carga horária não informada."}
                        </span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma lotação vigente para movimentar. Use “Adicionar lotação” para a primeira
                  lotação.
                </p>
              )}
              {preserved.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Lotações que permanecerão vigentes:{" "}
                  {preserved.map((item) => item.place).join("; ")}.
                </p>
              ) : null}
            </DetailSection>
          </section>
          <section id="destino">
            <DetailSection
              title="Nova lotação (destino)"
              description="O destino é uma unidade ou contexto organizacional existente."
            >
              <DestinationPicker
                contextKind={draft.contextKind}
                destination={draft.destination}
                onContextKind={(contextKind) => update({ contextKind })}
                onDestination={(destination) => update({ destination })}
              />
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold">Carga horária destinada à lotação</h3>
                <DistributedHoursField
                  hoursMode={draft.hoursMode}
                  hours={draft.distributedHours}
                  onHoursMode={(hoursMode) => update({ hoursMode })}
                  onHours={(distributedHours) => update({ distributedHours })}
                />
              </div>
            </DetailSection>
          </section>
          <section id="data">
            <DetailSection
              title="Data efetiva"
              description="A data efetiva encerra a lotação de origem e inicia a lotação de destino."
            >
              <div className="max-w-64">
                <Field
                  id="effective-date"
                  label="Data efetiva da movimentação"
                  value={draft.effectiveDate}
                  onChange={(effectiveDate) => update({ effectiveDate })}
                  type="date"
                />
              </div>
            </DetailSection>
          </section>
          <section id="conflitos">
            <DetailSection
              title="Compatibilidade e conflitos"
              description="Simultaneidade legítima em unidades distintas não é duplicidade."
            >
              <ConflictPanel conflicts={conflicts} label="Conflitos da movimentação" />
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
                  {POSTING_VERSION_CONFLICT} A futura operação de movimentação deverá revalidar a
                  versão antes da conclusão.
                </p>
              ) : null}
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão DE / PARA"
              description="Comparação explícita entre a lotação de origem e a lotação de destino."
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <div className="border border-border p-3" aria-label="DE — lotação atual">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">DE</p>
                  <DefinitionList
                    items={[
                      { term: "Unidade", detail: origin?.place ?? "Origem não selecionada" },
                      {
                        term: "Vigência",
                        detail: origin
                          ? `${origin.start} — ${draft.effectiveDate || "término pendente"}`
                          : "—",
                      },
                      {
                        term: "Carga contextual",
                        detail:
                          origin?.distributedHours ??
                          "Distribuição de carga horária não informada.",
                      },
                    ]}
                  />
                </div>
                <ArrowRight className="mx-auto hidden size-5 text-muted-foreground md:block" />
                <div className="border border-border p-3" aria-label="PARA — nova lotação">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">PARA</p>
                  <DefinitionList
                    items={[
                      { term: "Unidade", detail: draft.destination || "Destino pendente" },
                      { term: "Início", detail: draft.effectiveDate || "Data efetiva pendente" },
                      {
                        term: "Carga contextual",
                        detail:
                          draft.hoursMode === "informada"
                            ? `${draft.distributedHours || "—"} h destinadas`
                            : "Distribuição de carga horária não informada.",
                      },
                    ]}
                  />
                </div>
              </div>
              <p role="note" className="mt-4 border border-border bg-muted/40 p-3 text-sm">
                Esta operação encerra a lotação selecionada e cria uma nova lotação, preservando o
                histórico.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Atomicidade conceitual: validar o estado atual, encerrar a lotação de origem, criar a
                lotação de destino, registrar o ato pertinente, preservar o histórico e concluir tudo
                ou nada. Nenhum sucesso parcial é apresentado.
              </p>
              {errors.length ? (
                <ul aria-label="Pendências da movimentação" className="mt-4 space-y-1 text-xs">
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
              description="Nenhum dado será persistido e nenhuma função ou atuação pedagógica é criada."
            >
              <p className="text-sm">{POSTING_AUTHORIZATION_NOTE}</p>
            </DetailSection>
          </section>
        </div>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              A movimentação demonstrativa será descartada; nenhuma lotação será alterada.
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
                ? "Movimentação funcional demonstrativa preparada"
                : "Concluir movimentação (demonstrativa)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Movimentação funcional demonstrativa preparada. A lotação anterior foi preservada no histórico e a nova lotação foi preparada."
                : "A operação é conceitualmente atômica: ou todas as etapas são concluídas, ou nenhuma é."}
            </DialogDescription>
          </DialogHeader>
          {concluded ? (
            <div className="border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Próxima ação: Registrar função.</p>
              <p className="mt-1 text-xs text-muted-foreground">Preparada para a Etapa 9D2.</p>
            </div>
          ) : null}
          <DialogFooter>
            {concluded ? (
              <Button onClick={leave}>Voltar às lotações</Button>
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
