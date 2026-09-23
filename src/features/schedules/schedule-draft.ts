/**
 * RASCUNHO DE GRADE SEMANAL — modelo demonstrativo do editor visual (Etapa 10B).
 *
 * Fronteiras conceituais preservadas:
 * - Jornada Escolar ≠ Grade Semanal ≠ Horário Individual ≠ Calendário Escolar ≠
 *   Aula efetivamente ministrada. O editor altera apenas a distribuição
 *   recorrente planejada de uma turma.
 * - Nenhuma jornada é alterada, nenhum calendário é tocado, nenhum registro de
 *   Diário de Classe é criado e nada é persistido.
 * - Profissionais entram na grade exclusivamente por Atuação Pedagógica
 *   existente, sempre com o Vínculo Funcional específico. Lotação não atribui
 *   professor.
 * - Conflitos são hipóteses que requerem validação; nunca bloqueio automático.
 */
import {
  getClassUnitName,
  getDemonstrationClass,
  type DemonstrationClass,
} from "@/features/classes/classes-data";
import { getCurriculumMatrix } from "@/features/curriculum/curriculum-data";
import {
  demonstrationPedagogicalAssignments,
  getPedagogicalAssignment,
  pedagogicalAssignmentsForClass,
  type PedagogicalAssignmentRecord,
  type PedagogicalFieldKind,
} from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  WEEK_DAYS,
  getJourneyForClass,
  getScheduleForClass,
  scheduleVersions,
  timeToMinutes,
  type ScheduleBlock,
  type ScheduleBlockKind,
  type ScheduleSituation,
  type SchedulePublicationState,
  type SchoolJourney,
  type WeekDayId,
} from "./schedules-data";

export type ScheduleDraftMode = "nova" | "edicao";

export type ScheduleDraft = {
  classId: string;
  /** Jornada de referência; o editor nunca a modifica. */
  journeyId: string | null;
  /** Grade de origem quando o rascunho parte de uma versão existente. */
  originScheduleId: string | null;
  label: string;
  state: SchedulePublicationState;
  blocks: ScheduleBlock[];
};

/** Tipos demonstrativos de bloco; taxonomia não congelada. */
export const DRAFT_BLOCK_KINDS: ScheduleBlockKind[] = [
  "Aula",
  "Intervalo",
  "Acolhimento",
  "Oficina",
  "Atividade pedagógica",
  "Outro bloco configurável",
];

/** Durações usuais como atalho; qualquer duração pode ser digitada. */
export const DRAFT_DURATION_PRESETS = [45, 50, 90] as const;

export const DRAFT_BLOCK_STATUSES: ScheduleBlock["status"][] = [
  "Planejado",
  "Requer revisão",
  "Sem distribuição",
];

export const EDITOR_CAPABILITIES = [
  "Visualizar",
  "Criar",
  "Editar",
  "Revisar",
  "Publicar",
  "Retificar",
] as const;

export const EDITOR_PUBLICATION_STEPS = [
  "Rascunho",
  "Revisão",
  "Publicação",
  "Nova versão",
  "Alterações pontuais",
  "Histórico",
] as const;

export const EDITOR_VERSION_CONFLICT_MESSAGE =
  "Esta grade foi alterada por outro usuário durante a operação (simulação demonstrativa).";
export const EDITOR_CONCLUSION_MESSAGE =
  "Grade demonstrativa preparada. Nenhum horário foi publicado ou persistido em banco de dados.";
export const EDITOR_PUBLISHED_WARNING =
  "Grade publicada: a alteração está sujeita às regras de alteração e versionamento da futura Etapa 10C. Nada é publicado nesta etapa.";
export const EDITOR_JOURNEY_NOTE =
  "A jornada é exibida apenas como referência. Alterar um bloco não altera a jornada declarada nem o Calendário Escolar.";
export const EDITOR_PRIVACY_NOTE =
  "Somente dados profissionais necessários. Sem CPF completo, filiação, endereço, dados de saúde ou bancários.";
export const EDITOR_AUTHORIZATION_NOTE =
  "Visualizar, criar, editar, revisar, publicar e retificar serão capacidades distintas. Nenhuma alçada municipal é definida sem documentação.";

/* ------------------------------------------------------------------ tempo */

