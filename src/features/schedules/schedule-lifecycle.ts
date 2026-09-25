/**
 * CICLO DE VIDA DAS GRADES ESCOLARES — modelo demonstrativo (Etapa 10C).
 *
 * Fronteiras conceituais preservadas:
 * - Jornada Escolar ≠ Grade Semanal ≠ Calendário Escolar ≠ Atuação Pedagógica ≠
 *   Horário Individual ≠ Aula efetivamente ministrada.
 * - Alterar uma grade não altera calendário, jornada nem registro de aulas.
 * - Nenhuma grade é oficialmente publicada: todos os estados, autorias,
 *   referências de operação e documentos são demonstrativos.
 * - Versões anteriores nunca são sobrescritas: cada versão possui o próprio
 *   retrato de blocos e não é reconstruída com dados atuais.
 * - Nenhuma alçada municipal é inventada; a classificação final de uma
 *   alteração permanece configurável e sujeita a decisão institucional.
 */
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  getPedagogicalAssignment,
  type PedagogicalAssignmentRecord,
} from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { blockDuration, dayLabel, formatDuration } from "./schedule-draft";
import {
  getJourneyForClass,
  getScheduleForClass,
  scheduleVersions,
  timeToMinutes,
  type ScheduleBlock,
  type ScheduleSituation,
} from "./schedules-data";

/* -------------------------------------------------------------- taxonomias */

/** Estado da GRADE — distinto do estado de uma solicitação de alteração. */
export type ScheduleLifecycleState =
  | "Não iniciada"
  | "Em elaboração"
  | "Pronta para revisão"
  | "Em revisão"
  | "Revisão devolvida"
  | "Preparada para publicação"
  | "Publicada"
  | "Substituída"
  | "Histórica";

export const SCHEDULE_LIFECYCLE_STATES: ScheduleLifecycleState[] = [
  "Não iniciada",
  "Em elaboração",
  "Pronta para revisão",
  "Em revisão",
  "Revisão devolvida",
  "Preparada para publicação",
  "Publicada",
  "Substituída",
  "Histórica",
];

/** Estado da SOLICITAÇÃO — nunca confundido com o estado da grade. */
export type ChangeRequestState =
  | "Solicitação em preparação"
  | "Em análise"
  | "Correção solicitada"
  | "Devolvida para elaboração"
  | "Preparada para publicação"
  | "Preparada como retificação"
  | "Preparada como nova versão"
  | "Classificação pendente";

export const CHANGE_REQUEST_STATES: ChangeRequestState[] = [
  "Solicitação em preparação",
  "Em análise",
  "Correção solicitada",
  "Devolvida para elaboração",
  "Preparada para publicação",
  "Preparada como retificação",
  "Preparada como nova versão",
  "Classificação pendente",
];

/** Classificação de alteração; a decisão final é institucional. */
export type ChangeKind =
  | "Correção administrativa"
  | "Ajuste pontual"
  | "Alteração recorrente"
  | "Mudança estrutural"
  | "Classificação pendente";

export const CHANGE_KINDS: ChangeKind[] = [
  "Correção administrativa",
  "Ajuste pontual",
  "Alteração recorrente",
  "Mudança estrutural",
  "Classificação pendente",
];

/** Capacidades futuras distintas; nenhuma alçada é atribuída aqui. */
export const LIFECYCLE_CAPABILITIES = [
  "Visualizar",
  "Elaborar",
  "Revisar",
  "Solicitar alteração",
  "Autorizar alteração",
  "Preparar publicação",
  "Publicar",
  "Consultar histórico",
  "Retificar",
] as const;

export type LifecycleOperationalState =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "notFound"
  | "permission"
  | "insufficient"
  | "versionConflict"
  | "unavailable";

export const LIFECYCLE_OPERATIONAL_STATES: Array<{
  id: LifecycleOperationalState;
  label: string;
  detail: string;
}> = [
  { id: "ready", label: "Disponível", detail: "Consulta demonstrativa disponível." },
  { id: "loading", label: "Carregando", detail: "Consulta demonstrativa em carregamento." },
  { id: "empty", label: "Sem registros", detail: "Nenhum registro demonstrativo encontrado." },
  { id: "error", label: "Erro", detail: "Não foi possível carregar os registros demonstrativos." },
  {
    id: "notFound",
    label: "Não encontrado",
    detail: "O identificador não corresponde aos registros fictícios.",
  },
  {
    id: "permission",
    label: "Acesso negado",
    detail:
      "A consulta de horários de toda a rede não é presumida para todos os perfis. Autorização será definida por capacidade, unidade e finalidade.",
  },
  {
    id: "insufficient",
    label: "Informação insuficiente",
    detail: "Faltam informações para concluir a análise; nenhuma ausência de impacto é declarada.",
  },
  {
    id: "versionConflict",
    label: "Conflito de versão",
    detail:
      "Esta grade foi alterada por outro usuário durante a operação (simulação demonstrativa).",
  },
  {
    id: "unavailable",
    label: "Operação indisponível",
    detail: "A operação depende de regras institucionais ainda não documentadas.",
  },
];

export const LIFECYCLE_PUBLICATION_MESSAGE =
  "Preparação de publicação demonstrativa concluída. Nenhuma grade foi publicada oficialmente e nada foi gravado em banco de dados.";
export const LIFECYCLE_REVIEW_MESSAGE =
  "Decisão de revisão registrada apenas nesta simulação. Nenhuma aprovação administrativa real ocorreu.";
