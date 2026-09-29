import { rosterStudents } from "@/features/students/institutional-roster";
import { formatAcademicDate } from "@/lib/academic-date";
import { useSyncExternalStore } from "react";
import { isDiaryCloud } from "./diary-persistence-mode";
import {
  curriculumObjectiveRepository,
  type CurriculumObjective,
} from "@/features/curriculum/curriculum-objectives-repository";
import { getDemonstrationClass, getClassUnitName } from "@/features/classes/classes-data";
import { FIVE_EXPERIENCE_FIELDS } from "@/features/curriculum/curriculum-data";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { diaryStageForClass, studentsForClassOn } from "./diary-data";
import type { PlanningRelation } from "./lesson-records";

export type ExperienceFieldId = (typeof FIVE_EXPERIENCE_FIELDS)[number]["id"];

export const experienceFields = FIVE_EXPERIENCE_FIELDS.map((field) => ({
  id: field.id,
  label: field.label,
  description: field.description,
}));

/**
 * 6D.5.1 — objetivos vêm EXCLUSIVAMENTE da Matriz de Habilidades
 * (`curriculumObjectiveRepository`, fonte BNCC). O Diário não guarda currículo.
 */
export type LearningObjective = CurriculumObjective;

export type IndividualObservation = {
  id: string;
  studentId: string;
  text: string;
  fieldIds: ExperienceFieldId[];
  objectiveIds: string[];
};

export type InfantExperienceInput = {
  professionalId: string;
  assignmentId: string;
  date: string;
  title: string;
  description: string;
  fieldIds: ExperienceFieldId[];
  objectiveIds: string[];
  collectiveObservation: string;
  individualObservations: IndividualObservation[];
  planningRelation: PlanningRelation;
  relatedPlanning?: { id: string; summary: string } | undefined;
};

export type InfantExperienceStatus =
  | "Rascunho local"
  | "Concluído localmente (demonstração)"
  | "Registrada demonstrativamente"
  /** Versão vigente lida do banco (modo com sessão). */
  | "Registrada oficialmente";

export type InfantExperienceRecord = InfantExperienceInput & {
  id: string;
  status: InfantExperienceStatus;
  origin: "fixture" | "local";
  relatedLessonId?: string | undefined;
  createdAt: string;
};

export const infantExperienceFixtures: InfantExperienceRecord[] = [
  {
    id: "aul-002",
    relatedLessonId: "aul-002",
    origin: "fixture",
    status: "Registrada demonstrativamente",
    createdAt: "2026-09-22T10:00:00.000Z",
    professionalId: "pro-006",
    assignmentId: "atp-002",
    date: "2026-09-22",
    title: "Exploração de formas, texturas e cores",
    description:
      "[Texto fictício] As crianças exploraram materiais com diferentes texturas, produziram composições e compartilharam suas descobertas com o grupo.",
    fieldIds: ["tracos-sons", "eu-outro-nos"],
    objectiveIds: ["bncc:EI03TS01", "bncc:EI03TS02", "bncc:EI03EO01"],
    collectiveObservation:
      "[Texto fictício] O grupo criou diferentes estratégias para combinar materiais e organizou uma conversa sobre as produções.",
    individualObservations: [
      {
        id: "obs-001",
        studentId: "alu-005",
        text: "[Texto fictício] Participou espontaneamente da exploração e descreveu diferenças entre as texturas.",
        fieldIds: ["tracos-sons"],
        objectiveIds: ["bncc:EI03TS01"],
      },
      {
        id: "obs-002",
        studentId: "alu-005",
        text: "[Texto fictício] Compartilhou materiais e explicou sua composição ao grupo.",
        fieldIds: ["eu-outro-nos"],
        objectiveIds: ["bncc:EI03EO01"],
      },
    ],
    planningRelation: "Adaptado do planejado",
    relatedPlanning: {
      id: "pla-004",
      summary: "[Texto fictício] Contação de histórias com gestos e objetos.",
    },
  },
  {
    id: "exp-ei-002",
    origin: "fixture",
    status: "Registrada demonstrativamente",
    createdAt: "2026-09-15T10:00:00.000Z",
    professionalId: "pro-006",
    assignmentId: "atp-002",
    date: "2026-09-15",
    title: "Percurso de movimentos no pátio",
    description:
      "[Texto fictício] Experiência coletiva com percursos, gestos e deslocamentos em pequenos agrupamentos.",
    fieldIds: ["corpo-gestos"],
    objectiveIds: ["bncc:EI03CG01", "bncc:EI03CG02"],
    collectiveObservation:
      "[Texto fictício] O grupo propôs variações para o percurso e reorganizou os materiais coletivamente.",
    individualObservations: [],
    planningRelation: "Sem planejamento prévio",
  },
  {
    id: "exp-ei-003",
    origin: "fixture",
    status: "Rascunho local",
    createdAt: "2026-09-23T10:00:00.000Z",
    professionalId: "pro-006",
    assignmentId: "atp-002",
    date: "2026-09-23",
    title: "Narrativas sobre o entorno",
    description: "[Texto fictício] Rascunho de experiência de escuta e construção de narrativas.",
    fieldIds: ["escuta-fala", "espacos-tempos"],
    objectiveIds: ["bncc:EI03EF01"],
    collectiveObservation: "",
    individualObservations: [],
    planningRelation: "Não informado",
  },
];

