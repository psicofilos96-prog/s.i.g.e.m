import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
/**
 * Etapa 12C — Instrumentos e lançamentos avaliativos (domínio puro).
 *
 * Arquitetura canônica:
 *   Ano letivo → Calendário homologado → Período oficial → Instrumento → Lançamentos.
 *
 * Exceção explícita: dados de 2026 sem calendário homologado são tratados como
 * cenário LEGADO/DEMONSTRATIVO (`periodSource = "legado-demonstrativo"`),
 * sempre não oficial. Não é uma segunda fonte permanente de períodos.
 *
 * Nada aqui calcula média, soma, peso, arredondamento, recuperação, resultado,
 * situação, Conselho ou frequência. "Não registrado" nunca vira 0.
 */
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { isPublished } from "@/features/calendar/calendar-queries";
import { calendarRepository, type CalendarRepository } from "@/features/calendar/calendar-store";
import type { PedagogicalAssignmentRecord } from "@/features/pedagogical/pedagogical-data";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { instrumentTypes as defaultInstrumentTypes } from "./assessment-fixtures";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  curriculumRefOf,
  placementOn,
  recordingReadiness,
  studentPlacements,
  validateEntryValue,
} from "./assessment-rules";
import type {
  AcademicPlacement,
  AssessmentConfiguration,
  AssessmentEntry,
  AssessmentInstrument,
  AssessmentPeriod,
  AssessmentPeriodStructure,
  AuthorshipStamp,
  EntryValue,
  InstrumentType,
  PeriodSource,
} from "./assessment-types";

// ------------------------------------------------------------ Período

export type InstrumentPeriodResolution =
  | { ok: true; period: AssessmentPeriod; source: PeriodSource; official: boolean }
  | { ok: false; reason: string };

/**
 * Deriva o período da DATA de aplicação. O professor nunca escolhe um
 * período incompatível com a data.
 */
export function resolveInstrumentPeriod(
  structure: AssessmentPeriodStructure,
  date: string,
  calendars: Pick<CalendarRepository, "get"> = calendarRepository,
): InstrumentPeriodResolution {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { ok: false, reason: "Informe a data de aplicação." };
  if (structure.calendarId) {
    const cal = calendars.get(structure.calendarId);
    if (!cal) return { ok: false, reason: "O calendário referenciado não existe." };
    if (!isPublished(cal))
      return {
        ok: false,
        reason:
          "O calendário da rede ainda não foi homologado. Não há período oficial para esta data.",
      };
    const calPeriod = cal.periods.find((p) => p.start <= date && p.end >= date);
    if (!calPeriod)
      return { ok: false, reason: "A data não pertence a nenhum período oficial do calendário." };
    const period = structure.periods.find((p) => p.calendarPeriodId === calPeriod.id);
    if (!period)
      return { ok: false, reason: "O período oficial não está ligado à estrutura avaliativa." };
    return {
      ok: true,
      period: { ...period, label: calPeriod.name, start: calPeriod.start, end: calPeriod.end },
      source: "calendario-homologado",
      official: true,
    };
  }
  const period = structure.periods.find((p) => p.start <= date && p.end >= date);
  if (!period) return { ok: false, reason: "A data não pertence a nenhum período da estrutura." };
  return { ok: true, period, source: "legado-demonstrativo", official: false };
}

// -------------------------------------------------------- Capacidades

/**
 * A configuração decide se há fluxo de instrumentos — nunca o nome da etapa.
 * (Na EI 2026: allowsGrades=false e nenhum tipo de instrumento.)
 */
export function instrumentFlowAvailable(configuration: AssessmentConfiguration) {
  return configuration.allowedInstrumentTypeIds.length > 0 && configuration.scales.length > 0;
}

export function allowedTypes(
  configuration: AssessmentConfiguration,
  types: InstrumentType[] = defaultInstrumentTypes,
) {
  return types.filter((t) => configuration.allowedInstrumentTypeIds.includes(t.id));
}

// -------------------------------------------------------- Autoria

/** Carimbo de autoria com nome exibido na época (identidades demonstrativas). */
export function authorshipStamp(
  professionalId: string,
  pedagogicalAssignmentId: string,
  at: string,
): AuthorshipStamp {
  const name = teachingPersonName(professionalId);
  return { professionalId, pedagogicalAssignmentId, ...(name ? { displayName: name } : {}), at };
}

// -------------------------------------------------------- Instrumento

export type InstrumentInput = {
  title: string;
  instrumentTypeId: string;
  appliedOn: string;
  description?: string;
};

export type DomainResult<T> = { ok: true; value: T } | { ok: false; reasons: string[] };

