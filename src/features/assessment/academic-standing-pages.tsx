import { useCloudPeriodFacts } from "./assessment-period-sources";
import { useAssessmentNormativeSource, normativeSessionArgs, useAttendancePolicySource } from "./assessment-normative-sources";
import { demonstrationAttendanceFormulas } from "@/features/diary/attendance-formula-fixtures";
import type { AttendanceFrequencyFormula } from "@/features/diary/attendance-formula";
import { teachingClass as teachingClassNorms } from "@/features/diary/institutional-teaching";
import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { rosterStudents } from "@/features/students/institutional-roster";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { collegialStore, useCollegialStore } from "@/features/collegial/collegial-store";
import { useCloudCollegial } from "@/features/collegial/collegial-cloud";
import { sessionActor, useSessionAuthority } from "@/features/authority/session-authority";
import { useCloudStanding } from "./academic-standing-cloud";
import type { StandingCapability } from "./academic-standing-types";
import {
  officialStandingDeliberationFor,
  preparingDeliberationsFor,
} from "@/features/collegial/collegial-standing-bridge";
import { useState } from "react";
import { standingDemonstrationActor } from "./academic-standing-governance";
import { projectStandingDivergence, type StandingDivergence } from "./academic-standing-divergence";
import {
  REGISTRATION_CONFIRMATION_NOTE,
  registerConferredStandings,
  standingFingerprint,
  standingRegistrability,
  type RegistrationResult,
  type StandingRegistrability,
} from "./academic-standing-registration";
import type { AcademicStandingRecord } from "./academic-standing-types";
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
import { resolveCyclesForOrigin } from "./cycle-configuration";
import { useAcademicReferenceDate, referenceDateValue } from "@/features/academic/academic-reference-date";
import { cycleRange, type AssessmentCycle } from "./cycle-consolidation-types";
import { usePeriodClosingStore } from "./period-closing-store";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
const resolved = (state: ConfigurationState): state is Resolved =>
  "configuration" in state && "structure" in state;

/**
 * Ator demonstrativo do registro. Binding das capabilities ao usuário
 * autenticado será realizado com a persistência/autenticação Lovable Cloud.
 */
