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
import { compositionInputsForStudent } from "./assessment-composition-projection";
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
  FINAL_RECOVERY_STATE_LABEL,
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
        const results = students.map((student) => {
          const finalRecoveryTypeIds = rule?.finalRecovery?.instrumentTypeIds ?? [];
          const periodIds = new Set(cycle.periods.map((p) => p.periodId));
          const recoveryInstruments = snapshot.instruments.filter(
            (i) =>
              i.classId === classId &&
              periodIds.has(i.periodId) &&
              finalRecoveryTypeIds.includes(i.instrumentTypeId),
          );
          return consolidateCycle({
            cycle,
            configuration,
            studentId: student.id,
            studentName: student.personName,
            curriculumRef,
            ...(rule ? { rule } : {}),
            closings: closings.allRecords(),
            finalRecoveryEntries: compositionInputsForStudent({
              studentId: student.id,
              instruments: recoveryInstruments,
              entries: snapshot.entries,
            }),
          });
        });
        return <CycleCard key={cycle.id} cycle={cycle} results={results} />;
      })}
    </div>
  );
}

function CycleCard({
  cycle,
  results,
}: {
  cycle: AssessmentCycle;
  results: CycleConsolidation[];
}) {
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

      <div className="mt-4 min-w-0 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">
            Consolidação do ciclo por aluno, derivada das versões vigentes dos fechamentos
          </caption>
          <thead>
            <tr className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3">
                Aluno
              </th>
              <th scope="col" className="py-1.5 pr-3">
                Situação da consolidação
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right">
                Resultado do ciclo
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right">
                Recuperação final
              </th>
              <th scope="col" className="py-1.5 text-right">
                Pós-recuperação
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.studentId} className="border-b border-border/40">
                <td className="py-1.5 pr-3">{result.studentName ?? result.studentId}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {result.kind === "consolidado"
                    ? FINAL_RECOVERY_STATE_LABEL[result.finalRecovery.state]
                    : cycleConsolidationHeadline(result)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {numeric(result.kind === "acumulado-parcial" ? result.partialScore : result.cycleScore)}
                  {result.kind === "acumulado-parcial" ? " (parcial)" : ""}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {numeric(result.finalRecovery?.recoveryScore ?? null)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {numeric(result.postRecoveryScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
