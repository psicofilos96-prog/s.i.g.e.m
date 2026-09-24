/**
 * Etapa 12D — Acompanhamento avaliativo por aluno (projeção pura).
 *
 * Somente LEITURA. Cruza entidades já existentes (12A–12C): colocações do
 * aluno, configuração da turma, instrumentos e lançamentos. Não guarda estado,
 * não copia lançamentos e não expõe nenhuma operação de escrita.
 *
 * Contagens são contagens de ITENS (quantos instrumentos em cada situação).
 * Nunca soma, média, peso, arredondamento, resultado ou situação acadêmica.
 */
import { classAcademicYear } from "@/features/academic/academic-structure";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  infantExperienceFixtures,
  type InfantExperienceRecord,
} from "@/features/diary/infant-experiences";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { classConfigurationState } from "./assessment-configuration";
import { instrumentFlowAvailable } from "./assessment-instruments";
import { placementOn, studentPlacements } from "./assessment-rules";
import type {
  AcademicPlacement,
  AssessmentConfiguration,
  AssessmentEntry,
  AssessmentInstrument,
  AssessmentPeriodStructure,
  PeriodSource,
} from "./assessment-types";

/** Situação de um instrumento PARA ESTE ALUNO — nunca um resultado. */
export type JourneyItemState =
  /** Lançamento registrado com valor na escala. */
  | "registrado"
  /** Registrado como "não registrado", com motivo: ausência legítima. */
  | "nao-registrado"
  /** Elegível na data, instrumento aplicado, lançamento vazio ou em rascunho. */
  | "pendente"
  /** Elegível, mas o instrumento ainda está planejado: não é pendência. */
  | "planejado"
  /** Sem vínculo com a turma na data de aplicação: ausência legítima. */
  | "nao-elegivel";

export type IneligibilityReason = "ingresso-posterior" | "saida-anterior";

export type JourneyItem = {
  instrumentId: string;
  classId: string;
  /** Rótulos históricos (snapshot do lançamento, ou do instrumento). */
  historical: { title: string; typeLabel: string; periodLabel: string; classLabel: string; field: string };
  /** Rótulos atuais — referência secundária, apenas quando diferem. */
  current: { typeLabel: string; periodLabel: string };
  appliedOn: string;
  periodSource: PeriodSource | undefined;
  state: JourneyItemState;
  draft: boolean;
  corrected: boolean;
  ineligibility?: { reason: IneligibilityReason; date: string };
  /** Referência (não cópia) ao lançamento existente, quando houver. */
  entry?: Readonly<AssessmentEntry>;
};

export type PeriodCounts = Record<JourneyItemState, number> & { corrigido: number };

export type JourneyPeriod = {
  periodId: string;
  label: string;
  start?: string;
  end?: string;
  items: JourneyItem[];
  counts: PeriodCounts;
  /** O vínculo do aluno encerrou antes do período começar. */
  pathClosed: boolean;
  current: boolean;
};

export type InfantTimelineItem = {
  experienceId: string;
  date: string;
  title: string;
  classId: string;
  fieldIds: string[];
  collectiveObservation: string;
  individualObservation?: string;
};

export type StudentJourney =
  | { kind: "sem-configuracao"; reason: string }
  | {
      kind: "instrumentos";
      configuration: AssessmentConfiguration;
      academicYearId: string;
      classIds: string[];
      placements: AcademicPlacement[];
      placementAtReference: AcademicPlacement | null;
      periods: JourneyPeriod[];
      /** Totais de itens — nunca soma de valores. */
      totals: PeriodCounts;
      lastPlacementEnd: string | null;
    }
  | {
      kind: "acompanhamento";
      configuration: AssessmentConfiguration;
      academicYearId: string;
      classIds: string[];
      placements: AcademicPlacement[];
      placementAtReference: AcademicPlacement | null;
      timeline: InfantTimelineItem[];
    };

