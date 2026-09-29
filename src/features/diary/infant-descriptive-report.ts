/**
 * 6D.5.2 — Parecer Descritivo da Educação Infantil.
 *
 * Documento pedagógico individual: estudante + turma + período letivo + autor +
 * texto livre + referências à Matriz canônica + versionamento.
 * NÃO é nota, conceito, média, classificação nem resultado calculado: nenhuma
 * função deste módulo produz número, percentual ou juízo sobre o estudante.
 *
 * Rito mínimo: rascunho → conferência (não registra) → oficialização (versão
 * imutável). Correção = nova versão encadeada (`supersedesVersionId`).
 * Exigência adicional (ex.: homologação da coordenação) só existe se uma
 * política declarada a exigir; sem política, nada além do rito mínimo.
 * Persistência: o contrato `DescriptiveReportRepository` permite trocar a
 * implementação em memória pela persistente sem tocar a regra de domínio.
 */
import { useSyncExternalStore } from "react";
import { classAcademicYear } from "@/features/academic/academic-structure";
import { assessmentConfigurations, periodStructures } from "@/features/assessment/assessment-fixtures";
import { resolveConfiguration } from "@/features/assessment/assessment-rules";
import {
  curriculumObjectiveRepository,
  type CurriculumObjectiveRepository,
} from "@/features/curriculum/curriculum-objectives-repository";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import {
  ageGroupsForClass,
  infantAssignment,
  type ExperienceFieldId,
  type InfantExperienceRecord,
} from "./infant-experiences";

export const NO_DESCRIPTIVE_REPORT_NOTE = "Parecer ainda não registrado.";

export type ReportKey = { studentId: string; classId: string; periodId: string };

export type ReportAuthor = {
  professionalId: string;
  pedagogicalAssignmentId: string;
  /** Agente demonstrativo temporário até a autenticação real (Lovable Cloud). */
  demonstrative: true;
};

export type DescriptiveReportVersion = ReportKey & {
  id: string;
  logicalReportId: string;
  versionNumber: number;
  supersedesVersionId?: string;
  text: string;
  objectiveIds: readonly string[];
  author: ReportAuthor;
  officializedAt: string;
  /** Motivo declarado somente em correções (versão ≥ 2). */
  correctionReason?: string;
};

export type DescriptiveReportDraft = ReportKey & {
  text: string;
  objectiveIds: string[];
  /** Versão vigente a partir da qual o rascunho foi preparado (ausente no primeiro parecer). */
  baseVersionId?: string;
  correctionReason?: string;
};

/** Política opcional; ausência ⇒ professor autorizado → conferência → oficialização. */
export type DescriptiveReportPolicy = { additionalStepIds: readonly string[] };

export type ReportConference = {
  key: ReportKey;
  draft: Readonly<DescriptiveReportDraft>;
  author: ReportAuthor;
  baseVersionId: string | null;
  fingerprint: string;
  before: DescriptiveReportVersion | null;
};

export type ReportFailure = { ok: false; code: string; message: string };

// ------------------------------------------------------------ Repositório

export type DescriptiveReportRepository = {
  chain(key: ReportKey): readonly DescriptiveReportVersion[];
  append(version: DescriptiveReportVersion): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
};

const keyOf = (k: ReportKey) => `${k.studentId}|${k.classId}|${k.periodId}`;

export function createInMemoryReportRepository(): DescriptiveReportRepository {
  let versions: DescriptiveReportVersion[] = [];
  const cache = new Map<string, readonly DescriptiveReportVersion[]>();
  const listeners = new Set<() => void>();
  return {
    chain(key) {
      const k = keyOf(key);
      if (!cache.has(k)) cache.set(k, versions.filter((v) => keyOf(v) === k));
      return cache.get(k)!;
    },
    append(version) {
      versions = [...versions, Object.freeze({ ...version, objectiveIds: Object.freeze([...version.objectiveIds]) })];
      cache.clear();
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      versions = [];
      cache.clear();
      listeners.forEach((l) => l());
    },
  };
}

export const descriptiveReportRepository = createInMemoryReportRepository();

