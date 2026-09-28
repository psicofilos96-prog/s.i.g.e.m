/**
 * 6D.3.3.2 — Página da Mesa Avaliativa do Período no Diário.
 * Só composição: monta a entrada da projeção a partir das fontes demonstrativas
 * existentes e reprojeta quando um fato oficial muda. Nenhuma regra nova.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { AssessmentCorrectionPanel } from "@/components/sigem/assessment-correction-panel";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, diarySearch, type DiarySearch } from "@/features/diary/diary-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate } from "@/lib/academic-date";
import { classConfigurationState } from "./assessment-configuration";
import { compositionModelFor } from "./assessment-composition-fixtures";
import type { InstrumentEntryRosterStudent } from "./assessment-entry-projection";
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
import { projectAssessmentPeriod, type PeriodActionDefinition } from "./assessment-period-projection";
import { AssessmentPeriodWorkspace } from "./assessment-period-workspace";

/** Ações DEMONSTRATIVAS declaradas por configuração; o projetor não conhece verbos. */
export const PERIOD_DEMO_ACTIONS: readonly PeriodActionDefinition[] = [
  { actionId: "abrir-pauta", label: "Abrir pauta", target: "instrument", requiredCapabilities: [] },
  {
    actionId: "corrigir",
    label: "Corrigir",
    target: "result",
    requiredCapabilities: [],
    admissibleCellStates: ["recorded", "explicitly-unrecorded"],
  },
];

export function AssessmentPeriodPage({ classId, search }: { classId: string; search: DiarySearch }) {
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
  const configuration = "configuration" in state ? state.configuration : undefined;
  const all = store.instrumentsForClass(classId);
  const periodIds = [...new Set(all.map((i) => i.periodId))];
  const [periodId, setPeriodId] = useState<string>(periodIds[0] ?? "");
  const [correcting, setCorrecting] = useState<{ studentId: string; instrumentId: string } | null>(null);
  const periodInstruments = all.filter((i) => i.periodId === periodId);
  const periodLabel = periodInstruments[0] ? store.periodLabel(periodInstruments[0]) : undefined;

  // Lacuna documentada: a fixture do laboratório tem estudantes próprios; sem
  // ela, usamos o cadastro demonstrativo da turma.
  const students = useMemo<InstrumentEntryRosterStudent[]>(() => {
    if (all.some((i) => i.id === FIELD_LAB_INSTRUMENT_ID)) return fieldLabStudents(classId);
    return demonstrationStudents
      .map((s) => ({ s, placements: studentPlacements(s).filter((p) => p.classId === classId) }))
      .filter((x) => x.placements.length > 0)
      .sort((a, b) => a.s.personName.localeCompare(b.s.personName, "pt-BR"))
      .map((x, i) => ({ studentId: x.s.id, displayName: x.s.personName, rollNumber: i + 1, placements: x.placements }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, all.length]);

  const agent = { agentId: context.professionalId, capabilities: [] as string[] };
  // Reprojeção a cada mudança oficial (tick); nenhum valor é guardado na tela.
  const projection = useMemo(
    () =>
      projectAssessmentPeriod({
        context: {
          classId,
          ...(klass ? { classLabel: klass.name } : {}),
          ...(item?.field ? { componentLabel: item.field } : {}),
        },
        period: periodId ? { id: periodId, ...(periodLabel ? { label: periodLabel } : {}) } : undefined,
        configuration,
        compositionModel: configuration ? compositionModelFor(configuration.id) : undefined,
        instruments: all,
        students,
        versions: periodInstruments.flatMap((i) => fieldVersionStore.versions(i.id)),
        missingEntryPolicy: FIELD_MISSING_ENTRY_POLICY,
        agent,
        actionDefinitions: PERIOD_DEMO_ACTIONS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, periodId, configuration, students, all.length],
  );

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} search={classSearch}>
        <ArrowLeft /> Avaliação da turma
      </Link>
    </Button>
  );

  const header = (
    <DiaryHeader
      title="Avaliação do período"
      description={[klass?.name, item?.field, periodLabel].filter(Boolean).join(" · ")}
      context={context}
    >
      {back}
    </DiaryHeader>
  );

  if (!klass)
    return <StatePanel tone="danger" title="Turma não encontrada" description="Esta turma não existe no ambiente demonstrativo." />;

  return (
    <div className="space-y-6">
      {header}
      <p className="text-sm text-muted-foreground">
        Acompanhe os registros da turma e abra um instrumento quando precisar lançar ou revisar resultados.
      </p>
      {periodIds.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Período:</span>
          <select className="min-h-11 rounded-md border border-input bg-background px-2" value={periodId} onChange={(e) => { setCorrecting(null); setPeriodId(e.target.value); }}>
            {periodIds.map((id) => {
              const inst = all.find((i) => i.periodId === id)!;
              return <option key={id} value={id}>{store.periodLabel(inst)}</option>;
            })}
          </select>
        </label>
      )}

      {projection.state === "period-unavailable" ? (
        <StatePanel tone="info" title="Mesa indisponível" description={projection.disclosableReasons.join(" ")} />
      ) : (
        <AssessmentPeriodWorkspace
          projection={projection}
          formatDate={formatAcademicDate}
          renderOpenPauta={(instrumentId, label) => (
            <Button asChild size="sm">
              <Link
                to="/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
                params={{ turmaId: classId, instrumentoId: instrumentId }}
                search={classSearch}
              >
                {label}
              </Link>
            </Button>
          )}
          correcting={correcting}
          onRequestCorrection={(studentId, instrumentId) =>
            setCorrecting((c) => (c && c.studentId === studentId && c.instrumentId === instrumentId ? null : { studentId, instrumentId }))
          }
          renderCorrection={(student, cell) => {
            const instrument = store.get(cell.instrumentId);
            if (!instrument || !configuration) return null;
            return (
              <div className="space-y-2">
                <AssessmentCorrectionPanel
                  key={`${student.studentId}-${cell.instrumentId}`}
                  studentName={student.displayName}
                  instrumentLabel={instrument.title}
                  logicalEntryId={assessmentLogicalEntryId(instrument.id, student.studentId)}
                  source={{
                    readVersions: () => fieldVersionStore.versions(instrument.id),
                    append: (v) => fieldVersionStore.appendVersion(instrument.id, v),
                  }}
                  missingEntryPolicy={FIELD_MISSING_ENTRY_POLICY}
                  context={{ agent, instrument, configuration, policies: FIELD_CORRECTION_POLICIES }}
                  newVersionId={(base) => `ver-${instrument.id}-${student.studentId}-${base.version + 1}`}
                />
                <Button variant="ghost" className="min-h-11" onClick={() => setCorrecting(null)}>Fechar correção</Button>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
