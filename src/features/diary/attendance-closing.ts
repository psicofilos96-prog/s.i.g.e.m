/**
 * Etapa 12H.1 — Fechamento e Consolidação Oficial da Frequência (domínio puro).
 *
 * Consome exclusivamente as fontes canônicas já existentes:
 *   calendário homologado (12B) → grade/jornada (10A–10D) → registro de aula
 *   (11A) → chamada (11C) → vigência do vínculo do aluno (8A–8G)
 *   → prontuário do aluno/Secretaria Escolar (ocorrências).
 *
 * Nada aqui inventa presença, falta, percentual, abono, mínimo legal, prazo de
 * edição, resultado do ciclo ou situação acadêmica.
 */
import { formatAcademicDate } from "@/lib/academic-date";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { attendanceSlots, fixtureAttendanceRecords, type AttendanceRecord } from "./attendance";
import { plannedLessonKey, plannedLessonsFor, shiftDate, type LessonEntry } from "./lesson-records";
import { normalizedStudentDate } from "./diary-data";
import {
  ATTENDANCE_ACTION_LABEL,
  ATTENDANCE_CAPABILITY_LABEL,
  type AttendanceAccountingPolicy,
  type AttendanceActorStamp,
  type AttendanceClosingAction,
  type AttendanceClosingActor,
  type AttendanceClosingCapability,
  type AttendanceClosingScope,
  type AttendanceClosingSourceReference,
  type AttendanceClosingStage,
  type AttendanceClosingWorkflow,
  type AttendanceOccurrenceType,
  type AttendancePendency,
  type FactStudentAttendanceAnalytical,
  type PeriodAttendanceClosingRecord,
  type PlannedUnitFact,
  type ScopeAttendanceTotals,
  type StudentAttendanceFacts,
  type StudentAttendanceOccurrence,
  type StudentUnitFact,
  type TaughtUnitFact,
} from "./attendance-closing-types";

// -------------------------------------------------------------- Identidade

export function attendanceScopeKey(scope: AttendanceClosingScope) {
  return [
    scope.classId,
    scope.academicYearId,
    scope.calendarPeriodId ?? scope.periodId,
    `${scope.accountingUnit.kind}:${scope.accountingUnit.id}`,
  ].join("|");
}

export function sameAttendanceScope(a: AttendanceClosingScope, b: AttendanceClosingScope) {
  return attendanceScopeKey(a) === attendanceScopeKey(b);
}

// ------------------------------------------------------------- Capacidades

/**
 * Perfis DEMONSTRATIVOS. Nenhum cargo é regra: a atribuição definitiva de cada
 * capacidade pertence à governança institucional e exigirá autorização real.
 */
export const ATTENDANCE_DEMONSTRATION_PROFILES: Array<{
  id: string;
  label: string;
  name: string;
  capabilities: AttendanceClosingCapability[];
}> = [
  {
    id: "perfil-docente",
    label: "Professor responsável pelo registro",
    name: "Professor(a) do registro (demonstração)",
    capabilities: ["entregar-pauta-de-frequencia", "consultar-auditoria-de-frequencia"],
  },
  {
    id: "perfil-gestao-escolar",
    label: "Gestão escolar / Coordenação pedagógica",
    name: "Gestão escolar (demonstração)",
    capabilities: [
      "realizar-conferencia-de-frequencia",
      "devolver-pauta-de-frequencia",
      "consultar-auditoria-de-frequencia",
    ],
  },
  {
    id: "perfil-secretaria-escolar",
    label: "Secretaria escolar",
    name: "Secretaria escolar (demonstração)",
    capabilities: [
      "realizar-conferencia-de-frequencia",
      "homologar-fechamento-de-frequencia",
      "executar-retificacao-de-frequencia",
      "registrar-ocorrencia-no-prontuario",
      "consultar-auditoria-de-frequencia",
    ],
  },
  {
    id: "perfil-supervisao",
    label: "Supervisão de Ensino",
    name: "Supervisão de Ensino (demonstração)",
    capabilities: [
      "homologar-fechamento-de-frequencia",
      "autorizar-retificacao-de-frequencia",
      "reabrir-frequencia-fechada",
      "consultar-auditoria-de-frequencia",
    ],
  },
];

