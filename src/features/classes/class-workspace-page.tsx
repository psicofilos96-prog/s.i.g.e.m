import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, Lock, TriangleAlert, X } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import {
  CLASS_JOURNEY_OPTIONS,
  CLASS_PERIOD_OPTIONS,
  CLASS_SHIFT_OPTIONS,
  CLASS_UNIT_OPTIONS,
  classDraftChanges,
  classIssueFor,
  createBlankClassDraft,
  createClassDraftFrom,
  draftGroupings,
  getOffer,
  groupingsForOffer,
  isClassDraftDirty,
  matricesForOffer,
  matrixApplicabilityLabel,
  offersForContext,
  organizationsForOffer,
  validateClassDraft,
  type ClassDraft,
  type ClassDraftIssue,
} from "@/features/classes/class-draft";

export type ClassWorkspaceMode = "nova" | "edicao";

const SECTIONS = [
  { id: "contexto", label: "Contexto" },
  { id: "organizacao", label: "Organização" },
  { id: "tempo", label: "Turno e jornada" },
  { id: "matriz", label: "Matriz curricular" },
  { id: "identificacao", label: "Identificação" },
  { id: "revisao", label: "Revisão" },
];

function FieldError({ issue }: { issue?: ClassDraftIssue | undefined }) {
  if (!issue) return null;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {issue.message}
    </span>
  );
}

