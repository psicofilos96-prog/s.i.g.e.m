import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName, teachingPersonId, teachingClassBlocks } from "@/features/diary/institutional-teaching";
import { rosterStudents } from "@/features/students/institutional-roster";
import { classStage } from "@/features/academic/academic-structure";
import { parseAcademicDate } from "@/lib/academic-date";
import {
  demonstrationClasses,
  getClassUnitName,
  getDemonstrationClass,
} from "@/features/classes/classes-data";
import {
  demonstrationPedagogicalAssignments,
  pedagogicalContext,
  type PedagogicalAssignmentRecord,
} from "@/features/pedagogical/pedagogical-data";
import {
  demonstrationProfessionals,
  getDemonstrationProfessional,
} from "@/features/professionals/professionals-data";
import {
  demonstrationStudents,
  type DemonstrationStudent,
  type ClassAllocation,
  type AcademicLink,
  type StudentParticipation,
} from "@/features/students/students-data";
import { classProjection, normalizeReferenceDate } from "@/features/schedules/schedule-integration";
import { WEEK_DAYS, type ScheduleBlock } from "@/features/schedules/schedules-data";

export const DIARY_REFERENCE_DATE = "2026-09-23";
export const DEFAULT_DIARY_PROFESSIONAL_ID = "pro-006";

export type DiarySearch = {
  professor?: string;
  unidade?: string;
  turma?: string;
  componente?: string;
  ano?: string;
  periodo?: string;
  data?: string;
  q?: string;
  de?: string;
  ate?: string;
  estado?: string;
  /** Perfil demonstrativo de capacidades (retificação da chamada). */
  perfil?: string;
  /** Superfície de origem da navegação (ex.: "consolidacao"), para retorno contextual. */
  origem?: string;
};

export function diarySearch(search: DiarySearch, changes: Partial<DiarySearch>): DiarySearch {
  return { ...search, ...changes };
}

export type DiaryStage = "Educação Infantil" | "Anos Iniciais" | "Anos Finais" | "EJA" | "Outro";

export function dateInRange(date: string, start: string, end?: string | null) {
  return (!start || start <= date) && (!end || end >= date);
}

export function assignmentActiveOn(record: PedagogicalAssignmentRecord, date: string) {
  return dateInRange(date, record.start, record.end);
}

/** Etapa pela referência estruturada da turma (academic-structure), sem busca textual. */
export function diaryStageForClass(classId: string): DiaryStage {
  const label = classStage(classId)?.label;
  return label === "Educação Infantil" ||
    label === "Anos Iniciais" ||
    label === "Anos Finais" ||
    label === "EJA"
    ? label
    : "Outro";
}

export type DiaryContext = {
  professionalId: string;
  personName: string;
  referenceDate: string;
  historical: boolean;
  assignments: Array<{
    record: PedagogicalAssignmentRecord;
    classId: string;
    className: string;
    unitId: string;
    unitName: string;
    periodLabel: string;
    field: string;
    stage: DiaryStage;
    studentCount: number;
    blocks: ScheduleBlock[];
    nextBlock?: ScheduleBlock;
  }>;
  units: Array<{ value: string; label: string }>;
  classes: Array<{ value: string; label: string }>;
  fields: Array<{ value: string; label: string }>;
  years: string[];
  periods: string[];
};

export function diaryContext(
  professionalId = DEFAULT_DIARY_PROFESSIONAL_ID,
  referenceDate = DIARY_REFERENCE_DATE,
): DiaryContext {
  const date = normalizeReferenceDate(referenceDate);
  professionalId = teachingPersonId(professionalId);
  const records = teachingAssignments().filter(
    (item) => item.professionalId === professionalId && assignmentActiveOn(item, date),
  );
  const assignments = records.flatMap((record) => {
    const klass = teachingClass(record.classId);
    if (!klass) return [];
    const context = {
      klass,
      unitName: teachingUnitName(klass.unitId),
      periodLabel: klass.academicPeriod.label,
    };
    const projection = { blocks: teachingClassBlocks(context.klass.id, date) };
    const blocks = projection.blocks.filter((block) => block.assignmentIds.includes(record.id));
    return [
      {
        record,
        classId: context.klass.id,
        className: context.klass.name,
        unitId: context.klass.unitId,
        unitName: context.unitName,
        periodLabel: context.periodLabel,
        field: record.field ?? "Contexto pedagógico integrado",
        stage: diaryStageForClass(context.klass.id),
        studentCount: studentsForClassOn(context.klass.id, date).length,
        blocks,
        ...(blocks[0] ? { nextBlock: blocks[0] } : {}),
      },
    ];
  });
  const unique = <T>(items: T[]) => items.filter((item, index) => items.indexOf(item) === index);
  return {
    professionalId,
    personName: teachingPersonName(professionalId) ?? "Profissional não identificado",
    referenceDate: date,
    historical: date < "2026-01-01",
    assignments,
    units: unique(assignments.map((item) => item.unitId)).map((id) => ({
      value: id,
      label: teachingUnitName(id),
    })),
    classes: unique(assignments.map((item) => item.classId)).map((id) => ({
      value: id,
      label: teachingClass(id)?.name ?? id,
    })),
    fields: unique(assignments.map((item) => item.field)).map((field) => ({
      value: field,
      label: field,
    })),
    years: unique(demonstrationClasses.map((item) => String(item.academicPeriod.order)))
      .sort()
      .reverse(),
    periods: unique(assignments.map((item) => item.periodLabel)),
  };
}

