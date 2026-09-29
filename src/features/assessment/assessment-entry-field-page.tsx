/**
 * Pauta de lançamento canônica (6D.3.3.5): única superfície de lançamento oficial.
 * Só composição: nenhuma regra, cálculo ou estado oficial novo.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { withoutUndefined } from "./assessment-period-page";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { AssessmentEntryRegistration, type AssessmentEntryFactSource } from "@/components/sigem/assessment-entry-registration";
import { AssessmentCorrectionPanel, type AssessmentCorrectionFactSource } from "@/components/sigem/assessment-correction-panel";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, diarySearch, type DiarySearch } from "@/features/diary/diary-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate } from "@/lib/academic-date";
import { classConfigurationState } from "./assessment-configuration";
import type { AssessmentBatchOperation } from "./assessment-entry-batch";
import type { InstrumentEntryRosterStudent, ProjectInstrumentEntryRosterInput } from "./assessment-entry-projection";
import { projectInstrumentEntryRoster } from "./assessment-entry-projection";
import { assessmentLogicalEntryId } from "./assessment-entry-versions";
import { buildAssessmentCorrectionContext } from "./assessment-correction-context";
import { periodClosingStore, usePeriodClosingStore } from "./period-closing-store";
import { useInstrumentStore } from "./assessment-instrument-store";
import { FIELD_LAB_CONCEPT_OPTIONS, FIELD_LAB_INSTRUMENT_ID, fieldLabStudents, type FieldLabMode } from "./assessment-entry-field-fixture";
import type { AssessmentConfiguration, EntryValue } from "./assessment-types";
import { currentAssessmentEntryVersion, type AssessmentEntryVersion } from "./assessment-entry-versions";
import { studentPlacements } from "./assessment-rules";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { registerResultsInCloud, useCloudInstrumentFacts } from "./assessment-results-cloud";
import {
  FIELD_CORRECTION_POLICIES,
  FIELD_MISSING_ENTRY_POLICY,
  fieldVersionStore,
  useFieldVersionTick,
} from "./assessment-entry-field-config";

export function AssessmentEntryFieldPage({
  classId,
  instrumentId,
  search,
}: {
  classId: string;
  instrumentId: string;
  search: DiarySearch;
}) {
  const store = useInstrumentStore();
  usePeriodClosingStore(); // reprojeta quando um fechamento muda
  const tick = useFieldVersionTick();
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, {
    professor: context.professionalId,
    turma: classId,
    ...(item ? { unidade: item.unitId, componente: item.field } : {}),
  });
  const klass = getDemonstrationClass(classId);
  const state = classConfigurationState(classId);
  const instrument = store.get(instrumentId);
  const [correctingId, setCorrectingId] = useState<string>("");
  // Sessão institucional ⇒ o banco é a fonte canônica; sem sessão, laboratório em memória.
  const authority = useSessionAuthority();
  const cloud = authority.status === "signed-in";
  const cloudFacts = useCloudInstrumentFacts(instrumentId, cloud);
  const readVersions = () => (cloud ? cloudFacts.versions : fieldVersionStore.versions(instrumentId));
  const readActs = () => (cloud ? cloudFacts.acts : fieldVersionStore.acts(instrumentId));

  const students = useMemo<InstrumentEntryRosterStudent[]>(
    () =>
      instrumentId === FIELD_LAB_INSTRUMENT_ID ? fieldLabStudents(classId) : demonstrationStudents
        .map((s) => ({ s, placements: studentPlacements(s).filter((p) => p.classId === classId) }))
        .filter((x) => x.placements.length > 0)
        .sort((a, b) => a.s.personName.localeCompare(b.s.personName, "pt-BR"))
        .map((x, i) => ({ studentId: x.s.id, displayName: x.s.personName, rollNumber: i + 1, placements: x.placements })),
    [classId, instrumentId],
  );

  const isLab = instrumentId === FIELD_LAB_INSTRUMENT_ID;
  const mode: FieldLabMode = isLab ? fieldVersionStore.mode() : "numerica";
  const baseConfiguration = "configuration" in state ? state.configuration : undefined;
  // Ensaio DEMONSTRATIVO: a escala do laboratório substitui a da turma apenas nesta página.
  const configuration = useMemo<AssessmentConfiguration | undefined>(() => {
    if (!baseConfiguration || !isLab || mode === "numerica") return baseConfiguration;
    const scale =
      mode === "conceitual"
        ? { kind: "conceitual" as const, ordered: true, options: FIELD_LAB_CONCEPT_OPTIONS.map((o) => ({ ...o })), normativeStatus: "demonstrativo" as const }
        : { kind: "descritiva" as const };
    return { ...baseConfiguration, allowsGrades: false, scales: [scale] };
  }, [baseConfiguration, isLab, mode]);

  const readRoster = (): ProjectInstrumentEntryRosterInput | null =>
    instrument && configuration
      ? {
          instrument,
          configuration,
          students,
          versions: readVersions(),
          missingEntryPolicy: FIELD_MISSING_ENTRY_POLICY,
        }
      : null;

  // Nova fonte a cada mudança oficial ⇒ reprojeção sem perder o rascunho.
  const entrySource = useMemo<AssessmentEntryFactSource | null>(() => {
    if (!instrument || !configuration) return null;
    return {
      readRoster: () => readRoster()!,
      readActs,
      append: (versions, act) =>
        cloud
          ? registerResultsInCloud({
              instrumentId: instrument.id,
              classId: instrument.classId,
              periodId: instrument.periodId,
              planId: act.planId,
              configurationId: act.configurationId,
              configurationVersion: act.configurationVersion,
              versions,
            }).then(async (r) => (await cloudFacts.refresh(), r))
          : fieldVersionStore.appendBatch(instrument.id, versions, act),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, instrument, configuration, students, cloud, cloudFacts.versions, cloudFacts.acts]);

  if (!klass || !instrument || instrument.classId !== classId || !configuration || !entrySource)
    return (
      <StatePanel
        tone="danger"
        title="Pauta indisponível"
        description="O instrumento não existe nesta turma, foi criado em outra aba (estado temporário) ou a turma não tem configuração avaliativa."
      />
    );

  const correctionSource: AssessmentCorrectionFactSource = {
    readVersions,
    append: (v) =>
      cloud
        ? registerResultsInCloud({
            instrumentId: instrument.id,
            classId: instrument.classId,
            periodId: instrument.periodId,
            // Chave determinística: repetir a mesma correção não cria segundo ato.
            planId: `corr-${v.supersedesVersionId ?? v.logicalEntryId}`,
            versions: [v],
          }).then(async (r) => (await cloudFacts.refresh(), r))
        : fieldVersionStore.appendVersion(instrument.id, v),
  };
  const roster = readRoster()!;
  const projection = projectInstrumentEntryRoster(roster);
  const recorded =
    projection.state === "entry-enabled"
      ? projection.rosterItems.filter((r) => r.entryState === "recorded")
      : [];
  const correcting = recorded.find((r) => r.studentId === correctingId);
  const eligible =
    projection.state === "entry-enabled" ? projection.rosterItems.filter((r) => r.entryState !== "not-applicable") : [];
  const typeLabel = store.typeLabel(instrument.instrumentTypeId);
  // Cloud: agente e capacidades vêm da atuação vigente × política homologada; nunca de perfil demonstrativo.
  const agent = cloud
    ? {
        agentId: authority.person?.id ?? authority.user.id,
        capabilities: authority.capabilities
          .filter((c) => (c.classId === null || c.classId === classId) && (c.periodId === null || c.periodId === instrument.periodId))
          .map((c) => c.capabilityId),
      }
    : { agentId: instrument.professionalId ?? context.professionalId, capabilities: [] as string[] };
  // 6D.3.4.3b — fechamento vigente relido da fonte canônica a cada projeção/registro.
  const correctionContext = () =>
    buildAssessmentCorrectionContext({
      agent,
      instrument,
      configuration,
      policies: FIELD_CORRECTION_POLICIES,
      closingRecords: periodClosingStore.allRecords(),
      periodLabel: store.periodLabel(instrument),
    });
  const newBatchId = (op: AssessmentBatchOperation) =>
    op.kind === "novo-registro"
      ? `ver-${instrument.id}-${op.studentId}-1`
      : `ver-${instrument.id}-${op.studentId}-${op.baseVersion + 1}`;

  // 6D.3.3.4 — retorno contextual: turma + período do instrumento; a busca só
  // volta quando pertence ao mesmo período (estado de navegação, não dado).
  const periodReturnSearch = withoutUndefined({
    ...classSearch,
    periodo: instrument.periodId,
    q: search.periodo === instrument.periodId ? search.q : undefined,
  });
  // 6D.3.5.7 — vindo da Consolidação do ciclo, o retorno natural é ela.
  const fromConsolidation = search.origem === "consolidacao";
  const backToConsolidation = (variant: "outline" | "default") => (
    <Button asChild variant={variant} size="sm" className={variant === "default" ? "min-h-11" : undefined}>
      <Link to="/diario/turmas/$turmaId/avaliacao/consolidacao" params={{ turmaId: classId }} search={classSearch}>
        {variant === "outline" && <ArrowLeft />} Voltar à Consolidação do ciclo
      </Link>
    </Button>
  );
  const backToPeriod = (variant: "outline" | "default") => (
    <Button asChild variant={variant} size="sm" className={variant === "default" ? "min-h-11" : undefined}>
      <Link to="/diario/turmas/$turmaId/avaliacao/periodo" params={{ turmaId: classId }} search={periodReturnSearch}>
        {variant === "outline" && <ArrowLeft />} Voltar à Avaliação do período
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <DiaryHeader
        title={instrument.title}
        description={`${typeLabel} · ${klass.name} · aplicado em ${formatAcademicDate(instrument.appliedOn)} · ${store.periodLabel(instrument)}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} search={classSearch}>
            <ArrowLeft /> Avaliação da turma
          </Link>
        </Button>
        {fromConsolidation ? backToConsolidation("outline") : backToPeriod("outline")}
      </DiaryHeader>

      <AssessmentEntryRegistration
        key={mode}
        contextLabel={`${instrument.title} · ${klass.name}`}
        source={entrySource}
        context={{
          agent,
          recordedByAssignmentId: instrument.pedagogicalAssignmentId,
          correctionPolicies: FIELD_CORRECTION_POLICIES,
          instrumentStatus: instrument.status ?? "planejado",
        }}
        readPeriodClosing={() => correctionContext().periodClosing}
        newVersionId={newBatchId}
        renderSuccessContinuation={() => (fromConsolidation ? backToConsolidation("default") : backToPeriod("default"))}
        correctingStudentId={correcting?.studentId}
        onRequestCorrection={(id) => setCorrectingId((current) => (current === id ? "" : id))}
        renderCorrection={(row) => (
          <div className="space-y-2 rounded-md border border-border p-3">
            <AssessmentCorrectionPanel
              key={row.studentId}
              studentName={row.displayName}
              instrumentLabel={instrument.title}
              logicalEntryId={assessmentLogicalEntryId(instrument.id, row.studentId)}
              source={correctionSource}
              missingEntryPolicy={FIELD_MISSING_ENTRY_POLICY}
              context={correctionContext()}
              readContext={correctionContext}
              newVersionId={(base) => `ver-${instrument.id}-${row.studentId}-${base.version + 1}`}
            />
            <Button variant="ghost" className="min-h-11" onClick={() => setCorrectingId("")}>
              Fechar correção
            </Button>
          </div>
        )}
      />

    </div>
  );
}
