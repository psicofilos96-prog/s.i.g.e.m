import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, ShieldCheck, TriangleAlert } from "lucide-react";
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
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { ConflictPanel, Field } from "@/features/professionals/posting-form-fields";
import { identityForProfessional } from "@/features/professionals/professional-identity-draft";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  PEDAGOGICAL_CREATE_FEEDBACK,
  PEDAGOGICAL_CREATE_SCOPE_NOTE,
  PEDAGOGICAL_OPERATION_AUTHORIZATION_NOTE,
  PEDAGOGICAL_SECTIONS,
  PEDAGOGICAL_VERSION_CONFLICT,
  assessPedagogicalConflicts,
  blankPedagogicalDraft,
  draftFromRecord,
  fieldOptionsForClass,
  isPedagogicalDirty,
  linksForProfessional,
  pedagogicalDraftChanges,
  relatedRecordsForDraft,
  requiresNewAssignment,
  validatePedagogicalDraft,
  type PedagogicalDraft,
} from "./pedagogical-assignment-draft";
import {
  PEDAGOGICAL_AUTHORIZATION_REQUIREMENTS,
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  PEDAGOGICAL_PERIOD_NOTE,
  PEDAGOGICAL_POSTING_NOTE,
  getPedagogicalAssignment,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
} from "./pedagogical-data";
import {
  AcademicContextPicker,
  ClassPicker,
  FunctionalLinkPicker,
  PedagogicalFieldPicker,
  PedagogicalRolePicker,
  ProfessionalPicker,
} from "./pedagogical-form-fields";

