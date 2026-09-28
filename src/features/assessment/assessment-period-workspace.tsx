/**
 * 6D.3.3.2 — Assessment Period Workspace (Mesa Avaliativa do Período).
 *
 * Superfície COMPREENDER → LOCALIZAR → NAVEGAR. Consome EXCLUSIVAMENTE a
 * `AssessmentPeriodProjection`: não calcula, não edita célula e não decide
 * ações. Lançamento é da Pauta 2.0; correção é do painel focal homologado.
 */
import { useMemo, useState } from "react";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AssessmentPeriodProjection,
  PeriodCellProjection,
  PeriodInstrumentProjection,
  PeriodProjectedAction,
  PeriodStudentProjection,
} from "./assessment-period-projection";
import {
  INPUT_KIND_LABELS,
  presentComposition,
  presentInstrumentCounts,
  presentPeriodCell,
} from "./assessment-period-presentation";

type Available = Extract<AssessmentPeriodProjection, { state: "period-available" }>;

export type AssessmentPeriodWorkspaceProps = {
  projection: Available;
  /** Link para a Pauta 2.0 homologada; a Mesa não reconstrói o lançamento. */
  renderOpenPauta: (instrumentId: string, label: string) => React.ReactNode;
  correcting?: { studentId: string; instrumentId: string } | null;
  onRequestCorrection: (studentId: string, instrumentId: string) => void;
  renderCorrection: (student: PeriodStudentProjection, cell: PeriodCellProjection) => React.ReactNode;
  formatDate?: (iso: string) => string;
};

const TONE: Record<string, string> = {
  fact: "text-foreground font-medium",
  absent: "text-muted-foreground",
  "fact-missing": "text-foreground italic",
  muted: "text-muted-foreground/80",
  protected: "text-muted-foreground",
};

function norm(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function ActionButton({
  action,
  onClick,
  accessibleName,
}: {
  action: PeriodProjectedAction;
  onClick: () => void;
  accessibleName?: string;
}) {
  if (!action.available)
    return (
      <span className="text-xs text-muted-foreground" title={action.blockedReasons.join(" ")}>
        {action.label} indisponível — {action.blockedReasons.join(" ")}
      </span>
    );
  return (
    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClick} aria-label={accessibleName}>
      {action.label}
    </Button>
  );
}

function CellView({
  student,
  cell,
  instrumentTitle,
  onAction,
  compact,
}: {
  student: PeriodStudentProjection;
  cell: PeriodCellProjection;
  instrumentTitle: string;
  onAction: (actionId: string) => void;
  compact?: boolean;
}) {
  const p = presentPeriodCell(cell);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-0.5" data-testid={`period-cell-${student.studentId}-${cell.instrumentId}`} data-state={cell.state}>
      <span className={cn("text-sm", TONE[p.tone])}>
        {p.label}
        {p.correctionNote && compact && (
          <span className="text-muted-foreground"> · {p.correctionNote}</span>
        )}
      </span>
      {p.correctionNote && !compact && (
        <span className="text-xs text-muted-foreground">{p.correctionNote}</span>
      )}
      {p.detail && (
        <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Ocultar" : cell.state === "explicitly-unrecorded" ? "Ver motivo" : "Ver"}
        </button>
      )}
      {open && p.detail && (
        <p className={cn("whitespace-pre-wrap rounded-sm bg-muted p-2 text-xs", compact ? "" : "max-w-xs")}>{p.detail}</p>
      )}
      {p.versionNote && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Histórico</summary>
          <p className="mt-1">{p.versionNote}</p>
          {cell.currentVersionSupersedesVersionId && (
            <p>Substitui a versão {cell.currentVersionSupersedesVersionId}</p>
          )}
        </details>
      )}
      {cell.actions.map((a) => (
        <ActionButton
          key={a.actionId}
          action={a}
          onClick={() => onAction(a.actionId)}
          accessibleName={cellActionAccessibleName(a.label, student.displayName, instrumentTitle)}
        />
      ))}
    </div>
  );
}

