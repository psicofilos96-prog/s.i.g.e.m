/**
 * INTEGRAÇÃO DOS HORÁRIOS ESCOLARES — fonte única de projeção (Etapa 10D).
 *
 * Esta camada consolida as projeções usadas pelas visões de turma, profissional,
 * unidade, revisão, comparação, histórico e impressão. Regras preservadas:
 * - A versão apresentada é a EFETIVA para a data de referência; a versão mais
 *   recente não é confundida com a vigente.
 * - Versões históricas são lidas no próprio retrato (snapshot), nunca
 *   reconstruídas com dados atuais.
 * - Retificações são aplicadas somente a partir da respectiva data de efeito.
 * - Conflitos operam sobre a identidade da PESSOA, em toda a rede, inclusive na
 *   mesma grade; corresponsabilidade no mesmo bloco nunca é conflito.
 * - Profissionais são referenciados por Atuação Pedagógica e vínculo explícito;
 *   lotação, cargo ou função não inferem docência.
 * - A jornada permanece independente: nenhum bloco é gerado a partir dela.
 * - O calendário escolar permanece independente: nenhum bloco planejado é
 *   convertido em aula ministrada.
 */
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import {
  getPedagogicalAssignment,
  type PedagogicalAssignmentRecord,
} from "@/features/pedagogical/pedagogical-data";
import {
  demonstrationProfessionals,
  getDemonstrationProfessional,
} from "@/features/professionals/professionals-data";
import {
  LIFECYCLE_REFERENCE_DATE,
  effectiveBlocksFor,
  effectiveVersionFor,
  scheduleVersionRecords,
  versionsForClass,
  type ScheduleVersionRecord,
} from "./schedule-lifecycle";
import {
  SCHEDULE_REFERENCE_DATE,
  WEEK_DAYS,
  getJourneyForClass,
  timeToMinutes,
  type ScheduleBlock,
  type ScheduleSituation,
  type ScheduleVersion,
} from "./schedules-data";

/** Data de referência única do módulo (10A, 10B, 10C e 10D). */
export const SCHEDULE_INTEGRATION_REFERENCE_DATE = LIFECYCLE_REFERENCE_DATE;

/** As camadas 10A e 10C compartilham a mesma data de referência demonstrativa. */
export const SCHEDULE_REFERENCE_DATES_ALIGNED =
  SCHEDULE_REFERENCE_DATE === LIFECYCLE_REFERENCE_DATE;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza a data de referência da consulta; valores inválidos não são presumidos. */
export function normalizeReferenceDate(value?: string | null): string {
  return value && ISO_DATE.test(value) ? value : SCHEDULE_INTEGRATION_REFERENCE_DATE;
}

/** Search param de data de referência: omitido quando igual ao padrão. */
export function referenceSearch(date: string): { data?: string } {
  return date === SCHEDULE_INTEGRATION_REFERENCE_DATE ? {} : { data: date };
}

export type ProjectionSource =
  | "Versão vigente na data de referência"
  | "Versão em elaboração (não vigente)"
  | "Sem distribuição registrada";

export type ClassProjection = {
  referenceDate: string;
  classId: string;
  klass: ReturnType<typeof getDemonstrationClass>;
  unitId: string;
  unitName: string;
  periodLabel: string;
  matrixId?: string;
  matrixContextLabel?: string;
  matrixContextPeriod?: string;
  journey: ReturnType<typeof getJourneyForClass>;
  /** Versão efetiva na data; ausente quando nenhuma versão está vigente. */
  effective?: ScheduleVersionRecord;
  /** Versão mais recente registrada; nunca apresentada como vigente. */
  latest?: ScheduleVersionRecord;
  /** Versão exibida (efetiva ou, na ausência, a mais recente em elaboração). */
  displayed?: ScheduleVersionRecord;
  /** Versões com vigência futura, mantidas separadas da vigente. */
  future: ScheduleVersionRecord[];
  blocks: ScheduleBlock[];
  source: ProjectionSource;
  /** Versões históricas ou substituídas são somente leitura. */
  readOnly: boolean;
  situation: ScheduleSituation;
  /** Estrutura compatível com a visão semanal, derivada da versão exibida. */
  weekView: ScheduleVersion;
};

