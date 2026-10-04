import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName, teachingClassBlocks } from "@/features/diary/institutional-teaching";
import { isDiaryCloud } from "./diary-persistence-mode";
import { diaryReference } from "./diary-session-state";
import { institutionalCalendarDependency } from "@/features/calendar/institutional-calendar-days";
import { formatAcademicDate } from "@/lib/academic-date";
import { addDays, isIsoDate, weekdayOf as civilWeekday } from "@/lib/academic-date";
import { useSyncExternalStore } from "react";
import { getDemonstrationClass, getClassUnitName } from "@/features/classes/classes-data";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { classProjection, normalizeReferenceDate } from "@/features/schedules/schedule-integration";
import type { ScheduleBlock, WeekDayId } from "@/features/schedules/schedules-data";
import { diaryContext, taughtLessons, type DiaryContext, type TaughtLesson } from "./diary-data";

/**
 * Etapa 11B — registro de aulas efetivamente realizadas.
 * Aula prevista (bloco de grade), conteúdo planejado, aula ministrada e
 * conteúdo registrado são entidades distintas. Nada aqui persiste: registros
 * criados vivem apenas na memória desta aba do navegador.
 */

// B4.10.0d — domingo (0) é dia estrutural; sem bloco cadastrado nenhuma aula é prevista.
const WEEKDAY_BY_INDEX: Array<WeekDayId | null> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayOf(date: string): WeekDayId | null {
  return isIsoDate(date) ? (WEEKDAY_BY_INDEX[civilWeekday(date)] ?? null) : null;
}

export function shiftDate(date: string, days: number) {
  return addDays(date, days);
}

/** Aula prevista: um bloco da grade aplicável em uma data concreta. */
export type PlannedLesson = {
  key: string;
  date: string;
  blockId: string;
  block: ScheduleBlock;
  assignmentId: string;
  classId: string;
  className: string;
  unitId: string;
  unitName: string;
  field: string;
  stage: DiaryContext["assignments"][number]["stage"];
  role: string;
};

export function plannedLessonKey(date: string, blockId: string) {
  return `${date}::${blockId}`;
}

/**
 * B4.6.3d — blocos ESTRUTURAIS da grade do professor na data (atuações vigentes). Grade não é
 * calendário: com sessão, estes blocos NÃO são aulas previstas; servem para selecionar o horário
 * de uma aula efetivamente ministrada.
 */
export function scheduleBlocksFor(professionalId: string, date: string): PlannedLesson[] {
  const day = weekdayOf(date);
  if (!day) return [];
  const context = diaryContext(professionalId, date);
  return context.assignments
    .flatMap((item) =>
      item.blocks
        .filter((block) => block.day === day && block.kind !== "Intervalo")
        .map((block) => ({
          key: plannedLessonKey(date, block.id),
          date,
          blockId: block.id,
          block,
          assignmentId: item.record.id,
          classId: item.classId,
          className: item.className,
          unitId: item.unitId,
          unitName: item.unitName,
          field: item.field,
          stage: item.stage,
          role: item.record.role,
        })),
    )
    .sort((a, b) => a.block.start.localeCompare(b.block.start));
}

export type PlannedLessonsResolution =
  | { kind: "determinado"; lessons: PlannedLesson[] }
  | { kind: "indeterminado"; reason: string };

/**
 * B4.6.3d — aulas previstas = grade × dia letivo resolvido pelo calendário. Laboratório: grade
 * demonstrativa (comportamento explícito existente). Fora dele (sessão ou pendente): só o
 * adaptador central, com a data e o knownAt do contexto ACEITO pelo controlador do Diário; sem
 * calendário aplicável declarado nenhuma aula é prevista e o motivo é devolvido (nunca zero).
 */
export function plannedLessonsResolution(professionalId: string, date: string): PlannedLessonsResolution {
  if (!isDiaryCloud()) return { kind: "determinado", lessons: scheduleBlocksFor(professionalId, date) };
  const knownAt = diaryReference()?.knownAt ?? null;
  const dep = institutionalCalendarDependency(isIsoDate(date) ? { start: date, end: date } : null, knownAt);
  if (dep.summary.kind !== "determinado")
    return { kind: "indeterminado", reason: dep.reason ?? "Calendário institucional não resolvido." };
  const day = dep.summary.days[0];
  return { kind: "determinado", lessons: day?.state === "letivo" ? scheduleBlocksFor(professionalId, date) : [] };
}

