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
  POSTING_AUTHORIZATION_NOTE,
  POSTING_SECTIONS,
  POSTING_VERSION_CONFLICT,
  assessHoursDistribution,
  assessPostingConflicts,
  blankPostingDraft,
  draftFromPosting,
  getPostingContext,
  isPostingDirty,
  linkIsClosed,
  postingChanges,
  postingSituationLabel,
  validatePostingDraft,
  type PostingDraft,
} from "./posting-draft";
import {
  ConflictPanel,
  DestinationPicker,
  DistributedHoursField,
  Field,
} from "./posting-form-fields";

export function PostingWorkspacePage({
  mode,
  professionalId,
  linkId,
  postingId,
}: {
  mode: "nova" | "edicao";
  professionalId: string;
  linkId: string;
  postingId?: string;
}) {
  const { professional, link, posting, identity } = getPostingContext(
    professionalId,
    linkId,
    postingId,
  );
  const initial = useMemo(
    () => (mode === "edicao" && posting ? draftFromPosting(posting) : blankPostingDraft()),
    [mode, posting],
  );
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();
  if (!professional || !link || (mode === "edicao" && !posting))
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title={link ? "Lotação não encontrada" : "Vínculo funcional existente obrigatório"}
          description={
            link
              ? "A lotação informada não pertence a este vínculo funcional."
              : "Não é possível criar Lotação sem Vínculo Funcional. Registre o vínculo antes de lotar."
          }
          action={
            <Button asChild variant="outline">
              <Link
                to={
                  link
                    ? "/profissionais/$id/vinculos/$vinculoId/lotacoes"
                    : "/profissionais/$id/vinculos/novo"
                }
                params={
                  link
                    ? { id: professionalId, vinculoId: linkId }
                    : ({ id: professionalId } as never)
                }
              >
                {link ? "Voltar às lotações" : "Ir para novo vínculo funcional"}
              </Link>
            </Button>
          }
        />
      </div>
    );
  const update = (patch: Partial<PostingDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const dirty = isPostingDirty(draft, initial);
  const errors = validatePostingDraft(draft);
  const conflicts = assessPostingConflicts(link, draft, { excludePostingId: posting?.id });
  const strongConflict = conflicts.some((item) => item.level === "forte");
  const distribution = assessHoursDistribution(link, {
    hours: draft.hoursMode === "informada" ? Number(draft.distributedHours || 0) : undefined,
    excludePostingId: posting?.id,
  });
  const changes = postingChanges(draft, initial);
  const unitChanged = draft.destination !== initial.destination && mode === "edicao";
  const leave = () =>
    void navigate({
      to: "/profissionais/$id/vinculos/$vinculoId/lotacoes",
      params: { id: professionalId, vinculoId: linkId },
    });
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={mode === "nova" ? "Nova lotação" : "Editar lotação"}
        description="Registre em qual escola o profissional está lotado dentro de um vínculo já existente."
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
              {mode === "nova" ? "Registrar lotação" : "Concluir edição"}
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
        <nav aria-label="Seções da lotação" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {POSTING_SECTIONS.map(([id, label], index) => (
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
              title="Profissional"
              description="Nenhuma Pessoa ou papel Profissional será criado nesta operação."
            >
              <DefinitionList
                items={[
                  { term: "Pessoa", detail: professional.personName },
                  {
                    term: "Identificador SIGEM",
                    detail: identity?.sigemId ?? professional.personId,
                  },
                  { term: "Profissional", detail: professional.professionalId },
                ]}
              />
            </DetailSection>
          </section>
          <section id="vinculo">
            <DetailSection
              title="Vínculo funcional"
              description="Cargo é apresentado apenas como contexto e não pode ser editado aqui."
            >
              <DefinitionList
                items={[
                  {
                    term: "Matrícula funcional",
                    detail: link.functionalIdentifier || "Não informada neste contexto",
                  },
                  { term: "Cargo", detail: link.cargo },
                  { term: "Empregador / contexto", detail: link.employerContext },
                  {
                    term: "Vigência do vínculo",
                    detail: `${formatAcademicDate(link.start)} — ${formatAcademicDate(link.end, "em andamento")}`,
                  },
                  { term: "Carga do vínculo", detail: link.weeklyHours ?? "Não informada" },
                ]}
              />
              {linkIsClosed(link) ? (
                <p role="note" className="mt-3 border border-border bg-muted/40 p-3 text-xs">
                  Vínculo funcional encerrado. Suas lotações históricas permanecem consultáveis e
                  nova lotação posterior ao término não é esperada.
                </p>
              ) : null}
            </DetailSection>
          </section>
          <section id="destino">
            <DetailSection
              title="Destino da lotação"
              description="Unidade escolar, órgão central, setor administrativo ou outro contexto organizacional existente."
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
                <p className="mt-2 text-xs text-muted-foreground">
                  A carga total do vínculo não é presumida como exercida integralmente em cada
                  lotação. Nenhum motor definitivo de distribuição foi implementado.
                </p>
              </div>
            </DetailSection>
          </section>
          <section id="vigencia">
            <DetailSection
              title="Vigência"
              description="Cada lotação possui temporalidade própria, contextualizada na vigência do vínculo."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="posting-start"
                  label="Data de início"
                  value={draft.start}
                  onChange={(start) => update({ start })}
                  type="date"
                />
                <Field
                  id="posting-end"
                  label="Data de término (opcional)"
                  value={draft.end}
                  onChange={(end) => update({ end })}
                  type="date"
                />
              </div>
            </DetailSection>
          </section>
          <section id="existentes">
            <DetailSection
              title="Lotações já existentes"
              description="Adicionar lotação não encerra nem substitui as lotações anteriores."
            >
              {link.allocations.length ? (
                <ul
                  className="divide-y divide-border border-y border-border"
                  aria-label="Lotações existentes do vínculo"
                >
                  {link.allocations.map((item) => (
                    <li key={item.id} className="py-2 text-xs">
                      <strong>{postingSituationLabel(item)}:</strong> {item.place} · {item.start} —{" "}
                      {formatAcademicDate(item.end, "em andamento")} ·{" "}
                      {item.distributedHours ?? "Distribuição de carga horária não informada."}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma lotação registrada para este vínculo.
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{distribution.title}</p>
            </DetailSection>
          </section>
          <section id="conflitos">
            <DetailSection
              title="Compatibilidade e conflitos"
              description="Conflitos são demonstrativos; nenhuma regra municipal adicional foi inventada."
            >
              <ConflictPanel conflicts={conflicts} />
              <p className="mt-3 text-xs text-muted-foreground">{distribution.detail}</p>
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão"
              description="Profissional, vínculo, nova lotação, lotações existentes, avisos e escopo."
            >
              <DefinitionList
                items={[
                  {
                    term: "Profissional",
                    detail: `${professional.personName} · ${professional.professionalId}`,
                  },
                  {
                    term: "Vínculo",
                    detail: `${link.functionalIdentifier || "Sem matrícula funcional"} · ${link.cargo} · ${formatAcademicDate(link.start)} — ${formatAcademicDate(link.end, "em andamento")} · ${link.weeklyHours ?? "carga não informada"}`,
                  },
                  {
                    term: mode === "nova" ? "Nova lotação" : "Lotação",
                    detail: `${draft.destination || "Destino pendente"} · ${formatAcademicDate(draft.start, "início pendente")} — ${formatAcademicDate(draft.end, "sem término")} · ${draft.hoursMode === "informada" ? `${draft.distributedHours || "—"} h destinadas` : "Distribuição de carga horária não informada."}`,
                  },
                  {
                    term: "Lotações existentes",
                    detail: link.allocations.length
                      ? link.allocations
                          .map((item) => `${postingSituationLabel(item)}: ${item.place}`)
                          .join("; ")
                      : "Nenhuma",
                  },
                  {
                    term: "Avisos",
                    detail: conflicts.length
                      ? conflicts.map((item) => item.title).join(" ")
                      : "Nenhum aviso de sobreposição ou duplicidade.",
                  },
                  { term: "Distribuição de carga", detail: distribution.title },
                  {
                    term: "Escopo",
                    detail: "Cria ou corrige Lotação; NÃO cria Função nem Atuação Pedagógica",
                  },
                ]}
              />
              {mode === "edicao" ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Natureza da alteração</h3>
                  <RadioGroup
                    value={draft.changeNature}
                    onValueChange={(value) =>
                      update({ changeNature: value as "correcao" | "historica" })
                    }
                    className="mt-2"
                  >
                    <Label className="flex items-center gap-2">
                      <RadioGroupItem value="correcao" />
                      Correção administrativa da lotação
                    </Label>
                    <Label className="flex items-center gap-2">
                      <RadioGroupItem value="historica" />
                      Alteração historicamente relevante
                    </Label>
                  </RadioGroup>
                  {unitChanged ? (
                    <div
                      role="alert"
                      className="mt-3 border border-warning/40 bg-warning/10 p-3 text-sm"
                    >
                      <TriangleAlert className="mr-2 inline size-4" />
                      Mudança de unidade pode representar movimentação funcional. A edição não deve
                      trocar a unidade destruindo o histórico.
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link
                          to="/profissionais/$id/vinculos/$vinculoId/lotacoes/movimentar"
                          params={{ id: professional.id, vinculoId: link.id }}
                        >
                          Ir para movimentação funcional
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                  {changes.length ? (
                    <ul aria-label="Alterações da lotação" className="mt-3 space-y-1 text-xs">
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
                      {POSTING_VERSION_CONFLICT} A futura operação deverá revalidar a versão antes
                      da conclusão.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {errors.length ? (
                <ul aria-label="Pendências da lotação" className="mt-4 space-y-1 text-xs">
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
              <p className="text-sm">{POSTING_AUTHORIZATION_NOTE}</p>
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link
                  to="/profissionais/$id/vinculos/$vinculoId/funcoes/nova"
                  params={{ id: professional.id, vinculoId: link.id }}
                >
                  <LockKeyhole />
                  Próxima ação: Registrar função
                </Link>
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
              O preenchimento demonstrativo será descartado; nenhuma lotação será alterada.
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
                ? "Lotação demonstrativa preparada"
                : mode === "nova"
                  ? "Registrar lotação (demonstrativo)"
                  : "Concluir edição (demonstrativa)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Lotação demonstrativa preparada. Nenhuma função ou atuação pedagógica foi criada."
                : "A operação não persiste dados e preserva o vínculo funcional, as lotações anteriores e o histórico."}
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