export function buildInstrument(args: {
  id: string;
  input: InstrumentInput;
  configuration: AssessmentConfiguration;
  structure: AssessmentPeriodStructure;
  assignment: PedagogicalAssignmentRecord | undefined;
  professionalId: string;
  classId: string;
  now: string;
  calendars?: Pick<CalendarRepository, "get">;
  types?: InstrumentType[];
}): DomainResult<AssessmentInstrument> {
  const { input, configuration, assignment } = args;
  const reasons: string[] = [];
  if (!instrumentFlowAvailable(configuration))
    return {
      ok: false,
      reasons: ["A configuração avaliativa desta turma não admite instrumentos."],
    };
  if (!input.title.trim()) reasons.push("Informe o título do instrumento.");
  if (!allowedTypes(configuration, args.types).some((t) => t.id === input.instrumentTypeId))
    reasons.push("Tipo de instrumento não permitido pela configuração.");
  const period = resolveInstrumentPeriod(args.structure, input.appliedOn, args.calendars);
  if (!period.ok) reasons.push(period.reason);
  const klass = teachingClass(args.classId);
  const draft: AssessmentInstrument = {
    id: args.id,
    configurationId: configuration.id,
    periodId: period.ok ? period.period.id : "",
    pedagogicalAssignmentId: assignment?.id ?? "",
    classId: args.classId,
    instrumentTypeId: input.instrumentTypeId,
    title: input.title.trim(),
    appliedOn: input.appliedOn,
    snapshot: { classLabel: klass?.name ?? args.classId, fieldLabel: assignment?.field ?? "" },
    ...(assignment ? { curriculumRef: curriculumRefOf(assignment) } : {}),
    configurationVersion: configuration.version,
    ...(assignment
      ? { createdBy: authorshipStamp(args.professionalId, assignment.id, args.now) }
      : {}),
    ...(period.ok && period.period.calendarPeriodId
      ? { calendarPeriodId: period.period.calendarPeriodId }
      : {}),
    ...(period.ok ? { periodSource: period.source } : {}),
    status: "planejado",
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    professionalId: args.professionalId,
    createdAt: args.now,
  };
  if (period.ok) {
    const readiness = recordingReadiness({
      professionalId: args.professionalId,
      assignment,
      instrument: draft,
      period: period.period,
    });
    reasons.push(...readiness.reasons);
  }
  return reasons.length ? { ok: false, reasons } : { ok: true, value: draft };
}

// ----------------------------------------------------------- Pauta

export type RosterEligible = {
  student: DemonstrationStudent;
  placement: AcademicPlacement;
};
export type RosterInformative = {
  student: DemonstrationStudent;
  reason: "ingresso-posterior" | "saida-anterior";
  date: string;
};

/**
 * Pauta na DATA de aplicação. Elegíveis recebem campo de lançamento;
 * ingresso posterior/saída anterior aparecem apenas como informação.
 */
export function instrumentRoster(
  instrument: Pick<AssessmentInstrument, "classId" | "appliedOn">,
  students: DemonstrationStudent[],
) {
  const eligible: RosterEligible[] = [];
  const informative: RosterInformative[] = [];
  for (const student of students) {
    const placements = studentPlacements(student).filter((p) => p.classId === instrument.classId);
    if (!placements.length) continue;
    const at = placementOn(placements, instrument.classId, instrument.appliedOn);
    if (at) {
      eligible.push({ student, placement: at });
      continue;
    }
    const later = placements
      .map((p) => p.from)
      .filter((d): d is string => !!d && d > instrument.appliedOn)
      .sort()[0];
    const earlier = placements
      .map((p) => p.until)
      .filter((d): d is string => !!d && d < instrument.appliedOn)
      .sort()
      .reverse()[0];
    if (later) informative.push({ student, reason: "ingresso-posterior", date: later });
    else if (earlier) informative.push({ student, reason: "saida-anterior", date: earlier });
  }
  const byName = (a: { student: DemonstrationStudent }, b: { student: DemonstrationStudent }) =>
    a.student.personName.localeCompare(b.student.personName, "pt-BR");
  return { eligible: eligible.sort(byName), informative: informative.sort(byName) };
}

// ------------------------------------------------------- Lançamento

/**
 * Cria/atualiza um lançamento em RASCUNHO. O contexto acadêmico é fixado
 * no momento do lançamento e nunca é recalculado depois.
 */