export function attendanceDemonstrationActor(profileId: string): AttendanceClosingActor {
  const profile =
    ATTENDANCE_DEMONSTRATION_PROFILES.find((p) => p.id === profileId) ??
    ATTENDANCE_DEMONSTRATION_PROFILES[0]!;
  return {
    id: profile.id,
    name: profile.name,
    profileLabel: profile.label,
    capabilities: profile.capabilities,
  };
}

export function attendanceActorStamp(
  actor: AttendanceClosingActor,
  at: string,
): AttendanceActorStamp {
  return { actorId: actor.id, actorName: actor.name, profileLabel: actor.profileLabel, at };
}

export function canAttendance(
  actor: AttendanceClosingActor,
  capability: AttendanceClosingCapability,
) {
  return actor.capabilities.includes(capability);
}

export function missingAttendanceCapabilityReason(capability: AttendanceClosingCapability) {
  return `Esta operação exige a capacidade "${ATTENDANCE_CAPABILITY_LABEL[capability]}", que este perfil não possui.`;
}

export const ATTENDANCE_ACTION_CAPABILITY: Record<
  AttendanceClosingAction,
  AttendanceClosingCapability
> = {
  "entrega-docente": "entregar-pauta-de-frequencia",
  "inicio-conferencia": "realizar-conferencia-de-frequencia",
  "devolucao-com-apontamentos": "devolver-pauta-de-frequencia",
  "fechamento-oficial": "homologar-fechamento-de-frequencia",
  "retificacao-pontual": "executar-retificacao-de-frequencia",
  "reabertura-integral": "reabrir-frequencia-fechada",
};

// ------------------------------------------------------------- Duração (min)

const TIME = /(\d{2}):(\d{2})\D+(\d{2}):(\d{2})/;

/** Duração em minutos quando o horário é conhecido; null quando não é. */
export function slotDurationMinutes(time: string): number | null {
  const match = TIME.exec(time);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return end > start ? end - start : null;
}

/** Soma que preserva o desconhecido: qualquer parcela null torna o total null. */
export function sumMinutes(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}

// ----------------------------------------------------- Unidades ministradas

/**
 * Unidades MINISTRADAS do escopo. Só entra o que o registro de aula comprova:
 * rascunho de aula nunca produz unidade de frequência.
 */
