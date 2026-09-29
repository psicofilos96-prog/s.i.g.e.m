import { rosterStudents } from "@/features/students/institutional-roster";
import { formatAcademicDate, parseAcademicDate } from "@/lib/academic-date";
import { useSyncExternalStore } from "react";
import { isDiaryCloud } from "./diary-persistence-mode";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { classProjection } from "@/features/schedules/schedule-integration";
import {
  assignmentActiveOn,
  diaryStageForClass,
  studentsForClassOn,
  type DiaryStage,
  type DiaryStudent,
} from "./diary-data";
import {
  allFixtureLessons,
  fixtureLessons,
  fixtureEntry,
  localEntry,
  plannedLessonsFor,
  shiftDate,
  type LessonEntry,
  type LocalLessonRecord,
} from "./lesson-records";

// ---------------------------------------------------------------------------
// Chamada demonstrativa (Etapa 11C). Nada aqui é normativo ou persistente.
// ---------------------------------------------------------------------------

/** Marcação explícita. Ausência de marcação nunca significa presença nem falta. */
export type AttendanceMark = "Presente" | "Ausente";
export type AttendanceStatus = "Sem chamada" | "Rascunho" | "Parcialmente preenchida" | "Concluída";

/** marks[chaveDaAula][alunoId] */
export type AttendanceMarks = Record<string, Record<string, AttendanceMark>>;

/**
 * Retificação de uma chamada já concluída (12H.1). Nunca edita a versão
 * anterior: descreve a mudança que produziu a versão seguinte da cadeia.
 * `justification` só é preenchida quando a regra canônica a exigir — a
 * interface não inventa obrigatoriedade universal de motivo.
 */
export type AttendanceRectification = {
  at: string;
  actorId: string;
  actorName: string;
  justification?: string;
  /** Referência textual ao fechamento atingido, quando houver. */
  closingReference?: string;
  changes: readonly {
    slotKey: string;
    studentId: string;
    from: AttendanceMark | null;
    to: AttendanceMark;
  }[];
};

export type AttendanceRecord = {
  entryId: string;
  marks: AttendanceMarks;
  concluded: boolean;
  origin: "fixture" | "local";
  /** Versão vigente da chamada. Ausente = primeira versão. */
  version?: number;
  /** Retificação que produziu esta versão, quando não for a primeira. */
  rectification?: AttendanceRectification;
};


export type AttendanceSlot = { key: string; label: string; time: string };

/** Aulas efetivamente ministradas no registro: blocos ou unidades sem bloco. */
export function attendanceSlots(entry: LessonEntry): AttendanceSlot[] {
  if (entry.blockIds.length) {
    const blocks = entry.classId ? classProjection(entry.classId, entry.date).blocks : [];
    return entry.blockIds.map((id, index) => {
      const block = blocks.find((item) => item.id === id);
      return {
        key: id,
        label: `Aula ${index + 1}`,
        time: block ? `${block.start}–${block.end}` : id,
      };
    });
  }
  const time = entry.extraordinary
    ? `${entry.extraordinary.start}–${entry.extraordinary.end} (fora da previsão)`
    : "Sem bloco da grade";
  return Array.from({ length: Math.max(1, entry.quantity) }, (_, index) => ({
    key: `aula-${index + 1}`,
    label: `Aula ${index + 1}`,
    time,
  }));
}

// Fixtures fictícias de chamada ---------------------------------------------

/** Fixtures só existem no laboratório; com sessão, apenas o banco é fonte. */
export function fixtureAttendanceRecords(): AttendanceRecord[] {
  return isDiaryCloud() ? [] : fixtureAttendance;
}

export const fixtureAttendance: AttendanceRecord[] = [
  {
    entryId: "aul-001",
    origin: "fixture",
    concluded: true,
    marks: {
      "bl-001": { "alu-001": "Presente", "alu-002": "Presente" },
      "bl-002": { "alu-001": "Presente", "alu-002": "Ausente" },
    },
  },
  {
    entryId: "aul-002",
    origin: "fixture",
    concluded: true,
    marks: { "bl-090": { "alu-005": "Presente" } },
  },
  {
    entryId: "aul-004",
    origin: "fixture",
    concluded: true,
    marks: { "aula-1": { "alu-007": "Presente" } },
  },
  {
    entryId: "aul-005",
    origin: "fixture",
    concluded: true,
    marks: {
      "bl-001": { "alu-001": "Ausente", "alu-002": "Presente" },
      "bl-002": { "alu-001": "Ausente", "alu-002": "Presente" },
    },
  },
  {
    entryId: "aul-007",
    origin: "fixture",
    concluded: true,
    marks: { "bl-051": { "alu-003": "Presente" } },
  },
  {
    entryId: "aul-008",
    origin: "fixture",
    concluded: false,
    marks: { "aula-1": { "alu-004": "Presente" } },
  },
];

