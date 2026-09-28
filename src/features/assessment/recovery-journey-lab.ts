/**
 * 6D.3.5.7 — LABORATÓRIO DA JORNADA REAL da Recuperação Final.
 *
 * Menor conjunto de fixtures para percorrer o caminho OFICIAL já construído
 * (Consolidação do ciclo → Pauta 2.0 → Conferir → Registrar → Consolidação)
 * na turma de laboratório de campo (`tur-001`). Nada aqui é regra institucional:
 * - regra própria `lab-jornada-rf`, restrita a `tur-001` por `classIds`
 *   (as regras reais permanecem intocadas);
 * - fechamentos de período fictícios produzidos sob essa regra;
 * - um instrumento do tipo canônico `it-recuperacao-final` (o título não é
 *   usado para identificá-lo).
 * Os fatos da recuperação nascem SOMENTE pela Pauta 2.0 (versões oficiais).
 */
import { assessmentConfigurations, instrumentFixtures } from "./assessment-fixtures";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { AssessmentInstrument } from "./assessment-types";
import type { PeriodClosingRecord } from "./period-closing-types";

export const JOURNEY_LAB_CLASS_ID = "tur-001";
export const JOURNEY_LAB_RULE_ID = "lab-jornada-rf";
export const JOURNEY_LAB_INSTRUMENT_ID = "ins-lab-rf-jornada";
const YEAR = "ano-2026";
const PERIODS = ["pa-2026-a1", "pa-2026-a2", "pa-2026-a3"];
const CURRICULUM = { kind: "atuacao", assignmentId: "atp-001" } as const;
const cfg = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const AT = "2026-12-11T12:00:00.000Z";

export function journeyLabRule(): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  return {
    ...base,
    id: JOURNEY_LAB_RULE_ID,
    name: "Regra de laboratório — jornada da recuperação final",
    status: "homologada",
    scope: { ...base.scope, academicYearId: YEAR, stageIds: [], classIds: [JOURNEY_LAB_CLASS_ID] },
    configurationId: cfg.id,
    configurationVersion: cfg.version,
    cycleAggregation: { kind: "media-simples" },
    finalRecovery: {
      id: "lab-jornada-rec-final",
      enabled: true,
      scope: "anual",
      replacesCategoryIds: [],
      instrumentTypeIds: ["it-recuperacao-final"],
      maxScore: 100,
      prevalence: "maior-resultado",
      eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
      normativeStatus: "configurado",
    },
  } as InstitutionalAssessmentRule;
}

/** Resultado fictício por período: índice par < 50 (elegível), ímpar ≥ 50. */
const labScore = (index: number) => (index % 2 === 0 ? 40 : 70);

export function journeyLabClosings(studentIds: readonly string[]): PeriodClosingRecord[] {
  return PERIODS.map((periodId) => ({
    id: `lab-jornada-fec-${periodId}`,
    scope: { classId: JOURNEY_LAB_CLASS_ID, academicYearId: YEAR, periodId, curriculumRef: CURRICULUM },
    version: 1,
    resultKind: "resultado-consolidado-oficial-do-periodo",
    ruleId: JOURNEY_LAB_RULE_ID,
    ruleVersion: journeyLabRule().version,
    calendarId: "lab-jornada-cal",
    configurationId: cfg.id,
    configurationVersion: cfg.version,
    closedBy: { actorId: "lab", actorName: "Laboratório", profileLabel: "Laboratório", at: AT },
    closedAt: AT,
    results: studentIds.map((studentId, i) => ({
      studentId,
      entryIds: [],
      usedEntryVersions: [],
      categories: [],
      consolidatedPeriodScore: labScore(i),
      rounded: false,
      complete: true,
      unregistered: [],
      coverage: "integral",
    })),
  })) as unknown as PeriodClosingRecord[];
}

export function journeyLabInstrument(): AssessmentInstrument {
  const base = instrumentFixtures.find((i) => i.id === "ins-demo-001")!;
  return {
    ...structuredClone(base),
    id: JOURNEY_LAB_INSTRUMENT_ID,
    // Título propositalmente neutro: a identificação vem só do tipo canônico.
    title: "Avaliação de dezembro (laboratório)",
    instrumentTypeId: "it-recuperacao-final",
    periodId: "pa-2026-a3",
    appliedOn: "2026-12-10",
    status: "aplicado",
  };
}

/**
 * Ativação EXPLÍCITA da jornada: instala as fixtures de laboratório nos stores
 * em memória usados pelas telas oficiais. Idempotente. Sem ativação, nenhuma
 * turma é afetada.
 */
export async function installRecoveryJourneyLab() {
  const [
    { assessmentRuleRepository },
    { periodClosingStore },
    { instrumentStore },
    { demonstrationStudents },
    { calendarRepository },
    { createCalendarFixtures },
    { periodStructures },
  ] = await Promise.all([
      import("./assessment-rule-store"),
      import("./period-closing-store"),
      import("./assessment-instrument-store"),
      import("@/features/students/students-data"),
      import("@/features/calendar/calendar-store"),
      import("@/features/calendar/calendar-fixtures"),
      import("./assessment-fixtures"),
    ]);
  // Calendário de laboratório SÓ EM MEMÓRIA (não gravado, não listado) e
  // vínculo transitório da estrutura demonstrativa a ele; recarregar desfaz.
  const structure = periodStructures.find((st) => st.id === "est-2026-a");
  if (structure && !structure.calendarId) {
    const base = createCalendarFixtures()[0]!;
    calendarRepository.installTransientLaboratoryCalendar?.({
      ...base,
      id: "lab-jornada-cal",
      academicYearId: YEAR,
      year: 2026,
      title: "Calendário de laboratório (só em memória)",
      status: "homologado",
      periods: structure.periods.map((p) => ({
        id: `lab-jornada-cal-${p.id}`,
        order: p.sequence,
        name: p.label,
        start: p.start,
        end: p.end,
      })),
      periodGroups: [],
    } as typeof base);
    structure.calendarId = "lab-jornada-cal";
    // Admissão transitória do tipo canônico na configuração demonstrativa.
    if (!cfg.allowedInstrumentTypeIds.includes("it-recuperacao-final"))
      cfg.allowedInstrumentTypeIds = [...cfg.allowedInstrumentTypeIds, "it-recuperacao-final"];
    for (const p of structure.periods) p.calendarPeriodId = `lab-jornada-cal-${p.id}`;
  }
  assessmentRuleRepository.installLaboratoryRule?.(journeyLabRule());
  periodClosingStore.installLaboratoryRecords(journeyLabClosings(demonstrationStudents.map((s) => s.id)));
  instrumentStore.installLaboratoryInstrument(journeyLabInstrument());
}