export function ClassWorkspacePage({
  mode,
  originId,
}: {
  mode: ClassWorkspaceMode;
  originId?: string;
}) {
  const originClass = originId ? getDemonstrationClass(originId) : undefined;
  const initialDraft = useMemo<ClassDraft | null>(() => {
    if (mode === "nova") return createBlankClassDraft();
    if (!originClass) return null;
    return createClassDraftFrom(originClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, originId]);

  const [draft, setDraft] = useState<ClassDraft | null>(initialDraft);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    void navigate({ to: "/turmas" });
  }

  if (!draft || !initialDraft) {
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Turma de origem não encontrada"
          description="O identificador informado não corresponde às turmas fictícias disponíveis."
          action={
            <Button asChild variant="outline">
              <Link to="/turmas">Voltar para turmas</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Turma histórica/encerrada permanece somente leitura nesta etapa.
  if (mode === "edicao" && originClass?.situation === "Encerrada") {
    return (
      <div className="space-y-4 pb-5">
        <OperationalPageHeader
          title={`Turma encerrada — ${originClass.name}`}
          description="Edição estrutural indisponível: o contexto histórico não é reescrito nesta etapa."
          parent={{ label: "Turmas", to: "/turmas" }}
        />
        <div className="surface-panel">
          <EmptyState
            icon={Lock}
            title="Somente leitura"
            description="Período letivo, organização, agrupamentos e matriz aplicada permanecem como registrados naquele momento. Alteração retroativa de contexto histórico não é oferecida."
            action={
              <Button asChild variant="outline">
                <Link to="/turmas/$id" params={{ id: originClass.id }}>
                  Consultar a turma
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const current: ClassDraft = draft;
  const issues = validateClassDraft(draft);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "aviso");
  const dirty = isClassDraftDirty(draft, initialDraft);
  const changes = classDraftChanges(draft, initialDraft);

  const contextReady = Boolean(draft.unitId && draft.academicPeriodLabel);
  const offers = offersForContext(draft.unitId, draft.academicPeriodLabel);
  const organizations = organizationsForOffer(draft.offerId);
  const groupingCandidates = groupingsForOffer(draft.offerId);
  const matrices = matricesForOffer(draft.offerId);
  const selectedGroupings = draftGroupings(draft);
  const selectedOffer = getOffer(draft.offerId);
  const selectedMatrix = matrices.find((matrix) => matrix.id === draft.matrixId);

  function update(patch: Partial<ClassDraft>) {
    setDraft({ ...current, ...patch });
  }

  /** Valor controlado dos selects: "" significa nenhuma escolha registrada. */
  function selectValue(value: string) {
    return value ? { value } : {};
  }

  /** Unidade e período determinam as ofertas: trocar o contexto limpa o que dependia dele. */
  function setContext(patch: Partial<ClassDraft>) {
    update({
      ...patch,
      offerId: "",
      academicOrganization: "",
      groupingLabels: [],
      matrixId: "",
    });
  }

  function setOffer(offerId: string) {
    const [organization] = organizationsForOffer(offerId);
    const offer = getOffer(offerId);
    update({
      offerId,
      academicOrganization: organization ?? "",
      groupingLabels: [],
      matrixId: "",
      journey: current.journey || offer?.journey || "",
    });
  }

  function toggleGrouping(label: string) {
    const selected = current.groupingLabels.includes(label);
    update({
      groupingLabels: selected
        ? current.groupingLabels.filter((item) => item !== label)
        : [...current.groupingLabels, label],
    });
  }

  const title =
    mode === "nova"
      ? "Nova turma (configuração demonstrativa)"
      : `Editar turma — ${originClass?.name ?? "turma"}`;

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={title}
        description="Workspace por seções: a turma é construída dentro de um contexto institucional e acadêmico. Nada é persistido nesta etapa."
        parent={{ label: "Turmas", to: "/turmas" }}
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
              <CheckCircle2 /> Concluir configuração
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Configuração demonstrativa</StatusBadge>
        <span className="text-muted-foreground">
          {mode === "nova"
            ? "Turma em configuração, sem registro no SIGEM"
            : `Contexto atual preservado de ${originClass?.code ?? "turma"}`}
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

      <div className="grid gap-7 xl:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Seções do workspace" className="min-w-0">
          <ul className="sticky top-20 space-y-1 text-xs">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <section id="contexto" aria-labelledby="contexto-title">
            <DetailSection
              title="Contexto"
              description="Unidade e período letivo determinam quais ofertas educacionais podem ser consideradas."
              titleId="contexto-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="unit">Unidade</Label>
                  <Select
                    {...selectValue(draft.unitId)}
                    onValueChange={(value) => setContext({ unitId: value })}
                  >
                    <SelectTrigger id="unit" aria-label="Unidade" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_UNIT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={classIssueFor(issues, "unitId")} />
                </div>

                <div>
                  <Label htmlFor="period">Período letivo</Label>
                  <Select
                    {...selectValue(draft.academicPeriodLabel)}
                    onValueChange={(value) => setContext({ academicPeriodLabel: value })}
                  >
                    <SelectTrigger id="period" aria-label="Período letivo" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione o período letivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_PERIOD_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={classIssueFor(issues, "academicPeriodLabel")} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Período letivo é organização temporal própria: não é o ano civil nem o período
                    avaliativo, que não é modelado nesta etapa.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="offer">Oferta educacional</Label>
                {contextReady ? (
                  <>
                    <Select
                      {...selectValue(draft.offerId)}
                      onValueChange={(value) => setOffer(value)}
                    >
                      <SelectTrigger
                        id="offer"
                        aria-label="Oferta educacional"
                        className="mt-1 h-9"
                      >
                        <SelectValue placeholder="Selecione a oferta" />
                      </SelectTrigger>
                      <SelectContent>
                        {offers.map((offer) => (
                          <SelectItem key={offer.id} value={offer.id}>
                            {offer.stage} · {offer.organization} ({offer.situation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {offers.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground" role="note">
                        Nenhuma oferta fictícia registrada para esta unidade neste período letivo.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground" role="note">
                    Selecione unidade e período letivo para ver as ofertas educacionais possíveis.
                  </p>
                )}
                <FieldError issue={classIssueFor(issues, "offerId")} />
              </div>
            </DetailSection>
          </section>

          <section id="organizacao" aria-labelledby="organizacao-title">
            <DetailSection
              title="Organização"
              description="A oferta determina a organização acadêmica; a organização permite selecionar agrupamentos demonstrativamente compatíveis."
              titleId="organizacao-title"
            >
              <DefinitionList
                items={[
                  {
                    term: "Organização acadêmica",
                    detail: organizations[0] ?? "Depende da oferta educacional selecionada",
                  },
                ]}
              />

              {groupingCandidates.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground" role="note">
                  Selecione a oferta educacional para listar os agrupamentos considerados.
                </p>
              ) : (
                <fieldset className="mt-4">
                  <legend className="text-xs font-medium text-muted-foreground">
                    Agrupamentos atendidos (um ou vários)
                  </legend>
                  <ul
                    className="mt-2 grid gap-2 sm:grid-cols-2"
                    aria-label="Agrupamentos disponíveis"
                  >
                    {groupingCandidates.map((candidate) => {
                      const inputId = `grouping-${candidate.label}`;
                      return (
                        <li key={candidate.label} className="flex items-start gap-2">
                          <Checkbox
                            id={inputId}
                            checked={draft.groupingLabels.includes(candidate.label)}
                            onCheckedChange={() => toggleGrouping(candidate.label)}
                          />
                          <Label htmlFor={inputId} className="text-sm font-normal">
                            {candidate.label}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({candidate.kind})
                            </span>
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                  <FieldError issue={classIssueFor(issues, "groupingLabels")} />
                </fieldset>
              )}

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Agrupamentos selecionados</h3>
                {selectedGroupings.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum agrupamento selecionado. A turma não possui campo estrutural de série.
                  </p>
                ) : (
                  <ul
                    className="mt-2 divide-y divide-border border-y border-border"
                    aria-label="Agrupamentos selecionados"
                  >
                    {selectedGroupings.map((group) => (
                      <li
                        key={group.label}
                        className="flex items-start justify-between gap-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{group.label}</span>{" "}
                          <span className="text-xs text-muted-foreground">({group.kind})</span>
                          <span className="block text-xs text-muted-foreground">{group.note}</span>
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0"
                          aria-label={`Remover agrupamento ${group.label}`}
                          onClick={() => toggleGrouping(group.label)}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Organização simples e multisseriada/multietapa usam a mesma estrutura: cada
                  agrupamento permanece identificável, sem concatenação opaca.
                </p>
              </div>
            </DetailSection>
          </section>

          <section id="tempo" aria-labelledby="tempo-title">
            <DetailSection
              title="Turno e jornada"
              description="Turno é o recorte de horário; jornada é a organização do tempo escolar. São conceitos distintos."
              titleId="tempo-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="shift">Turno</Label>
                  <Select
                    {...selectValue(draft.shift)}
                    onValueChange={(value) => update({ shift: value })}
                  >
                    <SelectTrigger id="shift" aria-label="Turno" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione o turno" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_SHIFT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="journey">Jornada</Label>
                  <Select
                    {...selectValue(draft.journey)}
                    onValueChange={(value) => update({ journey: value })}
                  >
                    <SelectTrigger id="journey" aria-label="Jornada" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione a jornada" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        new Set(
                          [
                            ...(selectedOffer ? [selectedOffer.journey] : []),
                            ...(draft.journey ? [draft.journey] : []),
                            ...CLASS_JOURNEY_OPTIONS,
                          ].filter(Boolean),
                        ),
                      ).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tempo integral é registrado como organização de tempo com ampliação curricular,
                    nunca como caixa de seleção.
                  </p>
                </div>
              </div>
            </DetailSection>
          </section>

          <section id="matriz" aria-labelledby="matriz-title">
            <DetailSection
              title="Matriz curricular"
              description="O contexto determina quais matrizes são consideradas. A estrutura da matriz não é copiada para a turma."
              titleId="matriz-title"
            >
              {matrices.length === 0 ? (
                <p className="text-xs text-muted-foreground" role="note">
                  Selecione a oferta educacional para ver as matrizes curriculares consideradas.
                </p>
              ) : (
                <ul
                  className="divide-y divide-border border-y border-border"
                  aria-label="Matrizes consideradas"
                >
                  {matrices.map((matrix) => {
                    const inputId = `matrix-${matrix.id}`;
                    const applicability = matrixApplicabilityLabel(matrix, draft.offerId);
                    return (
                      <li key={matrix.id} className="flex items-start gap-3 py-3">
                        <input
                          type="radio"
                          id={inputId}
                          name="matrix"
                          className="mt-1.5"
                          checked={draft.matrixId === matrix.id}
                          onChange={() => update({ matrixId: matrix.id })}
                        />
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={inputId} className="text-sm font-medium">
                            {matrix.code} · {matrix.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {matrix.version} · vigência{" "}
                            <span className="font-mono text-tabular">
                              {matrix.effectiveFrom} —{" "}
                              {matrix.effectiveUntil ?? "sem término registrado"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Aplicabilidade: {applicability}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="ghost" className="shrink-0">
                          <Link to="/matrizes-curriculares/$id" params={{ id: matrix.id }}>
                            Consultar matriz
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <FieldError issue={classIssueFor(issues, "matrixId")} />
            </DetailSection>
          </section>

          <section id="identificacao" aria-labelledby="identificacao-title">
            <DetailSection
              title="Identificação"
              description="O nome não é a identidade permanente da turma: o identificador demonstrativo é registrado separadamente."
              titleId="identificacao-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="class-name">Identificação/nome da turma</Label>
                  <Input
                    id="class-name"
                    className="mt-1 h-9"
                    value={draft.name}
                    aria-invalid={Boolean(classIssueFor(issues, "name"))}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                  <FieldError issue={classIssueFor(issues, "name")} />
                </div>
                <div>
                  <Label htmlFor="class-code">Identificador demonstrativo</Label>
                  <Input
                    id="class-code"
                    className="mt-1 h-9 font-mono text-tabular"
                    value={draft.code}
                    onChange={(event) => update({ code: event.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum padrão oficial de codificação é presumido nesta etapa.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="class-note">Observação de contexto (opcional)</Label>
                <Textarea
                  id="class-note"
                  className="mt-1"
                  rows={2}
                  value={draft.note}
                  onChange={(event) => update({ note: event.target.value })}
                />
              </div>
            </DetailSection>
          </section>

          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisão"
              description="Resumo estrutural antes da conclusão demonstrativa."
              titleId="revisao-title"
            >
              <DefinitionList
                items={[
                  {
                    term: "Unidade",
                    detail: draft.unitId ? getClassUnitName(draft.unitId) : "Não informada",
                  },
                  { term: "Período letivo", detail: draft.academicPeriodLabel || "Não informado" },
                  {
                    term: "Oferta",
                    detail: selectedOffer
                      ? `${selectedOffer.stage} · ${selectedOffer.organization}`
                      : "Não informada",
                  },
                  { term: "Organização", detail: draft.academicOrganization || "Não informada" },
                  { term: "Turno", detail: draft.shift || "Não informado" },
                  { term: "Jornada", detail: draft.journey || "Não informada" },
                  {
                    term: "Matriz e versão",
                    detail: selectedMatrix
                      ? `${selectedMatrix.code} · ${selectedMatrix.version}`
                      : "Não informada",
                  },
                  { term: "Identificação", detail: draft.name || "Não informada" },
                  { term: "Identificador", detail: draft.code || "Não informado" },
                ]}
              />

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Agrupamentos da turma</h3>
                {selectedGroupings.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Nenhum agrupamento.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm" aria-label="Agrupamentos em revisão">
                    {selectedGroupings.map((group) => (
                      <li key={group.label}>
                        {group.label}{" "}
                        <span className="text-xs text-muted-foreground">({group.kind})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {mode === "edicao" ? (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold">Alterações estruturais</h3>
                  {changes.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhuma alteração em relação ao contexto atual da turma.
                    </p>
                  ) : (
                    <ul
                      className="mt-2 divide-y divide-border border-y border-border text-xs"
                      aria-label="Alterações estruturais"
                    >
                      {changes.map((change) => (
                        <li key={change.field} className="py-2">
                          <span className="font-medium">{change.field}:</span> {change.from} →{" "}
                          {change.to}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Alterações estruturais ficam preparadas para auditoria futura. Fatos históricos
                    já registrados não devem ser reescritos silenciosamente.
                  </p>
                </div>
              ) : null}

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Avisos e pendências</h3>
                {issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma pendência identificada nesta demonstração.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs" aria-label="Avisos e pendências">
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
                <p className="mt-3 text-xs text-muted-foreground">
                  {errors.length
                    ? `Concluir configuração indisponível: ${errors.length} erro(s) de preenchimento.`
                    : `Pronto para conclusão demonstrativa com ${warnings.length} aviso(s) em aberto.`}
                </p>
              </div>
            </DetailSection>
          </section>
        </div>
      </div>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              O workspace não salva nem armazena dados nesta etapa. Ao sair, a configuração é
              descartada e nenhuma turma existente é alterada.
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
                ? "Conclusão demonstrativa registrada"
                : "Concluir configuração (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Fluxo visual concluído. Nenhuma turma foi gravada no sistema, nenhum dado foi persistido e nenhum contexto histórico foi alterado."
                : "Concluir configuração demonstra apenas o encerramento da configuração no SIGEM. Não há persistência, matrícula, enturmação ou atribuição."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {selectedGroupings.length} agrupamento(s) · {warnings.length} aviso(s) em aberto ·{" "}
            {changes.length} alteração(ões) estrutural(is).
          </div>
          <DialogFooter>
            {concluded ? (
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  leave();
                }}
              >
                Voltar para turmas
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