// Estado local (memória da aba) ---------------------------------------------

let localAttendance: AttendanceRecord[] = [];
/** Versões anteriores preservadas: retificação nunca apaga a versão anterior. */
let supersededAttendance: AttendanceRecord[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());


/**
 * Trava institucional da frequência (12H.1). Não existe prazo arbitrário de
 * edição: enquanto não houver fechamento oficial, a edição ordinária permanece
 * possível. Após o fechamento, a alteração exige retificação formal versionada.
 */
export type AttendanceEditGuard = (entryId: string) => string | null;
let editGuard: AttendanceEditGuard | null = null;

export function setAttendanceEditGuard(guard: AttendanceEditGuard | null) {
  editGuard = guard;
  return () => {
    if (editGuard === guard) editGuard = null;
  };
}

export function attendanceEditLock(entryId: string) {
  return editGuard?.(entryId) ?? null;
}

export const attendanceStore = {
  list: () => localAttendance,
  get(entryId: string): AttendanceRecord | undefined {
    return (
      localAttendance.find((item) => item.entryId === entryId) ??
      fixtureAttendanceRecords().find((item) => item.entryId === entryId)
    );
  },
  save(entryId: string, marks: AttendanceMarks, concluded: boolean) {
    const locked = attendanceEditLock(entryId);
    if (locked) throw new Error(locked);
    const existing = attendanceStore.get(entryId);
    if (existing?.concluded) throw new Error("Chamada concluída não pode ser sobrescrita.");
    const record: AttendanceRecord = { entryId, marks, concluded, origin: "local" };
    localAttendance = [...localAttendance.filter((item) => item.entryId !== entryId), record];
    emit();
    return record;
  },
  discard(entryId: string) {
    const existing = localAttendance.find((item) => item.entryId === entryId);
    if (!existing || existing.concluded) return false;
    localAttendance = localAttendance.filter((item) => item.entryId !== entryId);
    emit();
    return true;
  },
  /**
   * Retificação versionada (12H.1): a versão vigente é substituída por uma
   * versão seguinte encadeada, e a anterior permanece consultável no histórico.
   * Não decide admissibilidade nem rito — isso é do resolvedor de correção.
   */
  rectify(entryId: string, marks: AttendanceMarks, rectification: AttendanceRectification) {
    const existing = attendanceStore.get(entryId);
    if (!existing) throw new Error("Não há chamada registrada para retificar.");
    if (!existing.concluded)
      throw new Error("Chamada em elaboração é corrigida na própria edição, sem retificação.");
    supersededAttendance = [...supersededAttendance, existing];
    const record: AttendanceRecord = {
      entryId,
      marks,
      concluded: true,
      origin: "local",
      version: (existing.version ?? 1) + 1,
      rectification,
    };
    localAttendance = [...localAttendance.filter((item) => item.entryId !== entryId), record];
    emit();
    return record;
  },
  /** Versões anteriores, da mais antiga para a mais recente. */
  history(entryId: string): AttendanceRecord[] {
    return supersededAttendance.filter((item) => item.entryId === entryId);
  },
  reset() {
    localAttendance = [];
    supersededAttendance = [];
    emit();
  },
  /**
   * Espelho somente leitura do banco: versão vigente de cada chamada oficial e
   * versões anteriores preservadas. Rascunhos da aba não são tocados.
   */
  hydrateOfficial(current: AttendanceRecord[], superseded: AttendanceRecord[]) {
    localAttendance = [...localAttendance.filter((item) => !item.concluded), ...current];
    supersededAttendance = superseded;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const empty: AttendanceRecord[] = [];

export function useLocalAttendance() {
  return useSyncExternalStore(attendanceStore.subscribe, attendanceStore.list, () => empty);
}

// Estudantes aplicáveis na data -----------------------------------------------

export type IneligibleStudent = { id: string; name: string; reason: string };

export function eligibleStudents(entry: LessonEntry): DiaryStudent[] {
  return entry.classId ? studentsForClassOn(entry.classId, entry.date) : [];
}

/** Alunos que já tiveram alocação nesta turma, mas não na data da aula. */
export function ineligibleStudents(entry: LessonEntry): IneligibleStudent[] {
  const eligible = new Set(eligibleStudents(entry).map((item) => item.student.id));
  return rosterStudents().flatMap((student) => {
    if (eligible.has(student.id)) return [];
    const allocations = student.enrollments.flatMap((enrollment) =>
      enrollment.academicLinks.flatMap((link) =>
        link.participations.flatMap((participation) =>
          participation.allocations.filter((item) => item.classId === entry.classId),
        ),
      ),
    );
    const allocation = allocations[allocations.length - 1];
    if (!allocation) return [];
    const reason = allocation.until
      ? `Alocação nesta turma encerrada em ${formatAcademicDate(allocation.until)}; não integra a chamada de ${formatAcademicDate(entry.date)}.`
      : `Alocação nesta turma a partir de ${formatAcademicDate(allocation.from)}; sem frequência para datas anteriores.`;
    return [{ id: student.id, name: student.personName, reason }];
  });
}

function isoDate(value: string) {
  return parseAcademicDate(value) ?? value;
}
/** Alocação iniciada até 30 dias antes da aula. */
export function recentlyAllocated(item: DiaryStudent, date: string) {
  const from = isoDate(item.allocation.from);
  return from <= date && shiftDate(from, 30) >= date;
}

// Estado e validação ----------------------------------------------------------

export function attendanceCounts(
  entry: LessonEntry,
  marks: AttendanceMarks,
  students = eligibleStudents(entry),
) {
  const slots = attendanceSlots(entry);
  const total = slots.length * students.length;
  let marked = 0;
  let present = 0;
  let absent = 0;
  for (const slot of slots)
    for (const item of students) {
      const mark = marks[slot.key]?.[item.student.id];
      if (mark) marked++;
      if (mark === "Presente") present++;
      if (mark === "Ausente") absent++;
    }
  return { total, marked, pending: total - marked, present, absent };
}

export function attendanceStatus(entry: LessonEntry, record?: AttendanceRecord): AttendanceStatus {
  if (!record) return "Sem chamada";
  if (record.concluded) return "Concluída";
  const counts = attendanceCounts(entry, record.marks);
  return counts.pending > 0 && counts.marked > 0 ? "Parcialmente preenchida" : "Rascunho";
}

export type AttendanceBlocker = { kind: string; message: string };

/** Impedimentos contextuais para abrir a chamada como operação. */
export function attendanceBlocker(
  entry: LessonEntry,
  professionalId: string,
  local: LocalLessonRecord[] = [],
  records: AttendanceRecord[] = localAttendance,
): AttendanceBlocker | null {
  // 6D.1.1 — frequência e registro de aula são ciclos IRMÃOS do mesmo contexto
  // letivo: a chamada não depende da conclusão do registro pedagógico. O que o
  // registro ainda em rascunho impede é apenas o fechamento oficial (12H.1),
  // que continua exigindo a unidade ministrada comprovada.

  if (entry.professionalId !== professionalId)
    return {
      kind: "assignment",
      message:
        "A atuação pedagógica deste registro pertence a outro profissional. A chamada só é operada pelo responsável registrado.",
    };
  const assignment = demonstrationPedagogicalAssignments.find(
    (item) => item.id === entry.assignmentId,
  );
  if (!assignment || !assignmentActiveOn(assignment, entry.date))
    return {
      kind: "temporal",
      message:
        "A atuação pedagógica não estava vigente na data da aula; a marcação não é permitida.",
    };
  const duplicate = duplicateAttendance(entry, local, records);
  if (duplicate)
    return {
      kind: "duplicate",
      message: `O bloco ${duplicate.blockId} desta data já possui chamada no registro ${duplicate.entryId}. Não é permitido duplicar a chamada do mesmo bloco ministrado.`,
    };
  return null;
}

function allEntries(local: LocalLessonRecord[]) {
  return [...fixtureLessons().map(fixtureEntry), ...local.map(localEntry)];
}

/** Outro registro da mesma turma/data que compartilha bloco e já tem chamada. */
export function duplicateAttendance(
  entry: LessonEntry,
  local: LocalLessonRecord[] = [],
  records: AttendanceRecord[] = localAttendance,
) {
  const has = (id: string) =>
    records.some((item) => item.entryId === id) ||
    fixtureAttendanceRecords().some((item) => item.entryId === id);
  if (has(entry.id)) return null;
  for (const other of allEntries(local)) {
    if (other.id === entry.id || other.classId !== entry.classId || other.date !== entry.date)
      continue;
    const blockId = other.blockIds.find((id) => entry.blockIds.includes(id));
    if (blockId && has(other.id)) return { entryId: other.id, blockId };
  }
  return null;
}

// Indicadores ------------------------------------------------------------------

export type StudentFrequency = {
  studentId: string;
  name: string;
  applicable: number;
  withConcluded: number;
  present: number;
  absent: number;
  pending: number;
  launches: Array<{
    entryId: string;
    date: string;
    slot: string;
    mark: AttendanceMark | null;
    concluded: boolean;
  }>;
};

export type FrequencyScope = {
  assignmentId: string;
  className: string;
  field: string;
  stage: DiaryStage;
  planned: number;
  taught: number;
  withConcluded: number;
  pendingLessons: number;
  students: StudentFrequency[];
};

export function frequencyIndicators(
  professionalId: string,
  from: string,
  to: string,
  entries: LessonEntry[],
  local: AttendanceRecord[] = localAttendance,
): FrequencyScope[] {
  const scoped = entries.filter(
    (entry) =>
      entry.professionalId === professionalId &&
      entry.status !== "Rascunho local" &&
      entry.date >= from &&
      entry.date <= to,
  );
  const planned: Record<string, number> = {};
  for (let date = from, guard = 0; date <= to && guard < 400; date = shiftDate(date, 1), guard++)
    for (const item of plannedLessonsFor(professionalId, date))
      planned[item.assignmentId] = (planned[item.assignmentId] ?? 0) + 1;
  const ids = [...new Set([...scoped.map((e) => e.assignmentId), ...Object.keys(planned)])];
  return ids.map((assignmentId) => {
    const own = scoped.filter((entry) => entry.assignmentId === assignmentId);
    const record = demonstrationPedagogicalAssignments.find((item) => item.id === assignmentId);
    const students = new Map<string, StudentFrequency>();
    let taught = 0;
    let withConcluded = 0;
    for (const entry of own) {
      const slots = attendanceSlots(entry);
      const attendance =
        local.find((item) => item.entryId === entry.id) ??
        fixtureAttendanceRecords().find((item) => item.entryId === entry.id);
      taught += slots.length;
      if (attendance?.concluded) withConcluded += slots.length;
      for (const item of eligibleStudents(entry)) {
        const row =
          students.get(item.student.id) ??
          ({
            studentId: item.student.id,
            name: item.student.personName,
            applicable: 0,
            withConcluded: 0,
            present: 0,
            absent: 0,
            pending: 0,
            launches: [],
          } satisfies StudentFrequency);
        for (const slot of slots) {
          const mark = attendance?.marks[slot.key]?.[item.student.id] ?? null;
          row.applicable++;
          if (attendance?.concluded && mark) {
            row.withConcluded++;
            if (mark === "Presente") row.present++;
            else row.absent++;
          } else row.pending++;
          row.launches.push({
            entryId: entry.id,
            date: entry.date,
            slot: slot.label,
            mark,
            concluded: Boolean(attendance?.concluded),
          });
        }
        students.set(item.student.id, row);
      }
    }
    const first = own[0];
    const classId = record?.classId ?? first?.classId ?? "";
    return {
      assignmentId,
      className: first?.className ?? classId,
      field: first?.field ?? record?.field ?? "Contexto pedagógico integrado",
      stage: diaryStageForClass(classId),
      planned: planned[assignmentId] ?? 0,
      taught,
      withConcluded,
      pendingLessons: taught - withConcluded,
      students: [...students.values()],
    };
  });
}

/** Prévia só existe sem pendências e fora da Educação Infantil. */
export function frequencyPreview(scope: FrequencyScope, student: StudentFrequency) {
  if (scope.stage === "Educação Infantil")
    return {
      available: false as const,
      reason: "Sem regra de contabilização definida para Educação Infantil.",
    };
  if (student.pending > 0 || student.withConcluded === 0)
    return {
      available: false as const,
      reason: "Há aulas sem chamada concluída; prévia indisponível.",
    };
  return {
    available: true as const,
    numerator: student.present,
    denominator: student.withConcluded,
    percent: Math.round((student.present / student.withConcluded) * 1000) / 10,
  };
}

export const attendanceScenarios = [
  ["Chamada concluída com duas aulas", "aul-001"],
  ["Chamada parcialmente preenchida", "aul-008"],
  ["Registro sem chamada", "aul-003 / aul-006"],
  ["Duplicidade de bloco compartilhado", "aul-009 × aul-001"],
  ["Aula fora da previsão", "aul-006"],
  ["Educação Infantil", "aul-002"],
  ["Anos Finais por componente", "aul-007"],
  ["EJA", "aul-008"],
  ["Consulta histórica", "aul-004"],
  ["Substituição (atuação encerrada)", "aul-003 · pro-009"],
  ["Aluno movimentado entre turmas", "alu-005"],
  ["Aluno transferido", "alu-003"],
  ["Recém-enturmado", "alu-004"],
  ["Atuação incompatível", "aul-007 aberta por pro-006"],
] as const;

export const ATTENDANCE_LOCAL_NOTE =
  "Chamadas feitas aqui existem apenas na memória desta aba. Ao recarregar a página, rascunhos e conclusões locais são perdidos. Concluir uma chamada demonstrativa não constitui validação institucional.";