function blocksOfRecord(record: ScheduleVersionRecord | undefined, date: string): ScheduleBlock[] {
  if (!record) return [];
  let blocks = record.blocks.map((item) => ({ ...item }));
  for (const rectification of record.rectifications) {
    if (!rectification.effectFrom || rectification.effectFrom > date) continue;
    blocks = blocks.map((item) =>
      item.id === rectification.after.id ? { ...rectification.after } : item,
    );
  }
  return blocks;
}

/** Retificações ainda não em efeito na data de referência. */
export function pendingRectifications(classId: string, date = SCHEDULE_INTEGRATION_REFERENCE_DATE) {
  return versionsForClass(classId).flatMap((record) =>
    record.rectifications.filter((item) => item.effectFrom && item.effectFrom > date),
  );
}

/** Projeção base, sem situação: evita recursão com a apuração de conflitos. */
function baseProjection(
  classId: string,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
): Omit<ClassProjection, "situation"> {
  const date = normalizeReferenceDate(referenceDate);
  const klass = getDemonstrationClass(classId);
  const records = versionsForClass(classId);
  const effective = effectiveVersionFor(classId, date);
  const latest = records[records.length - 1];
  const future = records.filter((item) => item.effectiveFrom > date && item.state !== "Histórica");
  const displayed = effective ?? (latest && latest.blocks.length ? latest : undefined);
  const blocks = effective ? effectiveBlocksFor(classId, date) : blocksOfRecord(displayed, date);
  const source: ProjectionSource = effective
    ? "Versão vigente na data de referência"
    : displayed
      ? "Versão em elaboração (não vigente)"
      : "Sem distribuição registrada";
  const readOnly = displayed
    ? displayed.state === "Histórica" || displayed.state === "Substituída"
    : false;
  const weekView: ScheduleVersion = {
    id: displayed?.id ?? `${classId}-sem-versao`,
    classId,
    journeyId: getJourneyForClass(classId)?.id ?? "",
    label: displayed?.version ?? "Sem versão",
    state: displayed?.state === "Substituída" ? "Substituída por nova versão" : "Em elaboração",
    effectiveFrom: displayed?.effectiveFrom ?? "",
    ...(displayed?.effectiveUntil ? { effectiveUntil: displayed.effectiveUntil } : {}),
    referenceDate: date,
    blocks,
    history: [],
  };
  return {
    referenceDate: date,
    classId,
    klass,
    unitId: klass?.unitId ?? "",
    unitName: klass ? getClassUnitName(klass.unitId) : "Unidade não identificada",
    periodLabel: klass?.academicPeriod.label ?? "Período letivo não identificado",
    ...(klass?.matrixId ? { matrixId: klass.matrixId } : {}),
    ...(klass?.matrixContextLabel ? { matrixContextLabel: klass.matrixContextLabel } : {}),
    ...(klass?.matrixContextPeriod ? { matrixContextPeriod: klass.matrixContextPeriod } : {}),
    journey: getJourneyForClass(classId),
    ...(effective ? { effective } : {}),
    ...(latest ? { latest } : {}),
    ...(displayed ? { displayed } : {}),
    future,
    blocks,
    source,
    readOnly,
    weekView,
  };
}

export function classProjection(
  classId: string,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
): ClassProjection {
  const base = baseProjection(classId, referenceDate);
  return {
    ...base,
    situation: projectionSituation(
      classId,
      base.blocks,
      base.referenceDate,
      Boolean(base.displayed),
    ),
  };
}

export function unitProjection(
  unitId: string,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
) {
  const date = normalizeReferenceDate(referenceDate);
  return scheduleVersionRecords
    .filter((record) => record.unitId === unitId)
    .map((record) => record.classId)
    .filter((id, index, all) => all.indexOf(id) === index)
    .map((id) => classProjection(id, date));
}

/* ------------------------------------------------------- identidade da Pessoa */

export function personOfProfessional(professionalId: string) {
  const professional = getDemonstrationProfessional(professionalId);
  return professional
    ? { personId: professional.personId, personName: professional.personName }
    : undefined;
}

