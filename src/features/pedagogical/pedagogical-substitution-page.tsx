import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, ShieldCheck } from "lucide-react";
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
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { ConflictPanel, Field } from "@/features/professionals/posting-form-fields";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  PEDAGOGICAL_CORESPONSIBILITY_NOTE,
  PEDAGOGICAL_OPERATION_AUTHORIZATION_NOTE,
  PEDAGOGICAL_SUBSTITUTION_FEEDBACK,
  PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE,
  PEDAGOGICAL_SUBSTITUTION_SECTIONS,
  PEDAGOGICAL_VERSION_CONFLICT,
  assessSubstitutionConflicts,
  blankSubstitutionDraft,
  fieldOptionsForClass,
  isPedagogicalDirty,
  linksForProfessional,
  substitutionInheritedField,
  validateSubstitutionDraft,
  type PedagogicalSubstitutionDraft,
} from "./pedagogical-assignment-draft";
import {
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  PEDAGOGICAL_SUBSTITUTION_NOTE,
  getPedagogicalAssignment,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
} from "./pedagogical-data";
import {
  FunctionalLinkPicker,
  PedagogicalFieldPicker,
  PedagogicalRolePicker,
  ProfessionalPicker,
} from "./pedagogical-form-fields";

export function PedagogicalSubstitutionPage({
  professionalId,
  activityId,
}: {
  professionalId: string;
  activityId: string;
}) {
  const record = getPedagogicalAssignment(activityId);
  const initial = useMemo(() => blankSubstitutionDraft(), []);
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();

  if (!record || record.professionalId !== professionalId)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Atuação pedagógica não encontrada"
          description="A substituição depende de uma atuação original existente."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id/atuacoes" params={{ id: professionalId }}>
                Voltar às atuações
              </Link>
            </Button>
          }
        />
      </div>
    );

  const update = (patch: Partial<PedagogicalSubstitutionDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const { professional, link, klass, unitName, periodLabel } = pedagogicalContext(record);
  const substituteLinks = linksForProfessional(draft.substituteProfessionalId);
  const substitute = getDemonstrationProfessional(draft.substituteProfessionalId);
  const substituteLink = substituteLinks.find((item) => item.id === draft.substituteLinkId);
  const fieldOptions = fieldOptionsForClass(getDemonstrationClass(record.classId));
  const inherited = substitutionInheritedField(draft, record);
  const errors = validateSubstitutionDraft(draft, record);
  const conflicts = assessSubstitutionConflicts(draft, record);
  const strongConflict = conflicts.some((item) => item.level === "forte");
  const dirty = isPedagogicalDirty(draft, initial);
  const leave = () =>
    void navigate({ to: "/profissionais/$id/atuacoes", params: { id: professionalId } });

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Registrar substituição temporária"
        description="Fluxo demonstrativo próprio. A substituição não encerra a atuação original, não duplica Pessoa ou Profissional e não implementa afastamento funcional."
        parent={{ label: "Atuações pedagógicas", to: "/atuacoes-pedagogicas" }}
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
              Registrar substituição temporária
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
        <nav aria-label="Seções da substituição" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {PEDAGOGICAL_SUBSTITUTION_SECTIONS.map(([id, label], index) => (
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
          <section id="original">
            <DetailSection
              title="Atuação original"
              description="O titular permanece com a atuação preservada durante toda a substituição."
            >
              <DefinitionList
                items={[
                  {
                    term: "Profissional titular",
                    detail: professional?.personName ?? "Não identificado",
                  },
                  {
                    term: "Vínculo do titular",
                    detail: link?.functionalIdentifier || "Vínculo sem matrícula funcional",
                  },
                  { term: "Turma", detail: klass?.name ?? record.classId },
                  { term: "Unidade e período letivo", detail: `${unitName} · ${periodLabel}` },
                  { term: "Componente ou campo", detail: pedagogicalFieldLabel(record) },
                  { term: "Papel do titular", detail: record.role },
                  { term: "Vigência", detail: pedagogicalValidityLabel(record) },
                  { term: "Situação", detail: pedagogicalSituationLabel(record) },
                ]}
              />
            </DetailSection>
          </section>
          <section id="substituto">
            <DetailSection
              title="Profissional substituto e vínculo"
              description="O substituto é um Profissional existente e a substituição referencia explicitamente o vínculo dele."
            >
              <ProfessionalPicker
                id="substitute-professional"
                label="Profissional substituto existente"
                value={draft.substituteProfessionalId}
                onChange={(value) =>
                  update({ substituteProfessionalId: value, substituteLinkId: "" })
                }
              />
              <div className="mt-4">
                <FunctionalLinkPicker
                  id="substitute-link"
                  links={substituteLinks}
                  value={draft.substituteLinkId}
                  onChange={(value) => update({ substituteLinkId: value })}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Nenhuma Pessoa ou Profissional é duplicado. O substituto não recebe automaticamente
                as mesmas permissões administrativas ou pedagógicas do titular.
              </p>
            </DetailSection>
          </section>
          <section id="contexto">
            <DetailSection
              title="Contexto acadêmico herdado"
              description="O contexto é herdado da atuação original ou ajustado explicitamente."
            >
              <RadioGroup
                value={draft.contextMode}
                onValueChange={(value) => update({ contextMode: value as "herdado" | "ajustado" })}
                className="grid gap-2 sm:grid-cols-2"
                aria-label="Contexto acadêmico da substituição"
              >
                <Label className="flex items-center gap-2 border border-border p-3 font-normal">
                  <RadioGroupItem value="herdado" />
                  Herdar contexto da atuação original
                </Label>
                <Label className="flex items-center gap-2 border border-border p-3 font-normal">
                  <RadioGroupItem value="ajustado" />
                  Ajustar componente ou campo explicitamente
                </Label>
              </RadioGroup>
              {draft.contextMode === "ajustado" ? (
                <div className="mt-4">
                  <PedagogicalFieldPicker
                    options={fieldOptions}
                    fieldKind={draft.fieldKind}
                    field={draft.field}
                    onChange={(option) =>
                      update({
                        fieldKind: option.kind,
                        field:
                          option.kind === "Contexto sem componente definido" ? "" : option.label,
                      })
                    }
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Contexto herdado: {pedagogicalFieldLabel(record)} ·{" "}
                  {klass?.name ?? record.classId} · {unitName} · {periodLabel}.
                </p>
              )}
            </DetailSection>
          </section>
          <section id="intervalo">
            <DetailSection
              title="Intervalo e papel"
              description="A substituição é uma relação temporal própria, com início, término e papel pedagógico."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="substitution-start"
                  label="Início da substituição"
                  value={draft.start}
                  onChange={(start) => update({ start })}
                  type="date"
                />
                <Field
                  id="substitution-end"
                  label="Término da substituição"
                  value={draft.end}
                  onChange={(end) => update({ end })}
                  type="date"
                />
              </div>
              <div className="mt-4">
                <PedagogicalRolePicker value={draft.role} onChange={(role) => update({ role })} />
              </div>
            </DetailSection>
          </section>
          <section id="compatibilidades">
            <DetailSection
              title="Compatibilidades"
              description="Incompatibilidade estrutural inequívoca impede a conclusão; ambiguidade normativa gera aviso."
            >
              <ConflictPanel conflicts={conflicts} label="Compatibilidades da substituição" />
              <p className="mt-3 text-xs text-muted-foreground">{PEDAGOGICAL_SUBSTITUTION_NOTE}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {PEDAGOGICAL_CORESPONSIBILITY_NOTE}
              </p>
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão comparativa"
              description="Titular e substituto, respectivos vínculos, intervalo e papel de cada um."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Atuação original
                  </h3>
                  <DefinitionList
                    items={[
                      {
                        term: "Profissional",
                        detail: professional?.personName ?? "Não identificado",
                      },
                      {
                        term: "Vínculo",
                        detail: link?.functionalIdentifier || "Vínculo sem matrícula funcional",
                      },
                      { term: "Turma", detail: klass?.name ?? record.classId },
                      { term: "Componente ou campo", detail: pedagogicalFieldLabel(record) },
                      { term: "Papel", detail: record.role },
                      { term: "Vigência", detail: pedagogicalValidityLabel(record) },
                    ]}
                  />
                </div>
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Substituição
                  </h3>
                  <DefinitionList
                    items={[
                      {
                        term: "Substituto",
                        detail: substitute?.personName ?? "Substituto pendente",
                      },
                      {
                        term: "Vínculo do substituto",
                        detail: substituteLink
                          ? `${substituteLink.employerContext} · ${substituteLink.functionalIdentifier || "sem matrícula funcional"} · ${substituteLink.cargo}`
                          : "Vínculo pendente de seleção explícita",
                      },
                      { term: "Início", detail: draft.start || "início pendente" },
                      { term: "Término", detail: draft.end || "término pendente" },
                      { term: "Papel", detail: draft.role || "papel pendente" },
                      {
                        term: "Componente ou campo",
                        detail: inherited.field
                          ? `${inherited.fieldKind}: ${inherited.field}`
                          : `${inherited.fieldKind} — componente convencional não aplicável a este contexto`,
                      },
                    ]}
                  />
                </div>
              </div>
              <p className="mt-3 text-sm">{PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE}</p>
              {errors.length ? (
                <ul aria-label="Pendências da substituição" className="mt-4 space-y-1 text-xs">
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
                  {PEDAGOGICAL_VERSION_CONFLICT} A futura implementação deverá revalidar versão e
                  contexto antes de concluir operações.
                </p>
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
              O preenchimento demonstrativo será descartado; nenhuma substituição será registrada.
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
                ? "Substituição demonstrativa preparada"
                : "Registrar substituição temporária (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded ? PEDAGOGICAL_SUBSTITUTION_FEEDBACK : PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE}
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
                <Button onClick={() => setConcluded(true)}>Confirmar substituição</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