export function minutesToTime(total: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function blockDuration(item: ScheduleBlock) {
  return Math.max(0, timeToMinutes(item.end) - timeToMinutes(item.start));
}

export function formatDuration(total: number) {
  if (total <= 0) return "0min";
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  if (!hour) return `${minute}min`;
  return minute ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
}

export function dayLabel(day: WeekDayId) {
  return WEEK_DAYS.find((item) => item.id === day)?.label ?? day;
}

/* ------------------------------------------------------- rascunho / edição */

export function createScheduleDraft(classId: string, mode: ScheduleDraftMode): ScheduleDraft | null {
  const klass = getDemonstrationClass(classId);
  if (!klass) return null;
  const journey = getJourneyForClass(classId);
  const existing = getScheduleForClass(classId);
  if (mode === "nova")
    return {
      classId,
      journeyId: journey?.id ?? null,
      originScheduleId: null,
      label: "Rascunho demonstrativo (primeira grade)",
      state: "Em elaboração",
      blocks: existing && existing.state === "Não iniciada" ? [] : [],
    };
  return {
    classId,
    journeyId: journey?.id ?? null,
    originScheduleId: existing?.id ?? null,
    label: existing ? `${existing.label} — rascunho demonstrativo` : "Rascunho demonstrativo",
    state: existing?.state ?? "Em elaboração",
    blocks: existing ? existing.blocks.map((item) => ({ ...item })) : [],
  };
}

export function isScheduleDraftDirty(draft: ScheduleDraft, initial: ScheduleDraft) {
  return JSON.stringify(draft.blocks) !== JSON.stringify(initial.blocks);
}

let sequence = 0;
function nextBlockId() {
  sequence += 1;
  return `draft-bl-${sequence}`;
}

export function addBlock(
  draft: ScheduleDraft,
  values: {
    day: WeekDayId;
    start: string;
    end: string;
    kind?: ScheduleBlockKind;
    label?: string;
    assignmentIds?: string[];
  },
): ScheduleDraft {
  const kind = values.kind ?? "Aula";
  const created: ScheduleBlock = {
    id: nextBlockId(),
    day: values.day,
    start: values.start,
    end: values.end,
    kind,
    label: values.label ?? (kind === "Intervalo" ? "Intervalo" : "Bloco sem componente definido"),
    assignmentIds: values.assignmentIds ?? [],
    status: "Planejado",
  };
  return { ...draft, blocks: [...draft.blocks, created] };
}

export function updateBlock(
  draft: ScheduleDraft,
  blockId: string,
  patch: Partial<Omit<ScheduleBlock, "id">>,
): ScheduleDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((item) => (item.id === blockId ? { ...item, ...patch } : item)),
  };
}

export function removeBlock(draft: ScheduleDraft, blockId: string): ScheduleDraft {
  return { ...draft, blocks: draft.blocks.filter((item) => item.id !== blockId) };
}

/** Reposicionar: mesmo bloco em outro dia e/ou outro horário, sem duplicar. */
export function repositionBlock(
  draft: ScheduleDraft,
  blockId: string,
  target: { day: WeekDayId; start: string },
): ScheduleDraft {
  const current = draft.blocks.find((item) => item.id === blockId);
  if (!current) return draft;
  const duration = blockDuration(current);
  return updateBlock(draft, blockId, {
    day: target.day,
    start: target.start,
    end: minutesToTime(timeToMinutes(target.start) + duration),
  });
}

export function duplicateBlock(draft: ScheduleDraft, blockId: string): ScheduleDraft {
  const current = draft.blocks.find((item) => item.id === blockId);
  if (!current) return draft;
  return {
    ...draft,
    blocks: [...draft.blocks, { ...current, id: nextBlockId() }],
  };
}

/* ----------------------------------------- componentes, campos e matrizes */

export type DraftFieldOption = {
  id: string;
  label: string;
  kind: PedagogicalFieldKind;
  helper: string;
};

/**
 * Componentes ou campos compatíveis com a matriz aplicável à turma.
 * A Educação Infantil não recebe disciplina convencional; a EJA usa a
 * estrutura das fases; turmas multisseriadas mantêm seus agrupamentos.
 */