export function professionalsOfPerson(personId: string) {
  return demonstrationProfessionals.filter((item) => item.personId === personId);
}

/** A atuação está vigente na data? Substituições fora da vigência não valem. */
export function assignmentInVigency(
  assignment: PedagogicalAssignmentRecord,
  date = SCHEDULE_INTEGRATION_REFERENCE_DATE,
) {
  if (assignment.start && assignment.start > date) return false;
  if (assignment.end && assignment.end < date) return false;
  return true;
}

export type ProjectionEntry = {
  classId: string;
  className: string;
  unitId: string;
  unitName: string;
  periodLabel: string;
  versionId: string;
  versionLabel: string;
  versionState: string;
  block: ScheduleBlock;
  assignment: PedagogicalAssignmentRecord;
  professionalId: string;
  personId: string;
  personName: string;
  linkId: string;
  inVigency: boolean;
};

/** Todos os blocos projetados da rede, por atuação, na data de referência. */
export function networkProjectionEntries(
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
): ProjectionEntry[] {
  const date = normalizeReferenceDate(referenceDate);
  const classIds = scheduleVersionRecords
    .map((record) => record.classId)
    .filter((id, index, all) => all.indexOf(id) === index);
  const entries: ProjectionEntry[] = [];
  for (const classId of classIds) {
    const projection = baseProjection(classId, date);
    for (const block of projection.blocks)
      for (const assignmentId of block.assignmentIds) {
        const assignment = getPedagogicalAssignment(assignmentId);
        if (!assignment) continue;
        const person = personOfProfessional(assignment.professionalId);
        entries.push({
          classId,
          className: projection.klass?.name ?? classId,
          unitId: projection.unitId,
          unitName: projection.unitName,
          periodLabel: projection.periodLabel,
          versionId: projection.displayed?.id ?? "",
          versionLabel: projection.displayed?.version ?? "Sem versão",
          versionState: projection.displayed?.state ?? "Não iniciada",
          block,
          assignment,
          professionalId: assignment.professionalId,
          personId: person?.personId ?? assignment.professionalId,
          personName: person?.personName ?? "Profissional não identificado",
          linkId: assignment.linkId,
          inVigency: assignmentInVigency(assignment, date),
        });
      }
  }
  return entries;
}

export type PersonProjection = {
  referenceDate: string;
  personId: string;
  personName: string;
  /** Vínculos funcionais distintos representados nos blocos. */
  linkIds: string[];
  professionalIds: string[];
  unitIds: string[];
  entries: ProjectionEntry[];
  /** Atuações fora da vigência: nunca projetadas como aula na data. */
  outOfVigency: ProjectionEntry[];
  groups: Array<{
    classId: string;
    className: string;
    unitId: string;
    unitName: string;
    versionLabel: string;
    linkIds: string[];
    blocks: ScheduleBlock[];
    weekView: ScheduleVersion;
  }>;
  conflicts: PersonConflict[];
};

/** Visão consolidada por PESSOA, preservando a identificação de cada vínculo. */
export function personProjection(
  professionalOrPersonId: string,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
): PersonProjection {
  const date = normalizeReferenceDate(referenceDate);
  const person =
    personOfProfessional(professionalOrPersonId) ??
    (professionalsOfPerson(professionalOrPersonId)[0]
      ? {
          personId: professionalOrPersonId,
          personName: professionalsOfPerson(professionalOrPersonId)[0]?.personName ?? "",
        }
      : undefined);
  const personId = person?.personId ?? professionalOrPersonId;
  const all = networkProjectionEntries(date).filter((entry) => entry.personId === personId);
  const entries = all.filter((entry) => entry.inVigency);
  const outOfVigency = all.filter((entry) => !entry.inVigency);
  const classIds = entries.map((entry) => entry.classId).filter((id, i, a) => a.indexOf(id) === i);
  const groups = classIds.map((classId) => {
    const projection = classProjection(classId, date);
    const own = entries.filter((entry) => entry.classId === classId);
    const blocks = own
      .map((entry) => entry.block)
      .filter((block, index, list) => list.findIndex((item) => item.id === block.id) === index);
    return {
      classId,
      className: projection.klass?.name ?? classId,
      unitId: projection.unitId,
      unitName: projection.unitName,
      versionLabel: projection.displayed?.version ?? "Sem versão",
      linkIds: own.map((entry) => entry.linkId).filter((id, i, a) => a.indexOf(id) === i),
      blocks,
      weekView: { ...projection.weekView, blocks },
    };
  });
  return {
    referenceDate: date,
    personId,
    personName: person?.personName ?? "Pessoa não identificada",
    linkIds: all.map((entry) => entry.linkId).filter((id, i, a) => a.indexOf(id) === i),
    professionalIds: all
      .map((entry) => entry.professionalId)
      .filter((id, i, a) => a.indexOf(id) === i),
    unitIds: entries.map((entry) => entry.unitId).filter((id, i, a) => a.indexOf(id) === i),
    entries,
    outOfVigency,
    groups,
    conflicts: identityConflicts(date).filter((conflict) => conflict.personId === personId),
  };
}