export function draftEntry(args: {
  instrument: AssessmentInstrument;
  configuration: AssessmentConfiguration;
  eligible: RosterEligible;
  value: EntryValue;
  now: string;
  existing?: AssessmentEntry;
  periodLabel: string;
  instrumentTypeLabel: string;
}): DomainResult<AssessmentEntry> {
  const { instrument, eligible, existing } = args;
  if (instrument.status !== "aplicado")
    return { ok: false, reasons: ["Aplique o instrumento para abrir a pauta de lançamentos."] };
  if (existing?.status === "registrado")
    return { ok: false, reasons: ["Lançamento registrado: use a correção justificada."] };
  const errors = validateEntryValue(args.configuration, args.value);
  if (errors.length) return { ok: false, reasons: errors };
  const p = eligible.placement;
  const entry: AssessmentEntry = {
    id: existing?.id ?? `lan-${instrument.id}-${eligible.student.id}`,
    instrumentId: instrument.id,
    studentId: eligible.student.id,
    placement: {
      enrollmentId: p.enrollmentId,
      academicLinkId: p.academicLinkId,
      participationId: p.participationId,
      allocationId: p.allocationId,
    },
    value: args.value,
    recordedAt: args.now,
    recordedByAssignmentId: instrument.pedagogicalAssignmentId,
    status: "rascunho",
    context: existing?.context ?? {
      studentName: eligible.student.personName,
      unitId: p.unitId,
      classId: instrument.classId,
      classLabel: instrument.snapshot.classLabel,
      field: instrument.snapshot.fieldLabel,
      pedagogicalAssignmentId: instrument.pedagogicalAssignmentId,
      professionalId: instrument.professionalId ?? "",
      periodId: instrument.periodId,
      periodLabel: args.periodLabel,
      ...(instrument.calendarPeriodId ? { calendarPeriodId: instrument.calendarPeriodId } : {}),
      instrumentTypeLabel: args.instrumentTypeLabel,
      appliedOn: instrument.appliedOn,
      periodSource: instrument.periodSource ?? "legado-demonstrativo",
      ...(instrument.curriculumRef ? { curriculumRef: instrument.curriculumRef } : {}),
      configurationId: args.configuration.id,
      configurationVersion: args.configuration.version,
    },
    history: existing?.history ?? [],
    author:
      existing?.author ??
      authorshipStamp(
        instrument.professionalId ?? "",
        instrument.pedagogicalAssignmentId,
        args.now,
      ),
  };
  // Rótulo do valor fixado na escala da época.
  entry.valueLabel = entryValueLabel(args.value, args.configuration);
  return { ok: true, value: entry };
}

/** Registra (conclui) lançamentos em rascunho. Não toca nos demais. */
export function registerEntries(entries: AssessmentEntry[], ids: string[], now: string) {
  return entries.map((e) =>
    ids.includes(e.id) && e.status !== "registrado"
      ? { ...e, status: "registrado" as const, recordedAt: now }
      : e,
  );
}

/** Correção não destrutiva: preserva o valor anterior com justificativa. */
export function correctEntry(args: {
  entry: AssessmentEntry;
  configuration: AssessmentConfiguration;
  value: EntryValue;
  justification: string;
  now: string;
  /** Quem corrige; por padrão, o autor original (identidade demonstrativa). */
  correctedBy?: { professionalId: string; pedagogicalAssignmentId: string };
}): DomainResult<AssessmentEntry> {
  const { entry } = args;
  const by = args.correctedBy ?? {
    professionalId: entry.author?.professionalId ?? entry.context?.professionalId ?? "",
    pedagogicalAssignmentId: entry.recordedByAssignmentId,
  };
  if (entry.status !== "registrado")
    return { ok: false, reasons: ["Somente lançamentos registrados são corrigidos."] };
  if (!args.justification.trim())
    return { ok: false, reasons: ["Informe a justificativa da correção."] };
  const errors = validateEntryValue(args.configuration, args.value);
  if (errors.length) return { ok: false, reasons: errors };
  return {
    ok: true,
    value: {
      ...entry,
      value: args.value,
      recordedAt: args.now,
      // O snapshot de contexto original é preservado intacto.
      valueLabel: entryValueLabel(args.value, args.configuration),
      history: [
        ...(entry.history ?? []),
        {
          value: entry.value,
          ...(entry.valueLabel ? { valueLabel: entry.valueLabel } : {}),
          recordedAt: entry.recordedAt,
          replacedAt: args.now,
          justification: args.justification.trim(),
          correctedBy: authorshipStamp(by.professionalId, by.pedagogicalAssignmentId, args.now),
        },
      ],
    },
  };
}

/** Situação da pauta — apenas contagem de estados, sem efeito acadêmico. */
export function rosterProgress(eligibleCount: number, entries: AssessmentEntry[]) {
  const registered = entries.filter((e) => e.status === "registrado").length;
  const drafts = entries.filter((e) => e.status !== "registrado").length;
  return {
    eligible: eligibleCount,
    registered,
    drafts,
    pending: Math.max(0, eligibleCount - registered - drafts),
  };
}

/** Texto de exibição do valor — "não registrado" NUNCA vira número. */
export function entryValueLabel(
  value: EntryValue,
  configuration?: AssessmentConfiguration,
): string {
  switch (value.kind) {
    case "numerica":
      return String(value.value).replace(".", ",");
    case "conceitual": {
      const scale = configuration?.scales.find((s) => s.kind === "conceitual");
      return (
        (scale?.kind === "conceitual" &&
          scale.options.find((o) => o.id === value.optionId)?.label) ||
        value.optionId
      );
    }
    case "descritiva":
      return value.text;
    case "nao-registrado":
      return `Não registrado — ${value.reason}`;
  }
}