function CompositionView({ student }: { student: PeriodStudentProjection }) {
  const p = presentComposition(student.composition);
  const [open, setOpen] = useState(false);
  const c = student.composition;
  return (
    <div className="flex flex-col items-start gap-0.5" data-testid={`period-composition-${student.studentId}`}>
      <span className="text-sm font-medium">{p.label}</span>
      {(p.explainable || p.reasons.length > 0) && (
        <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {p.explainable ? "Como foi calculado?" : "Por quê?"}
        </button>
      )}
      {open && (
        <div className="max-w-sm space-y-1 rounded-sm bg-muted p-2 text-xs">
          {p.reasons.map((r) => <p key={r}>{r}</p>)}
          {c.kind === "composed" && (
            <>
              {c.categories.map((cat) => (
                <p key={cat.categoryId}>
                  {cat.label}: {cat.stage ? String(cat.stage.value).replace(".", ",") : "sem registros suficientes"}
                </p>
              ))}
              <p className="text-muted-foreground">A explicação detalhada virá na próxima etapa.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StudentName({ s }: { s: PeriodStudentProjection }) {
  return (
    <div className="min-w-0">
      <span className="break-words">
        {s.rollNumber !== undefined && <span className="mr-1 tabular-nums text-muted-foreground">{s.rollNumber}.</span>}
        {s.displayName}
      </span>
      {s.identityDiscriminator && <span className="block text-xs text-muted-foreground">{s.identityDiscriminator}</span>}
    </div>
  );
}

export function AssessmentPeriodWorkspace({
  projection,
  renderOpenPauta,
  correcting,
  onRequestCorrection,
  renderCorrection,
  formatDate = (d) => d,
}: AssessmentPeriodWorkspaceProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return projection.students;
    return projection.students.filter(
      (s) => norm(s.displayName).includes(q) || (s.identityDiscriminator && norm(s.identityDiscriminator).includes(q)),
    );
  }, [query, projection.students]);

  const onCellAction = (student: PeriodStudentProjection, cell: PeriodCellProjection, actionId: string) => {
    if (actionId === "corrigir") onRequestCorrection(student.studentId, cell.instrumentId);
  };

  const correctingPair = correcting
    ? (() => {
        const s = projection.students.find((x) => x.studentId === correcting.studentId);
        const c = s?.cells.find((x) => x.instrumentId === correcting.instrumentId);
        return s && c ? { s, c } : null;
      })()
    : null;

  const instrumentById = new Map(projection.instruments.map((i) => [i.instrumentId, i]));
  const b = projection.balance;

  return (
    <div className="space-y-6">
      {projection.disclosures.map((d) => (
        <p key={d} role="note" className="text-sm text-muted-foreground">{d}</p>
      ))}

      <section aria-labelledby="period-instruments-title" className="space-y-2">
        <h2 id="period-instruments-title" className="text-base font-semibold">Instrumentos do período</h2>
        <ul className="divide-y divide-border rounded-md border border-border">
          {projection.instruments.map((i: PeriodInstrumentProjection) => (
            <li key={i.instrumentId} className="flex flex-wrap items-center justify-between gap-2 p-3" data-testid={`period-instrument-${i.instrumentId}`}>
              <div className="min-w-0">
                <p className="font-medium break-words">{i.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(i.appliedOn)}
                  {i.inputKind ? ` · ${INPUT_KIND_LABELS[i.inputKind] ?? i.inputKind}` : ""}
                </p>
                <p className="text-sm">{i.entryState === "entry-enabled" ? presentInstrumentCounts(i) : i.unavailableReasons?.join(" ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {i.actions.map((a) =>
                  a.available ? (
                    <span key={a.actionId}>{renderOpenPauta(i.instrumentId, a.label)}</span>
                  ) : (
                    <span key={a.actionId} className="text-xs text-muted-foreground">
                      {a.label} indisponível — {a.blockedReasons.join(" ")}
                    </span>
                  ),
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="period-course-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="period-course-title" className="text-base font-semibold">Percurso da turma</h2>
            <p className="text-sm text-muted-foreground">
              {b.students} estudantes · {b.cellsRecorded} registrados · {b.cellsExplicitlyUnrecorded} não registrados · {b.cellsUnrecorded} sem resultado · {b.cellsNotApplicable} não se aplicam
            </p>
          </div>
          <label className="w-full sm:w-64">
            <span className="sr-only">Buscar estudante</span>
            <Input
              type="search"
              placeholder="Buscar estudante"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="period-search"
            />
          </label>
        </div>

        {correctingPair && (
          <div className="rounded-md border border-border p-3" data-testid="period-correction">
            {renderCorrection(correctingPair.s, correctingPair.c)}
          </div>
        )}

        {/* Desktop: matriz compacta de consulta — nenhuma célula é campo editável. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm" data-testid="period-matrix">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 font-medium">Estudante</th>
                {projection.instruments.map((i) => (
                  <th key={i.instrumentId} scope="col" className="px-2 py-2 font-medium">{i.title}</th>
                ))}
                <th scope="col" className="px-2 py-2 font-medium">Composição</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.studentId} className="border-b border-border/60 align-top" data-testid={`period-row-${s.studentId}`}>
                  <th scope="row" className="py-2 pr-3 font-normal"><StudentName s={s} /></th>
                  {s.cells.map((c) => (
                    <td key={c.instrumentId} className="px-2 py-2">
                      <CellView student={s} cell={c} onAction={(id) => onCellAction(s, c, id)} />
                    </td>
                  ))}
                  <td className="px-2 py-2"><CompositionView student={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Celular: lista de estudantes com expansão focal. */}
        <ul className="space-y-2 md:hidden" data-testid="period-list">
          {visible.map((s) => (
            <li key={s.studentId} className="rounded-md border border-border">
              <details>
                <summary className="flex min-h-11 cursor-pointer items-start justify-between gap-2 p-3">
                  <StudentName s={s} />
                  <span className="shrink-0 text-sm">{presentComposition(s.composition).label}</span>
                </summary>
                <div className="space-y-3 border-t border-border p-3">
                  {s.cells.map((c) => (
                    <div key={c.instrumentId} className="space-y-1">
                      <p className="text-xs text-muted-foreground break-words">{instrumentById.get(c.instrumentId)?.title}</p>
                      <CellView compact student={s} cell={c} onAction={(id) => onCellAction(s, c, id)} />
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-muted-foreground">Composição</p>
                    <CompositionView student={s} />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nenhum estudante corresponde à busca.</p>}
      </section>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Detalhes normativos</summary>
        <p className="mt-1">
          Configuração {projection.context.configurationId} v{projection.context.configurationVersion} · período {projection.context.periodId}
          {projection.context.closingReference ? ` · fechamento ${projection.context.closingReference.closingId} v${projection.context.closingReference.closingVersion}` : ""}
        </p>
      </details>
    </div>
  );
}