export type JourneySource = {
  instruments: readonly AssessmentInstrument[];
  entries: readonly AssessmentEntry[];
  typeLabel: (id: string) => string;
  periodLabel: (instrument: AssessmentInstrument) => string;
  infantRecords?: readonly InfantExperienceRecord[];
};

export const emptyCounts = (): PeriodCounts => ({
  registrado: 0,
  "nao-registrado": 0,
  pendente: 0,
  planejado: 0,
  "nao-elegivel": 0,
  corrigido: 0,
});

/** Classifica um instrumento para o aluno. Pura. */
export function classifyItem(
  instrument: AssessmentInstrument,
  placements: AcademicPlacement[],
  entry: AssessmentEntry | undefined,
): Pick<JourneyItem, "state" | "draft" | "corrected" | "ineligibility"> {
  const corrected = !!entry?.history?.length;
  if (entry?.status === "registrado")
    return {
      state: entry.value.kind === "nao-registrado" ? "nao-registrado" : "registrado",
      draft: false,
      corrected,
    };
  const at = placementOn(placements, instrument.classId, instrument.appliedOn);
  if (!at) {
    const inClass = placements.filter((p) => p.classId === instrument.classId);
    const later = inClass
      .map((p) => p.from)
      .filter((d): d is string => !!d && d > instrument.appliedOn)
      .sort()[0];
    const earlier = inClass
      .map((p) => p.until)
      .filter((d): d is string => !!d && d < instrument.appliedOn)
      .sort()
      .reverse()[0];
    const ineligibility = later
      ? { reason: "ingresso-posterior" as const, date: later }
      : earlier
        ? { reason: "saida-anterior" as const, date: earlier }
        : undefined;
    return { state: "nao-elegivel", draft: false, corrected, ...(ineligibility ? { ineligibility } : {}) };
  }
  if (instrument.status !== "aplicado") return { state: "planejado", draft: false, corrected };
  return { state: "pendente", draft: entry?.status === "rascunho", corrected };
}

function countItems(items: JourneyItem[]): PeriodCounts {
  const c = emptyCounts();
  for (const i of items) {
    c[i.state] += 1;
    if (i.corrected) c.corrigido += 1;
  }
  return c;
}

/**
 * Monta o percurso do aluno no ano letivo da turma de contexto. Instrumentos
 * de TODAS as turmas em que o aluno teve alocação naquele ano entram — cada
 * um sob a turma em que foi aplicado.
 */