export function PedagogicalWorkspacePage({
  mode,
  professionalId,
  activityId,
  presetLinkId,
  presetClassId,
  presetUnitId,
}: {
  mode: "nova" | "edicao";
  professionalId?: string;
  activityId?: string;
  presetLinkId?: string;
  presetClassId?: string;
  presetUnitId?: string;
}) {
  const record = activityId ? getPedagogicalAssignment(activityId) : undefined;
  const initial = useMemo(() => {
    if (mode === "edicao" && record) return draftFromRecord(record);
    const klass = presetClassId ? getDemonstrationClass(presetClassId) : undefined;
    return blankPedagogicalDraft({
      ...(professionalId ? { professionalId } : {}),
      ...(presetLinkId ? { linkId: presetLinkId } : {}),
      ...(presetUnitId ? { unitId: presetUnitId } : {}),
      ...(klass
        ? {
            unitId: klass.unitId,
            periodLabel: klass.academicPeriod.label,
            classId: klass.id,
          }
        : {}),
    });
  }, [mode, record, professionalId, presetLinkId, presetClassId, presetUnitId]);
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();

  if (
    mode === "edicao" &&
    (!record || (professionalId && record.professionalId !== professionalId))
  )
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Atuação pedagógica não encontrada"
          description="A atuação não pertence ao profissional informado ou não existe nos dados fictícios."
          action={
            <Button asChild variant="outline">
              <Link to="/atuacoes-pedagogicas">Voltar à consulta geral</Link>
            </Button>
          }
        />
      </div>
    );

  const update = (patch: Partial<PedagogicalDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const links = linksForProfessional(draft.professionalId);
  const selectedLink = links.find((item) => item.id === draft.linkId);
  const klass = getDemonstrationClass(draft.classId);
  const fieldOptions = fieldOptionsForClass(klass);
  const identity = draft.professionalId ? identityForProfessional(draft.professionalId) : undefined;
  const professional = getDemonstrationProfessional(draft.professionalId);
  const errors = validatePedagogicalDraft(draft);
  const conflicts = assessPedagogicalConflicts(draft, { excludeRecordId: record?.id });
  const strongConflict = conflicts.some((item) => item.level === "forte");
  const dirty = isPedagogicalDirty(draft, initial);
  const changes = pedagogicalDraftChanges(draft, initial);
  const newAssignmentNeeded = mode === "edicao" && requiresNewAssignment(draft, initial);
  const related = relatedRecordsForDraft(draft).filter((item) => item.id !== record?.id);
  const leave = () =>
    void (draft.professionalId
      ? navigate({ to: "/profissionais/$id/atuacoes", params: { id: draft.professionalId } })
      : navigate({ to: "/atuacoes-pedagogicas" }));

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={mode === "nova" ? "Nova atuação pedagógica" : "Editar atuação pedagógica"}
        description="Workspace demonstrativo de Atribuição Docente a partir de Profissional e Vínculo Funcional existentes. Não cria Pessoa, Profissional, Vínculo, Lotação ou Função."
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
              {mode === "nova" ? "Registrar atuação pedagógica" : "Concluir edição"}
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
        <nav aria-label="Seções da atuação pedagógica" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {PEDAGOGICAL_SECTIONS.map(([id, label], index) => (
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
              description="A atuação depende de Profissional e Vínculo Funcional existentes e referencia explicitamente o vínculo pelo qual o profissional atua."
            >
              <ProfessionalPicker
                value={draft.professionalId}
                onChange={(value) => update({ professionalId: value, linkId: "" })}
              />
              <div className="mt-4">
                <DefinitionList
                  items={[
                    {
                      term: "Pessoa",
                      detail: professional?.personName ?? "Profissional a selecionar",
                    },
                    {
                      term: "Identificador SIGEM",
                      detail: identity?.sigemId ?? "Não informado nesta demonstração",
                    },
                    {
                      term: "Situação contextual",
                      detail: professional?.situation ?? "Não informada",
                    },
                    {
                      term: "Cargo contextual (somente leitura)",
                      detail: selectedLink?.cargo ?? "Depende do vínculo selecionado",
                    },
                  ]}
                />
              </div>
              <div className="mt-4">
                <FunctionalLinkPicker
                  links={links}
                  value={draft.linkId}
                  onChange={(value) => update({ linkId: value })}
                />
              </div>
              {selectedLink?.end ? (
                <p role="note" className="mt-3 border border-border bg-muted/40 p-3 text-xs">
                  Vínculo funcional com término em {selectedLink.end}. A consulta e a correção
                  histórica permanecem possíveis; nova atuação que ultrapasse inequivocamente o
                  término não é concluída.
                </p>
              ) : null}
            </DetailSection>
          </section>
          <section id="contexto">
            <DetailSection
              title="Unidade e período letivo"
              description="Contexto institucional e temporal existentes; nenhuma unidade, calendário ou período é criado aqui."
            >
              <AcademicContextPicker
                unitId={draft.unitId}
                periodLabel={draft.periodLabel}
                onUnit={(unitId) => update({ unitId, classId: "", field: "" })}
                onPeriod={(periodLabel) => update({ periodLabel, classId: "", field: "" })}
              />
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Lotações do vínculo como contexto
                </h3>
                {selectedLink?.allocations.length ? (
                  <ul
                    className="mt-2 divide-y divide-border border-y border-border"
                    aria-label="Lotações relevantes do vínculo"
                  >
                    {selectedLink.allocations.map((posting) => (
                      <li key={posting.id} className="py-2 text-xs">
                        <strong>{posting.status === "Atual" ? "ATUAL" : "HISTÓRICO"}:</strong>{" "}
                        {posting.place} · {posting.start} — {posting.end ?? "em andamento"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhuma lotação registrada neste vínculo.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{PEDAGOGICAL_POSTING_NOTE}</p>
                <p className="mt-1 text-xs text-muted-foreground">{PEDAGOGICAL_PERIOD_NOTE}</p>
              </div>
            </DetailSection>
          </section>
          <section id="turma">
            <DetailSection
              title="Turma e contexto acadêmico"
              description="Turmas simples, multisseriadas, multietapas e de EJA são suportadas sem exigir série única."
            >
              <ClassPicker
                unitId={draft.unitId}
                periodLabel={draft.periodLabel}
                value={draft.classId}
                onChange={(classId) => update({ classId, field: "" })}
              />
            </DetailSection>
          </section>
          <section id="componente">
            <DetailSection
              title="Componente ou campo"
              description="Estrutura pedagógica pertinente à turma e à matriz curricular já modelada."
            >
              <PedagogicalFieldPicker
                options={fieldOptions}
                fieldKind={draft.fieldKind}
                field={draft.field}
                onChange={(option) =>
                  update({
                    fieldKind: option.kind,
                    field: option.kind === "Contexto sem componente definido" ? "" : option.label,
                  })
                }
              />
            </DetailSection>
          </section>
          <section id="papel">
            <DetailSection
              title="Papel pedagógico"
              description="Seleção contextual demonstrativa; nenhuma enumeração normativa municipal é congelada."
            >
              <PedagogicalRolePicker value={draft.role} onChange={(role) => update({ role })} />
            </DetailSection>
          </section>
          <section id="vigencia">
            <DetailSection
              title="Vigência"
              description="Início obrigatório e término opcional, compatíveis com o vínculo, o período letivo e o contexto temporal da turma."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="pedagogical-start"
                  label="Data de início"
                  value={draft.start}
                  onChange={(start) => update({ start })}
                  type="date"
                />
                <Field
                  id="pedagogical-end"
                  label="Data de término (opcional)"
                  value={draft.end}
                  onChange={(end) => update({ end })}
                  type="date"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Atuações históricas não são apagadas nem reescritas por esta operação.
              </p>
            </DetailSection>
          </section>
          <section id="compatibilidades">
            <DetailSection
              title="Compatibilidades e atuações existentes"
              description="Sobreposição não é tratada automaticamente como duplicidade; corresponsabilidade legítima nunca é bloqueada."
            >
              <ConflictPanel conflicts={conflicts} label="Compatibilidades da atuação pedagógica" />
              <h3 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                Atuações relacionadas
              </h3>
              {related.length ? (
                <ul
                  className="mt-2 divide-y divide-border border-y border-border"
                  aria-label="Atuações pedagógicas relacionadas"
                >
                  {related.map((item) => {
                    const context = pedagogicalContext(item);
                    return (
                      <li key={item.id} className="py-2 text-xs">
                        <strong>{pedagogicalSituationLabel(item)}:</strong>{" "}
                        {context.professional?.personName ?? item.professionalId} · vínculo{" "}
                        {context.link?.functionalIdentifier ?? item.linkId} ·{" "}
                        {context.klass?.name ?? item.classId} · {item.role} ·{" "}
                        {pedagogicalFieldLabel(item)} · {pedagogicalValidityLabel(item)}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma atuação relacionada a este vínculo ou a esta turma.
                </p>
              )}
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão"
              description="Profissional, vínculo, cargo, unidade, período letivo, turma, componente ou campo, papel, vigência, relações e avisos."
            >
              <DefinitionList
                items={[
                  {
                    term: "Profissional",
                    detail: professional
                      ? `${professional.personName} · ${professional.professionalId}`
                      : "Profissional pendente",
                  },
                  {
                    term: "Vínculo funcional",
                    detail: selectedLink
                      ? `${selectedLink.employerContext} · ${selectedLink.functionalIdentifier || "sem matrícula funcional"} · ${selectedLink.start} — ${selectedLink.end ?? "em andamento"}`
                      : "Vínculo pendente de seleção explícita",
                  },
                  {
                    term: "Cargo contextual",
                    detail: selectedLink
                      ? `${selectedLink.cargo} (não alterado por esta operação)`
                      : "Depende do vínculo",
                  },
                  {
                    term: "Unidade",
                    detail: draft.unitId ? getClassUnitName(draft.unitId) : "Unidade pendente",
                  },
                  { term: "Período letivo", detail: draft.periodLabel || "Período pendente" },
                  { term: "Turma", detail: klass?.name ?? "Turma pendente" },
                  {
                    term: "Componente ou campo",
                    detail: draft.field
                      ? `${draft.fieldKind}: ${draft.field}`
                      : `${draft.fieldKind} — componente convencional não aplicável a este contexto`,
                  },
                  { term: "Papel", detail: draft.role || "Papel pendente" },
                  {
                    term: "Vigência",
                    detail: `${draft.start || "início pendente"} — ${draft.end || "sem término informado"}`,
                  },
                  {
                    term: "Atuações relacionadas",
                    detail: related.length
                      ? `${related.length} atuação(ões) no mesmo vínculo ou na mesma turma`
                      : "Nenhuma atuação relacionada",
                  },
                  {
                    term: "Avisos de duplicidade e compatibilidade",
                    detail: conflicts.length
                      ? conflicts.map((item) => item.title).join(" ")
                      : "Nenhum aviso identificado nesta demonstração.",
                  },
                  { term: "Escopo da operação", detail: PEDAGOGICAL_CREATE_SCOPE_NOTE },
                ]}
              />
              {mode === "edicao" ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Natureza da alteração</h3>
                  <RadioGroup
                    value={draft.changeNature}
                    onValueChange={(value) =>
                      update({ changeNature: value as "correcao" | "nova-atribuicao" })
                    }
                    className="mt-2"
                  >
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="correcao" />
                      Correção administrativa pertinente
                    </Label>
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="nova-atribuicao" />
                      Alteração que representa nova atribuição
                    </Label>
                  </RadioGroup>
                  {newAssignmentNeeded ? (
                    <div
                      role="alert"
                      className="mt-3 border border-warning/40 bg-warning/10 p-3 text-sm"
                    >
                      <TriangleAlert className="mr-2 inline size-4" />
                      Alterar profissional, vínculo, turma, componente, campo, papel ou contexto
                      institucional representa nova atribuição. A edição comum não deve substituir
                      silenciosamente o registro: encerre a atuação atual e registre outra,
                      preservando o histórico.
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/profissionais/$id/atuacoes/$atuacaoId/encerrar"
                            params={{
                              id: record?.professionalId ?? "",
                              atuacaoId: record?.id ?? "",
                            }}
                          >
                            Ir para encerramento da atuação
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/profissionais/$id/atuacoes/nova"
                            params={{ id: record?.professionalId ?? "" }}
                          >
                            Registrar nova atuação
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {changes.length ? (
                    <ul aria-label="Alterações da atuação" className="mt-3 space-y-1 text-xs">
                      {changes.map((item) => (
                        <li key={item.field}>
                          {item.field}: {item.from} → {item.to} ({item.nature})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
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
                  {PEDAGOGICAL_VERSION_CONFLICT} A futura implementação deverá revalidar versão e
                  contexto antes de concluir operações.
                </p>
              ) : null}
              {errors.length ? (
                <ul aria-label="Pendências da atuação" className="mt-4 space-y-1 text-xs">
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
              <p className="text-sm">
                <ShieldCheck className="mr-1 inline size-4" />
                {PEDAGOGICAL_OPERATION_AUTHORIZATION_NOTE}
              </p>
              <ul
                className="mt-2 list-disc pl-4 text-xs text-muted-foreground"
                aria-label="Elementos da autorização contextual futura"
              >
                {PEDAGOGICAL_AUTHORIZATION_REQUIREMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground" role="note">
                {PEDAGOGICAL_DATA_MINIMIZATION_NOTE}
              </p>
            </DetailSection>
          </section>
        </div>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              O preenchimento demonstrativo será descartado; nenhuma atuação será alterada.
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
                ? "Atuação pedagógica demonstrativa preparada"
                : mode === "nova"
                  ? "Registrar atuação pedagógica (demonstrativo)"
                  : "Concluir edição (demonstrativa)"}
            </DialogTitle>
            <DialogDescription>
              {concluded ? PEDAGOGICAL_CREATE_FEEDBACK : PEDAGOGICAL_CREATE_SCOPE_NOTE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {concluded ? (
              <Button onClick={leave}>Voltar às atuações</Button>
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