const REGISTRANT = standingDemonstrationActor("perfil-deliberativo");

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
  
  const authority = useSessionAuthority();
  const cloud = authority.status === "signed-in";
  // Com sessão: situações e atas vêm do banco; o domínio só confere e reconstrói.
  const cloudStanding = useCloudStanding(standingStore, classId, cloud);
  useCloudCollegial(collegialStore, classId, cloud);
  const registrant =
    cloud
      ? (sessionActor<StandingCapability>(authority, { classId }) ?? { ...REGISTRANT, capabilities: [] })
      : REGISTRANT;

  const referenceDate = useAcademicReferenceDate(search.data, cloud);
  const academicDate = referenceDateValue(referenceDate);
  const klass = teachingClass(classId);
  const norms = useAssessmentNormativeSource({ classId, ...normativeSessionArgs(authority), stageId: teachingClassNorms(classId)?.stageId ?? undefined, academicYearId: teachingClassNorms(classId)?.academicYearId, academicDate });
  // 6D.FINAL.6 — fórmulas de frequência: com sessão só da política homologada vigente.
  const attendancePolicies = useAttendancePolicySource<{ formulas?: AttendanceFrequencyFormula[] }>(cloud);
  const attendanceFormulas: readonly AttendanceFrequencyFormula[] = cloud
    ? attendancePolicies.policies.length === 1
      ? (attendancePolicies.policies[0]!.formulas ?? [])
      : []
    : demonstrationAttendanceFormulas;
  const standingClosings = useCloudPeriodFacts(classId, teachingClassNorms(classId)?.academicYearId, cloud, academicDate);
  const state = norms.state;
  const rules = norms.rules;
  if (referenceDate.kind === "invalid")
    return <StatePanel tone="warning" title="Situação acadêmica indisponível" description={referenceDate.reason} />;
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, referenceDate.date);
  const item = context.assignments.find((assignment) => assignment.classId === classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  if (cloud && (!norms.ready || !standingClosings.ready))
    return <StatePanel tone="info" title="Carregando" description="Lendo os fatos oficiais da turma." />;
  if (cloud && standingClosings.error)
    return <StatePanel tone="warning" title="Situação acadêmica indisponível" description={standingClosings.error} />;
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
  const cycleResolution = resolveCyclesForOrigin(cloud ? "institucional" : "laboratorio", { configuration, structure });
  if (cycleResolution.kind === "unavailable")
    return <StatePanel tone="warning" title="Situação acadêmica indisponível" description={cycleResolution.reason} />;
  const cycles = cycleResolution.cycles;

  const assessmentRule = rules.find(
    (rule) =>
      rule.status === "homologada" &&
      rule.scope.academicYearId === year.id &&
      (rule.scope.classIds?.includes(classId) ||
        (stageId ? rule.scope.stageIds.includes(stageId) : false)),
  );

  // 6D.FINAL.5 — com sessão, só regras de situação homologadas persistidas.
  const cadastradas = cloud ? (norms.standingRuleSets as typeof demonstrationStandingRuleSets) : [
    ...standingStore.ruleSets(),
    ...networkStandingRuleDrafts,
    ...networkStandingDraftRuleSets,
    ...demonstrationStandingRuleSets,
  ].filter(
    (rule, index, all) =>
      all.findIndex((other) => other.id === rule.id && other.version === rule.version) === index,
  );

  const students = rosterStudents().filter((student) => {
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
        const buildFor = (student: (typeof students)[number]) => {
          const consolidation = consolidateCycle({
            cycle,
            configuration,
            studentId: student.id,
            studentName: student.personName,
            curriculumRef,
            ...(assessmentRule ? { rule: assessmentRule } : {}),
            closings: cloud ? standingClosings.closings : closings.allRecords(),
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
            attendanceFormulas,
          });
          const scopeKey = standingScopeKey({ cycleId: cycle.id, studentId: student.id });
          const homologated = standingStore.homologatedFor({
            kindId: cycle.kindId,
            academicYearId: cycle.academicYearId,
          })[0];
          // Fonte única: deliberação registrada pelo colegiado (6D.4.1).
          // Só deliberação congelada em ata ENCERRADA produz efeito (6D.4.1b).
          const deliberation = officialStandingDeliberationFor(
            collegial.minutes(),
            scopeKey,
            (bodyId: string) => homologated?.bodies.find((b) => b.id === bodyId)?.label,
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
          return determination;
        };
        const rebuild = (studentId: string) => {
          const student = students.find((s) => s.id === studentId);
          return student ? buildFor(student) : undefined;
        };
        const rows = students.map((student) => {
          const determination = buildFor(student);
          const scopeKey = standingScopeKey({ cycleId: cycle.id, studentId: student.id });
          const record = standingStore.current(scopeKey);
          const preparing = preparingDeliberationsFor(
            collegial.deliberationsForStudent(student.id),
            collegial.minutes(),
            scopeKey,
          ).length;
          const historicalRuleSet = record
            ? standingStore.ruleSet(record.ruleSetId, record.ruleSetVersion)
            : undefined;
          const divergence = record
            ? projectStandingDivergence({
                record,
                currentFacts: determination.facts,
                ...(determination.deliberation ? { currentDeliberation: determination.deliberation } : {}),
                ...(historicalRuleSet ? { historicalRuleSet } : {}),
                studentName: student.personName,
              })
            : undefined;
          return {
            determination,
            record,
            preparing,
            divergence,
            registrability: standingRegistrability(determination, standingStore),
          };
        });
        return (
          <CycleStandingCard
            key={cycle.id}
            cycle={cycle}
            rows={rows}
            onRegister={(items) =>
              cloud
                ? cloudStanding.register({ actor: registrant, cycleId: cycle.id, conferred: items, rebuild })
                : registerConferredStandings({
                store: standingStore,
                actor: registrant,
                conferred: items,
                rebuild,
              })
            }
            rebuild={rebuild}
          />
        );
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

type StandingRow = {
  determination: AcademicStandingDetermination;
  record: AcademicStandingRecord | undefined;
  preparing: number;
  divergence: StandingDivergence | undefined;
  registrability: StandingRegistrability;
};

type Conferral = { studentId: string; fingerprint: string; determination: AcademicStandingDetermination };

const FACT_GROUP = {
  frequencia: /frequ|presen/i,
  recuperacao: /recupera/i,
};
const groupOf = (factId: string) =>
  FACT_GROUP.frequencia.test(factId) ? "frequencia" : FACT_GROUP.recuperacao.test(factId) ? "recuperacao" : "rendimento";
const factLine = (d: AcademicStandingDetermination, group: string) => {
  const facts = d.facts.filter((f) => groupOf(f.factId) === group);
  if (!facts.length) return undefined;
  return facts.map((f) => (f.value === null ? `não disponível${f.unavailableReason ? ` (${f.unavailableReason})` : ""}` : value(f.value))).join(" · ");
};

function ConferralSummary({ items }: { items: readonly Conferral[] }) {
  return (
    <ul className="space-y-3 text-sm">
      {items.map(({ determination: d }) => {
        const result = factLine(d, "rendimento");
        const attendance = factLine(d, "frequencia");
        const recovery = factLine(d, "recuperacao");
        return (
          <li key={d.studentId} className="rounded-md border border-border/70 p-3">
            <p className="font-medium text-foreground">{d.studentName ?? d.studentId}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
              <dt>Situação a registrar</dt><dd className="text-foreground">{d.standing?.label}</dd>
              <dt>Regra</dt><dd>{d.ruleSetId} · versão {d.ruleSetVersion}</dd>
              {result ? (<><dt>Resultado do ciclo</dt><dd>{result}</dd></>) : null}
              {attendance ? (<><dt>Frequência</dt><dd>{attendance}</dd></>) : null}
              {recovery ? (<><dt>Recuperação final</dt><dd>{recovery}</dd></>) : null}
              {d.deliberation ? (<><dt>Conselho</dt><dd>{d.deliberation.decision.note ?? d.deliberation.competenceLabel}</dd></>) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function CycleStandingCard({
  cycle,
  rows,
  onRegister,
  rebuild,
}: {
  cycle: AssessmentCycle;
  rows: readonly StandingRow[];
  onRegister: (
    items: readonly { studentId: string; fingerprint: string }[],
  ) => RegistrationResult | Promise<RegistrationResult>;
  rebuild: (studentId: string) => AcademicStandingDetermination | undefined;
}) {
  const range = cycleRange(cycle);
  const [conferral, setConferral] = useState<Conferral[] | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const registrable = rows.filter((r) => r.registrability.registrable);
  const blocked = rows.filter((r) => !r.record && !r.registrability.registrable);
  const confer = (list: readonly StandingRow[]) => {
    setFeedback(null);
    setConferral(list.map((r) => ({ studentId: r.determination.studentId, fingerprint: standingFingerprint(r.determination), determination: r.determination })));
  };
  const confirm = async () => {
    if (!conferral) return;
    const result = await onRegister(conferral);
    if (result.ok) {
      setFeedback({ tone: "success", text: `${result.records.length} situação(ões) acadêmica(s) registrada(s) oficialmente.` });
      setConferral(null);
      return;
    }
    setFeedback({ tone: "danger", text: result.reasons.join(" ") });
    if (result.stale)
      setConferral(
        conferral
          .map((c) => rebuild(c.studentId))
          .filter((d): d is AcademicStandingDetermination => Boolean(d && d.operationalState === "situacao-determinada" && d.standingId))
          .map((d) => ({ studentId: d.studentId, fingerprint: standingFingerprint(d), determination: d })),
      );
  };
  return (
    <section
      aria-label={`Situação acadêmica — ${cycle.label}`}
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
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
          <p className="mt-1 text-sm text-muted-foreground">
            {registrable.length} pode(m) ter a situação registrada · {blocked.length} ainda não pode(m) ser registrado(s)
          </p>
        </div>
        {registrable.length > 1 ? (
          <Button size="sm" onClick={() => confer(registrable)}>Registrar situações acadêmicas</Button>
        ) : null}
      </header>

      {feedback ? (
        <p role="status" className={`mt-3 rounded-md border px-3 py-2 text-sm ${feedback.tone === "success" ? "border-primary/40 text-foreground" : "border-destructive/50 text-destructive"}`}>
          {feedback.text}
        </p>
      ) : null}

      <Dialog open={conferral !== null} onOpenChange={(open) => !open && setConferral(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência antes do registro</DialogTitle>
            <DialogDescription>{REGISTRATION_CONFIRMATION_NOTE}</DialogDescription>
          </DialogHeader>
          {conferral && conferral.length > 0 ? (
            <ConferralSummary items={conferral} />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma situação pode ser registrada com os fatos atuais.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConferral(null)}>Cancelar</Button>
            <Button onClick={confirm} disabled={!conferral?.length}>Confirmar registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ul className="mt-4 space-y-4">
        {rows.map((row) => {
          const { determination } = row;
          return (
          <li
            key={determination.studentId}
            className="min-w-0 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={
                  row.record
                    ? "success"
                    : determination.operationalState === "ciclo-em-andamento"
                      ? "neutral"
                      : "warning"
                }
              >
                {row.record ? "Oficial" : STANDING_OPERATIONAL_STATE_LABEL[determination.operationalState]}
              </StatusBadge>
              <span className="font-medium text-foreground">
                {determination.studentName ?? determination.studentId}
              </span>
            </div>

            <StandingStateBlock row={row} onRegister={() => confer([row])} />

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
          );
        })}
      </ul>
    </section>
  );
}

const CHANGE_LABEL = (c: Extract<StandingDivergence, { status: "divergent" }>["changes"][number]) =>
  c.kind === "fact-value"
    ? `${c.factId}: ${value(c.before)} → ${value(c.after)}`
    : c.kind === "fact-source-version"
      ? `${c.factId}: nova versão da fonte (${c.before ?? "?"} → ${c.after ?? "?"})`
      : c.kind === "fact-missing-now"
        ? `${c.factId}: não está mais disponível`
        : "Deliberação oficial do Conselho diferente da considerada";

function StandingStateBlock({ row, onRegister }: { row: StandingRow; onRegister: () => void }) {
  const { determination: d, record } = row;
  return (
    <div className="mt-2 space-y-2 text-sm">
      {record ? (
        <div>
          <p className="font-medium text-foreground">
            Situação acadêmica oficial: {d.ruleSetId === record.ruleSetId && d.standing?.id === record.standingId ? d.standing.label : (record.standingId ?? "—")}
          </p>
          <p className="text-muted-foreground">
            Registrada em {formatAcademicDate(record.determinedAt.slice(0, 10))} por {record.determinedBy.actorName} · regra {record.ruleSetId} versão {record.ruleSetVersion}
            {record.deliberationSource ? " · considera deliberação oficial do Conselho" : ""}
          </p>
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Detalhes do registro</summary>
            <p>Registro {record.id} (versão {record.version}) · {record.facts.length} fato(s) congelado(s)</p>
            {record.deliberationSource ? (
              <p>Deliberação {record.deliberationId} · ata {record.deliberationSource.minuteId} v{record.deliberationSource.minuteVersion}</p>
            ) : null}
          </details>
        </div>
      ) : d.operationalState === "situacao-determinada" && d.standing ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">Situação indicada pelas regras atuais: {d.standing.label}</p>
            <p className="text-muted-foreground">Esta situação ainda não foi registrada oficialmente.</p>
          </div>
          <Button size="sm" variant="outline" onClick={onRegister}>
            Registrar situação acadêmica
          </Button>
        </div>
      ) : null}

      {!record && d.deliberation ? (
        <p className="text-muted-foreground">
          Deliberação oficial do Conselho: {d.deliberation.decision.note ?? d.deliberation.competenceLabel} ({d.deliberation.bodyLabel})
        </p>
      ) : null}

      {row.preparing > 0 ? (
        <p role="note" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-muted-foreground">
          Há uma deliberação do Conselho em preparação. Ela ainda não produz efeito nesta situação.
        </p>
      ) : null}

      {row.divergence?.status === "divergent" ? (
        <div role="note" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
          <p className="font-medium text-foreground">Há fatos acadêmicos posteriores a esta situação oficial.</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {row.divergence.changes.map((c, i) => (<li key={i}>{CHANGE_LABEL(c)}</li>))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            {row.divergence.impact.kind === "impact-undetermined"
              ? `Impacto indeterminado: ${row.divergence.impact.reason}`
              : row.divergence.impact.kind === "standing-unchanged"
                ? "Pela regra do registro, a situação permaneceria a mesma."
                : row.divergence.impact.kind === "standing-would-change"
                  ? "Pela regra do registro, a situação indicada seria outra. O registro oficial não foi alterado."
                  : "Com os fatos atuais, a regra do registro não conclui situação."}
            {" "}Nada foi recalculado, substituído ou reaberto.
          </p>
        </div>
      ) : null}
    </div>
  );
}