export function buildStudentJourney(args: {
  student: DemonstrationStudent;
  contextClassId: string;
  referenceDate: string;
  source: JourneySource;
  /** Filtra por componente (rótulo histórico do instrumento). */
  field?: string;
}): StudentJourney {
  const { student, contextClassId, referenceDate, source } = args;
  const state = classConfigurationState(contextClassId);
  if (!("configuration" in state)) return { kind: "sem-configuracao", reason: state.reason };
  const { configuration, structure } = state;
  const academicYearId = configuration.academicYearId;
  const placements = studentPlacements(student).filter(
    (p) => p.classId && classAcademicYear(p.classId)?.id === academicYearId,
  );
  const classIds = [...new Set(placements.map((p) => p.classId!))];
  const placementAtReference =
    placements.find(
      (p) => (!p.from || p.from <= referenceDate) && (!p.until || p.until >= referenceDate),
    ) ?? null;

  if (configuration.usesPedagogicalRecords && !configuration.allowsGrades) {
    return {
      kind: "acompanhamento",
      configuration,
      academicYearId,
      classIds,
      placements,
      placementAtReference,
      timeline: infantTimeline(student.id, placements, source.infantRecords ?? infantExperienceFixtures),
    };
  }
  if (!instrumentFlowAvailable(configuration))
    return { kind: "sem-configuracao", reason: "A configuração não admite instrumentos." };

  const items: JourneyItem[] = source.instruments
    .filter((i) => classIds.includes(i.classId))
    .filter((i) => !args.field || i.snapshot.fieldLabel === args.field)
    .map((instrument) => {
      const entry = source.entries.find(
        (e) => e.instrumentId === instrument.id && e.studentId === student.id,
      );
      const currentType = source.typeLabel(instrument.instrumentTypeId);
      const currentPeriod = source.periodLabel(instrument);
      const ctx = entry?.context;
      return {
        instrumentId: instrument.id,
        classId: instrument.classId,
        historical: {
          title: instrument.title,
          typeLabel: ctx?.instrumentTypeLabel ?? currentType,
          periodLabel: ctx?.periodLabel ?? currentPeriod,
          classLabel: ctx?.classLabel ?? instrument.snapshot.classLabel,
          field: ctx?.field ?? instrument.snapshot.fieldLabel,
        },
        current: { typeLabel: currentType, periodLabel: currentPeriod },
        appliedOn: instrument.appliedOn,
        periodSource: instrument.periodSource,
        ...classifyItem(instrument, placements, entry),
        ...(entry ? { entry } : {}),
      };
    })
    .sort((a, b) => a.appliedOn.localeCompare(b.appliedOn));

  const lastPlacementEnd = placements.some((p) => !p.until)
    ? null
    : (placements.map((p) => p.until!).sort().reverse()[0] ?? null);

  const periods = buildPeriods(structure, items, source, lastPlacementEnd, referenceDate);
  return {
    kind: "instrumentos",
    configuration,
    academicYearId,
    classIds,
    placements,
    placementAtReference,
    periods,
    totals: countItems(items),
    lastPlacementEnd,
  };
}

function buildPeriods(
  structure: AssessmentPeriodStructure,
  items: JourneyItem[],
  source: JourneySource,
  lastPlacementEnd: string | null,
  referenceDate: string,
): JourneyPeriod[] {
  const byId = new Map<string, JourneyItem[]>();
  for (const item of items) {
    const ins = source.instruments.find((i) => i.id === item.instrumentId)!;
    byId.set(ins.periodId, [...(byId.get(ins.periodId) ?? []), item]);
  }
  const known = [...structure.periods]
    .sort((a, b) => a.sequence - b.sequence)
    .map((p) => {
      const list = byId.get(p.id) ?? [];
      byId.delete(p.id);
      return {
        periodId: p.id,
        label: list[0]?.historical.periodLabel ?? p.label,
        start: p.start,
        end: p.end,
        items: list,
        counts: countItems(list),
        pathClosed: !!lastPlacementEnd && lastPlacementEnd < p.start,
        current: p.start <= referenceDate && p.end >= referenceDate,
      };
    });
  // Instrumentos de outra estrutura (outra turma/configuração) mantêm o seu período.
  const other = [...byId.entries()].map(([periodId, list]) => ({
    periodId,
    label: list[0]!.historical.periodLabel,
    items: list,
    counts: countItems(list),
    pathClosed: false,
    current: false,
  }));
  return [...known, ...other];
}

function infantTimeline(
  studentId: string,
  placements: AcademicPlacement[],
  records: readonly InfantExperienceRecord[],
): InfantTimelineItem[] {
  return records
    .flatMap((r) => {
      const classId = demonstrationPedagogicalAssignments.find((a) => a.id === r.assignmentId)
        ?.classId;
      if (!classId || !placementOn(placements, classId, r.date)) return [];
      const obs = r.individualObservations.find((o) => o.studentId === studentId);
      return [
        {
          experienceId: r.id,
          date: r.date,
          title: r.title,
          classId,
          fieldIds: [...r.fieldIds],
          collectiveObservation: r.collectiveObservation,
          ...(obs ? { individualObservation: obs.text } : {}),
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function classLabel(classId: string) {
  return getDemonstrationClass(classId)?.name ?? classId;
}
