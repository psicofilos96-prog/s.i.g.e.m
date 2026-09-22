import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  GitBranch,
  Minus,
  Plus,
  Replace,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { MatrixTable } from "@/components/sigem/curriculum-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEMO_MATRIX_SEGMENTS,
  getCurriculumMatrix,
  type DemoMatrixSegment,
} from "@/features/curriculum/curriculum-data";
import {
  addExperienceField,
  addGridElement,
  changeKindLabel,
  computeGridTotals,
  createBlankGridDraft,
  createDraftFromMatrix,
  diffStructures,
  formatIsoDate,
  gridRows,
  isDraftDirty,
  issueFor,
  moveExperienceField,
  moveGridElement,
  removeExperienceField,
  removeGridElement,
  setExperienceFieldLabel,
  setExtendedAxisLabel,
  setGridElementLabel,
  setGridValue,
  setJourneyWeekly,
  validateDraft,
  type DraftChange,
  type DraftIssue,
  type MatrixDraft,
} from "@/features/curriculum/matrix-draft";

/**
 * WORKSPACE DEDICADO DE MATRIZ CURRICULAR (padrão B — edição estruturada).
 * Drawer/Sheet permanece reservado a edição contextual curta.
 *
 * Nada é persistido: o estado vive apenas nesta página. Concluir versão é uma
 * demonstração visual e NÃO representa aprovação, homologação ou publicação
 * normativa — competência institucional ainda não modelada no SIGEM.
 */

export type WorkspaceMode = "nova-matriz" | "nova-versao" | "rascunho";

const SECTIONS = [
  { id: "identificacao", label: "Identificação" },
  { id: "aplicabilidade", label: "Aplicabilidade e vigência" },
  { id: "referencia", label: "Referência normativa" },
  { id: "estrutura", label: "Estrutura curricular" },
  { id: "comparacao", label: "Comparação de versões" },
  { id: "revisao", label: "Revisão" },
] as const;

function FieldError({ issue }: { issue?: DraftIssue }) {
  if (!issue) return null;
  return (
    <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {issue.message}
    </p>
  );
}

const CHANGE_ICON: Record<DraftChange["kind"], typeof Plus> = {
  added: Plus,
  removed: Minus,
  load: Replace,
  organization: GitBranch,
};