/** Aulas previstas do professor na data; indeterminado ⇒ lista vazia (use a resolução para o motivo). */
export function plannedLessonsFor(professionalId: string, date: string): PlannedLesson[] {
  const r = plannedLessonsResolution(professionalId, date);
  return r.kind === "determinado" ? r.lessons : [];
}

/** Blocos da turma na data que pertencem a outras atuações (não selecionáveis). */
export function foreignClassBlocks(classId: string, assignmentId: string, date: string) {
  const day = weekdayOf(date);
  if (!day) return [];
  // B4.10.0d — com sessão, data inválida não vira data substituta.
  const q = isDiaryCloud() ? (isIsoDate(date) ? date : null) : normalizeReferenceDate(date);
  if (q === null) return [];
  return teachingClassBlocks(classId, q).filter(
    (block) =>
      block.day === day &&
      block.kind !== "Intervalo" &&
      !block.assignmentIds.includes(assignmentId),
  );
}

/** Conteúdo planejado: fixture independente do bloco e do registro. */
export type PlannedContent = {
  id: string;
  date: string;
  blockId: string;
  assignmentId: string;
  text: string;
  source: "Planejamento semanal demonstrativo";
};

export const plannedContents: PlannedContent[] = [
  {
    id: "pla-001",
    date: "2026-09-23",
    blockId: "bl-006",
    assignmentId: "atp-001",
    text: "[Texto fictício] Retomada da leitura compartilhada e roda de conversa sobre o texto.",
    source: "Planejamento semanal demonstrativo",
  },
  {
    id: "pla-002",
    date: "2026-09-21",
    blockId: "bl-004",
    assignmentId: "atp-001",
    text: "[Texto fictício] Leitura orientada em pequenos grupos.",
    source: "Planejamento semanal demonstrativo",
  },
  {
    id: "pla-003",
    date: "2026-09-21",
    blockId: "bl-001",
    assignmentId: "atp-001",
    text: "[Texto fictício] Leitura compartilhada de relato.",
    source: "Planejamento semanal demonstrativo",
  },
  {
    id: "pla-004",
    date: "2026-09-22",
    blockId: "bl-090",
    assignmentId: "atp-002",
    text: "[Texto fictício] Contação de histórias com gestos e objetos.",
    source: "Planejamento semanal demonstrativo",
  },
];

export function plannedContentFor(date: string, blockId: string, assignmentId: string) {
  return plannedContents.find(
    (item) => item.date === date && item.blockId === blockId && item.assignmentId === assignmentId,
  );
}

export type PlanningRelation =
  | "Conforme o planejado"
  | "Adaptado do planejado"
  | "Diferente do planejado"
  | "Sem planejamento prévio"
  | "Não informado";

/** Detalhes adicionais dos registros fictícios da Etapa 11A (fonte única). */
export type LessonFixtureDetail = {
  blockIds: string[];
  quantity: number;
  contentMode: "shared" | "individual";
  contents: Record<string, string>;
  planningRelation: PlanningRelation;
  extraordinary?: { justification: string; start: string; end: string };
};

export const lessonFixtureDetails: Record<string, LessonFixtureDetail> = {
  "aul-001": {
    blockIds: ["bl-001", "bl-002"],
    quantity: 2,
    contentMode: "shared",
    contents: { shared: "Leitura compartilhada e produção de pequenos relatos." },
    planningRelation: "Adaptado do planejado",
  },
  "aul-002": {
    blockIds: ["bl-090"],
    quantity: 1,
    contentMode: "shared",
    contents: { shared: "Exploração de narrativas, gestos e convivência nos agrupamentos." },
    planningRelation: "Diferente do planejado",
  },
  "aul-003": {
    blockIds: ["bl-007"],
    quantity: 1,
    contentMode: "shared",
    contents: { shared: "Atividade de linguagem durante a substituição temporária." },
    planningRelation: "Sem planejamento prévio",
  },
  "aul-004": {
    blockIds: [],
    quantity: 1,
    contentMode: "shared",
    contents: { shared: "Resolução colaborativa de situações matemáticas." },
    planningRelation: "Não informado",
  },
  "aul-005": {
    blockIds: ["bl-001", "bl-002"],
    quantity: 2,
    contentMode: "individual",
    contents: {
      "bl-001": "[Texto fictício] Leitura de parlendas.",
      "bl-002": "[Texto fictício] Reescrita coletiva de parlenda.",
    },
    planningRelation: "Sem planejamento prévio",
  },
  "aul-006": {
    blockIds: [],
    quantity: 1,
    contentMode: "shared",
    contents: { shared: "[Texto fictício] Atividade de leitura em horário não previsto na grade." },
    planningRelation: "Sem planejamento prévio",
    extraordinary: {
      justification: "[Texto fictício] Atividade realizada em horário distinto da grade.",
      start: "10:40",
      end: "11:30",
    },
  },
  "aul-007": {
    blockIds: ["bl-051"],
    quantity: 1,
    contentMode: "shared",
    contents: { shared: "[Texto fictício] Observação de fenômenos do cotidiano." },
    planningRelation: "Conforme o planejado",
  },
  "aul-008": {
    blockIds: [],
    quantity: 2,
    contentMode: "shared",
    contents: { shared: "[Texto fictício] Leitura de textos informativos em grupo." },
    planningRelation: "Não informado",
  },
  "aul-009": {
    blockIds: ["bl-002"],
    quantity: 1,
    contentMode: "shared",
    contents: {
      shared: "[Texto fictício] Registro complementar que compartilha o bloco de aul-001.",
    },
    planningRelation: "Não informado",
  },
};

