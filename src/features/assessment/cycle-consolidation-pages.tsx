/**
 * Etapa 12H — tela da consolidação do ciclo avaliativo.
 *
 * A tela nunca calcula: tudo vem do motor (12E), dos fechamentos vigentes (12G)
 * e da regra homologada (12F). O rótulo do ciclo vem da configuração e o
 * intervalo de datas é exibido separadamente.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { classStage } from "@/features/academic/academic-structure";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate } from "@/lib/academic-date";
import { classConfigurationState, type ConfigurationState } from "./assessment-configuration";
import { compositionInputFromVersion, officialCurrentVersionsForStudent } from "./assessment-canonical-inputs";
import { FINAL_RECOVERY_ENTRY_STATES, presentFinalRecovery } from "./final-recovery-presentation";
import { fieldVersionStore, useFieldVersionTick } from "./assessment-entry-field-config";
import { useInstrumentStore } from "./assessment-instrument-store";
import { useAssessmentRules } from "./assessment-rule-store";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import {
  curriculumRefOf,
  eligibilityInPeriod,
  studentPlacements,
} from "./assessment-rules";
import type { AssessmentConfiguration } from "./assessment-types";
import { consolidateCycle, cycleConsolidationHeadline } from "./cycle-consolidation";
import { resolveCycles } from "./cycle-configuration";
import {
  cycleRange,
  CYCLE_CONSOLIDATION_NOTE,
  type AssessmentCycle,
  type CycleConsolidation,
} from "./cycle-consolidation-types";
import { usePeriodClosingStore } from "./period-closing-store";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
const resolved = (state: ConfigurationState): state is Resolved =>
  "configuration" in state && "structure" in state;

const numeric = (value: number | null) =>
  value === null ? "—" : String(value).replace(".", ",");

function applicableRule(
  rules: readonly InstitutionalAssessmentRule[],
  academicYearId: string,
  stageId: string | undefined,
  classId: string,
) {
  const candidates = rules.filter(
    (r) =>
      r.status !== "arquivada" &&
      r.scope.academicYearId === academicYearId &&
      (r.scope.classIds?.includes(classId) ||
        (stageId ? r.scope.stageIds.includes(stageId) : false)),
  );
  return candidates.find((r) => r.status === "homologada") ?? candidates[0];
}

export function CycleConsolidationPage({
  classId,
  search,
}: {
  classId: string;
  search: DiarySearch;
}) {
  const instruments = useInstrumentStore();
  const closings = usePeriodClosingStore();
  const rules = useAssessmentRules();
  useFieldVersionTick();

  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((a) => a.classId === classId);
  const klass = getDemonstrationClass(classId);
  const state = classConfigurationState(classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  if (!klass || !resolved(state) || !item)
    return (
      <StatePanel
        tone="warning"
        title="Consolidação indisponível"
        description="Turma, atuação pedagógica ou configuração avaliativa não encontradas para este contexto."
      />
    );

  const { configuration, structure, year } = state;
  const rule = applicableRule(rules, year.id, classStage(classId)?.id, classId);
  const curriculumRef = curriculumRefOf(item.record);
  const cycles = resolveCycles({ configuration, structure });
  const snapshot = instruments.snapshot();

  const students = demonstrationStudents.filter((student) => {
    const placements = studentPlacements(student);
    return structure.periods.some(
      (period) => eligibilityInPeriod(placements, classId, period).coverage !== "sem-vinculo",
    );
  });

  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Consolidação do ciclo avaliativo"
        description={`${klass.name} · ${item.field} · ${year.label}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link
            to="/diario/turmas/$turmaId/avaliacao"
            params={{ turmaId: classId }}
            search={classSearch}
          >
            <ArrowLeft /> Avaliação da turma
          </Link>
        </Button>
      </DiaryHeader>

      <StatePanel
        tone="info"
        title="Resultado do ciclo, recuperação final e resultado pós-recuperação são informações distintas"
        description={CYCLE_CONSOLIDATION_NOTE}
      />

      {cycles.map((cycle) => {
        // 6D.3.5.6 — instrumento identificado SOMENTE pelos tipos da regra homologada.
        const finalRecoveryTypeIds = rule?.finalRecovery?.instrumentTypeIds ?? [];
        const periodIds = new Set(cycle.periods.map((p) => p.periodId));
        const recoveryInstruments = snapshot.instruments.filter(
          (i) =>
            i.classId === classId &&
            periodIds.has(i.periodId) &&
            finalRecoveryTypeIds.includes(i.instrumentTypeId),
        );
        const results = students.map((student) => {
          // Fonte canônica: versão oficial vigente (rascunho/superada nunca entram).
          const uses = officialCurrentVersionsForStudent({
            studentId: student.id,
            instruments: recoveryInstruments,
            versions: recoveryInstruments.flatMap((i) => fieldVersionStore.versions(i.id)),
          });
          return consolidateCycle({
            cycle,
            configuration,
            studentId: student.id,
            studentName: student.personName,
            curriculumRef,
            ...(rule ? { rule } : {}),
            closings: closings.allRecords(),
            finalRecoveryEntries: uses.map((u) =>
              compositionInputFromVersion(u, { id: configuration.id, version: configuration.version ?? 0 }),
            ),
            finalRecoveryVersions: uses.map((u) => ({
              versionId: u.version.id,
              logicalEntryId: u.version.logicalEntryId,
              version: u.version.version,
              instrumentId: u.instrument.id,
              instrumentTitle: u.instrument.title,
              isCorrection: Boolean(u.version.supersedesVersionId),
            })),
          });
        });
        return <CycleCard
            key={cycle.id}
            cycle={cycle}
            results={results}
            classId={classId}
            search={classSearch}
            recoveryInstruments={recoveryInstruments.map((i) => ({ id: i.id, title: i.title }))}
          />;
      })}
    </div>
  );
}

function CycleCard({
  cycle,
  results,
  classId,
  search,
  recoveryInstruments,
}: {
  cycle: AssessmentCycle;
  results: CycleConsolidation[];
  classId: string;
  search: DiarySearch;
  recoveryInstruments: { id: string; title: string }[];
}) {
  // Esta tela não recebe perfil com restrição de leitura: a fronteira de
  // divulgação existente é respeitada pela apresentação (valuesDisclosed).
  const presented = results.map((r) => ({ result: r, view: presentFinalRecovery(r, { valuesDisclosed: true }) }));
  const needsEntry = presented.some((p) => FINAL_RECOVERY_ENTRY_STATES.has(p.view.status));
  const range = cycleRange(cycle);
  const first = results[0];

  return (
    <section
      aria-label={`Consolidação — ${cycle.label}`}
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <header className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Layers aria-hidden className="size-4 text-primary" /> {cycle.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {range ? `${formatAcademicDate(range.start)} — ${formatAcademicDate(range.end)}` : "Sem períodos declarados"}
            {" · "}
            {cycle.periods.length} período(s) oficial(is)
          </p>
        </div>
        {first ? (
          <div className="flex flex-wrap gap-2 md:justify-end">
            <StatusBadge
              tone={
                first.kind === "consolidado" && first.official
                  ? "success"
                  : first.kind === "pendencia-administrativa"
                    ? "warning"
                    : "neutral"
              }
            >
              {cycleConsolidationHeadline(first)}
            </StatusBadge>
          </div>
        ) : null}
      </header>

      {first && first.kind !== "consolidado" ? (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {(first.kind === "bloqueado" || first.kind === "pendencia-administrativa"
            ? first.reasons
            : [first.kind === "nao-aplicavel" ? first.reason : first.label]
          ).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {needsEntry && recoveryInstruments.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Lançar resultado da recuperação final na pauta:</span>
          {recoveryInstruments.map((i) => (
            <Button key={i.id} asChild size="sm" variant="outline">
              <Link
                to="/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
                params={{ turmaId: classId, instrumentoId: i.id }}
                search={search}
              >
                Abrir pauta — {i.title}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}

      <ul className="mt-4 divide-y divide-border/50" aria-label="Recuperação final por estudante">
        {presented.map(({ result, view }) => (
          <li key={result.studentId} className="min-w-0 py-2.5">
            <div className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
              <p className="min-w-0 break-words font-medium text-foreground">
                {result.studentName ?? result.studentId}
              </p>
              <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm tabular-nums">
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Resultado do ciclo</dt>
                  <dd>
                    {result.kind === "acumulado-parcial"
                      ? `${numeric(result.partialScore)} (parcial)`
                      : view.values.cycle ?? "—"}
                  </dd>
                </div>
                {view.values.recovery ? (
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">Recuperação final</dt>
                    <dd>{view.values.recovery}</dd>
                  </div>
                ) : null}
                {view.values.after && view.status.startsWith("applied") ? (
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">Após recuperação</dt>
                    <dd className="font-semibold">{view.values.after}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <p className="text-sm text-foreground">
              <span className="font-medium">Situação:</span> {view.label}
            </p>
            {view.status !== "applied-with-effect" && view.status !== "applied-without-effect" ? (
              <p className="text-xs text-muted-foreground">{view.reason}</p>
            ) : null}
            {view.explanation.state === "protected" ? (
              <p className="text-xs text-muted-foreground">
                A explicação está protegida: os valores não podem ser exibidos neste perfil.
              </p>
            ) : null}
            {view.explanation.state === "available" ? (
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer text-primary">Como a recuperação alterou este resultado?</summary>
                <div className="mt-1 space-y-1 rounded-md border border-border/60 p-2">
                  <p>
                    Resultado do ciclo antes: <strong>{view.explanation.level1.before}</strong> · depois da
                    recuperação: <strong>{view.explanation.level1.after}</strong>
                  </p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {view.explanation.level2.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">Detalhes normativos</summary>
                    <ul className="mt-1 space-y-0.5 break-words text-xs text-muted-foreground">
                      {view.explanation.level3.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      {first && first.contributions.length > 0 ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Períodos que compõem o ciclo</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {first.contributions.map((contribution) => (
              <li key={contribution.periodId} className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={contribution.closed ? "success" : "warning"}>
                  {contribution.closed
                    ? `Fechado · versão ${contribution.closingVersion}`
                    : "Sem fechamento oficial"}
                </StatusBadge>
                <span>{contribution.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Situação acadêmica, efeito da frequência e deliberação do Conselho de Classe não são
            produzidos nesta etapa.
          </p>
        </div>
      ) : null}
    </section>
  );
}
