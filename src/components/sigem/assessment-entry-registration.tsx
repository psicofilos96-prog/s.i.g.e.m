/**
 * 6D.3.2.3b — Conferência e Registro da Pauta.
 *
 * Superfície `Conferir → Registrar → Sucesso/Conflito → Reprojetar`. Nenhum
 * domínio novo: números, impedimentos e operações vêm de
 * `AssessmentEntryBatchPlan`; o ato é `commitAssessmentEntryBatch`; a grade é
 * sempre `projectInstrumentEntryRoster` sobre os FATOS relidos da fonte.
 *
 * - Conferir não registra: voltar à pauta não produz fato oficial.
 * - Rito de retificação vem de `resolveAssessmentCorrection`; a tela só o projeta.
 * - Conflito: nenhum registro parcial e nenhum rascunho perdido.
 * - Sucesso: rascunhos efetivados somem; a verdade volta a ser o domínio.
 */
import { useMemo, useRef, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  commitAssessmentEntryBatch,
  prepareAssessmentEntryBatch,
  type AssessmentBatchBlocker,
  type AssessmentBatchDraftItem,
  type AssessmentBatchOperation,
  type AssessmentEntryBatchAct,
  type AssessmentEntryBatchPlan,
  type PrepareAssessmentEntryBatchInput,
} from "@/features/assessment/assessment-entry-batch";
import {
  projectInstrumentEntryRoster,
  type InstrumentRosterItemProjection,
  type ProjectInstrumentEntryRosterInput,
} from "@/features/assessment/assessment-entry-projection";
import { resolveAssessmentCorrection } from "@/features/assessment/assessment-correction";
import { currentAssessmentEntryVersion, assessmentLogicalEntryId, type AssessmentEntryVersion } from "@/features/assessment/assessment-entry-versions";
import type { AssessmentConfiguration } from "@/features/assessment/assessment-types";
import { AssessmentEntryWorkspace, entryValueLabel, useAssessmentEntryDraft } from "./assessment-entry-grid";

/** Fonte dos fatos oficiais. Lida no momento de cada operação, nunca do estado React. */
export type AssessmentEntryFactSource = {
  readRoster: () => ProjectInstrumentEntryRosterInput;
  readActs: () => readonly AssessmentEntryBatchAct[];
  append: (versions: readonly AssessmentEntryVersion[], act: AssessmentEntryBatchAct) => void;
};

export type AssessmentEntryRegistrationContext = Omit<PrepareAssessmentEntryBatchInput, "roster" | "drafts">;

type Corrections = Record<string, { justification?: string; satisfied?: string[] }>;

type Phase =
  | { kind: "editing" }
  | { kind: "review"; bases: Record<string, string | null>; closing?: AssessmentEntryRegistrationContext["periodClosing"] }
  | { kind: "conflict"; plan: AssessmentEntryBatchPlan }
  | { kind: "success"; newRecords: number; rectifications: number };