export const extraLessonFixtures: TaughtLesson[] = [
  {
    id: "aul-005",
    date: "2026-09-14",
    classId: "tur-001",
    assignmentId: "atp-001",
    professionalId: "pro-006",
    summary: "[Texto fictício] Leitura de parlendas; reescrita coletiva.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-006",
    date: "2026-09-18",
    classId: "tur-001",
    assignmentId: "atp-001",
    professionalId: "pro-006",
    summary: "[Texto fictício] Atividade de leitura fora da previsão da grade.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-007",
    date: "2026-09-16",
    classId: "tur-005",
    assignmentId: "atp-006",
    professionalId: "pro-003",
    summary: "[Texto fictício] Observação de fenômenos do cotidiano.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-008",
    date: "2026-09-15",
    classId: "tur-004",
    assignmentId: "atp-007",
    professionalId: "pro-008",
    summary: "[Texto fictício] Leitura de textos informativos em grupo.",
    status: "Registrada demonstrativamente",
  },
  {
    id: "aul-009",
    date: "2026-09-21",
    classId: "tur-001",
    assignmentId: "atp-001",
    professionalId: "pro-006",
    summary: "[Texto fictício] Registro complementar no mesmo bloco de aul-001.",
    status: "Registrada demonstrativamente",
  },
];

export const allFixtureLessons: TaughtLesson[] = [...taughtLessons, ...extraLessonFixtures];

// ---------------------------------------------------------------------------
// Registros locais (rascunhos e concluídos) — somente memória desta aba.
// ---------------------------------------------------------------------------

export type LocalLessonStatus =
  | "Rascunho local"
  | "Concluído localmente (demonstração)"
  /** Versão vigente de registro oficial lido do banco (modo com sessão). */
  | "Registrado oficialmente";

/** Fixtures só existem no laboratório; com sessão, apenas o banco é fonte. */
export function fixtureLessons(): TaughtLesson[] {
  return isDiaryCloud() ? [] : allFixtureLessons;
}

export type LessonRecordInput = {
  professionalId: string;
  assignmentId: string;
  date: string;
  blockIds: string[];
  quantity: number;
  contentMode: "shared" | "individual";
  contents: Record<string, string>;
  planningRelation: PlanningRelation;
  objectives: string;
  skills: string;
  strategies: string;
  observations: string;
  groupings: string;
  extraordinary: boolean;
  extraordinaryStart: string;
  extraordinaryEnd: string;
  justification: string;
};

export type LocalLessonRecord = LessonRecordInput & {
  id: string;
  status: LocalLessonStatus;
  createdAt: string;
};

let localRecords: LocalLessonRecord[] = [];
let sequence = 0;
/**
 * B4.10.0c — partição de rascunhos por contexto: "laboratorio", `conta:<userId>` ou null (incerto).
 * Rascunhos (e, no laboratório, todo o estado local) ficam guardados na memória da aba e voltam só
 * para a MESMA partição; fatos oficiais de conta nunca são guardados (vêm do espelho aceito).
 */