export function matrixFieldOptions(classId: string): DraftFieldOption[] {
  const klass = getDemonstrationClass(classId);
  if (!klass) return [];
  const matrix = getCurriculumMatrix(klass.matrixId);
  if (!matrix) return [];
  const structure = matrix.structure;
  if (structure.kind === "experience-fields")
    return structure.fields.map((field) => ({
      id: field.id,
      label: field.label,
      kind: "Campo de experiência" as PedagogicalFieldKind,
      helper: `${structure.organizationLabel} — sem disciplina convencional.`,
    }));
  if (structure.kind === "grid")
    return structure.groups.flatMap((group) =>
      group.rows.map((row) => ({
        id: `${group.id}-${row.id}`,
        label: row.label,
        kind: (matrix.segment.startsWith("EJA")
          ? "Componente curricular"
          : "Componente curricular") as PedagogicalFieldKind,
        helper: `${structure.organizationLabel} — ${structure.rowsHeader.toLowerCase()}.`,
      })),
    );
  return structure.axes.map((axis) => ({
    id: axis.id,
    label: axis.label,
    kind: "Contexto sem componente definido" as PedagogicalFieldKind,
    helper: structure.description,
  }));
}

export function matrixReferenceLabel(classId: string) {
  const klass = getDemonstrationClass(classId);
  const matrix = klass ? getCurriculumMatrix(klass.matrixId) : undefined;
  if (!matrix) return "Matriz curricular não identificada";
  return `${matrix.name} · ${matrix.version} (${matrix.situation})`;
}

export function classGroupingLabels(klass: DemonstrationClass) {
  return klass.groupings.map((group) => `${group.label} · ${group.kind}`);
}

/* ---------------------------------------------- profissionais por atuação */

export type DraftAssignmentOption = {
  assignment: PedagogicalAssignmentRecord;
  professionalId: string;
  professionalName: string;
  sigemId: string;
  linkLabel: string;
  role: string;
  fieldLabel: string;
};

/** Candidatos vêm de Atuações Pedagógicas da turma — nunca de lotação. */
export function assignmentOptionsForClass(classId: string): DraftAssignmentOption[] {
  return pedagogicalAssignmentsForClass(classId).map((assignment) => {
    const professional = getDemonstrationProfessional(assignment.professionalId);
    const link = professional?.links.find((item) => item.id === assignment.linkId);
    return {
      assignment,
      professionalId: assignment.professionalId,
      professionalName: professional?.personName ?? "Profissional não identificado",
      sigemId: professional?.professionalId ?? assignment.professionalId,
      linkLabel: link
        ? `${link.employerContext} · ${link.cargo} (${link.status})`
        : "Vínculo funcional não identificado",
      role: assignment.role,
      fieldLabel: assignment.field ?? assignment.fieldKind,
    };
  });
}

export function assignmentOption(assignmentId: string): DraftAssignmentOption | undefined {
  const assignment = getPedagogicalAssignment(assignmentId);
  if (!assignment) return undefined;
  return assignmentOptionsForClass(assignment.classId).find(
    (item) => item.assignment.id === assignmentId,
  );
}

/**
 * Profissionais com contexto na unidade da turma, porém sem Atuação Pedagógica
 * compatível. O editor de horários não cria atuação: apenas aponta a pendência.
 */
export function professionalsPendingAssignment(classId: string) {
  const klass = getDemonstrationClass(classId);
  if (!klass) return [];
  const assigned = new Set(
    pedagogicalAssignmentsForClass(classId).map((item) => item.professionalId),
  );
  const rows: Array<{ professionalId: string; professionalName: string; detail: string }> = [];
  for (const assignment of demonstrationPedagogicalAssignments) {
    if (assigned.has(assignment.professionalId)) continue;
    const other = getDemonstrationClass(assignment.classId);
    if (!other || other.unitId !== klass.unitId) continue;
    if (rows.some((row) => row.professionalId === assignment.professionalId)) continue;
    const professional = getDemonstrationProfessional(assignment.professionalId);
    rows.push({
      professionalId: assignment.professionalId,
      professionalName: professional?.personName ?? assignment.professionalId,
      detail: `Possui contexto em ${getClassUnitName(klass.unitId)}, mas não há Atuação Pedagógica compatível com esta turma.`,
    });
  }
  return rows;
}

/* --------------------------------------------------- jornada de referência */

export function journeyDayFor(journey: SchoolJourney | undefined, day: WeekDayId) {
  return journey?.days.find((item) => item.day === day);
}

