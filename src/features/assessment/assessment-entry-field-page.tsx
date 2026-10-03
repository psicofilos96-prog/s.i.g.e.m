import { useAssessmentNormativeSource, normativeSessionArgs } from "./assessment-normative-sources";
import { teachingClass, useInstitutionalTeaching } from "@/features/diary/institutional-teaching";
import { useInstitutionalRoster } from "@/features/students/institutional-roster";
import { useDiaryCloudSync } from "@/features/diary/diary-cloud";
import { useDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
/**
 * Pauta de lançamento canônica (6D.3.3.5): única superfície de lançamento oficial.
 * Só composição: nenhuma regra, cálculo ou estado oficial novo.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { withoutUndefined } from "./assessment-period-page";
import { classEntryRoster } from "./assessment-period-sources";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { AssessmentEntryRegistration, type AssessmentEntryFactSource } from "@/components/sigem/assessment-entry-registration";
import { AssessmentCorrectionPanel, type AssessmentCorrectionFactSource } from "@/components/sigem/assessment-correction-panel";
import { DiaryHeader } from "@/features/diary/diary-context";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, diarySearch, type DiarySearch } from "@/features/diary/diary-data";
import { formatAcademicDate } from "@/lib/academic-date";
import type { AssessmentBatchOperation } from "./assessment-entry-batch";
import type { InstrumentEntryRosterStudent, ProjectInstrumentEntryRosterInput } from "./assessment-entry-projection";
import { projectInstrumentEntryRoster } from "./assessment-entry-projection";
import { assessmentLogicalEntryId } from "./assessment-entry-versions";
import { buildAssessmentCorrectionContext } from "./assessment-correction-context";
import { periodClosingStore, usePeriodClosingStore } from "./period-closing-store";
import { useInstrumentStore } from "./assessment-instrument-store";
import { FIELD_LAB_CONCEPT_OPTIONS, FIELD_LAB_INSTRUMENT_ID, type FieldLabMode } from "./assessment-entry-field-fixture";
import type { AssessmentConfiguration } from "./assessment-types";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { registerResultsInCloud, useCloudPautaFacts } from "./assessment-results-cloud";
import { currentClosingForInstrument } from "./assessment-correction-context";
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
  useDiaryCloudSync();
  const diaryMode = useDiaryPersistenceMode();
  useInstitutionalTeaching();
  const authority = useSessionAuthority();
  const cloud = authority.status === "signed-in";
  // O espelho do Diário pode ainda estar em laboratório no primeiro render da sessão.
  const institutionalContextReady = !cloud || diaryMode === "cloud";
  const context = institutionalContextReady
    ? diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data)
    : undefined;
  const item = context?.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, {
    ...(context ? { professor: context.professionalId } : {}),
    turma: classId,
    ...(item ? { unidade: item.unitId, componente: item.field } : {}),
  });
  const klass = institutionalContextReady ? teachingClass(classId) : undefined;
  const [correcting, setCorrecting] = useState<{ instrumentId: string; studentId: string; cloud: boolean } | null>(null);
  // Sessão institucional ⇒ o banco é a fonte canônica; sem sessão, laboratório em memória.
  const institutionalRoster = useInstitutionalRoster();
  const cloudFacts = useCloudPautaFacts(instrumentId, classId, cloud);
  // Com sessão, o instrumento é o do cadastro institucional; nunca cópia do navegador.
  const instrument = cloud
    ? cloudFacts.ready && cloudFacts.instrument?.id === instrumentId && cloudFacts.instrument.classId === classId
      ? cloudFacts.instrument
      : undefined
    : store.get(instrumentId);
  // A Pauta só resolve normas depois de conhecer a data efetiva do instrumento.
  const state = useAssessmentNormativeSource({
    classId,
    ...normativeSessionArgs(authority),
    stageId: klass?.stageId ?? undefined,
    academicYearId: klass?.academicYearId,
    academicDate: instrument?.appliedOn,
  }).state;
  const closingRecords = () => (cloud ? cloudFacts.closings : periodClosingStore.allRecords());
  const correctionPolicies = cloud ? cloudFacts.policies : FIELD_CORRECTION_POLICIES;
  const expectedClosingId = () =>
    instrument ? (currentClosingForInstrument(closingRecords(), instrument)?.id ?? null) : null;
  const readVersions = () => (cloud ? cloudFacts.versions : fieldVersionStore.versions(instrumentId));
  const readActs = () => (cloud ? cloudFacts.acts : fieldVersionStore.acts(instrumentId));

  const isLab = !cloud && instrumentId === FIELD_LAB_INSTRUMENT_ID;
  const rosterReady = !cloud || institutionalRoster.status === "pronta";
  const students = useMemo<InstrumentEntryRosterStudent[]>(
    () => classEntryRoster(classId, isLab, cloud ? (rosterReady ? institutionalRoster.students : []) : undefined),
    [classId, isLab, cloud, rosterReady, institutionalRoster.students],
  );
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
  // Não há catálogo institucional de motivos de "não registrado" nesta etapa.
  const missingEntryPolicy = cloud ? undefined : FIELD_MISSING_ENTRY_POLICY;
  const officialPeriod = cloud && "structure" in state
    ? state.structure.periods.find((period) => period.id === instrument?.periodId)
    : undefined;
  const periodLabel = cloud ? officialPeriod?.label : instrument ? store.periodLabel(instrument) : undefined;
  const typeLabel = cloud ? instrument?.instrumentTypeId : instrument ? store.typeLabel(instrument.instrumentTypeId) : undefined;

  const readRoster = (): ProjectInstrumentEntryRosterInput | null =>
    instrument && configuration
      ? {
          instrument,
          configuration,
          students,
          versions: readVersions(),
          ...(officialPeriod ? { period: officialPeriod } : {}),
          ...(missingEntryPolicy ? { missingEntryPolicy } : {}),
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
          ? versions.some((version) => version.value.kind === "nao-registrado")
            ? Promise.resolve({ ok: false as const, message: "Política institucional de não registro indisponível. Nada foi gravado." })
            : registerResultsInCloud({
              instrumentId: instrument.id,
              expectedClosingId: expectedClosingId(),
              planId: act.planId,
              configurationId: act.configurationId,
              configurationVersion: act.configurationVersion,
              versions,
            }).then(async (r) => (await cloudFacts.refresh(), r))
          : fieldVersionStore.appendBatch(instrument.id, versions, act),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, instrument, configuration, officialPeriod, students, cloud, missingEntryPolicy, cloudFacts.versions, cloudFacts.acts, cloudFacts.closings]);

  if (!context || !klass || !instrument || instrument.classId !== classId || !configuration || !entrySource || !periodLabel)
    return (
      <StatePanel
        tone="danger"
        title="Pauta indisponível"
        description={cloud
          ? "Aguardando instrumento, turma, configuração e período oficiais aplicáveis à data de aplicação."
          : "O instrumento não existe nesta turma, foi criado em outra aba (estado temporário) ou a turma não tem configuração avaliativa."}
      />
    );

  const correctionSource: AssessmentCorrectionFactSource = {
    readVersions,
    append: (v) =>
      cloud
        ? v.value.kind === "nao-registrado"
          ? Promise.resolve({ ok: false as const, message: "Política institucional de não registro indisponível. Nada foi gravado." })
          : registerResultsInCloud({
            instrumentId: instrument.id,
            expectedClosingId: expectedClosingId(),
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
  const correctingStudent = recorded.find((r) => correcting?.instrumentId === instrumentId && correcting.cloud === cloud && r.studentId === correcting.studentId);
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
      policies: correctionPolicies,
      closingRecords: closingRecords(),
      periodLabel,
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
        description={`${typeLabel ?? instrument.instrumentTypeId} · ${klass.name} · aplicado em ${formatAcademicDate(instrument.appliedOn)} · ${periodLabel}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} search={classSearch}>
            <ArrowLeft /> Avaliação da turma
          </Link>
        </Button>
        {fromConsolidation ? backToConsolidation("outline") : backToPeriod("outline")}
      </DiaryHeader>

      {!rosterReady ? (
        <StatePanel
          tone="warning"
          title="Pauta indisponível"
          description={institutionalRoster.status === "indisponivel"
            ? "Não foi possível consultar os estudantes institucionais da turma."
            : "Aguardando os estudantes institucionais da turma."}
        />
      ) : <>
        {cloud && <p role="status" className="text-sm text-muted-foreground">
          A ação “Não registrado” está indisponível até existir uma política institucional de motivos.
        </p>}
        <AssessmentEntryRegistration
        key={`${cloud ? "institucional" : "laboratorio"}:${classId}:${instrumentId}:${mode}`}
        contextLabel={`${instrument.title} · ${klass.name}`}
        source={entrySource}
        context={{
          agent,
          recordedByAssignmentId: instrument.pedagogicalAssignmentId,
          correctionPolicies: correctionPolicies,
          instrumentStatus: instrument.status ?? "planejado",
        }}
        readPeriodClosing={() => correctionContext().periodClosing}
        newVersionId={newBatchId}
        renderSuccessContinuation={() => (fromConsolidation ? backToConsolidation("default") : backToPeriod("default"))}
        allowMissingEntry={!cloud}
        correctingStudentId={correctingStudent?.studentId}
        onRequestCorrection={(id) => setCorrecting((current) => (current?.instrumentId === instrumentId && current.cloud === cloud && current.studentId === id ? null : { instrumentId, studentId: id, cloud }))}
        renderCorrection={(row) => (
          <div className="space-y-2 rounded-md border border-border p-3">
            <AssessmentCorrectionPanel
              key={row.studentId}
              studentName={row.displayName}
              instrumentLabel={instrument.title}
              logicalEntryId={assessmentLogicalEntryId(instrument.id, row.studentId)}
              source={correctionSource}
              {...(missingEntryPolicy ? { missingEntryPolicy } : {})}
              allowMissingEntry={!cloud}
              context={correctionContext()}
              readContext={correctionContext}
              newVersionId={(base) => `ver-${instrument.id}-${row.studentId}-${base.version + 1}`}
            />
            <Button variant="ghost" className="min-h-11" onClick={() => setCorrecting(null)}>
              Fechar correção
            </Button>
          </div>
        )}
        />
      </>}

    </div>
  );
}