/** Fixtures só existem no laboratório; com sessão, apenas o banco é fonte. */
export function infantFixtures(): InfantExperienceRecord[] {
  return isDiaryCloud() ? [] : infantExperienceFixtures;
}

let localExperiences: InfantExperienceRecord[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const infantExperienceStore = {
  list: () => localExperiences,
  get(id: string) {
    return (
      localExperiences.find((item) => item.id === id) ??
      infantFixtures().find((item) => item.id === id)
    );
  },
  upsert(
    input: InfantExperienceInput,
    status: Exclude<InfantExperienceStatus, "Registrada demonstrativamente">,
    id?: string,
    relatedLessonId?: string,
  ) {
    const current = id ? localExperiences.find((item) => item.id === id) : undefined;
    if (current && current.status !== "Rascunho local")
      throw new Error("Registro concluído não pode ser sobrescrito.");
    const record: InfantExperienceRecord = {
      ...input,
      id: current?.id ?? id ?? `exp-local-${String(++sequence).padStart(3, "0")}`,
      status,
      origin: "local",
      ...((relatedLessonId ?? current?.relatedLessonId)
        ? { relatedLessonId: relatedLessonId ?? current?.relatedLessonId }
        : {}),
      createdAt: current?.createdAt ?? new Date().toISOString(),
    };
    localExperiences = current
      ? localExperiences.map((item) => (item.id === record.id ? record : item))
      : [...localExperiences, record];
    emit();
    return record;
  },
  discard(id: string) {
    const current = localExperiences.find((item) => item.id === id);
    if (!current || current.status !== "Rascunho local") return false;
    localExperiences = localExperiences.filter((item) => item.id !== id);
    emit();
    return true;
  },
  reset() {
    localExperiences = [];
    sequence = 0;
    emit();
  },
  /** Espelho somente leitura do banco; rascunhos da aba são preservados. */
  hydrateOfficial(records: InfantExperienceRecord[]) {
    localExperiences = [...localExperiences.filter((item) => item.status === "Rascunho local"), ...records];
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const emptyRecords: InfantExperienceRecord[] = [];
export function useLocalInfantExperiences() {
  return useSyncExternalStore(
    infantExperienceStore.subscribe,
    infantExperienceStore.list,
    () => emptyRecords,
  );
}

export function infantExperienceRecords(professionalId: string, local: InfantExperienceRecord[]) {
  return [...infantFixtures(), ...local]
    .filter((item) => item.professionalId === professionalId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function infantAssignment(assignmentId: string) {
  const assignment = demonstrationPedagogicalAssignments.find((item) => item.id === assignmentId);
  return assignment && diaryStageForClass(assignment.classId) === "Educação Infantil"
    ? assignment
    : undefined;
}

export function isInfantAssignment(assignmentId?: string) {
  return Boolean(assignmentId && infantAssignment(assignmentId));
}

export function emptyInfantExperience(
  professionalId: string,
  date: string,
  assignmentId = "",
): InfantExperienceInput {
  return {
    professionalId,
    assignmentId,
    date,
    title: "",
    description: "",
    fieldIds: [],
    objectiveIds: [],
    collectiveObservation: "",
    individualObservations: [],
    planningRelation: "Não informado",
  };
}

export function infantExperienceContext(record: InfantExperienceInput) {
  const assignment = infantAssignment(record.assignmentId);
  const klass = assignment ? getDemonstrationClass(assignment.classId) : undefined;
  return {
    assignment,
    klass,
    className: klass?.name ?? "Turma não identificada",
    unitName: klass ? getClassUnitName(klass.unitId) : "Unidade não identificada",
    professionalName:
      getDemonstrationProfessional(record.professionalId)?.personName ?? record.professionalId,
    groupings: klass?.groupings.map((item) => item.label) ?? [],
  };
}

export function objectivesFor(query: string, fieldId?: string, ageGroupIds?: readonly string[]) {
  return curriculumObjectiveRepository.query({
    text: query,
    ...(fieldId ? { fieldId } : {}),
    ...(ageGroupIds?.length ? { ageGroupIds } : {}),
  });
}

/** Grupos etários curriculares declarados pelos agrupamentos da turma (sem presunção). */
export function ageGroupsForClass(classId?: string): string[] {
  const klass = classId ? getDemonstrationClass(classId) : undefined;
  return [...new Set(klass?.groupings.flatMap((g) => g.curriculumAgeGroupIds ?? []) ?? [])];
}

export function eligibleChildren(input: InfantExperienceInput) {
  const assignment = infantAssignment(input.assignmentId);
  return assignment ? studentsForClassOn(assignment.classId, input.date) : [];
}

export function unavailableChildren(input: InfantExperienceInput) {
  const assignment = infantAssignment(input.assignmentId);
  if (!assignment) return [];
  const eligible = new Set(eligibleChildren(input).map((item) => item.student.id));
  return rosterStudents().flatMap((student) => {
    if (eligible.has(student.id)) return [];
    const allocations = student.enrollments.flatMap((enrollment) =>
      enrollment.academicLinks.flatMap((link) =>
        link.participations.flatMap((participation) =>
          participation.allocations.filter(
            (allocation) => allocation.classId === assignment.classId,
          ),
        ),
      ),
    );
    const allocation = allocations.at(-1);
    if (!allocation) return [];
    return [
      {
        id: student.id,
        name: student.personName,
        reason: allocation.until
          ? `Alocação encerrada em ${formatAcademicDate(allocation.until)}; fora do contexto de ${formatAcademicDate(input.date)}.`
          : `Alocação iniciada em ${formatAcademicDate(allocation.from)}; fora do contexto de ${formatAcademicDate(input.date)}.`,
      },
    ];
  });
}

export function validateInfantExperience(input: InfantExperienceInput) {
  const issues: Array<{ field: string; message: string }> = [];
  const assignment = infantAssignment(input.assignmentId);
  if (!assignment || assignment.professionalId !== input.professionalId)
    issues.push({
      field: "assignment",
      message: "Selecione uma atuação vigente da Educação Infantil.",
    });
  if (
    assignment &&
    (assignment.start > input.date || (assignment.end && assignment.end < input.date))
  )
    issues.push({ field: "assignment", message: "A atuação não está vigente na data escolhida." });
  if (!input.description.trim())
    issues.push({
      field: "description",
      message: "Descreva a experiência efetivamente realizada.",
    });
  const validChildren = new Set(eligibleChildren(input).map((item) => item.student.id));
  input.individualObservations.forEach((observation) => {
    if (!validChildren.has(observation.studentId))
      issues.push({
        field: "individual",
        message: "Há observação vinculada a uma criança fora da turma na data.",
      });
    if (!observation.text.trim())
      issues.push({
        field: "individual",
        message: "Descreva a observação individual ou remova o item vazio.",
      });
  });
  return issues;
}

export function fieldLabel(id: string) {
  return experienceFields.find((field) => field.id === id)?.label ?? id;
}

export function objectiveById(id: string) {
  return curriculumObjectiveRepository.byId(id);
}

export const infantExperienceScenarios = [
  "registro simples com um campo",
  "registro com vários campos",
  "vários objetivos",
  "observação coletiva",
  "observações individuais",
  "criança recém-enturmada",
  "criança fora da turma na data",
  "planejamento relacionado",
  "sem planejamento",
  "chamada concluída",
  "chamada pendente",
  "rascunho",
  "consulta histórica",
  "turma multietapa",
  "experiência sem objetivos",
  "experiência sem observações",
  "busca de objetivo",
  "filtro por campo",
  "atuação incompatível",
  "atuação encerrada",
  "descrição longa",
  "proteção contra perda",
  "detalhe da experiência",
  "linha do tempo infantil",
  "frequência sem percentual oficial",
  "registro criado na sessão",
] as const;