let lessonPartition: string | null = "laboratorio";
const lessonSaved = new Map<string, LocalLessonRecord[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const localLessonStore = {
  list: () => localRecords,
  get: (id: string) => localRecords.find((item) => item.id === id),
  upsert(input: LessonRecordInput, status: LocalLessonStatus, id?: string) {
    const existing = id ? localRecords.find((item) => item.id === id) : undefined;
    if (existing && existing.status !== "Rascunho local") {
      throw new Error("Registro concluído não pode ser sobrescrito.");
    }
    const record: LocalLessonRecord = {
      ...input,
      id: existing?.id ?? `loc-${String(++sequence).padStart(3, "0")}`,
      status,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    localRecords = existing
      ? localRecords.map((item) => (item.id === record.id ? record : item))
      : [...localRecords, record];
    emit();
    return record;
  },
  discard(id: string) {
    const existing = localRecords.find((item) => item.id === id);
    if (!existing || existing.status !== "Rascunho local") return false;
    localRecords = localRecords.filter((item) => item.id !== id);
    emit();
    return true;
  },
  reset() {
    localRecords = [];
    sequence = 0;
    emit();
  },
  switchDraftPartition(next: string | null) {
    if (next === lessonPartition) return;
    if (lessonPartition !== null)
      lessonSaved.set(
        lessonPartition,
        lessonPartition === "laboratorio" ? localRecords : localRecords.filter((r) => r.status === "Rascunho local"),
      );
    localRecords = next === null ? [] : (lessonSaved.get(next) ?? []);
    lessonPartition = next;
    emit();
  },
  /** Espelho somente leitura: substitui os registros oficiais, preserva rascunhos da aba. */
  hydrateOfficial(records: LocalLessonRecord[]) {
    localRecords = [...localRecords.filter((item) => item.status === "Rascunho local"), ...records];
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const emptyList: LocalLessonRecord[] = [];
export function useLocalLessonRecords() {
  return useSyncExternalStore(localLessonStore.subscribe, localLessonStore.list, () => emptyList);
}

export function emptyLessonInput(
  professionalId: string,
  date: string,
  assignmentId = "",
): LessonRecordInput {
  return {
    professionalId,
    assignmentId,
    date,
    blockIds: [],
    quantity: 0,
    contentMode: "shared",
    contents: {},
    planningRelation: "Não informado",
    objectives: "",
    skills: "",
    strategies: "",
    observations: "",
    groupings: "",
    extraordinary: false,
    extraordinaryStart: "",
    extraordinaryEnd: "",
    justification: "",
  };
}

export type SelectionConflict = {
  kind: "assignments" | "classes" | "components";
  message: string;
};

/** Verifica compatibilidade da seleção; não inventa regra institucional de agrupamento. */
export function selectionConflict(
  planned: PlannedLesson[],
  blockIds: string[],
): SelectionConflict | null {
  const chosen = planned.filter((item) => blockIds.includes(item.blockId));
  const unique = (values: string[]) => new Set(values).size;
  if (unique(chosen.map((item) => item.classId)) > 1)
    return {
      kind: "classes",
      message:
        "As aulas selecionadas pertencem a turmas diferentes. Faça um registro para cada turma.",
    };
  if (unique(chosen.map((item) => item.field)) > 1)
    return {
      kind: "components",
      message:
        "As aulas selecionadas envolvem componentes ou campos distintos. Registre cada componente separadamente.",
    };
  if (unique(chosen.map((item) => item.assignmentId)) > 1)
    return {
      kind: "assignments",
      message:
        "As aulas selecionadas pertencem a atuações pedagógicas diferentes. Separe-as em registros próprios.",
    };
  return null;
}

export function areConsecutive(blocks: ScheduleBlock[]) {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.every((block, index) => index === 0 || sorted[index - 1]!.end === block.start);
}

export type ValidationIssue = { field: string; message: string };

export function validateLessonInput(
  input: LessonRecordInput,
  planned: PlannedLesson[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const assignment = teachingAssignments().find(
    (item) => item.id === input.assignmentId,
  );
  if (!assignment) issues.push({ field: "assignment", message: "Selecione a atuação pedagógica." });
  else if (
    assignment.professionalId !== input.professionalId ||
    assignment.start > input.date ||
    (assignment.end && assignment.end < input.date)
  )
    issues.push({
      field: "assignment",
      message: "A atuação selecionada não está vigente para este profissional na data informada.",
    });
  if (input.extraordinary) {
    if (!input.justification.trim())
      issues.push({
        field: "justification",
        message: "Descreva a situação da aula fora da previsão.",
      });
    if (!input.extraordinaryStart || !input.extraordinaryEnd)
      issues.push({ field: "time", message: "Informe o horário em que a atividade ocorreu." });
  } else {
    if (!input.blockIds.length)
      issues.push({ field: "blocks", message: "Selecione ao menos uma aula prevista." });
    const own = planned.filter((item) => item.assignmentId === input.assignmentId);
    if (input.blockIds.some((id) => !own.some((item) => item.blockId === id)))
      issues.push({
        field: "blocks",
        message: "Há aula selecionada que não pertence à atuação escolhida.",
      });
    const conflict = selectionConflict(planned, input.blockIds);
    if (conflict) issues.push({ field: "blocks", message: conflict.message });
  }
  if (input.quantity < 1)
    issues.push({ field: "quantity", message: "Informe a quantidade efetivamente realizada." });
  const texts =
    input.contentMode === "shared"
      ? [input.contents["shared"] ?? ""]
      : input.blockIds.map((id) => input.contents[id] ?? "");
  if (input.contentMode === "individual" && input.extraordinary)
    issues.push({ field: "content", message: "Aula fora da previsão usa conteúdo único." });
  if (!texts.length || texts.some((text) => !text.trim()))
    issues.push({
      field: "content",
      message:
        input.contentMode === "shared"
          ? "Descreva o conteúdo ou a atividade realizada."
          : "Descreva o conteúdo de cada aula individualizada.",
    });
  return issues;
}

export function isInputDirty(input: LessonRecordInput, initial: LessonRecordInput) {
  return JSON.stringify(input) !== JSON.stringify(initial);
}

// ---------------------------------------------------------------------------
// Projeção unificada para histórico e detalhamento.
// ---------------------------------------------------------------------------

export type LessonEntry = {
  id: string;
  origin: "fixture" | "local";
  status: TaughtLesson["status"] | LocalLessonStatus;
  date: string;
  classId: string;
  className: string;
  unitId: string;
  unitName: string;
  assignmentId: string;
  field: string;
  role: string;
  professionalId: string;
  professionalName: string;
  quantity: number;
  blockIds: string[];
  contentMode: "shared" | "individual";
  contents: Record<string, string>;
  summary: string;
  planningRelation: PlanningRelation;
  extraordinary?: { justification: string; start: string; end: string };
  optional: Partial<
    Pick<LessonRecordInput, "objectives" | "skills" | "strategies" | "observations" | "groupings">
  >;
};

function assignmentInfo(assignmentId: string) {
  const record = teachingAssignments().find((item) => item.id === assignmentId);
  const klass = record ? teachingClass(record.classId) : undefined;
  return {
    record,
    className: klass?.name ?? record?.classId ?? "Turma não identificada",
    unitId: klass?.unitId ?? "",
    unitName: klass ? teachingUnitName(klass.unitId) : "Unidade não identificada",
    field: record?.field ?? "Contexto pedagógico integrado",
    role: record?.role ?? "Atuação não identificada",
  };
}

export function fixtureEntry(lesson: TaughtLesson): LessonEntry {
  const info = assignmentInfo(lesson.assignmentId);
  const detail = lessonFixtureDetails[lesson.id];
  return {
    id: lesson.id,
    origin: "fixture",
    status: lesson.status,
    date: lesson.date,
    classId: lesson.classId,
    className: teachingClass(lesson.classId)?.name ?? info.className,
    unitId: info.unitId,
    unitName: info.unitName,
    assignmentId: lesson.assignmentId,
    field: info.field,
    role: info.role,
    professionalId: lesson.professionalId,
    professionalName:
      teachingPersonName(lesson.professionalId) ?? lesson.professionalId,
    quantity: detail?.quantity ?? 1,
    blockIds: detail?.blockIds ?? [],
    contentMode: detail?.contentMode ?? "shared",
    contents: detail?.contents ?? { shared: lesson.summary },
    summary: lesson.summary,
    planningRelation: detail?.planningRelation ?? "Não informado",
    ...(detail?.extraordinary ? { extraordinary: detail.extraordinary } : {}),
    optional: {},
  };
}

export function localEntry(record: LocalLessonRecord): LessonEntry {
  const info = assignmentInfo(record.assignmentId);
  const texts =
    record.contentMode === "shared"
      ? [record.contents["shared"] ?? ""]
      : record.blockIds.map((id) => record.contents[id] ?? "");
  return {
    id: record.id,
    origin: "local",
    status: record.status,
    date: record.date,
    classId: info.record?.classId ?? "",
    className: info.className,
    unitId: info.unitId,
    unitName: info.unitName,
    assignmentId: record.assignmentId,
    field: info.field,
    role: info.role,
    professionalId: record.professionalId,
    professionalName:
      teachingPersonName(record.professionalId) ?? record.professionalId,
    quantity: record.quantity,
    blockIds: record.blockIds,
    contentMode: record.contentMode,
    contents: record.contents,
    summary: texts.filter(Boolean).join(" · ") || "Sem conteúdo informado",
    planningRelation: record.planningRelation,
    ...(record.extraordinary
      ? {
          extraordinary: {
            justification: record.justification,
            start: record.extraordinaryStart,
            end: record.extraordinaryEnd,
          },
        }
      : {}),
    optional: {
      objectives: record.objectives,
      skills: record.skills,
      strategies: record.strategies,
      observations: record.observations,
      groupings: record.groupings,
    },
  };
}

export function lessonEntries(professionalId: string, local: LocalLessonRecord[]) {
  return [
    ...fixtureLessons().filter((item) => item.professionalId === professionalId).map(fixtureEntry),
    ...local.filter((item) => item.professionalId === professionalId).map(localEntry),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export function findLessonEntry(id: string, local: LocalLessonRecord[]) {
  const fixture = fixtureLessons().find((item) => item.id === id);
  if (fixture) return fixtureEntry(fixture);
  const record = local.find((item) => item.id === id);
  return record ? localEntry(record) : undefined;
}

// ---------------------------------------------------------------------------
// Agenda diária.
// ---------------------------------------------------------------------------

/** "Na grade": bloco estrutural sem confirmação do calendário — nunca aula prevista. */
export type AgendaItemState = "Registrada" | "Rascunho em elaboração" | "Prevista" | "Na grade";

export type AgendaItem = PlannedLesson & {
  state: AgendaItemState;
  entryId?: string;
  plan?: PlannedContent;
};

export function dailyAgenda(
  professionalId: string,
  date: string,
  local: LocalLessonRecord[],
): AgendaItem[] {
  const entries = lessonEntries(professionalId, local).filter((entry) => entry.date === date);
  const resolution = plannedLessonsResolution(professionalId, date);
  const blocks = resolution.kind === "determinado" ? resolution.lessons : scheduleBlocksFor(professionalId, date);
  const uncovered: AgendaItemState = resolution.kind === "determinado" ? "Prevista" : "Na grade";
  return blocks.map((planned) => {
    const covering = entries.find(
      (entry) =>
        entry.assignmentId === planned.assignmentId && entry.blockIds.includes(planned.blockId),
    );
    const plan = plannedContentFor(date, planned.blockId, planned.assignmentId);
    const state: AgendaItemState = !covering
      ? uncovered
      : covering.status === "Rascunho local"
        ? "Rascunho em elaboração"
        : "Registrada";
    return {
      ...planned,
      state,
      ...(covering ? { entryId: covering.id } : {}),
      ...(plan ? { plan } : {}),
    };
  });
}

export const lessonScenarios = [
  ["Aula simples", "2026-09-23 · bl-006 (pro-006)"],
  ["Duas aulas consecutivas com conteúdo comum", "aul-001"],
  ["Duas aulas com conteúdos distintos", "aul-005"],
  ["Aula planejada ainda não realizada", "pla-001"],
  ["Aula realizada com conteúdo diferente do planejado", "aul-002"],
  ["Aula sem planejamento prévio", "aul-003"],
  ["Aula fora da previsão", "aul-006"],
  ["Professor substituto", "pro-009 · 2026-06-12"],
  ["Professor com duas escolas", "pro-003"],
  ["Professor com várias turmas", "pro-006"],
  ["Consulta histórica", "aul-004 · 2025-10-14"],
  ["Educação Infantil multietapa", "tur-009 · atp-002"],
  ["Anos Iniciais com vários componentes", "tur-001 · 2026-09-21"],
  ["Anos Finais por componente", "aul-007"],
  ["EJA", "aul-008"],
  ["Rascunho incompleto", "estado local"],
  ["Registro demonstrativo concluído", "estado local"],
  ["Seleção de contexto incompatível", "pro-006 · 2026-09-22"],
] as const;

export const LOCAL_RECORD_NOTE =
  "Registros criados aqui existem somente na memória desta aba. Nada é enviado, salvo permanentemente ou sincronizado; ao recarregar a página, eles deixam de existir.";
