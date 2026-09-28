/**
 * 6D.3.2.5-A — Pauta de Lançamento 2.0 montada no Diário real.
 * Só composição: nenhuma regra, cálculo ou estado oficial novo.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { FIELD_LAB_INSTRUMENT_ID, fieldLabStudents } from "./assessment-entry-field-fixture";
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

  const configuration = "configuration" in state ? state.configuration : undefined;

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
  const typeLabel = store.typeLabel(instrument.instrumentTypeId);
  const agent = { agentId: instrument.professionalId ?? context.professionalId, capabilities: [] as string[] };
  const newBatchId = (op: AssessmentBatchOperation) =>
    op.kind === "novo-registro"
      ? `ver-${instrument.id}-${op.studentId}-1`
      : `ver-${instrument.id}-${op.studentId}-${op.baseVersion + 1}`;

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
      </DiaryHeader>

      <p className="text-sm text-muted-foreground">
        Laboratório de campo: os registros desta pauta ficam apenas nesta aba e não substituem a pauta anterior.
      </p>

      <AssessmentEntryRegistration
        contextLabel={`${instrument.title} · ${klass.name}`}
        source={entrySource}
        context={{
          agent,
          recordedByAssignmentId: instrument.pedagogicalAssignmentId,
          correctionPolicies: FIELD_CORRECTION_POLICIES,
          instrumentStatus: instrument.status ?? "planejado",
        }}
        newVersionId={newBatchId}
      />

      <section aria-labelledby="corrigir-titulo" className="space-y-3 border-t border-border/70 pt-5">
        <h2 id="corrigir-titulo" className="text-base font-semibold">Corrigir um resultado já registrado</h2>
        {recorded.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há resultado registrado neste instrumento.</p>
        ) : (
          <label className="block max-w-md text-sm">
            <span className="mb-1 block text-muted-foreground">Estudante</span>
            <select
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={correctingId}
              onChange={(e) => setCorrectingId(e.target.value)}
            >
              <option value="">Escolha o estudante</option>
              {recorded.map((r) => (
                <option key={r.studentId} value={r.studentId}>
                  {r.rollNumber ? `${r.rollNumber}. ` : ""}{r.displayName} — {r.currentDisplayLabel}
                </option>
              ))}
            </select>
          </label>
        )}
        {correcting ? (
          <AssessmentCorrectionPanel
            key={correcting.studentId}
            studentName={correcting.displayName}
            instrumentLabel={instrument.title}
            logicalEntryId={assessmentLogicalEntryId(instrument.id, correcting.studentId)}
            source={correctionSource}
            missingEntryPolicy={FIELD_MISSING_ENTRY_POLICY}
            context={{ agent, instrument, configuration, policies: FIELD_CORRECTION_POLICIES }}
            newVersionId={(base) => `ver-${instrument.id}-${correcting.studentId}-${base.version + 1}`}
          />
        ) : null}
      </section>
    </div>
  );
}