export function AssessmentEntryRegistration({
  contextLabel,
  source,
  context,
  newVersionId,
  now = () => new Date().toISOString(),
  correctingStudentId,
  renderCorrection,
  onRequestCorrection,
  renderSuccessContinuation,
  readPeriodClosing,
}: {
  contextLabel: string;
  source: AssessmentEntryFactSource;
  context: AssessmentEntryRegistrationContext;
  newVersionId: (op: AssessmentBatchOperation) => string;
  now?: () => string;
  correctingStudentId?: string | undefined;
  renderCorrection?: ((item: InstrumentRosterItemProjection) => React.ReactNode) | undefined;
  onRequestCorrection?: ((studentId: string) => void) | undefined;
  /** 6D.3.3.4 — continuidade após registro (ex.: voltar à Avaliação do período). */
  renderSuccessContinuation?: (() => React.ReactNode) | undefined;
  /** 6D.3.4.3b — relê o fechamento vigente no instante da revisão e do registro. */
  readPeriodClosing?: (() => AssessmentEntryRegistrationContext["periodClosing"]) | undefined;
}) {
  // Reprojeção: incrementar `revision` relê a fonte de fatos.
  const [revision, setRevision] = useState(0);
  const projection = useMemo(
    () => projectInstrumentEntryRoster(source.readRoster()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, source],
  );
  const enabled = projection.state === "entry-enabled" ? projection : null;
  const rosterItems = enabled?.rosterItems ?? [];
  const mode = enabled?.inputMode ?? { kind: "descritiva" as const, maxLength: 1 };
  const balance = enabled?.surfaceBalance ?? {
    totalStudents: 0, recordedCount: 0, unrecordedCount: 0, notApplicableCount: 0, summaryLabel: "",
  };
  const draft = useAssessmentEntryDraft({ rosterItems, balance, inputMode: mode as never });
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  const [corrections, setCorrections] = useState<Corrections>({});
  const committing = useRef(false);

  const names = useMemo(
    () => new Map(rosterItems.map((item) => [item.studentId, item.displayName])),
    [rosterItems],
  );

  const draftItems = (bases: Record<string, string | null>): AssessmentBatchDraftItem[] =>
    Object.entries(draft.drafts).map(([studentId, value]) => {
      const c = corrections[studentId];
      return {
        studentId,
        value,
        expectedBaseVersionId: bases[studentId] ?? null,
        ...(c
          ? {
              correction: {
                ...(c.justification ? { justification: c.justification } : {}),
                ...(c.satisfied?.length ? { satisfiedRequirementCodes: c.satisfied } : {}),
              },
            }
          : {}),
      };
    });

  const liveClosing = () => (readPeriodClosing ? readPeriodClosing() : context.periodClosing);
  const buildInput = (
    bases: Record<string, string | null>,
    closing = liveClosing(),
  ): PrepareAssessmentEntryBatchInput => {
    const { periodClosing: _ignored, ...rest } = context;
    return { ...rest, ...(closing ? { periodClosing: closing } : {}), roster: source.readRoster(), drafts: draftItems(bases) };
  };

  const plan =
    phase.kind === "review" ? prepareAssessmentEntryBatch(buildInput(phase.bases, phase.closing)) : null;

  if (!enabled)
    return (
      <div role="status" data-testid="assessment-registration-unavailable">
        {projection.state === "entry-unavailable" ? projection.disclosableReasons.join(" ") : null}
      </div>
    );

  const openReview = () => {
    // A base é a que o professor tinha em mão: o fato exibido na pauta.
    const bases = Object.fromEntries(
      rosterItems.map((item: InstrumentRosterItemProjection) => [item.studentId, item.currentVersionId ?? null]),
    );
    // O plano fica ligado ao fechamento consultado ao abrir a revisão; o
    // registro relê o vigente, e a identidade do plano muda se ele mudou.
    setPhase({ kind: "review", bases, closing: liveClosing() });
  };

  const register = () => {
    if (!plan || phase.kind !== "review" || committing.current) return;
    committing.current = true;
    try {
      const result = commitAssessmentEntryBatch({
        plan,
        current: buildInput(phase.bases),
        committedActs: source.readActs(),
        newVersionId,
        now: now(),
      });
      if (!result.committed) {
        setRevision((r) => r + 1);
        setPhase({ kind: "conflict", plan: result.plan });
        return;
      }
      if (!result.alreadyCommitted) source.append(result.newVersions, result.act);
      const done = plan.operations.map((op) => op.studentId);
      draft.dropDrafts(done);
      setCorrections((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !done.includes(id))),
      );
      setRevision((r) => r + 1);
      setPhase({
        kind: "success",
        newRecords: plan.summary.newRecords,
        rectifications: plan.summary.rectifications,
      });
    } finally {
      committing.current = false;
    }
  };

  const footer = (
    <section className="sticky bottom-0 border-t border-border bg-background p-4" aria-live="polite">
      {phase.kind === "editing" && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="mr-auto text-sm text-muted-foreground">
            Conferir não registra nada: você poderá voltar à pauta.
          </p>
          <Button className="min-h-11" onClick={openReview} data-testid="assessment-review-open">
            Conferir lançamentos
          </Button>
        </div>
      )}

      {phase.kind === "success" && (
        <div role="status" data-testid="assessment-registration-success" className="space-y-3">
          <p className="font-semibold">Lançamentos registrados.</p>
          <p className="text-sm">
            {successSentence(phase.newRecords, phase.rectifications)} {phase.newRecords + phase.rectifications === 1 ? "passou" : "passaram"} a integrar oficialmente o Diário.
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => setPhase({ kind: "editing" })}>
            Continuar na pauta
          </Button>
          {renderSuccessContinuation?.()}
        </div>
      )}

      {phase.kind === "conflict" && (
        <div role="alert" data-testid="assessment-registration-conflict" className="space-y-3">
          <p className="font-semibold">A pauta mudou desde a conferência.</p>
          <p className="text-sm">Nenhum lançamento foi registrado. Suas alterações locais foram mantidas.</p>
          <BlockerList blockers={phase.plan.blockers} names={names} />
          <Button className="min-h-11" onClick={() => setPhase({ kind: "editing" })} data-testid="assessment-conflict-back">
            Voltar à pauta e revisar
          </Button>
        </div>
      )}

      {phase.kind === "review" && plan && (
        <div data-testid="assessment-review" className="space-y-4">
          <h2 className="text-base font-semibold">Conferência dos lançamentos</h2>
          <p className="text-sm" data-testid="assessment-review-summary">{reviewSummaryLabel(plan)}</p>
          {plan.summary.newRecords > 0 && (
            <div>
              <p className="font-medium">Novos registros — {plan.summary.newRecords}</p>
              <p className="text-sm text-muted-foreground">Serão registrados pela primeira vez.</p>
            </div>
          )}
          <RectificationList
            plan={plan}
            drafts={draft.drafts}
            names={names}
            mode={mode as never}
            context={context}
            roster={source.readRoster()}
            corrections={corrections}
            onChange={setCorrections}
          />
          {plan.blockers.length > 0 && <BlockerList blockers={plan.blockers} names={names} />}
          {plan.operations.length === 0 && plan.blockers.length === 0 && (
            <p className="text-sm">Não há nada a registrar: nenhuma alteração local difere dos registros oficiais.</p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" className="min-h-11" onClick={() => setPhase({ kind: "editing" })}>
              Voltar à pauta
            </Button>
            <Button
              className="min-h-11"
              disabled={plan.state !== "ready"}
              onClick={register}
              data-testid="assessment-register"
            >
              Registrar lançamentos
            </Button>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <AssessmentEntryWorkspace
      contextLabel={contextLabel}
      rosterItems={rosterItems}
      mode={mode as never}
      policy={enabled.missingEntryPolicy}
      draftController={draft}
      persistenceNote="Alterações locais ainda não registradas. O registro oficial ocorre só em “Registrar lançamentos”."
      footer={footer}
      correctingStudentId={correctingStudentId}
      renderCorrection={renderCorrection}
      onRequestCorrection={onRequestCorrection}
      onRequestReview={openReview}
    />
  );
}

/**
 * Fonte ÚNICA das contagens da conferência: alterações sobre registros
 * existentes incluem as prontas e as que aguardam exigência do rito, para que
 * cabeçalho e detalhamento nunca divirjam.
 */
export function existingRecordChangeIds(plan: AssessmentEntryBatchPlan): string[] {
  const ids = new Set<string>();
  for (const op of plan.operations) if (op.kind === "retificacao") ids.add(op.studentId);
  for (const b of plan.blockers) if (b.code === "retificacao-inadmissivel" && b.studentId) ids.add(b.studentId);
  return [...ids];
}

function reviewSummaryLabel(plan: AssessmentEntryBatchPlan): string {
  const { newRecords, remainingUnrecorded, notApplicable } = plan.summary;
  const changes = existingRecordChangeIds(plan).length;
  const parts = [
    `${newRecords} ${newRecords === 1 ? "novo registro" : "novos registros"}`,
    `${changes} ${changes === 1 ? "alteração de registro existente" : "alterações de registros existentes"}`,
    `${remainingUnrecorded} ${remainingUnrecorded === 1 ? "estudante continua" : "estudantes continuam"} sem registro`,
  ];
  if (notApplicable) parts.push(`${notApplicable} não se ${notApplicable === 1 ? "aplica" : "aplicam"}`);
  return parts.join(" · ");
}

function successSentence(newRecords: number, rectifications: number) {
  const parts: string[] = [];
  if (newRecords) parts.push(`${newRecords} ${newRecords === 1 ? "novo resultado" : "novos resultados"}`);
  if (rectifications) parts.push(`${rectifications} ${rectifications === 1 ? "correção" : "correções"}`);
  return parts.join(" e ");
}

function BlockerList({ blockers, names }: { blockers: readonly AssessmentBatchBlocker[]; names: Map<string, string> }) {
  return (
    <ul className="space-y-1 text-sm" data-testid="assessment-blockers">
      {blockers.map((blocker, index) => (
        <li key={`${blocker.code}-${blocker.studentId ?? "pauta"}-${index}`}>
          {blocker.studentId ? <strong>{names.get(blocker.studentId) ?? "Estudante"}: </strong> : null}
          {blocker.messages.join(" ")}
          {blocker.code === "versao-base-divergente" ? " Revise essa linha antes de tentar novamente." : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Alterações sobre registros oficiais. O rito exibido é EXATAMENTE o
 * `requiredRitual` do resolvedor; nada é exigido pela tela por conta própria.
 */
function RectificationList({
  plan, drafts, names, mode, context, roster, corrections, onChange,
}: {
  plan: AssessmentEntryBatchPlan;
  drafts: Readonly<Record<string, import("@/features/assessment/assessment-types").EntryValue>>;
  names: Map<string, string>;
  mode: Parameters<typeof entryValueLabel>[1];
  context: AssessmentEntryRegistrationContext;
  roster: ProjectInstrumentEntryRosterInput;
  corrections: Corrections;
  onChange: (next: Corrections) => void;
}) {
  const candidates = Object.keys(drafts)
    .map((studentId) => {
      const current = currentAssessmentEntryVersion(roster.versions, assessmentLogicalEntryId(roster.instrument.id, studentId));
      return current && current.status === "registrado" ? { studentId, current } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter(({ studentId }) => existingRecordChangeIds(plan).includes(studentId));
  if (!candidates.length) return null;

  return (
    <div data-testid="assessment-review-rectifications" className="space-y-3">
      <p className="font-medium">Alterações em registros existentes — {candidates.length}</p>
      <p className="text-sm text-muted-foreground">
        Serão registradas como correção; o resultado anterior permanecerá no histórico.
      </p>
      {candidates.map(({ studentId, current }) => {
        const ritual = resolveAssessmentCorrection({
          baseVersionId: current.id,
          versions: roster.versions,
          agent: context.agent,
          instrument: { id: roster.instrument.id, instrumentTypeId: roster.instrument.instrumentTypeId, status: context.instrumentStatus },
          configuration: roster.configuration as AssessmentConfiguration,
          policies: context.correctionPolicies,
          ...(context.periodClosing ? { periodClosing: context.periodClosing } : {}),
        }).requiredRitual;
        const entry = corrections[studentId] ?? {};
        const set = (next: typeof entry) => onChange({ ...corrections, [studentId]: next });
        return (
          <div key={studentId} className="rounded-md border border-border p-3" data-testid={`assessment-rectification-${studentId}`}>
            <p className="text-sm">
              <strong>{names.get(studentId)}</strong> · {entryValueLabel(current.value, mode)} → {entryValueLabel(drafts[studentId]!, mode)}
            </p>
            {ritual.map((req) =>
              req.code === "justificativa" ? (
                <label key={req.code} className="mt-2 block text-sm">
                  {req.label}
                  <Textarea
                    className="mt-1"
                    value={entry.justification ?? ""}
                    onChange={(e) => set({ ...entry, justification: e.target.value })}
                    data-testid={`assessment-justification-${studentId}`}
                  />
                </label>
              ) : (
                <label key={req.code} className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={entry.satisfied?.includes(req.code) ?? false}
                    onChange={(e) =>
                      set({
                        ...entry,
                        satisfied: e.target.checked
                          ? [...(entry.satisfied ?? []), req.code]
                          : (entry.satisfied ?? []).filter((code) => code !== req.code),
                      })
                    }
                  />
                  {req.label}
                </label>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}