export function taughtUnits(
  lessons: readonly LessonEntry[],
  attendance: readonly AttendanceRecord[],
): TaughtUnitFact[] {
  return lessons
    .filter((entry) => entry.status !== "Rascunho local")
    .flatMap((entry) => {
      const record =
        attendance.find((item) => item.entryId === entry.id) ??
        fixtureAttendanceRecords().find((item) => item.entryId === entry.id);
      return attendanceSlots(entry).map((slot) => ({
        unitKey: `${entry.id}::${slot.key}`,
        lessonEntryId: entry.id,
        date: entry.date,
        slotKey: slot.key,
        slotLabel: slot.label,
        durationMinutes: slotDurationMinutes(slot.time),
        ...(entry.blockIds.includes(slot.key) ? { blockId: slot.key } : {}),
        attendanceConcluded: Boolean(record?.concluded),
      }));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.slotKey.localeCompare(b.slotKey));
}

/**
 * Unidades PREVISTAS no intervalo, pela grade do professor da atuação. Serve
 * apenas para conferir o que deveria ocorrer — nunca gera fato de frequência.
 */
export function plannedUnits(args: {
  professionalId: string;
  assignmentId: string;
  start: string;
  end: string;
  lessons: readonly LessonEntry[];
  /** Dias letivos do calendário homologado, quando informados. */
  isSchoolDay?: (date: string) => boolean;
}): PlannedUnitFact[] | null {
  // B4.6.2b.3 — sem fonte de dias letivos não há previsto: nunca contar todos os dias nem zero.
  if (!args.isSchoolDay) return null;
  const executed = new Set(
    args.lessons
      .filter((entry) => entry.status !== "Rascunho local")
      .flatMap((entry) => entry.blockIds.map((id) => plannedLessonKey(entry.date, id))),
  );
  const list: PlannedUnitFact[] = [];
  for (let date = args.start, guard = 0; date <= args.end && guard < 500; guard++) {
    if (args.isSchoolDay(date))
      for (const planned of plannedLessonsFor(args.professionalId, date)) {
        if (planned.assignmentId !== args.assignmentId) continue;
        list.push({
          plannedKey: planned.key,
          date,
          blockId: planned.blockId,
          label: `${planned.block.start}–${planned.block.end}`,
          durationMinutes: slotDurationMinutes(`${planned.block.start}–${planned.block.end}`),
          executed: executed.has(planned.key),
        });
      }
    date = shiftDate(date, 1);
  }
  return list;
}

// ------------------------------------------------------- Vigência do vínculo

export type AllocationWindow = { from: string | null; until: string | null };

/** Janelas de vínculo do aluno com a turma. Identidade e vigência, nunca estado atual. */
export function allocationWindows(
  student: DemonstrationStudent,
  classId: string,
): AllocationWindow[] {
  return student.enrollments.flatMap((enrollment) =>
    enrollment.academicLinks.flatMap((link) =>
      link.participations.flatMap((participation) =>
        participation.allocations
          .filter((allocation) => allocation.classId === classId)
          .flatMap((allocation): AllocationWindow[] => {
            if (student.dataOrigin !== "institucional")
              return [{ from: normalizedStudentDate(allocation.from), until: normalizedStudentDate(allocation.until) }];
            // B4.10.0f — janela = interseção das vigências próprias da cadeia; abertura ausente não vira vigência.
            const starts = [enrollment.openedAt || null, participation.validFrom ?? null, allocation.from || null];
            if (starts.some((d) => !d)) return [];
            const ends = [enrollment.closedAt, participation.validUntil ?? null, allocation.until].filter((d): d is string => !!d);
            const from = (starts as string[]).sort().at(-1)!;
            const until = ends.length ? ends.sort()[0]! : null;
            return until !== null && until < from ? [] : [{ from, until }];
          }),
      ),
    ),
  );
}

export function coveredOn(windows: readonly AllocationWindow[], date: string) {
  return windows.some((w) => (!w.from || w.from <= date) && (!w.until || w.until >= date));
}

export function periodCoverage(
  windows: readonly AllocationWindow[],
  period: { start: string; end: string },
): StudentAttendanceFacts["coverage"] {
  const matching = windows.filter(
    (w) => (!w.from || w.from <= period.end) && (!w.until || w.until >= period.start),
  );
  if (!matching.length) return "sem-vinculo";
  const earliest = matching.map((w) => w.from ?? period.start).sort()[0] ?? period.start;
  const latest = matching.some((w) => !w.until)
    ? period.end
    : (matching
        .map((w) => w.until as string)
        .sort()
        .reverse()[0] ?? period.end);
  const late = earliest > period.start;
  const early = latest < period.end;
  return late && early ? "parcial" : late ? "ingresso-posterior" : early ? "saida-anterior" : "integral";
}

// ---------------------------------------------------------------- Contexto

export type AttendanceClosingContext = {
  scope: AttendanceClosingScope;
  policy: AttendanceAccountingPolicy;
  period: { id: string; label: string; start: string; end: string };
  /** O período vem de calendário homologado? */
  officialPeriod: boolean;
  calendarId?: string;
  /** Registros de aula do escopo, já filtrados por turma/atuação e período. */
  lessons: readonly LessonEntry[];
  attendance: readonly AttendanceRecord[];
  /** null ⇒ sem fonte de dias letivos: previsto indisponível (nunca zero). */
  planned: readonly PlannedUnitFact[] | null;
  /** B4.6.2b.3 — calendário institucional não lido (dependência distinta do período B2.4). */
  calendarDependency?: "indisponivel";
  students: readonly DemonstrationStudent[];
  occurrences: readonly StudentAttendanceOccurrence[];
  occurrenceTypes: readonly AttendanceOccurrenceType[];
  stage: AttendanceClosingStage;
  /** Dia letivo segundo o calendário homologado, quando disponível. */
  isSchoolDay?: (date: string) => boolean;
};

// ----------------------------------------------------------- Fatos do aluno

function occurrenceFor(
  ctx: AttendanceClosingContext,
  studentId: string,
  date: string,
): StudentAttendanceOccurrence | undefined {
  return ctx.occurrences.find(
    (o) => o.studentId === studentId && o.from <= date && o.until >= date,
  );
}

/**
 * Fatos neutros por aluno. A unidade só é aplicável quando foi ministrada E o
 * vínculo com a turma estava vigente na data. Unidade ministrada sem chamada
 * concluída fica registrada como pendência de registro — nunca como falta.
 */
export function studentAttendanceFacts(ctx: AttendanceClosingContext): StudentAttendanceFacts[] {
  const units = taughtUnits(ctx.lessons, ctx.attendance);
  const byEntry = new Map(ctx.lessons.map((entry) => [entry.id, entry]));
  const records = (entryId: string) =>
    ctx.attendance.find((item) => item.entryId === entryId) ??
    fixtureAttendanceRecords().find((item) => item.entryId === entryId);

  return ctx.students
    .map((student) => {
      const windows = allocationWindows(student, ctx.scope.classId);
      const coverage = periodCoverage(windows, ctx.period);
      const applicable = units.filter((unit) => coveredOn(windows, unit.date));
      const facts: StudentUnitFact[] = applicable.map((unit) => {
        const entry = byEntry.get(unit.lessonEntryId);
        const record = records(unit.lessonEntryId);
        const raw = record?.concluded ? record.marks[unit.slotKey]?.[student.id] : undefined;
        const mark = raw === "Presente" ? "presenca" : raw === "Ausente" ? "ausencia" : null;
        const occurrence = mark === "ausencia" ? occurrenceFor(ctx, student.id, unit.date) : undefined;
        return {
          unitKey: unit.unitKey,
          lessonEntryId: unit.lessonEntryId,
          date: unit.date,
          slotLabel: entry ? `${unit.slotLabel} · ${entry.field}` : unit.slotLabel,
          durationMinutes: unit.durationMinutes,
          mark,
          ...(occurrence
            ? { occurrenceId: occurrence.id, occurrenceTypeId: occurrence.occurrenceTypeId }
            : {}),
        } satisfies StudentUnitFact;
      });

      const pick = (predicate: (fact: StudentUnitFact) => boolean) => facts.filter(predicate);
      const presences = pick((f) => f.mark === "presenca");
      const absences = pick((f) => f.mark === "ausencia");
      const withOccurrence = absences.filter((f) => f.occurrenceId);
      const withoutOccurrence = absences.filter((f) => !f.occurrenceId);
      const unregistered = pick((f) => f.mark === null);
      const minutes = (list: readonly StudentUnitFact[]) =>
        sumMinutes(list.map((f) => f.durationMinutes));

      return {
        studentId: student.id,
        studentName: student.personName,
        coverage,
        applicableUnits: facts.length,
        applicableMinutes: minutes(facts),
        presences: presences.length,
        presenceMinutes: minutes(presences),
        absences: absences.length,
        absenceMinutes: minutes(absences),
        absencesWithRegisteredOccurrence: withOccurrence.length,
        absenceWithOccurrenceMinutes: minutes(withOccurrence),
        absencesWithoutRegisteredOccurrence: withoutOccurrence.length,
        absenceWithoutOccurrenceMinutes: minutes(withoutOccurrence),
        unitsWithoutAttendanceRecord: unregistered.length,
        unitsWithoutAttendanceMinutes: minutes(unregistered),
        occurrenceRefs: ctx.occurrences
          .filter(
            (o) =>
              o.studentId === student.id &&
              o.from <= ctx.period.end &&
              o.until >= ctx.period.start,
          )
          .map((o) => ({
            occurrenceId: o.id,
            occurrenceTypeId: o.occurrenceTypeId,
            from: o.from,
            until: o.until,
          })),
        units: facts,
      } satisfies StudentAttendanceFacts;
    })
    .filter((row) => row.coverage !== "sem-vinculo")
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
}

/** Totais do escopo: previsto, ministrado e pendências institucionais. */
export function scopeTotals(ctx: AttendanceClosingContext): ScopeAttendanceTotals {
  const units = taughtUnits(ctx.lessons, ctx.attendance);
  const withoutAttendance = units.filter((unit) => !unit.attendanceConcluded);
  return {
    // ctx.planned === null ⇒ indisponível (null), nunca 0; o fechamento oficial é bloqueado por pendência.
    plannedUnits: ctx.planned ? ctx.planned.length : null,
    plannedMinutes: ctx.planned ? sumMinutes(ctx.planned.map((p) => p.durationMinutes)) : null,
    taughtUnits: units.length,
    taughtMinutes: sumMinutes(units.map((u) => u.durationMinutes)),
    plannedWithoutExecutionUnits: ctx.planned ? ctx.planned.filter((p) => !p.executed).length : null,
    taughtWithoutAttendanceUnits: withoutAttendance.length,
    taughtWithoutAttendanceMinutes: sumMinutes(withoutAttendance.map((u) => u.durationMinutes)),
  };
}

// -------------------------------------------------------------- Pendências

const pend = (p: AttendancePendency): AttendancePendency => p;

/** Pendências da ENTREGA da pauta de frequência pelo professor. */
export function attendanceDeliveryPendencies(
  ctx: AttendanceClosingContext,
): AttendancePendency[] {
  const list: AttendancePendency[] = [];
  const units = taughtUnits(ctx.lessons, ctx.attendance);

  if (!units.length)
    list.push(
      pend({
        code: "sem-unidade-ministrada-no-periodo",
        severity: "aviso",
        message:
          "Nenhuma unidade ministrada foi comprovada neste período para este escopo. Sem registro de aula não existe fato de frequência.",
      }),
    );

  // Ajuste 6: unidade ministrada sem chamada concluída bloqueia o fechamento
  // quando a política exige chamada — e nunca é convertida em presença/falta.
  const seen = new Set<string>();
  for (const unit of units) {
    if (unit.attendanceConcluded || seen.has(unit.lessonEntryId)) continue;
    seen.add(unit.lessonEntryId);
    list.push(
      pend({
        code: "aula-ministrada-sem-chamada-concluida",
        severity: ctx.policy.requiresConcludedAttendance ? "bloqueante" : "aviso",
        message: ctx.policy.requiresConcludedAttendance
          ? `Aula ministrada em ${formatAcademicDate(unit.date)} sem chamada concluída. A política de apuração exige chamada: regularize o registro. A ausência de chamada não é presença nem falta do aluno.`
          : `Aula ministrada em ${formatAcademicDate(unit.date)} sem chamada concluída. A política aplicada não exige chamada nesta unidade; nenhuma presença ou falta é presumida.`,
        lessonEntryId: unit.lessonEntryId,
        date: unit.date,
      }),
    );
  }

  if (ctx.planned === null)
    list.push(
      pend({
        code: "unidades-previstas-indisponiveis",
        severity: "aviso",
        message: "Unidades previstas indisponíveis: não há fonte de dias letivos consultável. Nada é contado como previsto nem como zero.",
      }),
    );
  for (const planned of (ctx.planned ?? []).filter((p) => !p.executed))
    list.push(
      pend({
        code: "unidade-prevista-sem-execucao",
        severity: "aviso",
        message: `Unidade prevista em ${formatAcademicDate(planned.date)} (${planned.label}) sem registro de aula. Unidade prevista e não ministrada não gera presença nem ausência.`,
        date: planned.date,
      }),
    );

  if (ctx.isSchoolDay)
    for (const entry of ctx.lessons) {
      if (entry.status === "Rascunho local" || ctx.isSchoolDay(entry.date)) continue;
      list.push(
        pend({
          code: "aula-em-data-sem-dia-letivo",
          severity: "pendencia-especial",
          message: `Aula registrada em ${formatAcademicDate(entry.date)}, data que o calendário homologado não classifica como dia letivo. Exige conferência institucional: nenhum ajuste é feito automaticamente.`,
          lessonEntryId: entry.id,
          date: entry.date,
        }),
      );
    }

  for (const row of studentAttendanceFacts(ctx))
    if (row.coverage !== "integral")
      list.push(
        pend({
          code: "cobertura-parcial-do-periodo",
          severity: "pendencia-especial",
          message:
            "Vínculo parcial com a turma no período. A apuração considera estritamente as unidades ministradas durante a vigência: nenhuma falta é atribuída fora dela e nenhuma proporção ou equivalência é presumida.",
          studentId: row.studentId,
          studentName: row.studentName,
        }),
      );

  return list;
}

/** Pendências do FECHAMENTO OFICIAL, somadas às da entrega. */
export function attendanceClosingPendencies(
  ctx: AttendanceClosingContext,
): AttendancePendency[] {
  const list: AttendancePendency[] = [];
  if (ctx.stage === "fechado")
    list.push(
      pend({
        code: "frequencia-do-periodo-ja-fechada",
        severity: "bloqueante",
        message:
          "A frequência deste período já está fechada oficialmente. Alterações exigem retificação formal versionada ou reabertura.",
      }),
    );
  if (ctx.stage === "em-andamento" || ctx.stage === "devolvida-para-ajustes")
    list.push(
      pend({
        code: "pauta-de-frequencia-nao-entregue",
        severity: "bloqueante",
        message: "A pauta de frequência ainda não foi entregue pelo professor responsável.",
      }),
    );
  else if (ctx.stage === "entregue")
    list.push(
      pend({
        code: "pauta-de-frequencia-nao-conferida",
        severity: "bloqueante",
        message: "A conferência institucional da frequência ainda não foi realizada.",
      }),
    );
  if (ctx.planned === null)
    list.push(
      pend({
        code: "unidades-previstas-indisponiveis",
        severity: "bloqueante",
        message: "Unidades previstas indisponíveis: sem fonte de dias letivos não há conferência de previsto para o fechamento oficial.",
      }),
    );
  if (ctx.calendarDependency === "indisponivel")
    list.push(
      pend({
        code: "calendario-institucional-indisponivel",
        severity: "bloqueante",
        message: "Calendário institucional indisponível para consulta. Isto não significa que o calendário não exista nem que não esteja homologado; sem essa leitura não há fechamento oficial.",
      }),
    );
  else if (!ctx.officialPeriod || !ctx.calendarId)
    list.push(
      pend({
        code: "calendario-nao-homologado",
        severity: "bloqueante",
        message:
          "O período não vem de calendário escolar homologado. Sem período oficial não existe fechamento oficial de frequência.",
      }),
    );
  if (ctx.policy.status !== "homologada")
    list.push(
      pend({
        code: "politica-de-apuracao-nao-homologada",
        severity: "bloqueante",
        message:
          "A política de unidade/apuração da frequência aplicável não está homologada. Sem política homologada não existe unidade oficial de apuração — nada é presumido.",
      }),
    );
  if (!ctx.scope.accountingUnit.id)
    list.push(
      pend({
        code: "unidade-de-apuracao-nao-configurada",
        severity: "bloqueante",
        message: "A unidade de apuração do escopo não está identificada por um ID estável.",
      }),
    );
  return [...list, ...attendanceDeliveryPendencies(ctx)];
}

export const attendanceBlocking = (list: readonly AttendancePendency[]) =>
  list.filter((p) => p.severity === "bloqueante");
export const attendanceSpecial = (list: readonly AttendancePendency[]) =>
  list.filter((p) => p.severity === "pendencia-especial");
export const attendanceAdvisories = (list: readonly AttendancePendency[]) =>
  list.filter((p) => p.severity === "aviso");

// ------------------------------------------------------ Integridade dos fatos

/**
 * Integridade aplicada sobre unidades MINISTRADAS e APLICÁVEIS (ajuste 11):
 * aplicáveis = presenças + ausências com ocorrência + ausências sem ocorrência
 * + unidades sem registro de chamada.
 */
export function attendanceIntegrityIssues(
  students: readonly StudentAttendanceFacts[],
): string[] {
  const issues: string[] = [];
  for (const row of students) {
    const sum =
      row.presences +
      row.absencesWithRegisteredOccurrence +
      row.absencesWithoutRegisteredOccurrence +
      row.unitsWithoutAttendanceRecord;
    if (sum !== row.applicableUnits)
      issues.push(
        `${row.studentName}: a soma dos fatos (${sum}) difere das unidades aplicáveis (${row.applicableUnits}).`,
      );
    if (row.absences !== row.absencesWithRegisteredOccurrence + row.absencesWithoutRegisteredOccurrence)
      issues.push(`${row.studentName}: ausências com e sem ocorrência não somam o total de ausências.`);
  }
  return issues;
}

// ------------------------------------------------------- Cadeia de versões

export function attendanceChain(
  records: readonly PeriodAttendanceClosingRecord[],
  scopeKey: string,
) {
  return records
    .filter((r) => attendanceScopeKey(r.scope) === scopeKey)
    .sort((a, b) => a.version - b.version);
}

/** Versão VIGENTE derivada da cadeia: a única que nenhuma outra sucede. */
export function currentAttendanceClosing(
  records: readonly PeriodAttendanceClosingRecord[],
  scopeKey: string,
): PeriodAttendanceClosingRecord | undefined {
  const chain = attendanceChain(records, scopeKey);
  const superseded = new Set(
    chain.map((r) => r.precedingClosingId).filter((id): id is string => !!id),
  );
  const open = chain.filter((r) => !superseded.has(r.id));
  return open[open.length - 1];
}

export function isAttendanceSuperseded(
  records: readonly PeriodAttendanceClosingRecord[],
  record: PeriodAttendanceClosingRecord,
) {
  return attendanceChain(records, attendanceScopeKey(record.scope)).some(
    (r) => r.precedingClosingId === record.id,
  );
}

export function attendanceChainIssues(
  records: readonly PeriodAttendanceClosingRecord[],
  scopeKey: string,
): string[] {
  const chain = attendanceChain(records, scopeKey);
  const issues: string[] = [];
  const versions = new Set<number>();
  for (const record of chain) {
    if (versions.has(record.version)) issues.push(`Versão ${record.version} duplicada.`);
    versions.add(record.version);
    if (record.version === 1) {
      if (record.precedingClosingId) issues.push("A versão 1 não pode suceder outra versão.");
    } else if (!record.precedingClosingId)
      issues.push(`Versão ${record.version} sem antecessora.`);
    else if (!chain.some((r) => r.id === record.precedingClosingId))
      issues.push(`Versão ${record.version} aponta para antecessora inexistente.`);
  }
  const superseded = new Set(
    chain.map((r) => r.precedingClosingId).filter((id): id is string => !!id),
  );
  if (chain.filter((r) => !superseded.has(r.id)).length > 1)
    issues.push("Mais de uma versão vigente na mesma cadeia.");
  return issues;
}

export function attendanceSourceReference(
  record: PeriodAttendanceClosingRecord,
): AttendanceClosingSourceReference {
  return {
    closingId: record.id,
    closingVersion: record.version,
    scopeKey: attendanceScopeKey(record.scope),
    policyId: record.policyId,
    policyVersion: record.policyVersion,
    calendarId: record.calendarId,
    materializedAt: record.closedAt,
  };
}

/**
 * Trava de edição: uma chamada coberta por fechamento VIGENTE não pode ser
 * sobrescrita. Antes do fechamento não existe prazo arbitrário (ajuste 7).
 */
export function attendanceEditLockReason(
  records: readonly PeriodAttendanceClosingRecord[],
  entryId: string,
): string | null {
  const scopeKeys = new Set(records.map((r) => attendanceScopeKey(r.scope)));
  for (const scopeKey of scopeKeys) {
    const current = currentAttendanceClosing(records, scopeKey);
    if (current?.lessonEntryIds.includes(entryId))
      return `Esta chamada integra o fechamento oficial de frequência ${current.id} (versão ${current.version}). Qualquer alteração exige retificação formal versionada e auditável.`;
  }
  return null;
}

// -------------------------------------------------- Saída analítica (CIECE)

export function attendanceAnalyticalFacts(
  record: PeriodAttendanceClosingRecord,
  unitId: string,
): FactStudentAttendanceAnalytical[] {
  return record.students.map((row) => ({
    academicYearId: record.scope.academicYearId,
    calendarId: record.calendarId,
    periodId: record.scope.periodId,
    ...(record.scope.calendarPeriodId
      ? { calendarPeriodId: record.scope.calendarPeriodId }
      : {}),
    unitId,
    classId: record.scope.classId,
    studentId: row.studentId,
    accountingUnitKind: record.scope.accountingUnit.kind,
    accountingUnitId: record.scope.accountingUnit.id,
    unitKind: record.unitKind,
    policyId: record.policyId,
    policyVersion: record.policyVersion,
    closingId: record.id,
    closingVersion: record.version,
    closedAt: record.closedAt,
    coverage: row.coverage,
    plannedUnits: record.totals.plannedUnits,
    plannedMinutes: record.totals.plannedMinutes,
    taughtUnits: record.totals.taughtUnits,
    taughtMinutes: record.totals.taughtMinutes,
    applicableUnits: row.applicableUnits,
    applicableMinutes: row.applicableMinutes,
    attendedUnits: row.presences,
    attendedMinutes: row.presenceMinutes,
    absentUnits: row.absences,
    absentMinutes: row.absenceMinutes,
    absencesWithRegisteredOccurrence: row.absencesWithRegisteredOccurrence,
    absencesWithoutRegisteredOccurrence: row.absencesWithoutRegisteredOccurrence,
    plannedWithoutExecutionUnits: record.totals.plannedWithoutExecutionUnits,
    taughtWithoutAttendanceUnits: record.totals.taughtWithoutAttendanceUnits,
  }));
}

// -------------------------------------------------------------- Transições

export const ATTENDANCE_STAGE_AFTER: Record<AttendanceClosingAction, AttendanceClosingStage> = {
  "entrega-docente": "entregue",
  "inicio-conferencia": "em-conferencia",
  "devolucao-com-apontamentos": "devolvida-para-ajustes",
  "fechamento-oficial": "fechado",
  "retificacao-pontual": "fechado",
  "reabertura-integral": "reaberto",
};

export const ATTENDANCE_STAGE_FROM: Record<AttendanceClosingAction, AttendanceClosingStage[]> = {
  "entrega-docente": ["em-andamento", "devolvida-para-ajustes", "reaberto"],
  "inicio-conferencia": ["entregue", "reaberto"],
  "devolucao-com-apontamentos": ["entregue", "em-conferencia", "reaberto"],
  "fechamento-oficial": ["em-conferencia", "reaberto"],
  "retificacao-pontual": ["fechado"],
  "reabertura-integral": ["fechado"],
};

export function attendanceTransitionAllowed(
  action: AttendanceClosingAction,
  stage: AttendanceClosingStage,
) {
  return ATTENDANCE_STAGE_FROM[action].includes(stage);
}

export function emptyAttendanceWorkflow(
  scope: AttendanceClosingScope,
): AttendanceClosingWorkflow {
  return {
    scopeKey: attendanceScopeKey(scope),
    scope,
    stage: "em-andamento",
    events: [],
  };
}

export const attendanceActionLabel = (action: AttendanceClosingAction) =>
  ATTENDANCE_ACTION_LABEL[action];
