/**
 * Etapa 12I — tela da situação acadêmica do ciclo.
 *
 * A tela não decide nada: exibe as três camadas separadas (fatos consolidados,
 * regra institucional e deliberação registrada), o estado operacional e a
 * explicação estrutural de cada critério avaliado. Sem regra homologada, a
 * determinação permanece bloqueada e os impedimentos aparecem por extenso.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gavel, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { classStage } from "@/features/academic/academic-structure";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  consolidateCycleAttendance,
  CYCLE_ATTENDANCE_NOTE,
} from "@/features/diary/attendance-cycle-consolidation";
import { useAttendanceClosingStore } from "@/features/diary/attendance-closing-store";
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
import { useAssessmentRules } from "./assessment-rule-store";
import { curriculumRefOf, eligibilityInPeriod, studentPlacements } from "./assessment-rules";
import type { AssessmentConfiguration } from "./assessment-types";
import { buildStandingFactContext } from "./academic-standing-facts";
import { determineAcademicStanding } from "./academic-standing-engine";
import { standingRuleIssues } from "./academic-standing-governance";
import { standingScopeKey, useAcademicStandingStore } from "./academic-standing-store";
import { useCollegialStore } from "@/features/collegial/collegial-store";
import { standingDeliberationFor } from "@/features/collegial/collegial-standing-bridge";
import {
  demonstrationStandingRuleSets,
  networkStandingDraftRuleSets,
} from "./academic-standing-fixtures";
import { networkStandingRuleDrafts } from "./academic-standing-network-rules";
import {
  ACADEMIC_STANDING_LABEL,
  ACADEMIC_STANDING_NOTE,
  COMPARISON_OPERATOR_LABEL,
  STANDING_OPERATIONAL_STATE_LABEL,
  STANDING_RULE_STATUS_LABEL,
  STANDING_ORIGIN_LABEL,
  type AcademicStandingDetermination,
  type AcademicStandingRuleSet,
} from "./academic-standing-types";
import { consolidateCycle } from "./cycle-consolidation";
import { resolveCycles } from "./cycle-configuration";
import { cycleRange, type AssessmentCycle } from "./cycle-consolidation-types";
import { usePeriodClosingStore } from "./period-closing-store";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
const resolved = (state: ConfigurationState): state is Resolved =>
  "configuration" in state && "structure" in state;

const value = (input: unknown) =>
  input === null || input === undefined
    ? "não disponível"
    : typeof input === "number"
      ? String(Number(input.toFixed(4))).replace(".", ",")
      : typeof input === "boolean"
        ? input
          ? "sim"
          : "não"
        : String(input);

export function AcademicStandingPage({
  classId,
  search,
}: {
  classId: string;
  search: DiarySearch;
}) {
  const closings = usePeriodClosingStore();
  const attendanceClosings = useAttendanceClosingStore();
  const standingStore = useAcademicStandingStore();
  const collegial = useCollegialStore();
  const rules = useAssessmentRules();

  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((assignment) => assignment.classId === classId);
  const klass = getDemonstrationClass(classId);
  const state = classConfigurationState(classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  if (!klass || !resolved(state) || !item)
    return (
      <StatePanel
        tone="warning"
        title="Situação acadêmica indisponível"
        description="Turma, atuação pedagógica ou configuração avaliativa não encontradas para este contexto."
      />
    );

  const { configuration, structure, year } = state;
  const stageId = classStage(classId)?.id;
  const curriculumRef = curriculumRefOf(item.record);
  const cycles = resolveCycles({ configuration, structure });

  const assessmentRule = rules.find(
    (rule) =>
      rule.status === "homologada" &&
      rule.scope.academicYearId === year.id &&
      (rule.scope.classIds?.includes(classId) ||
        (stageId ? rule.scope.stageIds.includes(stageId) : false)),
  );

  const cadastradas = [
    ...standingStore.ruleSets(),
    ...networkStandingRuleDrafts,
    ...networkStandingDraftRuleSets,
    ...demonstrationStandingRuleSets,
  ].filter(
    (rule, index, all) =>
      all.findIndex((other) => other.id === rule.id && other.version === rule.version) === index,
  );

  const students = demonstrationStudents.filter((student) => {
    const placements = studentPlacements(student);
    return structure.periods.some(
      (period) => eligibilityInPeriod(placements, classId, period).coverage !== "sem-vinculo",
    );
  });

  return (
    <div className="space-y-5">
      <DiaryHeader
        title={ACADEMIC_STANDING_LABEL}
        description={`${klass.name} · ${item.field} · ${year.label}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link
            to="/diario/turmas/$turmaId/avaliacao/consolidacao"
            params={{ turmaId: classId }}
            search={classSearch}
          >
            <ArrowLeft /> Consolidação do ciclo
          </Link>
        </Button>
      </DiaryHeader>

      <StatePanel
        tone="info"
        title="Fatos, regra institucional e deliberação são camadas distintas"
        description={ACADEMIC_STANDING_NOTE}
      />

      <RuleSetPanel ruleSets={cadastradas} />

      {cycles.map((cycle) => {
        const rows = students.map((student) => {
          const consolidation = consolidateCycle({
            cycle,
            configuration,
            studentId: student.id,
            studentName: student.personName,
            curriculumRef,
            ...(assessmentRule ? { rule: assessmentRule } : {}),
            closings: closings.allRecords(),
            finalRecoveryEntries: [],
          });
          const attendance = consolidateCycleAttendance({
            cycle,
            studentId: student.id,
            studentName: student.personName,
            closings: attendanceClosings.allRecords(),
          });
          const facts = buildStandingFactContext({
            cycle: { id: cycle.id, kindId: cycle.kindId, academicYearId: cycle.academicYearId },
            studentId: student.id,
            studentName: student.personName,
            consolidations: [
              {
                componentId:
                  curriculumRef?.kind === "matriz"
                    ? curriculumRef.componentId
                    : (curriculumRef?.assignmentId ?? item.field),

                componentLabel: item.field,
                consolidation,
              },
            ],
            attendance,
          });
          const scopeKey = standingScopeKey({ cycleId: cycle.id, studentId: student.id });
          const homologated = standingStore.homologatedFor({
            kindId: cycle.kindId,
            academicYearId: cycle.academicYearId,
          })[0];
          // Fonte única: deliberação registrada pelo colegiado (6D.4.1).
          const deliberation = standingDeliberationFor(
            collegial.deliberationsForStudent(student.id),
            scopeKey,
            (bodyId) => homologated?.bodies.find((b) => b.id === bodyId)?.label,
          );
          const determination = determineAcademicStanding({
            cycle: { id: cycle.id, kindId: cycle.kindId, academicYearId: cycle.academicYearId },
            studentId: student.id,
            studentName: student.personName,
            ...(homologated ? { ruleSet: homologated } : {}),
            facts: facts.facts,
            factPendencies: facts.pendencies,
            cycleComplete: facts.cycleComplete,
            factsOfficial: facts.factsOfficial,
            ...(deliberation ? { deliberation } : {}),
          });
          return { determination, attendanceNote: attendance.pendencies.length };
        });
        return <CycleStandingCard key={cycle.id} cycle={cycle} rows={rows} />;
      })}

      <StatePanel
        tone="neutral"
        title="Frequência consolidada do ciclo entra como fato, nunca como efeito"
        description={CYCLE_ATTENDANCE_NOTE}
      />
    </div>
  );
}

function RuleSetPanel({ ruleSets }: { ruleSets: readonly AcademicStandingRuleSet[] }) {
  return (
    <section
      aria-label="Regras de situação acadêmica cadastradas"
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <ScrollText aria-hidden className="size-4 text-primary" /> Regras de situação cadastradas
      </h2>
      {ruleSets.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhuma regra de situação acadêmica cadastrada. Sem regra homologada nenhuma situação é
          determinada.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {ruleSets.map((ruleSet) => {
            const issues = standingRuleIssues(ruleSet);
            return (
              <li key={`${ruleSet.id}-${ruleSet.version}`} className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={ruleSet.status === "homologada" ? "success" : "warning"}>
                    {STANDING_RULE_STATUS_LABEL[ruleSet.status]}
                  </StatusBadge>
                  <span className="font-medium text-foreground">{ruleSet.label}</span>
                  <span className="text-xs text-muted-foreground">versão {ruleSet.version}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ruleSet.standings.length} situação(ões) cadastrada(s) · {ruleSet.steps.length}{" "}
                  critério(s) · {ruleSet.bodies.length} órgão(s) deliberativo(s)
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Situações cadastradas">
                  {ruleSet.standings.map((standing) => (
                    <li
                      key={standing.id}
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {standing.historicalLabel ?? standing.label}
                      </span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {STANDING_ORIGIN_LABEL[standing.origin ?? "determinacao-por-regra"]}
                      </span>
                    </li>
                  ))}
                </ul>
                {ruleSet.note ? (
                  <p className="mt-1 text-xs text-muted-foreground">{ruleSet.note}</p>
                ) : null}
                {issues.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CycleStandingCard({
  cycle,
  rows,
}: {
  cycle: AssessmentCycle;
  rows: readonly { determination: AcademicStandingDetermination }[];
}) {
  const range = cycleRange(cycle);
  return (
    <section
      aria-label={`Situação acadêmica — ${cycle.label}`}
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <header className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Gavel aria-hidden className="size-4 text-primary" /> {cycle.label}
        </h2>
        <p className="text-sm text-muted-foreground">
          {range
            ? `${formatAcademicDate(range.start)} — ${formatAcademicDate(range.end)}`
            : "Sem períodos declarados"}
          {" · "}
          {cycle.periods.length} período(s) oficial(is)
        </p>
      </header>

      <ul className="mt-4 space-y-4">
        {rows.map(({ determination }) => (
          <li
            key={determination.studentId}
            className="min-w-0 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={
                  determination.operationalState === "situacao-determinada"
                    ? "success"
                    : determination.operationalState === "ciclo-em-andamento"
                      ? "neutral"
                      : "warning"
                }
              >
                {STANDING_OPERATIONAL_STATE_LABEL[determination.operationalState]}
              </StatusBadge>
              <span className="font-medium text-foreground">
                {determination.studentName ?? determination.studentId}
              </span>
              {determination.standing ? (
                <span className="text-sm text-muted-foreground">
                  Situação: {determination.standing.label}
                </span>
              ) : null}
            </div>

            {determination.reasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {determination.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}

            {determination.steps.length > 0 ? (
              <div className="mt-3 min-w-0 overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Critérios avaliados, com fato consultado, operador, parâmetro e resultado
                  </caption>
                  <thead>
                    <tr className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-3">
                        Critério
                      </th>
                      <th scope="col" className="py-1.5 pr-3">
                        Fato consultado
                      </th>
                      <th scope="col" className="py-1.5 pr-3">
                        Valor
                      </th>
                      <th scope="col" className="py-1.5 pr-3">
                        Comparação
                      </th>
                      <th scope="col" className="py-1.5">
                        Resultado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {determination.steps.map((step) => (
                      <tr key={step.stepId} className="border-b border-border/40 align-top">
                        <td className="py-1.5 pr-3">{step.label}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {step.node.factId ?? "composição de critérios"}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">{value(step.node.value)}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {step.node.operator
                            ? `${COMPARISON_OPERATOR_LABEL[step.node.operator]} ${step.node.parameter?.description ?? ""}`
                            : "—"}
                        </td>
                        <td className="py-1.5">
                          {step.result === null
                            ? "não avaliável"
                            : step.result
                              ? "satisfeito"
                              : "não satisfeito"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {determination.pendencies.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {determination.pendencies.map((pendency) => (
                  <li key={`${pendency.id}-${pendency.scopeKey ?? ""}`}>{pendency.message}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