/** Delegado ao parser canônico (src/lib/academic-date). */
export function normalizedStudentDate(value: string | null) {
  return parseAcademicDate(value);
}
function allocationActiveOn(allocation: ClassAllocation, date: string) {
  const from = normalizedStudentDate(allocation.from);
  const until = normalizedStudentDate(allocation.until);
  return (!from || from <= date) && (!until || until >= date);
}
export type DiaryStudent = {
  student: DemonstrationStudent;
  enrollmentId: string;
  academicLink: AcademicLink;
  participation: StudentParticipation;
  allocation: ClassAllocation;
};
export function studentsForClassOn(
  classId: string,
  referenceDate = DIARY_REFERENCE_DATE,
): DiaryStudent[] {
  const date = normalizeReferenceDate(referenceDate);
  return rosterStudents().flatMap((student) =>
    student.enrollments.flatMap((enrollment) =>
      enrollment.academicLinks.flatMap((academicLink) =>
        academicLink.participations.flatMap((participation) =>
          participation.allocations
            .filter(
              (allocation) =>
                allocation.classId === classId && allocationActiveOn(allocation, date),
            )
            .map((allocation) => ({
              student,
              enrollmentId: enrollment.id,
              academicLink,
              participation,
              allocation,
            })),
        ),
      ),
    ),
  );
}

export type TaughtLesson = {
  id: string;
  date: string;
  classId: string;
  assignmentId: string;
  professionalId: string;
  summary: string;
  status: "Registrada demonstrativamente";
};
export const taughtLessons: TaughtLesson[] = [
  {
    id: "aul-001",
    date: "2026-09-21",
    classId: "tur-001",
    assignmentId: "atp-001",
    professionalId: "pro-006",
    summary: "Leitura compartilhada e produção de pequenos relatos.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-002",
    date: "2026-09-22",
    classId: "tur-009",
    assignmentId: "atp-002",
    professionalId: "pro-006",
    summary: "Exploração de narrativas, gestos e convivência nos agrupamentos.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-003",
    date: "2026-06-12",
    classId: "tur-001",
    assignmentId: "atp-010",
    professionalId: "pro-009",
    summary: "Atividade de linguagem durante a substituição temporária.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-004",
    date: "2025-10-14",
    classId: "tur-006",
    assignmentId: "atp-003",
    professionalId: "pro-006",
    summary: "Resolução colaborativa de situações matemáticas.",
    status: "Registrada demonstrativamente",
  },
];
export function lessonsForProfessional(professionalId: string) {
  return taughtLessons.filter((item) => item.professionalId === professionalId);
}
export function lessonContext(lesson: TaughtLesson) {
  const assignment = teachingAssignments().find(
    (item) => item.id === lesson.assignmentId,
  );
  const klass = teachingClass(lesson.classId);
  return {
    lesson,
    assignment,
    klass,
    unitName: klass ? teachingUnitName(klass.unitId) : "Unidade não identificada",
  };
}
export function dayLabel(day: ScheduleBlock["day"]) {
  return WEEK_DAYS.find((item) => item.id === day)?.label ?? day;
}

export const diaryScenarios = [
  ["A", "Professor com uma turma", "pro-001"],
  ["B", "Professor com várias turmas", "pro-006"],
  ["C", "Professor com duas escolas", "pro-003"],
  ["D", "Professor com vários componentes", "pro-006"],
  ["E", "Atuação temporária", "pro-009"],
  ["F", "Sem turma ativa", "pro-011"],
  ["G", "Ano letivo anterior", "pro-006@2025"],
  ["H", "Educação Infantil", "tur-002"],
  ["I", "Anos Iniciais", "tur-001"],
  ["J", "Anos Finais", "tur-005"],
  ["K", "EJA", "tur-004"],
  ["L", "Aluno transferido", "alu-003"],
  ["M", "Ingresso após início", "alu-001"],
  ["N", "Mudança de turma", "alu-005"],
  ["O", "Sem aulas registradas", "tur-007"],
] as const;

export const DIARY_DEMONSTRATION_NOTE =
  "Ambiente demonstrativo com dados integralmente fictícios. Nenhuma operação acadêmica é salva ou publicada.";
export const DIARY_PRIVACY_NOTE =
  "Consulta contextual com dados mínimos: não exibe CPF, endereço, contatos, informações familiares, clínicas ou documentos pessoais.";