export function useReportChain(key: ReportKey, repo = descriptiveReportRepository) {
  return useSyncExternalStore(repo.subscribe, () => repo.chain(key), () => repo.chain(key));
}

/** Versão vigente = a que nenhuma outra substitui (projeção da cadeia). */
export function currentReportVersion(chain: readonly DescriptiveReportVersion[]) {
  const superseded = new Set(chain.map((v) => v.supersedesVersionId).filter(Boolean));
  return chain.find((v) => !superseded.has(v.id)) ?? null;
}

// ------------------------------------------------------ Contexto normativo

/** Períodos letivos da configuração aplicável à turma — nunca "bimestre" fixo. */
export function reportPeriodsForClass(classId: string) {
  const year = classAcademicYear(classId);
  if (!year) return [];
  const resolution = resolveConfiguration(classId, year.id, assessmentConfigurations);
  if (resolution.status !== "resolvida") return [];
  const structure = periodStructures.find((s) => s.id === resolution.configuration.periodStructureId);
  return [...(structure?.periods ?? [])].sort((a, b) => a.sequence - b.sequence);
}

/** Autoria: atuação pedagógica vigente do profissional na turma, não cargo. */
export function reportAuthorFor(
  professionalId: string,
  classId: string,
  date: string,
): ReportAuthor | null {
  const assignment = demonstrationPedagogicalAssignments.find(
    (a) =>
      a.professionalId === professionalId &&
      a.classId === classId &&
      (!a.start || a.start <= date) &&
      (!a.end || a.end >= date),
  );
  return assignment
    ? { professionalId, pedagogicalAssignmentId: assignment.id, demonstrative: true }
    : null;
}

/** Objetivos admissíveis: somente da Matriz e do grupo BNCC declarado pela turma. */
export function admissibleObjectivesForClass(
  classId: string,
  query = "",
  repo: CurriculumObjectiveRepository = curriculumObjectiveRepository,
) {
  const groups = ageGroupsForClass(classId);
  if (!groups.length) return [];
  return repo.query({ text: query, ageGroupIds: groups });
}

// ------------------------------------------------------------ Subsídios

export type ReportSubsidy = {
  recordId: string;
  date: string;
  title: string;
  observation: string | null;
  fieldIds: readonly ExperienceFieldId[];
  objectiveIds: readonly string[];
};

/**
 * Registros pedagógicos do estudante no período como SUBSÍDIO de escrita.
 * Somente leitura: nada é concatenado nem copiado para o parecer.
 */