export const LIFECYCLE_CHANGE_MESSAGE =
  "Proposta de alteração demonstrativa preparada. A grade de origem permanece inalterada.";
export const LIFECYCLE_REVIEWER_NOTE =
  "O responsável pela revisão varia por unidade, etapa e tipo de alteração. Não se presume que o revisor seja sempre a SEMED.";
export const LIFECYCLE_CLASSIFICATION_NOTE =
  "Quais alterações dispensam nova versão é decisão institucional. A classificação permanece configurável e nenhum limite normativo é inventado.";
export const LIFECYCLE_PRIVACY_NOTE =
  "Somente dados profissionais necessários. Sem CPF completo, filiação, endereço, dados de saúde ou bancários.";
export const LIFECYCLE_AUTHORIZATION_NOTE =
  "Visualizar, elaborar, revisar, solicitar alteração, autorizar alteração, preparar publicação, publicar, consultar histórico e retificar serão capacidades distintas.";
export const LIFECYCLE_DOCUMENT_NOTE =
  "Documento demonstrativo — não oficial. A emissão oficial depende de backend e autorização.";
export const LIFECYCLE_REFERENCE_NOTE =
  "A versão apresentada é a efetiva para a data de referência. Uma versão futura não é apresentada como vigente hoje.";

/* ----------------------------------------------------------------- registro */

export type Rectification = {
  id: string;
  versionId: string;
  kind: ChangeKind;
  /** Data de efeito; não confundida com elaboração ou publicação. */
  effectFrom: string;
  author: string;
  justification: string;
  operationReference: string;
  before: ScheduleBlock;
  after: ScheduleBlock;
};

export type ScheduleVersionRecord = {
  id: string;
  classId: string;
  unitId: string;
  periodLabel: string;
  version: string;
  state: ScheduleLifecycleState;
  /** Vigência declarada; não se presume início no primeiro dia do período. */
  effectiveFrom: string;
  effectiveUntil?: string;
  preparedOn: string;
  publishedOn?: string;
  operationReference: string;
  author: string;
  nature: string;
  justification: string;
  /** Retrato próprio da versão; nunca reconstruído com dados atuais. */
  blocks: ScheduleBlock[];
  /** Retificações rastreadas sem criar nova versão principal. */
  rectifications: Rectification[];
  /** Campos historicamente incompletos, identificados explicitamente. */
  incompleteFields?: string[];
  supersededBy?: string;
};

function snapshot(classId: string) {
  return (getScheduleForClass(classId)?.blocks ?? []).map((item) => ({ ...item }));
}

function patch(
  blocks: ScheduleBlock[],
  changes: Record<string, Partial<ScheduleBlock> | null>,
  extra: ScheduleBlock[] = [],
) {
  const result: ScheduleBlock[] = [];
  for (const item of blocks) {
    const change = changes[item.id];
    if (change === null) continue;
    result.push(change ? { ...item, ...change } : { ...item });
  }
  return [...result, ...extra.map((item) => ({ ...item }))];
}

const AUTHOR_UNIT = "Equipe demonstrativa da unidade (perfil funcional fictício)";
const AUTHOR_NETWORK = "Equipe demonstrativa da rede (perfil funcional fictício)";

const tur001Base = snapshot("tur-001");

/** Versão 1 de tur-001: retrato próprio, preservado integralmente. */
const tur001V1: ScheduleBlock[] = patch(tur001Base, {
  "bl-002": { label: "Componente curricular demonstrativo — Matemática" },
  "bl-004": { end: "10:20" },
  "bl-005": { start: "08:10", end: "09:20" },
  "bl-007": { assignmentIds: ["atp-001"], status: "Planejado" },
  "bl-008": null,
});

/** Retrato da versão 2 antes da retificação demonstrativa. */
const tur001V2: ScheduleBlock[] = patch(tur001Base, { "bl-004": { end: "10:20" } });

const tur001V3: ScheduleBlock[] = patch(tur001V2, { "bl-006": { start: "08:10", end: "09:00" } }, [
  {
    id: "bl-009",
    day: "fri",
    start: "07:20",
    end: "08:10",
    kind: "Oficina",
    label: "Oficina demonstrativa de leitura",
    assignmentIds: ["atp-001"],
    status: "Planejado",
  },
]);

function fromScheduleVersion(
  id: string,
  classId: string,
  state: ScheduleLifecycleState,
  extra: Partial<ScheduleVersionRecord> = {},
): ScheduleVersionRecord {
  const source = scheduleVersions.find((item) => item.classId === classId);
  const klass = getDemonstrationClass(classId);
  return {
    id,
    classId,
    unitId: klass?.unitId ?? "",
    periodLabel: klass?.academicPeriod.label ?? "Período letivo não identificado",
    version: source?.label ?? "Sem versão",
    state,
    effectiveFrom: source?.effectiveFrom ?? "",
    ...(source?.effectiveUntil ? { effectiveUntil: source.effectiveUntil } : {}),
    preparedOn: source?.effectiveFrom ?? "",
    operationReference: `OPER-${id.toUpperCase()}`,
    author: AUTHOR_UNIT,
    nature: "Elaboração demonstrativa inicial",
    justification: "Registro fictício para demonstrar o ciclo de vida da grade.",
    blocks: (source?.blocks ?? []).map((item) => ({ ...item })),
    rectifications: [],
    ...extra,
  };
}