/** Bloco fora do funcionamento conhecido — alerta, nunca alteração da jornada. */
export function blockOutsideJourney(
  item: ScheduleBlock,
  journey: SchoolJourney | undefined,
): string | undefined {
  if (!journey) return undefined;
  const declared = journeyDayFor(journey, item.day);
  if (!declared)
    return `${dayLabel(item.day)} não consta no funcionamento declarado da jornada.`;
  if (
    timeToMinutes(item.start) < timeToMinutes(declared.start) ||
    timeToMinutes(item.end) > timeToMinutes(declared.end)
  )
    return `${item.start}–${item.end} ultrapassa o funcionamento declarado (${declared.start}–${declared.end}).`;
  return undefined;
}

/* ------------------------------------------------------- projeção e alertas */

/**
 * Projeção única: a grade da turma editada é substituída pelo rascunho em todas
 * as leituras (turma e profissional). Nenhuma cópia contraditória é criada.
 */
export function projectedBlocks(draft: ScheduleDraft) {
  const rows = scheduleVersions
    .filter((version) => version.classId !== draft.classId)
    .flatMap((version) =>
      version.blocks.map((item) => ({ classId: version.classId, scheduleId: version.id, block: item })),
    );
  return [
    ...rows,
    ...draft.blocks.map((item) => ({
      classId: draft.classId,
      scheduleId: draft.originScheduleId ?? "rascunho",
      block: item,
    })),
  ];
}

export type DraftAlert = {
  id: string;
  classification: ScheduleSituation;
  title: string;
  detail: string;
  blockIds: string[];
};

function overlap(a: ScheduleBlock, b: ScheduleBlock) {
  return (
    a.day === b.day &&
    timeToMinutes(a.start) < timeToMinutes(b.end) &&
    timeToMinutes(b.start) < timeToMinutes(a.end)
  );
}

/**
 * Conflitos temporais da mesma Pessoa em toda a rede: entre turmas, entre
 * vínculos, entre unidades e entre blocos da própria grade. A verificação nunca
 * se limita a uma matrícula funcional.
 */
export function draftConflicts(draft: ScheduleDraft): DraftAlert[] {
  const entries = projectedBlocks(draft).flatMap((row) =>
    row.block.assignmentIds
      .map((id) => getPedagogicalAssignment(id))
      .filter((item): item is PedagogicalAssignmentRecord => Boolean(item))
      .map((assignment) => ({ ...row, assignment })),
  );
  const alerts: DraftAlert[] = [];
  for (let left = 0; left < entries.length; left += 1)
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      if (!a || !b) continue;
      if (a.assignment.professionalId !== b.assignment.professionalId) continue;
      if (a.block.id === b.block.id) continue;
      if (!overlap(a.block, b.block)) continue;
      const sameClass = a.classId === b.classId;
      const professional = getDemonstrationProfessional(a.assignment.professionalId);
      const unitA = getDemonstrationClass(a.classId)?.unitId ?? "";
      const unitB = getDemonstrationClass(b.classId)?.unitId ?? "";
      alerts.push({
        id: `conf-${a.block.id}-${b.block.id}`,
        classification: "Conflito temporal potencial",
        title: sameClass
          ? "Sobreposição na própria grade"
          : unitA === unitB
            ? "Sobreposição entre turmas da mesma unidade"
            : "Sobreposição entre unidades da rede",
        detail: `${professional?.personName ?? "Profissional"} — ${dayLabel(a.block.day)}, ${a.block.start}–${a.block.end} e ${b.block.start}–${b.block.end}${
          sameClass
            ? " na mesma turma"
            : ` em ${getClassUnitName(unitA)} e ${getClassUnitName(unitB)}`
        }. Vínculos considerados: ${a.assignment.linkId} e ${b.assignment.linkId}. Requer validação; não constitui infração automática.`,
        blockIds: [a.block.id, b.block.id],
      });
    }
  return alerts;
}