export function reportSubsidies(
  key: ReportKey,
  period: { start: string; end: string },
  records: readonly InfantExperienceRecord[],
): ReportSubsidy[] {
  return records
    .filter((r) => infantAssignment(r.assignmentId)?.classId === key.classId)
    .filter((r) => r.date >= period.start && r.date <= period.end)
    .flatMap((r) => {
      const obs = r.individualObservations.find((o) => o.studentId === key.studentId);
      if (!obs) return [];
      return [
        {
          recordId: r.id,
          date: r.date,
          title: r.title || "Experiência pedagógica",
          observation: obs.text,
          fieldIds: [...new Set([...r.fieldIds, ...obs.fieldIds])],
          objectiveIds: [...new Set([...r.objectiveIds, ...obs.objectiveIds])],
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// -------------------------------------------------------------- Rito

export function draftFromCurrent(
  key: ReportKey,
  current: DescriptiveReportVersion | null,
): DescriptiveReportDraft {
  return current
    ? { ...key, text: current.text, objectiveIds: [...current.objectiveIds], baseVersionId: current.id }
    : { ...key, text: "", objectiveIds: [] };
}

function fingerprintOf(draft: DescriptiveReportDraft, baseVersionId: string | null) {
  return JSON.stringify([
    keyOf(draft),
    baseVersionId,
    draft.text,
    [...draft.objectiveIds].sort(),
    draft.correctionReason ?? "",
  ]);
}

/** Conferir NÃO registra: apenas congela o que seria oficializado. */
export function conferReport(input: {
  draft: DescriptiveReportDraft;
  author: ReportAuthor | null;
  repo?: DescriptiveReportRepository;
  objectives?: CurriculumObjectiveRepository;
}): { ok: true; conference: ReportConference } | ReportFailure {
  const repo = input.repo ?? descriptiveReportRepository;
  const objectives = input.objectives ?? curriculumObjectiveRepository;
  const { draft } = input;
  if (!input.author)
    return { ok: false, code: "author-without-assignment", message: "Sem atuação pedagógica vigente nesta turma para preparar o parecer." };
  if (!draft.text.trim())
    return { ok: false, code: "empty-text", message: "Escreva o texto do parecer antes de conferir." };
  const groups = ageGroupsForClass(draft.classId);
  for (const id of draft.objectiveIds) {
    const o = objectives.byId(id);
    if (!o) return { ok: false, code: "objective-not-in-matrix", message: `Objetivo ${id} não existe na Matriz.` };
    if (!groups.includes(o.ageGroupId))
      return { ok: false, code: "objective-not-applicable", message: `${o.code} não pertence ao grupo BNCC declarado pela turma.` };
  }
  const current = currentReportVersion(repo.chain(draft));
  const baseVersionId = current?.id ?? null;
  if ((draft.baseVersionId ?? null) !== baseVersionId)
    return { ok: false, code: "stale-base", message: "O parecer vigente mudou. Recomece a partir da versão atual." };
  if (current) {
    if (!draft.correctionReason?.trim())
      return { ok: false, code: "correction-reason-required", message: "Informe o motivo da nova versão." };
    if (current.text === draft.text && [...current.objectiveIds].sort().join() === [...draft.objectiveIds].sort().join())
      return { ok: false, code: "no-change", message: "Nada mudou em relação à versão vigente." };
  }
  const frozen = Object.freeze({ ...draft, objectiveIds: [...draft.objectiveIds] });
  return {
    ok: true,
    conference: {
      key: { studentId: draft.studentId, classId: draft.classId, periodId: draft.periodId },
      draft: frozen,
      author: input.author,
      baseVersionId,
      fingerprint: fingerprintOf(frozen, baseVersionId),
      before: current,
    },
  };
}

let sequence = 0;

/** Oficializar: cria versão imutável. Falha fechada se o vigente mudou após a conferência. */
export function officializeReport(input: {
  conference: ReportConference;
  repo?: DescriptiveReportRepository;
  policy?: DescriptiveReportPolicy | null;
  now?: string;
}): { ok: true; version: DescriptiveReportVersion } | ReportFailure {
  const repo = input.repo ?? descriptiveReportRepository;
  const { conference } = input;
  if (input.policy?.additionalStepIds.length)
    return { ok: false, code: "policy-step-not-available", message: "A política declara etapa adicional ainda não disponível; nada foi oficializado." };
  const chain = repo.chain(conference.key);
  const current = currentReportVersion(chain);
  if ((current?.id ?? null) !== conference.baseVersionId)
    return { ok: false, code: "concurrent-change", message: "O parecer vigente mudou depois da conferência. Confira novamente." };
  if (fingerprintOf(conference.draft, conference.baseVersionId) !== conference.fingerprint)
    return { ok: false, code: "conference-altered", message: "A conferência não corresponde mais ao texto. Confira novamente." };
  const version: DescriptiveReportVersion = {
    ...conference.key,
    id: `par-${String(++sequence).padStart(4, "0")}`,
    logicalReportId: chain[0]?.logicalReportId ?? `parecer:${keyOf(conference.key)}`,
    versionNumber: chain.length + 1,
    ...(current ? { supersedesVersionId: current.id } : {}),
    text: conference.draft.text,
    objectiveIds: [...conference.draft.objectiveIds],
    author: conference.author,
    officializedAt: input.now ?? new Date().toISOString(),
    ...(current && conference.draft.correctionReason ? { correctionReason: conference.draft.correctionReason } : {}),
  };
  repo.append(version);
  return { ok: true, version: repo.chain(conference.key).find((v) => v.id === version.id)! };
}