export const scheduleVersionRecords: ScheduleVersionRecord[] = [
  {
    id: "grd-001-v1",
    classId: "tur-001",
    unitId: getDemonstrationClass("tur-001")?.unitId ?? "",
    periodLabel: getDemonstrationClass("tur-001")?.academicPeriod.label ?? "",
    version: "Versão 1",
    state: "Substituída",
    effectiveFrom: "2026-02-09",
    effectiveUntil: "2026-05-03",
    preparedOn: "2026-02-02",
    publishedOn: "2026-02-06",
    operationReference: "OPER-2026-000112",
    author: AUTHOR_UNIT,
    nature: "Primeira publicação demonstrativa",
    justification: "Distribuição inicial preparada com a jornada declarada da turma.",
    blocks: tur001V1,
    rectifications: [],
    supersededBy: "grd-001-v2",
  },
  {
    id: "grd-001-v2",
    classId: "tur-001",
    unitId: getDemonstrationClass("tur-001")?.unitId ?? "",
    periodLabel: getDemonstrationClass("tur-001")?.academicPeriod.label ?? "",
    version: "Versão 2",
    state: "Publicada",
    effectiveFrom: "2026-05-04",
    preparedOn: "2026-04-27",
    publishedOn: "2026-05-04",
    operationReference: "OPER-2026-000431",
    author: AUTHOR_UNIT,
    nature: "Mudança estrutural demonstrativa (nova versão)",
    justification: "Reorganização dos blocos de linguagens e inclusão de período sem distribuição.",
    blocks: tur001V2,
    rectifications: [
      {
        id: "ret-001",
        versionId: "grd-001-v2",
        kind: "Correção administrativa",
        effectFrom: "2026-08-10",
        author: AUTHOR_UNIT,
        justification:
          "Correção de digitação no término do bloco de leitura orientada; a versão principal foi preservada.",
        operationReference: "OPER-2026-000902",
        before: {
          id: "bl-004",
          day: "mon",
          start: "09:40",
          end: "10:20",
          kind: "Atividade pedagógica",
          label: "Leitura orientada",
          assignmentIds: ["atp-001"],
          status: "Planejado",
        },
        after: {
          id: "bl-004",
          day: "mon",
          start: "09:40",
          end: "10:30",
          kind: "Atividade pedagógica",
          label: "Leitura orientada",
          assignmentIds: ["atp-001"],
          status: "Planejado",
        },
      },
    ],
  },
  {
    id: "grd-001-v3",
    classId: "tur-001",
    unitId: getDemonstrationClass("tur-001")?.unitId ?? "",
    periodLabel: getDemonstrationClass("tur-001")?.academicPeriod.label ?? "",
    version: "Versão 3",
    state: "Preparada para publicação",
    effectiveFrom: "2026-10-05",
    preparedOn: "2026-09-21",
    operationReference: "OPER-2026-001188",
    author: AUTHOR_UNIT,
    nature: "Nova versão demonstrativa com vigência futura",
    justification:
      "Inclusão de oficina na sexta-feira e deslocamento de um bloco; vigência inicia após o período em curso.",
    blocks: tur001V3,
    rectifications: [],
  },
  fromScheduleVersion("grd-002-v1", "tur-002", "Pronta para revisão", {
    nature: "Elaboração concluída e encaminhada para revisão",
    justification: "Rotina da Educação Infantil organizada por campos de experiência.",
  }),
  fromScheduleVersion("grd-003-v1", "tur-003", "Revisão devolvida", {
    nature: "Revisão devolvida para elaboração",
    justification: "A revisão demonstrativa apontou dias sem distribuição na turma multisseriada.",
  }),
  fromScheduleVersion("grd-004-v1", "tur-004", "Publicada", {
    publishedOn: "2026-02-12",
    nature: "Publicação demonstrativa da EJA",
    justification: "Organização por fases, incluindo sábado.",
    author: AUTHOR_NETWORK,
  }),
  fromScheduleVersion("grd-005-v1", "tur-005", "Em elaboração", {
    nature: "Elaboração em andamento",
    justification: "Compatibilidade administrativa pendente de validação.",
  }),
  fromScheduleVersion("grd-006-v1", "tur-006", "Histórica", {
    nature: "Versão preservada como histórica",
    justification: "Registro do período letivo anterior, preservado em leitura.",
    incompleteFields: [
      "Responsável pela operação não registrado no histórico demonstrativo.",
      "Referência de operação anterior à numeração atual.",
    ],
  }),
  fromScheduleVersion("grd-007-v0", "tur-007", "Não iniciada", {
    nature: "Nenhuma versão iniciada",
    justification: "A turma possui jornada, mas não possui distribuição semanal.",
  }),
  fromScheduleVersion("grd-009-v1", "tur-009", "Em elaboração", {
    nature: "Elaboração em andamento",
    justification: "Turma multietapa preservada como registro único.",
  }),
];