/** Corresponsabilidade: profissionais distintos no mesmo bloco — não é conflito. */
export function coresponsibilityNotes(draft: ScheduleDraft): DraftAlert[] {
  return draft.blocks
    .filter((item) => {
      const people = new Set(
        item.assignmentIds
          .map((id) => getPedagogicalAssignment(id)?.professionalId)
          .filter(Boolean),
      );
      return people.size > 1;
    })
    .map((item) => ({
      id: `cores-${item.id}`,
      classification: "Situação sem conflito identificado" as ScheduleSituation,
      title: "Corresponsabilidade registrada",
      detail: `${dayLabel(item.day)} ${item.start}–${item.end}: mais de um profissional atua no mesmo bloco. Corresponsabilidade não é conflito nem substituição.`,
      blockIds: [item.id],
    }));
}

export function structuralAlerts(draft: ScheduleDraft): DraftAlert[] {
  const journey = draft.journeyId
    ? getJourneyForClass(draft.classId)
    : getJourneyForClass(draft.classId);
  const alerts: DraftAlert[] = [];
  for (const item of draft.blocks) {
    const outside = blockOutsideJourney(item, journey);
    if (outside)
      alerts.push({
        id: `jornada-${item.id}`,
        classification: "Incompatibilidade estrutural demonstrativa",
        title: "Bloco fora da jornada declarada",
        detail: `${outside} A jornada não é alterada automaticamente.`,
        blockIds: [item.id],
      });
    if (blockDuration(item) <= 0)
      alerts.push({
        id: `duracao-${item.id}`,
        classification: "Incompatibilidade estrutural demonstrativa",
        title: "Duração inválida",
        detail: `${dayLabel(item.day)} ${item.start}–${item.end}: o término não é posterior ao início.`,
        blockIds: [item.id],
      });
    if (item.kind === "Aula" && !item.assignmentIds.length)
      alerts.push({
        id: `sem-prof-${item.id}`,
        classification: "Informação insuficiente",
        title: "Bloco de aula sem profissional",
        detail: `${dayLabel(item.day)} ${item.start}–${item.end}: nenhuma Atuação Pedagógica foi selecionada. Intervalos não exigem profissional, aulas dependem de validação.`,
        blockIds: [item.id],
      });
    if (item.kind !== "Intervalo" && item.kind !== "Outro bloco configurável") {
      const options = matrixFieldOptions(draft.classId);
      if (options.length && !options.some((option) => item.label.includes(option.label)))
        alerts.push({
          id: `matriz-${item.id}`,
          classification: "Compatibilidade pendente de validação",
          title: "Componente ou campo não confirmado na matriz",
          detail: `“${item.label}” não corresponde diretamente a um elemento da matriz aplicável. Compatibilidade requer validação; a matriz não é alterada aqui.`,
          blockIds: [item.id],
        });
    }
  }
  return alerts;
}

export function draftAlerts(draft: ScheduleDraft): DraftAlert[] {
  return [...draftConflicts(draft), ...structuralAlerts(draft)];
}

export function draftSituation(draft: ScheduleDraft): ScheduleSituation {
  const alerts = draftAlerts(draft);
  if (!draft.blocks.length) return "Informação insuficiente";
  const order: ScheduleSituation[] = [
    "Conflito temporal potencial",
    "Incompatibilidade estrutural demonstrativa",
    "Compatibilidade pendente de validação",
    "Informação insuficiente",
  ];
  for (const classification of order)
    if (alerts.some((alert) => alert.classification === classification)) return classification;
  return "Situação sem conflito identificado";
}

/* -------------------------------------------------------- carga planejada */

export type PlannedLoad = {
  byField: Array<{ label: string; minutes: number; blocks: number }>;
  totalMinutes: number;
  teachingMinutes: number;
  intervalMinutes: number;
  undistributed: number;
  journeyMinutes: number | null;
  divergences: string[];
};

