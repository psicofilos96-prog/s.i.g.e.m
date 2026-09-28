/**
 * 6D.3.2.5-A — Pauta de Lançamento 2.0 montada no Diário real.
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
import { useInstrumentStore } from "./assessment-instrument-store";
import { FIELD_LAB_CONCEPT_OPTIONS, FIELD_LAB_INSTRUMENT_ID, fieldLabStudents, type FieldLabMode } from "./assessment-entry-field-fixture";
import type { AssessmentConfiguration, EntryValue } from "./assessment-types";
import { currentAssessmentEntryVersion, type AssessmentEntryVersion } from "./assessment-entry-versions";
import { studentPlacements } from "./assessment-rules";
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
  const [conflictTarget, setConflictTarget] = useState("");

  const readRoster = (): ProjectInstrumentEntryRosterInput | null =>
    instrument && configuration
      ? {
          instrument,
          configuration,
          students,
          versions: fieldVersionStore.versions(instrument.id),
          missingEntryPolicy: FIELD_MISSING_ENTRY_POLICY,
        }
      : null;

  // Nova fonte a cada mudança oficial ⇒ reprojeção sem perder o rascunho.
  const entrySource = useMemo<AssessmentEntryFactSource | null>(() => {
    if (!instrument || !configuration) return null;
    return {
      readRoster: () => readRoster()!,
      readActs: () => fieldVersionStore.acts(instrument.id),
      append: (versions, act) => fieldVersionStore.appendBatch(instrument.id, versions, act),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, instrument, configuration, students]);

  if (!klass || !instrument || instrument.classId !== classId || !configuration || !entrySource)
    return (
      <StatePanel
        tone="danger"
        title="Pauta indisponível"
        description="O instrumento não existe nesta turma, foi criado em outra aba (estado temporário) ou a turma não tem configuração avaliativa."
      />
    );

  const correctionSource: AssessmentCorrectionFactSource = {
    readVersions: () => fieldVersionStore.versions(instrument.id),
    append: (v) => fieldVersionStore.appendVersion(instrument.id, v),
  };
  const roster = readRoster()!;
  const projection = projectInstrumentEntryRoster(roster);
  const recorded =
    projection.state === "entry-enabled"
      ? projection.rosterItems.filter((r) => r.entryState === "recorded")
      : [];
  const correcting = recorded.find((r) => r.studentId === correctingId);
  // G — mecanismo EXCLUSIVAMENTE demonstrativo: outra "sessão" grava um fato oficial.
  const simulateOtherSession = () => {
    const logical = assessmentLogicalEntryId(instrument.id, conflictTarget);
    const base = currentAssessmentEntryVersion(fieldVersionStore.versions(instrument.id), logical);
    const value: EntryValue =
      mode === "numerica"
        ? { kind: "numerica", value: base?.value.kind === "numerica" && base.value.value === 100 ? 99 : 100 }
        : mode === "conceitual"
          ? { kind: "conceitual", optionId: base?.value.kind === "conceitual" && base.value.optionId === "cdemo-d" ? "cdemo-c" : "cdemo-d" }
          : { kind: "descritiva", text: "Registro alterado por outra sessão (simulação do laboratório)." };
    const at = new Date().toISOString();
    const version = (base?.version ?? 0) + 1;
    fieldVersionStore.appendVersion(instrument.id, {
      id: `ver-${instrument.id}-${conflictTarget}-${version}-sim`,
      logicalEntryId: logical,
      version,
      ...(base ? { supersedesVersionId: base.id } : {}),
      instrumentId: instrument.id,
      studentId: conflictTarget,
      status: "registrado",
      value,
      recordedAt: at,
      recordedBy: { professionalId: "pro-sim", pedagogicalAssignmentId: instrument.pedagogicalAssignmentId, displayName: "Outra sessão (simulação)", at },
    } as unknown as AssessmentEntryVersion);
  };
  const eligible =
    projection.state === "entry-enabled" ? projection.rosterItems.filter((r) => r.entryState !== "not-applicable") : [];
  const typeLabel = store.typeLabel(instrument.instrumentTypeId);
  const agent = { agentId: instrument.professionalId ?? context.professionalId, capabilities: [] as string[] };
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
        {backToPeriod("outline")}
      </DiaryHeader>

      <p className="text-sm text-muted-foreground">
        Laboratório de campo: os registros desta pauta ficam apenas nesta aba e não substituem a pauta anterior.
      </p>

      {isLab && (
        <section aria-label="Controles do laboratório" className="space-y-3 rounded-md border border-dashed border-border p-3 text-sm">
          <p className="font-medium">Controles do laboratório (não pertencem ao produto)</p>
          <label className="flex flex-wrap items-center gap-2">
            <span>Ensaio:</span>
            <select
              className="min-h-11 rounded-md border border-input bg-background px-2"
              value={mode}
              onChange={(e) => { setCorrectingId(""); fieldVersionStore.setMode(e.target.value as FieldLabMode); }}
            >
              <option value="numerica">A — Numérico</option>
              <option value="conceitual">B — Conceitual (escala demonstrativa)</option>
              <option value="descritiva">C — Descritivo</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-wrap items-center gap-2">
              <span>G — Simular alteração por outra sessão em:</span>
              <select
                className="min-h-11 max-w-full rounded-md border border-input bg-background px-2"
                value={conflictTarget}
                onChange={(e) => setConflictTarget(e.target.value)}
              >
                <option value="">Escolha um estudante</option>
                {eligible.map((r) => (
                  <option key={r.studentId} value={r.studentId}>{r.rollNumber}. {r.displayName}</option>
                ))}
              </select>
            </label>
            <Button variant="outline" className="min-h-11" disabled={!conflictTarget} onClick={simulateOtherSession}>
              Simular alteração
            </Button>
          </div>
        </section>
      )}

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
        newVersionId={newBatchId}
        renderSuccessContinuation={() => backToPeriod("default")}
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
              context={{ agent, instrument, configuration, policies: FIELD_CORRECTION_POLICIES }}
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