export function MatrixVersionDiff({
  changes,
  previousLabel,
  nextLabel,
}: {
  changes: DraftChange[];
  previousLabel: string;
  nextLabel: string;
}) {
  if (!changes.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma alteração registrada entre {previousLabel} e {nextLabel}.
      </p>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">
        Comparação {previousLabel} ↔ {nextLabel}. Cada alteração é identificada por ícone e texto,
        sem depender de cor.
      </p>
      <ul className="mt-3 divide-y divide-border border-y border-border" aria-label="Alterações">
        {changes.map((change) => {
          const Icon = CHANGE_ICON[change.kind];
          return (
            <li key={change.id} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center border border-border text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {changeKindLabel(change.kind)}:{" "}
                  </span>
                  {change.label}
                </p>
                <p className="font-mono text-[0.6875rem] text-tabular text-muted-foreground">
                  {change.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GridEditor({
  draft,
  issues,
  onChange,
}: {
  draft: MatrixDraft;
  issues: DraftIssue[];
  onChange: (next: MatrixDraft) => void;
}) {
  if (draft.structure.kind !== "grid") return null;
  const structure = draft.structure;
  const rows = gridRows(structure);
  const computed = computeGridTotals(structure);

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs text-muted-foreground">
        Organização: {structure.organizationLabel || "a definir"} · unidade de leitura:{" "}
        {structure.unitLabel}. A terminologia é neutra: um elemento curricular pode ser componente,
        campo ou elemento de ampliação.
      </p>
      <div className="min-w-0 overflow-auto border border-border bg-card shadow-panel">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">Edição dos elementos curriculares</caption>
          <thead className="sticky top-0 z-20 bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold">
                Elemento curricular
              </th>
              {structure.columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold"
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right text-xs font-semibold">
                Soma
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-semibold">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={structure.columns.length + 3}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  Estrutura sem elementos curriculares.
                </td>
              </tr>
            ) : null}
            {rows.map((row, rowIndex) => {
              const rowSum = row.values.reduce(
                (total, value) => (typeof value === "number" ? total + value : total),
                0,
              );
              return (
                <tr key={row.id} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <Label className="sr-only" htmlFor={`row-${row.id}`}>
                      Denominação do elemento curricular {rowIndex + 1}
                    </Label>
                    <Input
                      id={`row-${row.id}`}
                      className="h-8 w-56 text-sm"
                      value={row.label}
                      aria-invalid={Boolean(issueFor(issues, `row-label-${row.id}`))}
                      onChange={(event) =>
                        onChange(setGridElementLabel(draft, row.id, event.target.value))
                      }
                    />
                    <FieldError issue={issueFor(issues, `row-label-${row.id}`)} />
                  </th>
                  {structure.columns.map((column, index) => (
                    <td key={column.id} className="px-3 py-2 text-right">
                      <Label className="sr-only" htmlFor={`cell-${row.id}-${column.id}`}>
                        {row.label || `Elemento ${rowIndex + 1}`} em {column.label}
                      </Label>
                      <Input
                        id={`cell-${row.id}-${column.id}`}
                        inputMode="decimal"
                        className="h-8 w-16 text-right font-mono text-xs text-tabular tabular-nums"
                        value={row.values[index] ?? ""}
                        onChange={(event) =>
                          onChange(setGridValue(draft, row.id, index, event.target.value))
                        }
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono text-xs text-tabular tabular-nums">
                    {rowSum}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Mover ${row.label || `elemento ${rowIndex + 1}`} para cima`}
                      onClick={() => onChange(moveGridElement(draft, row.id, "up"))}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Mover ${row.label || `elemento ${rowIndex + 1}`} para baixo`}
                      onClick={() => onChange(moveGridElement(draft, row.id, "down"))}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Remover ${row.label || `elemento ${rowIndex + 1}`}`}
                      onClick={() => onChange(removeGridElement(draft, row.id))}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted">
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left text-xs font-semibold">
                Total calculado
              </th>
              {computed.map((value, index) => (
                <td
                  key={structure.columns[index]?.id ?? index}
                  className="px-3 py-2 text-right font-mono text-xs font-semibold text-tabular tabular-nums"
                >
                  {value ?? "—"}
                </td>
              ))}
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
            <tr className="border-t border-border">
              <th
                scope="row"
                className="px-3 py-2 text-left text-xs font-normal text-muted-foreground"
              >
                Referência documentada
              </th>
              {structure.columns.map((column, index) => (
                <td
                  key={column.id}
                  className="px-3 py-2 text-right font-mono text-xs text-tabular tabular-nums text-muted-foreground"
                >
                  {structure.totals?.[index] ?? "—"}
                </td>
              ))}
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      <Button size="sm" variant="outline" onClick={() => onChange(addGridElement(draft))}>
        <Plus /> Adicionar elemento curricular
      </Button>
      <p className="text-xs text-muted-foreground">
        Valor calculado e referência documentada são exibidos separadamente; divergências não são
        silenciadas nem corrigidas automaticamente.
      </p>
    </div>
  );
}

function ExperienceFieldsEditor({
  draft,
  issues,
  onChange,
}: {
  draft: MatrixDraft;
  issues: DraftIssue[];
  onChange: (next: MatrixDraft) => void;
}) {
  if (draft.structure.kind !== "experience-fields") return null;
  const structure = draft.structure;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Educação Infantil: a edição se organiza por campos de experiências, agrupamentos e jornadas.
        Não há grade de disciplinas nem planilha de componentes.
      </p>
      <div>
        <h3 className="text-sm font-semibold">Agrupamentos</h3>
        <p className="text-xs text-muted-foreground">{structure.organizationLabel}</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Agrupamentos">
          {structure.groupings.map((grouping) => (
            <li key={grouping.id} className="border border-border px-2 py-1 text-xs">
              {grouping.label}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Campos de experiências</h3>
        <ul
          className="mt-2 divide-y divide-border border-y border-border"
          aria-label="Campos de experiências"
        >
          {structure.fields.length === 0 ? (
            <li className="py-4 text-xs text-muted-foreground">
              Estrutura sem campos de experiências.
            </li>
          ) : null}
          {structure.fields.map((field, index) => (
            <li key={field.id} className="flex flex-wrap items-start gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <Label className="sr-only" htmlFor={`campo-${field.id}`}>
                  Denominação do campo de experiências {index + 1}
                </Label>
                <Input
                  id={`campo-${field.id}`}
                  className="h-8 text-sm"
                  value={field.label}
                  aria-invalid={Boolean(issueFor(issues, `field-label-${field.id}`))}
                  onChange={(event) =>
                    onChange(setExperienceFieldLabel(draft, field.id, event.target.value))
                  }
                />
                <FieldError issue={issueFor(issues, `field-label-${field.id}`)} />
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Mover ${field.label || `campo ${index + 1}`} para cima`}
                  onClick={() => onChange(moveExperienceField(draft, field.id, "up"))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Mover ${field.label || `campo ${index + 1}`} para baixo`}
                  onClick={() => onChange(moveExperienceField(draft, field.id, "down"))}
                >
                  <ArrowDown />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Remover ${field.label || `campo ${index + 1}`}`}
                  onClick={() => onChange(removeExperienceField(draft, field.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => onChange(addExperienceField(draft))}
        >
          <Plus /> Adicionar campo de experiências
        </Button>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Jornadas e cargas aplicáveis</h3>
        <p className="text-xs text-muted-foreground">
          A jornada integral é organização de oferta com ampliação curricular, nunca um Sim/Não.
        </p>
        <div className="mt-2 space-y-3">
          {structure.journeys.map((journey) => (
            <div key={journey.id} className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor={`journey-${journey.id}`} className="text-xs">
                  {journey.label}
                </Label>
                <Input
                  id={`journey-${journey.id}`}
                  className="mt-1 h-8 w-48 text-sm"
                  value={journey.weekly}
                  onChange={(event) =>
                    onChange(setJourneyWeekly(draft, journey.id, event.target.value))
                  }
                />
              </div>
              <p className="max-w-lg flex-1 text-xs text-muted-foreground">{journey.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExtendedTimeEditor({
  draft,
  onChange,
}: {
  draft: MatrixDraft;
  onChange: (next: MatrixDraft) => void;
}) {
  if (draft.structure.kind !== "extended-time") return null;
  const structure = draft.structure;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{structure.description}</p>
      <div className="space-y-3">
        {structure.axes.map((axis) => (
          <div key={axis.id}>
            <Label htmlFor={`axis-${axis.id}`} className="text-xs">
              Eixo de ampliação curricular
            </Label>
            <Input
              id={`axis-${axis.id}`}
              className="mt-1 h-8 max-w-lg text-sm"
              value={axis.label}
              onChange={(event) =>
                onChange(setExtendedAxisLabel(draft, axis.id, event.target.value))
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">{axis.description}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold">Não modelado nesta etapa</h3>
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
          {structure.pending.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MatrixWorkspacePage({
  mode,
  originId,
}: {
  mode: WorkspaceMode;
  originId?: string;
}) {
  const originMatrix = originId ? getCurriculumMatrix(originId) : undefined;
  const initialDraft = useMemo<MatrixDraft | null>(() => {
    if (mode === "nova-matriz") return createBlankGridDraft();
    if (!originMatrix) return null;
    if (mode === "rascunho") {
      const draft = createDraftFromMatrix(originMatrix);
      return {
        ...draft,
        code: originMatrix.code,
        versionLabel: originMatrix.version,
        normativeReference: originMatrix.normativeReference,
        origin: originMatrix.previousVersionId
          ? (() => {
              const previous = getCurriculumMatrix(originMatrix.previousVersionId!);
              return previous
                ? {
                    matrixId: previous.id,
                    versionLabel: previous.version,
                    effectiveFrom: previous.effectiveFrom,
                    effectiveUntil: previous.effectiveUntil,
                    structure: previous.structure,
                  }
                : null;
            })()
          : null,
      };
    }
    return createDraftFromMatrix(originMatrix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, originId]);

  const [draft, setDraft] = useState<MatrixDraft | null>(initialDraft);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  if (!draft || !initialDraft) {
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Matriz de origem não encontrada"
          description="O identificador informado não corresponde às matrizes demonstrativas disponíveis."
          action={
            <Button asChild variant="outline">
              <Link to="/matrizes-curriculares">Voltar para matrizes curriculares</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const issues = validateDraft(draft);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "aviso");
  const dirty = isDraftDirty(draft, initialDraft);
  const changes = draft.origin ? diffStructures(draft.origin.structure, draft.structure) : [];
  const originLabel = draft.origin
    ? `${draft.origin.versionLabel} (${draft.origin.effectiveFrom} — ${draft.origin.effectiveUntil ?? "sem término registrado"})`
    : "Nenhuma versão de origem: matriz criada do zero";

  const title =
    mode === "nova-matriz"
      ? "Nova matriz curricular (rascunho)"
      : mode === "nova-versao"
        ? `Nova versão de ${originMatrix?.name ?? "matriz"}`
        : `Rascunho de ${draft.name}`;

  function leave() {
    void navigate({ to: "/matrizes-curriculares" });
  }

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={title}
        description="Workspace dedicado de edição estruturada. Nada é persistido nesta etapa."
        parent={{ label: "Matrizes curriculares", to: "/matrizes-curriculares" }}
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
              <CheckCircle2 /> Concluir versão
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Rascunho</StatusBadge>
        <span className="text-muted-foreground">Origem: {originLabel}</span>
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
          <section id="identificacao" aria-labelledby="identificacao-title">
            <DetailSection
              title="Identificação"
              description="Identidade da matriz e da versão em elaboração."
              titleId="identificacao-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nome da matriz</Label>
                  <Input
                    id="name"
                    className="mt-1 h-9"
                    value={draft.name}
                    aria-invalid={Boolean(issueFor(issues, "name"))}
                    aria-describedby={issueFor(issues, "name") ? "name-error" : undefined}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                  <span id="name-error">
                    <FieldError issue={issueFor(issues, "name")} />
                  </span>
                </div>
                <div>
                  <Label htmlFor="code">Código demonstrativo</Label>
                  <Input
                    id="code"
                    className="mt-1 h-9 font-mono text-tabular"
                    value={draft.code}
                    aria-invalid={Boolean(issueFor(issues, "code"))}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                  />
                  <FieldError issue={issueFor(issues, "code")} />
                </div>
                <div>
                  <Label htmlFor="versionLabel">Versão</Label>
                  <Input
                    id="versionLabel"
                    className="mt-1 h-9"
                    value={draft.versionLabel}
                    onChange={(event) => setDraft({ ...draft, versionLabel: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="summary">Leitura resumida</Label>
                  <Textarea
                    id="summary"
                    className="mt-1 min-h-[2.25rem] text-sm"
                    value={draft.summary}
                    onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  />
                </div>
              </div>
            </DetailSection>
          </section>

          <section id="aplicabilidade" aria-labelledby="aplicabilidade-title">
            <DetailSection
              title="Aplicabilidade e vigência"
              description="A que organização acadêmica a versão se aplica e em que período demonstrativo."
              titleId="aplicabilidade-title"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="segment">Segmento / organização</Label>
                  <Select
                    value={draft.segment || undefined}
                    onValueChange={(value) =>
                      setDraft({ ...draft, segment: value as DemoMatrixSegment })
                    }
                  >
                    <SelectTrigger id="segment" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_MATRIX_SEGMENTS.map((segment) => (
                        <SelectItem key={segment} value={segment}>
                          {segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError issue={issueFor(issues, "segment")} />
                </div>
                <div>
                  <Label htmlFor="organization">Organização acadêmica</Label>
                  <Input
                    id="organization"
                    className="mt-1 h-9"
                    value={draft.organization}
                    onChange={(event) => setDraft({ ...draft, organization: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="effectiveFrom">Início da vigência</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    className="mt-1 h-9"
                    value={draft.effectiveFrom}
                    aria-invalid={Boolean(issueFor(issues, "effectiveFrom"))}
                    onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })}
                  />
                  <FieldError issue={issueFor(issues, "effectiveFrom")} />
                </div>
                <div>
                  <Label htmlFor="effectiveUntil">Término da vigência (opcional)</Label>
                  <Input
                    id="effectiveUntil"
                    type="date"
                    className="mt-1 h-9"
                    value={draft.effectiveUntil}
                    aria-invalid={Boolean(issueFor(issues, "effectiveUntil"))}
                    onChange={(event) => setDraft({ ...draft, effectiveUntil: event.target.value })}
                  />
                  <FieldError issue={issueFor(issues, "effectiveUntil")} />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Definir esta vigência não altera a vigência nem a estrutura da versão anterior.
              </p>
            </DetailSection>
          </section>

          <section id="referencia" aria-labelledby="referencia-title">
            <DetailSection
              title="Referência normativa"
              description="Documento de referência demonstrativo; nenhum fluxo de aprovação é implementado."
              titleId="referencia-title"
            >
              <Label htmlFor="normativeReference">Documento de referência</Label>
              <Input
                id="normativeReference"
                className="mt-1 h-9 max-w-xl"
                value={draft.normativeReference}
                onChange={(event) => setDraft({ ...draft, normativeReference: event.target.value })}
              />
              <FieldError issue={issueFor(issues, "normativeReference")} />
            </DetailSection>
          </section>

          <section id="estrutura" aria-labelledby="estrutura-title">
            <DetailSection
              title="Estrutura curricular"
              description="O editor se adapta à natureza da organização: campos de experiências, componentes por ano, fases da EJA ou eixos de ampliação."
              titleId="estrutura-title"
            >
              <GridEditor draft={draft} issues={issues} onChange={setDraft} />
              <ExperienceFieldsEditor draft={draft} issues={issues} onChange={setDraft} />
              <ExtendedTimeEditor draft={draft} onChange={setDraft} />
              <FieldError issue={issueFor(issues, "structure")} />
            </DetailSection>
          </section>

          <section id="comparacao" aria-labelledby="comparacao-title">
            <DetailSection
              title="Comparação de versões"
              description="O que muda em relação à versão de origem, antes de concluir."
              titleId="comparacao-title"
            >
              {draft.origin ? (
                <MatrixVersionDiff
                  changes={changes}
                  previousLabel={draft.origin.versionLabel}
                  nextLabel={draft.versionLabel}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Matriz criada do zero: não há versão anterior para comparar.
                </p>
              )}
            </DetailSection>
          </section>

          <section id="revisao" aria-labelledby="revisao-title">
            <DetailSection
              title="Revisão"
              description="Leitura final de dados gerais, vigência, estrutura, alterações e inconsistências."
              titleId="revisao-title"
            >
              <DefinitionList
                items={[
                  { term: "Nome", detail: draft.name || "Não informado" },
                  { term: "Código", detail: draft.code || "Não informado" },
                  { term: "Versão", detail: draft.versionLabel },
                  { term: "Segmento", detail: draft.segment || "Não informado" },
                  {
                    term: "Vigência",
                    detail: (
                      <span className="font-mono text-tabular">
                        {draft.effectiveFrom ? formatIsoDate(draft.effectiveFrom) : "não informada"}{" "}
                        —{" "}
                        {draft.effectiveUntil
                          ? formatIsoDate(draft.effectiveUntil)
                          : "sem término registrado"}
                      </span>
                    ),
                  },
                  { term: "Referência", detail: draft.normativeReference || "Não informada" },
                  { term: "Versão de origem", detail: originLabel },
                  {
                    term: "Alterações identificadas",
                    detail: `${changes.length} alteração(ões) em relação à versão de origem`,
                  },
                ]}
              />

              {draft.structure.kind === "grid" ? (
                <div className="mt-5 min-w-0">
                  <h3 className="text-sm font-semibold">Estrutura e cargas em revisão</h3>
                  <div className="mt-2">
                    <MatrixTable
                      label={`Revisão da estrutura de ${draft.name || "matriz em rascunho"}`}
                      rowsHeader={draft.structure.rowsHeader}
                      unitLabel={draft.structure.unitLabel}
                      columns={draft.structure.columns}
                      groups={draft.structure.groups}
                      totals={computeGridTotals(draft.structure)}
                      totalsLabel="Total calculado"
                      showRowTotals
                      rowTotalsHeader="Soma"
                      legend={[
                        "Total calculado a partir da estrutura editada.",
                        `Referência documentada: ${
                          draft.structure.totals
                            ?.map((value) => (value === null ? "—" : value))
                            .join(" · ") || "não registrada"
                        }.`,
                      ]}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Avisos e inconsistências</h3>
                {issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma pendência identificada nesta demonstração.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs" aria-label="Avisos e inconsistências">
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
                    ? `Concluir versão indisponível: ${errors.length} erro(s) de preenchimento.`
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
              O workspace não salva nem armazena dados nesta etapa. Ao sair, as alterações do
              rascunho são perdidas. A versão de origem permanece inalterada.
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
              {concluded ? "Conclusão demonstrativa registrada" : "Concluir versão (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Fluxo visual concluído. Nada foi salvo, nenhuma versão anterior foi alterada e nenhuma aprovação normativa ocorreu."
                : "Concluir versão demonstra apenas o encerramento da edição no SIGEM. Não representa aprovação, homologação ou publicação normativa, e nenhum dado é persistido."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            {changes.length} alteração(ões) em relação à versão de origem · {warnings.length}{" "}
            aviso(s) em aberto.
          </div>
          <DialogFooter>
            {concluded ? (
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  leave();
                }}
              >
                Voltar para matrizes curriculares
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