export function plannedLoad(draft: ScheduleDraft): PlannedLoad {
  const journey = getJourneyForClass(draft.classId);
  const byField = new Map<string, { minutes: number; blocks: number }>();
  let totalMinutes = 0;
  let intervalMinutes = 0;
  for (const item of draft.blocks) {
    const duration = blockDuration(item);
    totalMinutes += duration;
    if (item.kind === "Intervalo") {
      intervalMinutes += duration;
      continue;
    }
    const current = byField.get(item.label) ?? { minutes: 0, blocks: 0 };
    byField.set(item.label, { minutes: current.minutes + duration, blocks: current.blocks + 1 });
  }
  const journeyMinutes = journey
    ? journey.days.reduce(
        (total, day) =>
          total +
          Math.max(0, timeToMinutes(day.end) - timeToMinutes(day.start)) -
          day.intervals.reduce(
            (sum, interval) =>
              sum + Math.max(0, timeToMinutes(interval.end) - timeToMinutes(interval.start)),
            0,
          ),
        0,
      )
    : null;
  const teachingMinutes = totalMinutes - intervalMinutes;
  const divergences: string[] = [];
  if (journeyMinutes !== null && teachingMinutes < journeyMinutes)
    divergences.push(
      `Restam ${formatDuration(journeyMinutes - teachingMinutes)} do funcionamento declarado sem distribuição. Nenhum cumprimento normativo é declarado.`,
    );
  if (journeyMinutes !== null && teachingMinutes > journeyMinutes)
    divergences.push(
      `O planejamento excede em ${formatDuration(teachingMinutes - journeyMinutes)} o funcionamento declarado. Divergência requer validação.`,
    );
  const daysWithoutBlocks = (journey?.days ?? []).filter(
    (day) => !draft.blocks.some((item) => item.day === day.day),
  );
  if (daysWithoutBlocks.length)
    divergences.push(
      `Dias sem distribuição: ${daysWithoutBlocks.map((day) => dayLabel(day.day)).join("; ")}.`,
    );
  return {
    byField: [...byField.entries()]
      .map(([label, value]) => ({ label, ...value }))
      .sort((a, b) => b.minutes - a.minutes),
    totalMinutes,
    teachingMinutes,
    intervalMinutes,
    undistributed: draft.blocks.filter((item) => item.status === "Sem distribuição").length,
    journeyMinutes,
    divergences,
  };
}

/* ------------------------------------------------------------- pré-condições */

export type EditorPrecondition = {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
};

export function editorPreconditions(classId: string): EditorPrecondition[] {
  const klass = getDemonstrationClass(classId);
  const journey = getJourneyForClass(classId);
  return [
    {
      id: "turma",
      ok: Boolean(klass),
      label: "Turma existente",
      detail: klass
        ? `${klass.name} (${klass.code})`
        : "Turma não localizada; nenhuma turma é criada pelo editor.",
    },
    {
      id: "unidade",
      ok: Boolean(klass?.unitId),
      label: "Unidade conhecida",
      detail: klass ? getClassUnitName(klass.unitId) : "Unidade não identificada.",
    },
    {
      id: "periodo",
      ok: Boolean(klass?.academicPeriod.label),
      label: "Período letivo conhecido",
      detail: klass?.academicPeriod.label ?? "Período letivo não identificado.",
    },
    {
      id: "jornada",
      ok: Boolean(journey),
      label: "Jornada disponível",
      detail: journey
        ? `${journey.shift} · vigência desde ${journey.effectiveFrom}`
        : "Pendência: jornada não declarada. Nenhuma jornada é criada silenciosamente pelo editor.",
    },
  ];
}

/* ----------------------------------------------------------------- cenários */

export const editorScenarios = [
  ["A", "Primeira grade a partir de jornada existente", "tur-007"],
  ["B", "Grade parcialmente preenchida", "tur-003"],
  ["C", "Grade completa", "tur-001"],
  ["D", "Blocos com durações diferentes", "grd-001-v2"],
  ["E", "Jornada com dias variáveis", "jor-003"],
  ["F", "Educação Infantil sem disciplina convencional", "tur-002"],
  ["G", "Ensino Fundamental — anos iniciais", "tur-001"],
  ["H", "Ensino Fundamental — anos finais", "tur-005"],
  ["I", "EJA por fases", "tur-004"],
  ["J", "Turma multisseriada/multietapa", "tur-009"],
  ["K", "Múltiplos profissionais no mesmo bloco", "bl-001"],
  ["L", "Profissional em duas escolas", "pro-003"],
  ["M", "Profissional com dois vínculos", "pro-008"],
  ["N", "Conflito temporal potencial", "bl-022,bl-050"],
  ["O", "Corresponsabilidade", "atp-004"],
  ["P", "Profissional sem atuação compatível", "tur-001"],
  ["Q", "Bloco fora da jornada declarada", "tur-002"],
  ["R", "Intervalo sem componente e sem profissional", "bl-003"],
  ["S", "Divergência de carga planejada", "tur-003"],
  ["T", "Rascunho com alterações não salvas", "tur-003"],
] as const;