/* ------------------------------------------------------------- conflitos */

export type PersonConflict = {
  id: string;
  personId: string;
  personName: string;
  professionalIds: string[];
  linkIds: string[];
  classIds: string[];
  unitIds: string[];
  blockIds: string[];
  scope: "Mesma turma" | "Mesma unidade" | "Unidades distintas";
  explanation: string;
};

function overlaps(a: ScheduleBlock, b: ScheduleBlock) {
  return (
    a.day === b.day &&
    timeToMinutes(a.start) < timeToMinutes(b.end) &&
    timeToMinutes(b.start) < timeToMinutes(a.end)
  );
}

function dayName(day: ScheduleBlock["day"]) {
  return WEEK_DAYS.find((item) => item.id === day)?.label ?? day;
}

/**
 * Conflitos pela identidade da Pessoa, considerando turmas, vínculos, unidades e
 * blocos da mesma grade. Dois profissionais no mesmo bloco (corresponsabilidade)
 * não geram conflito.
 */
export function identityConflicts(
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
): PersonConflict[] {
  const entries = networkProjectionEntries(referenceDate).filter((entry) => entry.inVigency);
  const conflicts: PersonConflict[] = [];
  const seen = new Set<string>();
  for (let left = 0; left < entries.length; left += 1)
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      if (!a || !b) continue;
      if (a.personId !== b.personId) continue;
      if (a.block.id === b.block.id) continue;
      if (!overlaps(a.block, b.block)) continue;
      const key = [a.personId, ...[a.block.id, b.block.id].sort()].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const scope =
        a.classId === b.classId
          ? "Mesma turma"
          : a.unitId === b.unitId
            ? "Mesma unidade"
            : "Unidades distintas";
      const where =
        scope === "Mesma turma"
          ? `na mesma turma (${a.className})`
          : scope === "Mesma unidade"
            ? `na mesma unidade (${a.unitName}), turmas ${a.className} e ${b.className}`
            : `em ${a.unitName} e ${b.unitName}`;
      conflicts.push({
        id: `conf-${a.block.id}-${b.block.id}`,
        personId: a.personId,
        personName: a.personName,
        professionalIds: [a.professionalId, b.professionalId].filter(
          (id, i, list) => list.indexOf(id) === i,
        ),
        linkIds: [a.linkId, b.linkId].filter((id, i, list) => list.indexOf(id) === i),
        classIds: [a.classId, b.classId].filter((id, i, list) => list.indexOf(id) === i),
        unitIds: [a.unitId, b.unitId].filter((id, i, list) => list.indexOf(id) === i),
        blockIds: [a.block.id, b.block.id],
        scope,
        explanation: `${a.personName} — ${dayName(a.block.day)}, ${a.block.start}–${a.block.end} e ${b.block.start}–${b.block.end} ${where}. Vínculos considerados: ${[a.linkId, b.linkId].filter((id, i, list) => list.indexOf(id) === i).join(" e ")}. Conflito temporal potencial; requer validação e não constitui infração automática.`,
      });
    }
  return conflicts;
}