export function versionsForClass(classId: string) {
  return scheduleVersionRecords
    .filter((item) => item.classId === classId)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export function getVersionRecord(versionId: string) {
  return scheduleVersionRecords.find((item) => item.id === versionId);
}

export function lifecycleStateTone(state: ScheduleLifecycleState) {
  if (state === "Publicada") return "success" as const;
  if (state === "Preparada para publicação" || state === "Em revisão") return "info" as const;
  if (state === "Revisão devolvida") return "danger" as const;
  if (state === "Pronta para revisão" || state === "Em elaboração") return "warning" as const;
  return "neutral" as const;
}

export function changeKindTone(kind: ChangeKind) {
  if (kind === "Mudança estrutural") return "danger" as const;
  if (kind === "Classificação pendente") return "warning" as const;
  if (kind === "Alteração recorrente") return "info" as const;
  return "neutral" as const;
}

/* --------------------------------------------------- data de referência */

export const LIFECYCLE_REFERENCE_DATE = "2026-09-23";

function withinVigency(record: ScheduleVersionRecord, date: string) {
  if (!record.effectiveFrom || record.effectiveFrom > date) return false;
  if (record.effectiveUntil && record.effectiveUntil < date) return false;
  return true;
}

/**
 * Versão efetiva para uma data: apenas versões publicadas (ou já substituídas,
 * dentro da própria vigência) e nunca a mais recente quando ainda não vigente.
 */
export function effectiveVersionFor(
  classId: string,
  date: string = LIFECYCLE_REFERENCE_DATE,
): ScheduleVersionRecord | undefined {
  const candidates = versionsForClass(classId).filter(
    (record) =>
      (record.state === "Publicada" ||
        record.state === "Substituída" ||
        record.state === "Histórica") &&
      withinVigency(record, date),
  );
  return candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

/** Blocos efetivos: retrato da versão mais as retificações já em efeito. */
export function effectiveBlocksFor(
  classId: string,
  date: string = LIFECYCLE_REFERENCE_DATE,
): ScheduleBlock[] {
  const record = effectiveVersionFor(classId, date);
  if (!record) return [];
  let blocks = record.blocks.map((item) => ({ ...item }));
  for (const rectification of record.rectifications) {
    if (rectification.effectFrom > date) continue;
    blocks = blocks.map((item) =>
      item.id === rectification.after.id ? { ...rectification.after } : item,
    );
  }
  return blocks;
}

export function referenceContextLabel(classId: string, date: string) {
  const record = effectiveVersionFor(classId, date);
  const future = versionsForClass(classId).filter(
    (item) => item.effectiveFrom > date && item.state !== "Histórica",
  );
  if (!record)
    return `Nenhuma versão vigente em ${formatAcademicDate(date)}.${
      future.length ? ` Existe versão com vigência futura (${formatAcademicDate(future[0]?.effectiveFrom)}).` : ""
    }`;
  return `${record.version} (${record.state}) vigente em ${formatAcademicDate(date)}, desde ${formatAcademicDate(record.effectiveFrom)}${
    record.effectiveUntil ? ` até ${formatAcademicDate(record.effectiveUntil)}` : ""
  }.${future.length ? ` Versão futura prevista para ${formatAcademicDate(future[0]?.effectiveFrom)}.` : ""}`;
}

/* ------------------------------------------------- comparação semântica */

export type VersionDiffKind =
  | "Bloco adicionado"
  | "Bloco removido"
  | "Bloco deslocado"
  | "Duração alterada"
  | "Componente ou campo alterado"
  | "Profissional alterado"
  | "Vínculo funcional alterado"
  | "Vigência alterada";

export type VersionDiff = { id: string; kind: VersionDiffKind; detail: string };

function assignmentsOf(item: ScheduleBlock) {
  return item.assignmentIds
    .map((id) => getPedagogicalAssignment(id))
    .filter((entry): entry is PedagogicalAssignmentRecord => Boolean(entry));
}

function peopleOf(item: ScheduleBlock) {
  return assignmentsOf(item).map(
    (assignment) =>
      getDemonstrationProfessional(assignment.professionalId)?.personName ??
      assignment.professionalId,
  );
}

function linksOf(item: ScheduleBlock) {
  return assignmentsOf(item).map((assignment) => assignment.linkId);
}

function blockLabel(item: ScheduleBlock) {
  return `${dayLabel(item.day)} ${item.start}–${item.end} · ${item.label}`;
}

/** Comparação semântica: nunca texto bruto nem JSON. */
export function compareVersions(fromId: string, toId: string): VersionDiff[] {
  const from = getVersionRecord(fromId);
  const to = getVersionRecord(toId);
  if (!from || !to) return [];
  const diffs: VersionDiff[] = [];
  if (
    from.effectiveFrom !== to.effectiveFrom ||
    (from.effectiveUntil ?? "") !== (to.effectiveUntil ?? "")
  )
    diffs.push({
      id: "vigencia",
      kind: "Vigência alterada",
      detail: `De ${formatAcademicDate(from.effectiveFrom)}${from.effectiveUntil ? `–${formatAcademicDate(from.effectiveUntil)}` : ""} para ${formatAcademicDate(to.effectiveFrom)}${to.effectiveUntil ? `–${formatAcademicDate(to.effectiveUntil)}` : ""}.`,
    });
  for (const item of to.blocks) {
    const previous = from.blocks.find((entry) => entry.id === item.id);
    if (!previous) {
      diffs.push({
        id: `add-${item.id}`,
        kind: "Bloco adicionado",
        detail: blockLabel(item),
      });
      continue;
    }
    if (previous.day !== item.day || previous.start !== item.start)
      diffs.push({
        id: `move-${item.id}`,
        kind: "Bloco deslocado",
        detail: `${item.label}: de ${dayLabel(previous.day)} ${previous.start} para ${dayLabel(item.day)} ${item.start}.`,
      });
    if (blockDuration(previous) !== blockDuration(item))
      diffs.push({
        id: `dur-${item.id}`,
        kind: "Duração alterada",
        detail: `${item.label}: de ${formatDuration(blockDuration(previous))} para ${formatDuration(blockDuration(item))}.`,
      });
    if (previous.label !== item.label)
      diffs.push({
        id: `field-${item.id}`,
        kind: "Componente ou campo alterado",
        detail: `${dayLabel(item.day)} ${item.start}: de “${previous.label}” para “${item.label}”.`,
      });
    const beforePeople = peopleOf(previous).join("; ");
    const afterPeople = peopleOf(item).join("; ");
    if (beforePeople !== afterPeople)
      diffs.push({
        id: `prof-${item.id}`,
        kind: "Profissional alterado",
        detail: `${blockLabel(item)}: de ${beforePeople || "sem profissional"} para ${afterPeople || "sem profissional"}.`,
      });
    const beforeLinks = linksOf(previous).join("; ");
    const afterLinks = linksOf(item).join("; ");
    if (beforeLinks !== afterLinks)
      diffs.push({
        id: `link-${item.id}`,
        kind: "Vínculo funcional alterado",
        detail: `${blockLabel(item)}: vínculos de ${beforeLinks || "não identificado"} para ${afterLinks || "não identificado"}.`,
      });
  }
  for (const item of from.blocks)
    if (!to.blocks.some((entry) => entry.id === item.id))
      diffs.push({
        id: `rem-${item.id}`,
        kind: "Bloco removido",
        detail: blockLabel(item),
      });
  return diffs;
}

/* ------------------------------------------------------ conflitos em rede */

export type NetworkConflict = {
  id: string;
  professionalId: string;
  professionalName: string;
  detail: string;
  classIds: string[];
  unitIds: string[];
};

function overlap(a: ScheduleBlock, b: ScheduleBlock) {
  return (
    a.day === b.day &&
    timeToMinutes(a.start) < timeToMinutes(b.end) &&
    timeToMinutes(b.start) < timeToMinutes(a.end)
  );
}

/**
 * Conflitos considerando a mesma Pessoa em toda a rede, independentemente da
 * quantidade de vínculos, unidades ou turmas. Corresponsabilidade no mesmo
 * bloco não é conflito.
 */
/** Projeção de outras turmas: versão efetiva ou, na ausência, a mais recente. */
function projectionBlocks(classId: string, date: string) {
  const effective = effectiveBlocksFor(classId, date);
  if (effective.length) return effective;
  const records = versionsForClass(classId);
  return (records[records.length - 1]?.blocks ?? []).map((item) => ({ ...item }));
}

export function networkConflicts(
  classId: string,
  blocks: ScheduleBlock[],
  date: string = LIFECYCLE_REFERENCE_DATE,
): NetworkConflict[] {
  const projection = [
    ...scheduleVersionRecords
      .filter((record) => record.classId !== classId)
      .map((record) => record.classId)
      .filter((id, index, all) => all.indexOf(id) === index)
      .flatMap((id) => projectionBlocks(id, date).map((block) => ({ classId: id, block }))),
    ...blocks.map((block) => ({ classId, block })),
  ];
  const entries = projection.flatMap((row) =>
    assignmentsOf(row.block).map((assignment) => ({ ...row, assignment })),
  );
  const conflicts: NetworkConflict[] = [];
  for (let left = 0; left < entries.length; left += 1)
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      if (!a || !b) continue;
      if (a.assignment.professionalId !== b.assignment.professionalId) continue;
      if (a.block.id === b.block.id) continue;
      if (!overlap(a.block, b.block)) continue;
      const unitA = getDemonstrationClass(a.classId)?.unitId ?? "";
      const unitB = getDemonstrationClass(b.classId)?.unitId ?? "";
      const name =
        getDemonstrationProfessional(a.assignment.professionalId)?.personName ??
        a.assignment.professionalId;
      conflicts.push({
        id: `net-${a.block.id}-${b.block.id}`,
        professionalId: a.assignment.professionalId,
        professionalName: name,
        classIds: [a.classId, b.classId],
        unitIds: [unitA, unitB],
        detail: `${name} — ${dayLabel(a.block.day)}, ${a.block.start}–${a.block.end} e ${b.block.start}–${b.block.end}${
          a.classId === b.classId
            ? " na mesma turma"
            : ` em ${getClassUnitName(unitA)} e ${getClassUnitName(unitB)}`
        }. Vínculos considerados: ${a.assignment.linkId} e ${b.assignment.linkId}. Conflito temporal potencial; requer validação e não constitui infração automática.`,
      });
    }
  return conflicts;
}

export function coresponsibilityBlocks(blocks: ScheduleBlock[]) {
  return blocks.filter((item) => new Set(peopleOf(item)).size > 1);
}

/* ---------------------------------------------------------- validações */

export type ReviewFindingCategory =
  | "Bloqueio estrutural demonstrativo"
  | "Conflito temporal potencial"
  | "Advertência"
  | "Informação insuficiente"
  | "Item dependente de decisão institucional";

export type ReviewFinding = {
  id: string;
  category: ReviewFindingCategory;
  title: string;
  detail: string;
};

export const REVIEW_FINDING_CATEGORIES: ReviewFindingCategory[] = [
  "Bloqueio estrutural demonstrativo",
  "Conflito temporal potencial",
  "Advertência",
  "Informação insuficiente",
  "Item dependente de decisão institucional",
];

export function reviewFindings(versionId: string): ReviewFinding[] {
  const record = getVersionRecord(versionId);
  if (!record) return [];
  const journey = getJourneyForClass(record.classId);
  const findings: ReviewFinding[] = [];
  if (!record.blocks.length)
    findings.push({
      id: "sem-blocos",
      category: "Informação insuficiente",
      title: "Nenhum bloco distribuído",
      detail: "A grade proposta não possui distribuição semanal. Nada é presumido.",
    });
  for (const item of record.blocks) {
    if (blockDuration(item) <= 0)
      findings.push({
        id: `dur-${item.id}`,
        category: "Bloqueio estrutural demonstrativo",
        title: "Duração inválida",
        detail: `${blockLabel(item)}: término não posterior ao início.`,
      });
    const declared = journey?.days.find((day) => day.day === item.day);
    if (journey && !declared)
      findings.push({
        id: `dia-${item.id}`,
        category: "Bloqueio estrutural demonstrativo",
        title: "Dia fora da jornada declarada",
        detail: `${dayLabel(item.day)} não consta no funcionamento declarado. A jornada não é alterada.`,
      });
    else if (
      declared &&
      (timeToMinutes(item.start) < timeToMinutes(declared.start) ||
        timeToMinutes(item.end) > timeToMinutes(declared.end))
    )
      findings.push({
        id: `fora-${item.id}`,
        category: "Advertência",
        title: "Bloco fora do funcionamento declarado",
        detail: `${blockLabel(item)} ultrapassa ${declared.start}–${declared.end}.`,
      });
    if (item.kind === "Aula" && !item.assignmentIds.length)
      findings.push({
        id: `prof-${item.id}`,
        category: "Informação insuficiente",
        title: "Bloco de aula sem Atuação Pedagógica",
        detail: `${blockLabel(item)}: nenhum profissional selecionado. Intervalos não exigem profissional.`,
      });
    if (item.status === "Sem distribuição")
      findings.push({
        id: `dist-${item.id}`,
        category: "Advertência",
        title: "Período sem distribuição definida",
        detail: blockLabel(item),
      });
  }
  for (const conflict of networkConflicts(record.classId, record.blocks))
    findings.push({
      id: conflict.id,
      category: "Conflito temporal potencial",
      title: "Sobreposição da mesma Pessoa na rede",
      detail: conflict.detail,
    });
  findings.push({
    id: "decisao",
    category: "Item dependente de decisão institucional",
    title: "Responsabilidade pela revisão e publicação",
    detail: LIFECYCLE_REVIEWER_NOTE,
  });
  return findings;
}

export function findingsByCategory(versionId: string) {
  const findings = reviewFindings(versionId);
  return REVIEW_FINDING_CATEGORIES.map((category) => ({
    category,
    items: findings.filter((item) => item.category === category),
  }));
}

export function reviewSituation(versionId: string): ScheduleSituation {
  const findings = reviewFindings(versionId);
  if (findings.some((item) => item.category === "Conflito temporal potencial"))
    return "Conflito temporal potencial";
  if (findings.some((item) => item.category === "Bloqueio estrutural demonstrativo"))
    return "Incompatibilidade estrutural demonstrativa";
  if (findings.some((item) => item.category === "Informação insuficiente"))
    return "Informação insuficiente";
  if (findings.some((item) => item.category === "Advertência"))
    return "Compatibilidade pendente de validação";
  return "Situação sem conflito identificado";
}

/* ----------------------------------------------------- solicitações */

export type ChangeRequest = {
  id: string;
  classId: string;
  unitId: string;
  periodLabel: string;
  originVersionId: string;
  kind: ChangeKind;
  state: ChangeRequestState;
  /** Operação demonstrativa: revisão ou alteração. */
  operation: "Revisão de grade" | "Alteração de grade publicada";
  referenceDate: string;
  effectFrom: string;
  author: string;
  justification: string;
  affectedBlockIds: string[];
  /** Antes/depois preservados; a grade de origem nunca é alterada. */
  before: ScheduleBlock[];
  after: ScheduleBlock[];
  pendencies: string[];
  /** Decisão sobre nova versão; null quando a classificação está pendente. */
  requiresNewVersion: boolean | null;
  resultingVersionId?: string;
  rectificationId?: string;
};

function blocksOf(versionId: string) {
  return (getVersionRecord(versionId)?.blocks ?? []).map((item) => ({ ...item }));
}

function requestContext(classId: string) {
  const klass = getDemonstrationClass(classId);
  return {
    unitId: klass?.unitId ?? "",
    periodLabel: klass?.academicPeriod.label ?? "Período letivo não identificado",
  };
}

const v2Blocks = blocksOf("grd-001-v2");

export const changeRequests: ChangeRequest[] = [
  {
    id: "sol-001",
    classId: "tur-001",
    ...requestContext("tur-001"),
    originVersionId: "grd-001-v2",
    kind: "Correção administrativa",
    state: "Preparada como retificação",
    operation: "Alteração de grade publicada",
    referenceDate: "2026-08-08",
    effectFrom: "2026-08-10",
    author: AUTHOR_UNIT,
    justification: "Correção de digitação no término do bloco de leitura orientada.",
    affectedBlockIds: ["bl-004"],
    before: v2Blocks,
    after: v2Blocks.map((item) => (item.id === "bl-004" ? { ...item, end: "10:30" } : { ...item })),
    pendencies: [],
    requiresNewVersion: false,
    rectificationId: "ret-001",
  },
  {
    id: "sol-002",
    classId: "tur-001",
    ...requestContext("tur-001"),
    originVersionId: "grd-001-v2",
    kind: "Ajuste pontual",
    state: "Em análise",
    operation: "Alteração de grade publicada",
    referenceDate: "2026-09-14",
    effectFrom: "2026-09-28",
    author: AUTHOR_UNIT,
    justification:
      "Antecipação de um bloco de linguagens na segunda-feira, com sobreposição a ser validada.",
    affectedBlockIds: ["bl-002"],
    before: v2Blocks,
    after: v2Blocks.map((item) =>
      item.id === "bl-002" ? { ...item, start: "07:30", end: "08:40" } : { ...item },
    ),
    pendencies: [
      "Revisão demonstrativa em andamento; nenhuma autorização foi concedida.",
      "A alteração faz surgir conflito temporal potencial que requer validação.",
    ],
    requiresNewVersion: false,
  },
  {
    id: "sol-003",
    classId: "tur-005",
    ...requestContext("tur-005"),
    originVersionId: "grd-005-v1",
    kind: "Alteração recorrente",
    state: "Correção solicitada",
    operation: "Revisão de grade",
    referenceDate: "2026-09-18",
    effectFrom: "2026-09-30",
    author: AUTHOR_UNIT,
    justification: "Repetição semanal de um bloco de ciências em outro dia.",
    affectedBlockIds: ["bl-050"],
    before: blocksOf("grd-005-v1"),
    after: blocksOf("grd-005-v1").map((item) =>
      item.id === "bl-050" ? { ...item, day: "tue" as const } : { ...item },
    ),
    pendencies: [
      "Conflito temporal potencial com outra unidade requer validação.",
      "Classificação depende das regras institucionais de alteração.",
    ],
    requiresNewVersion: null,
  },
  {
    id: "sol-004",
    classId: "tur-001",
    ...requestContext("tur-001"),
    originVersionId: "grd-001-v2",
    kind: "Mudança estrutural",
    state: "Preparada como nova versão",
    operation: "Alteração de grade publicada",
    referenceDate: "2026-09-21",
    effectFrom: "2026-10-05",
    author: AUTHOR_UNIT,
    justification: "Inclusão de oficina e deslocamento de bloco; exige nova versão demonstrativa.",
    affectedBlockIds: ["bl-006", "bl-009"],
    before: v2Blocks,
    after: tur001V3,
    pendencies: [],
    requiresNewVersion: true,
    resultingVersionId: "grd-001-v3",
  },
  {
    id: "sol-005",
    classId: "tur-003",
    ...requestContext("tur-003"),
    originVersionId: "grd-003-v1",
    kind: "Classificação pendente",
    state: "Classificação pendente",
    operation: "Revisão de grade",
    referenceDate: "2026-09-19",
    effectFrom: "",
    author: AUTHOR_UNIT,
    justification:
      "Reorganização dos agrupamentos multisseriados sem regra institucional documentada.",
    affectedBlockIds: ["bl-030"],
    before: blocksOf("grd-003-v1"),
    after: blocksOf("grd-003-v1").map((item) =>
      item.id === "bl-030" ? { ...item, end: "09:10" } : { ...item },
    ),
    pendencies: [
      "Decisão pendente: as regras institucionais não permitem classificar esta mudança.",
      "Data de efeito não definida; nenhuma publicação definitiva é simulada.",
    ],
    requiresNewVersion: null,
  },
  {
    id: "sol-006",
    classId: "tur-002",
    ...requestContext("tur-002"),
    originVersionId: "grd-002-v1",
    kind: "Ajuste pontual",
    state: "Preparada para publicação",
    operation: "Revisão de grade",
    referenceDate: "2026-09-20",
    effectFrom: "2026-09-29",
    author: AUTHOR_UNIT,
    justification: "Rotina da Educação Infantil revisada e preparada para publicação.",
    affectedBlockIds: ["bl-022"],
    before: blocksOf("grd-002-v1"),
    after: blocksOf("grd-002-v1").map((item) =>
      item.id === "bl-022" ? { ...item, start: "13:35", end: "14:25" } : { ...item },
    ),
    pendencies: [],
    requiresNewVersion: false,
  },
  {
    id: "sol-007",
    classId: "tur-009",
    ...requestContext("tur-009"),
    originVersionId: "grd-009-v1",
    kind: "Classificação pendente",
    state: "Devolvida para elaboração",
    operation: "Revisão de grade",
    referenceDate: "2026-09-22",
    effectFrom: "",
    author: AUTHOR_NETWORK,
    justification: "Revisão devolvida por informação insuficiente na turma multietapa.",
    affectedBlockIds: [],
    before: blocksOf("grd-009-v1"),
    after: blocksOf("grd-009-v1"),
    pendencies: ["Informação insuficiente: dias sem distribuição."],
    requiresNewVersion: null,
  },
];

export function changeRequestsForClass(classId: string) {
  return changeRequests.filter((item) => item.classId === classId);
}

export function getChangeRequest(id: string) {
  return changeRequests.find((item) => item.id === id);
}

export function changeRequestStateTone(state: ChangeRequestState) {
  if (state === "Preparada para publicação" || state === "Preparada como nova versão")
    return "success" as const;
  if (state === "Correção solicitada" || state === "Devolvida para elaboração")
    return "danger" as const;
  if (state === "Classificação pendente") return "warning" as const;
  return "info" as const;
}

/** Classificação nunca determina automaticamente a dispensa de nova versão. */
export function classificationGuidance(kind: ChangeKind) {
  if (kind === "Classificação pendente")
    return {
      requiresNewVersion: null as boolean | null,
      note: "Classificação pendente: a solicitação pode ser preparada, mas nenhuma publicação definitiva é simulada e nenhuma autorização é assumida.",
    };
  if (kind === "Mudança estrutural")
    return {
      requiresNewVersion: true as boolean | null,
      note: "Cenário demonstrativo de mudança importante: nova versão é criada e a versão anterior é preservada integralmente.",
    };
  return {
    requiresNewVersion: false as boolean | null,
    note: `Cenário demonstrativo de alteração simples: a identificação da versão principal é preservada e a retificação é rastreada. ${LIFECYCLE_CLASSIFICATION_NOTE}`,
  };
}

/* --------------------------------------------------------------- impacto */

export type ChangeImpact = {
  changedBlocks: Array<{ id: string; before?: ScheduleBlock; after?: ScheduleBlock }>;
  professionals: string[];
  classes: string[];
  units: string[];
  newConflicts: NetworkConflict[];
  resolvedConflicts: NetworkConflict[];
  pendencies: string[];
  /** Quando faltam informações, nenhuma ausência de impacto é declarada. */
  insufficient: boolean;
};

export function changeImpact(requestId: string): ChangeImpact | undefined {
  const request = getChangeRequest(requestId);
  if (!request) return undefined;
  const before = networkConflicts(request.classId, request.before);
  const after = networkConflicts(request.classId, request.after);
  const beforeIds = new Set(before.map((item) => item.id));
  const afterIds = new Set(after.map((item) => item.id));
  const changedBlocks: ChangeImpact["changedBlocks"] = [];
  for (const item of request.after) {
    const previous = request.before.find((entry) => entry.id === item.id);
    if (!previous) changedBlocks.push({ id: item.id, after: item });
    else if (JSON.stringify(previous) !== JSON.stringify(item))
      changedBlocks.push({ id: item.id, before: previous, after: item });
  }
  for (const item of request.before)
    if (!request.after.some((entry) => entry.id === item.id))
      changedBlocks.push({ id: item.id, before: item });
  const conflicts = [...after.filter((item) => !beforeIds.has(item.id))];
  const resolved = before.filter((item) => !afterIds.has(item.id));
  const professionals = [
    ...new Set(
      changedBlocks.flatMap((entry) => [
        ...peopleOf(entry.after ?? entry.before ?? ({ assignmentIds: [] } as never)),
        ...peopleOf(entry.before ?? entry.after ?? ({ assignmentIds: [] } as never)),
      ]),
    ),
  ];
  const classes = [...new Set([request.classId, ...conflicts.flatMap((item) => item.classIds)])];
  const units = [...new Set([request.unitId, ...conflicts.flatMap((item) => item.unitIds)])].filter(
    Boolean,
  );
  const insufficient = request.requiresNewVersion === null || !request.effectFrom;
  const pendencies = [
    ...request.pendencies,
    ...(insufficient
      ? [
          "Informações insuficientes para concluir a análise de impacto; nenhuma ausência de impacto é declarada.",
        ]
      : []),
  ];
  return {
    changedBlocks,
    professionals,
    classes,
    units,
    newConflicts: conflicts,
    resolvedConflicts: resolved,
    pendencies,
    insufficient,
  };
}

/* -------------------------------------------------------------- cenários */

export const lifecycleScenarios = [
  ["A", "Grade em elaboração", "grd-005-v1"],
  ["B", "Grade pronta para revisão", "grd-002-v1"],
  ["C", "Revisão devolvida", "grd-003-v1"],
  ["D", "Grade preparada para publicação", "grd-001-v3"],
  ["E", "Publicação demonstrativa", "grd-004-v1"],
  ["F", "Grade vigente na data de referência", "grd-001-v2"],
  ["G", "Grade com vigência futura", "grd-001-v3"],
  ["H", "Grade histórica", "grd-006-v1"],
  ["I", "Correção administrativa", "sol-001"],
  ["J", "Ajuste pontual", "sol-002"],
  ["K", "Alteração recorrente", "sol-003"],
  ["L", "Mudança estrutural", "sol-004"],
  ["M", "Classificação indefinida", "sol-005"],
  ["N", "Nova versão preservando a anterior", "grd-001-v1,grd-001-v2"],
  ["O", "Retificação sem nova versão principal", "ret-001"],
  ["P", "Conflito surgido após alteração", "sol-002"],
  ["Q", "Conflito resolvido após alteração", "sol-006"],
  ["R", "Profissional em duas escolas", "pro-003"],
  ["S", "Corresponsabilidade em bloco", "bl-001"],
  ["T", "Comparação de versões", "grd-001-v2,grd-001-v3"],
] as const;

export function lifecycleConsistencyIssues() {
  const issues: string[] = [];
  for (const record of scheduleVersionRecords) {
    if (!getDemonstrationClass(record.classId))
      issues.push(`Versão ${record.id} referencia turma inexistente.`);
    if (record.supersededBy && !getVersionRecord(record.supersededBy))
      issues.push(`Versão ${record.id} aponta substituição inexistente.`);
  }
  for (const request of changeRequests) {
    if (!getVersionRecord(request.originVersionId))
      issues.push(`Solicitação ${request.id} referencia versão de origem inexistente.`);
    if (request.resultingVersionId && !getVersionRecord(request.resultingVersionId))
      issues.push(`Solicitação ${request.id} aponta versão resultante inexistente.`);
  }
  return issues;
}