export function conflictsForClass(classId: string, referenceDate?: string) {
  return identityConflicts(referenceDate).filter((item) => item.classIds.includes(classId));
}

export function conflictsForUnit(unitId: string, referenceDate?: string) {
  return identityConflicts(referenceDate).filter((item) => item.unitIds.includes(unitId));
}

/** Blocos com mais de uma Pessoa: corresponsabilidade legítima, nunca conflito. */
export function coresponsibilityBlocksOf(blocks: ScheduleBlock[]) {
  return blocks.filter((block) => {
    const people = block.assignmentIds
      .map((id) => getPedagogicalAssignment(id))
      .map((assignment) =>
        assignment ? personOfProfessional(assignment.professionalId)?.personId : undefined,
      )
      .filter((id): id is string => Boolean(id));
    return new Set(people).size > 1;
  });
}

function projectionSituation(
  classId: string,
  blocks: ScheduleBlock[],
  date: string,
  hasVersion: boolean,
): ScheduleSituation {
  if (!hasVersion) return "Informação insuficiente";
  if (conflictsForClass(classId, date).length) return "Conflito temporal potencial";
  if (blocks.some((item) => item.status === "Requer revisão"))
    return "Compatibilidade pendente de validação";
  if (blocks.some((item) => item.status === "Sem distribuição")) return "Informação insuficiente";
  return "Situação sem conflito identificado";
}

/* ------------------------------------------------------------- auditoria */

/** Auditoria de integração: identidades, vigências simultâneas e referências. */
export function integrationConsistencyIssues() {
  const issues: string[] = [];
  if (!SCHEDULE_REFERENCE_DATES_ALIGNED)
    issues.push("Datas de referência divergentes entre as camadas de horários.");
  const classIds = scheduleVersionRecords
    .map((record) => record.classId)
    .filter((id, index, all) => all.indexOf(id) === index);
  for (const classId of classIds) {
    if (!getDemonstrationClass(classId))
      issues.push(`Versão de grade referencia turma inexistente: ${classId}.`);
    const publishedRanges = versionsForClass(classId).filter(
      (record) => record.state === "Publicada",
    );
    for (let left = 0; left < publishedRanges.length; left += 1)
      for (let right = left + 1; right < publishedRanges.length; right += 1) {
        const a = publishedRanges[left];
        const b = publishedRanges[right];
        if (!a || !b) continue;
        const aEnd = a.effectiveUntil ?? "9999-12-31";
        const bEnd = b.effectiveUntil ?? "9999-12-31";
        if (a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd)
          issues.push(
            `Duas versões publicadas com vigência simultânea na turma ${classId}: ${a.id} e ${b.id}.`,
          );
      }
  }
  for (const record of scheduleVersionRecords)
    for (const block of record.blocks)
      for (const assignmentId of block.assignmentIds) {
        const assignment = getPedagogicalAssignment(assignmentId);
        if (!assignment)
          issues.push(`Bloco ${block.id} referencia atuação inexistente: ${assignmentId}.`);
        else if (assignment.classId !== record.classId)
          issues.push(`Bloco ${block.id} contradiz a turma da atuação ${assignmentId}.`);
        else if (!assignment.linkId)
          issues.push(`Atuação ${assignmentId} sem vínculo funcional explícito.`);
      }
  return issues;
}

export const INTEGRATION_SOURCE_NOTE =
  "Turma, profissional, unidade, revisão, comparação, histórico e impressão utilizam a mesma projeção: versão efetiva na data de referência, com retificações já em efeito.";
export const INTEGRATION_IDENTITY_NOTE =
  "Blocos são associados por identificadores canônicos de turma, período, matriz, Atuação Pedagógica e vínculo funcional — nunca apenas pelo nome do profissional ou da turma.";
export const INTEGRATION_CALENDAR_NOTE =
  "O Calendário Escolar permanece a fonte dos dias letivos e eventos. A grade semanal não reescreve o calendário e blocos planejados não se tornam aulas ministradas.";
export const INTEGRATION_HISTORY_NOTE =
  "Versões históricas são lidas no próprio retrato demonstrativo e não aceitam edição direta.";
