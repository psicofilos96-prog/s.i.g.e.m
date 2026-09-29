import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { hydrateInstitutionalRoster, resetInstitutionalRoster } from "@/features/students/institutional-roster";
/**
 * Diário no Lovable Cloud — registro de aula, chamada, fechamento de
 * frequência e experiências da Educação Infantil.
 *
 * Com sessão:
 * - O banco é a ÚNICA fonte dos fatos oficiais; os stores do Diário viram
 *   espelhos somente leitura (`hydrateOfficial`/`hydrate`), fixtures somem.
 * - Rascunhos continuam só na aba, porque rascunho não é fato oficial.
 * - Cada gravação é uma função transacional que revalida capacidade (atuação
 *   vigente × política homologada), versão-base, fechamento em vigor, regra de
 *   correção homologada e repetição (`plan_id`). A tela nunca é garantia.
 * Sem sessão, nada daqui roda: o laboratório em memória continua.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/features/authority/session-authority";
import { refusalMessage } from "@/features/assessment/assessment-results-cloud";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { setDiaryPersistenceMode } from "./diary-persistence-mode";
import { localLessonStore, type LessonRecordInput, type LocalLessonRecord } from "./lesson-records";
import { lessonVersionStore, setLessonCorrectionCloud } from "./lesson-correction-config";
import type { LessonCorrectionPolicy } from "./lesson-correction";
import type { LessonRecordVersion } from "./lesson-versions";
import { attendanceStore, type AttendanceMarks, type AttendanceRecord } from "./attendance";
import { attendanceClosingStore } from "./attendance-closing-store";
import { ATTENDANCE_STAGE_AFTER, attendanceScopeKey } from "./attendance-closing";
import type {
  AttendanceClosingAction,
  AttendanceClosingEvent,
  AttendanceClosingScope,
  AttendanceClosingWorkflow,
  PeriodAttendanceClosingRecord,
} from "./attendance-closing-types";
import {
  infantExperienceStore,
  type InfantExperienceInput,
  type InfantExperienceRecord,
} from "./infant-experiences";

export type CloudResult = { ok: true; id: string } | { ok: false; message: string };

// ----------------------------------------------------------------- meta

type Meta = {
  lessonCurrent: Record<string, string>;
  attendanceCurrent: Record<string, string>;
  experienceCurrent: Record<string, string>;
  closingLastEvent: Record<string, string>;
  /** Versão vigente da chamada, por aula — usada para conferir o fechamento. */
  attendanceCurrentByLesson: Record<string, string>;
  policies: PolicyRow[];
};

const meta: Meta = {
  lessonCurrent: {},
  attendanceCurrent: {},
  experienceCurrent: {},
  closingLastEvent: {},
  attendanceCurrentByLesson: {},
  policies: [],
};

type PolicyRow = {
  id: string;
  logical_policy_id: string;
  version: number;
  family_id: string;
  applies_when_official_closing: string;
  outcome: string;
  required_capabilities: string[];
  requirement_codes: string[];
  admissible_changes: string[] | null;
  definition: Record<string, unknown> | null;
};

/** Há regra de correção homologada para a família? Sem ela, correção falha fechada. */
export function cloudCorrectionPolicies(familyId: string) {
  return meta.policies.filter((p) => p.family_id === familyId);
}

/** Componente da atuação; sem código curricular, a própria atuação identifica o escopo. */
export function assignmentScope(assignmentId: string) {
  const a = teachingAssignments().find((item) => item.id === assignmentId);
  return a ? { classId: a.classId, componentId: a.fieldId ?? `atuacao:${a.id}` } : undefined;
}

// ------------------------------------------------------------ mapeamentos

function currentOf<T extends { id: string }>(rows: T[], key: (r: T) => string, supersedes: (r: T) => string | null) {
  const superseded = new Set(rows.map(supersedes).filter(Boolean));
  const out = new Map<string, T>();
  for (const r of rows) if (!superseded.has(r.id)) out.set(key(r), r);
  return out;
}

type LessonRow = {
  id: string;
  logical_record_id: string;
  version_number: number;
  supersedes_version_id: string | null;
  facts: LessonRecordInput;
  rectification: Record<string, unknown> | null;
  author_person_id: string;
  concluded_at: string;
};

export function lessonRowToVersion(r: LessonRow): LessonRecordVersion {
  const rect = r.rectification;
  return {
    id: r.id,
    logicalRecordId: r.logical_record_id,
    version: r.version_number,
    ...(r.supersedes_version_id ? { supersedesVersionId: r.supersedes_version_id } : {}),
    status: "Concluída",
    facts: r.facts,
    createdAt: r.concluded_at,
    concludedAt: r.concluded_at,
    ...(rect
      ? {
          rectification: {
            actedAt: r.concluded_at,
            agentId: r.author_person_id,
            policyId: String(rect["policyId"] ?? ""),
            policyVersion: Number(rect["policyVersion"] ?? 0),
            policyLabel: String(rect["policyId"] ?? ""),
            satisfiedRequirements: ((rect["requirementCodes"] as string[] | undefined) ?? []).map((code) => ({
              code,
              label: code,
              provenance: `Regra ${String(rect["policyId"])} (versão ${String(rect["policyVersion"])}).`,
            })),
            ...(rect["justification"] ? { justification: String(rect["justification"]) } : {}),
            changedAspects: (rect["changedAspects"] as string[] | undefined) ?? [],
          },
        }
      : {}),
  };
}

type AttendanceRow = {
  id: string;
  lesson_logical_id: string;
  version_number: number;
  supersedes_version_id: string | null;
  marks: AttendanceMarks;
  rectification: { justification?: string; changes?: NonNullable<AttendanceRecord["rectification"]>["changes"] } | null;
  author_person_id: string;
  recorded_at: string;
};

export function attendanceRowToRecord(r: AttendanceRow): AttendanceRecord {
  return {
    entryId: r.lesson_logical_id,
    marks: r.marks,
    concluded: true,
    origin: "local",
    version: r.version_number,
    ...(r.rectification
      ? {
          rectification: {
            at: r.recorded_at,
            actorId: r.author_person_id,
            actorName: r.author_person_id,
            ...(r.rectification.justification ? { justification: r.rectification.justification } : {}),
            changes: r.rectification.changes ?? [],
          },
        }
      : {}),
  };
}

type ClosingEventRow = {
  id: string;
  scope_key: string;
  sequence: number;
  action: string;
  scope: AttendanceClosingScope;
  detail: string;
  justification: string | null;
  closing_version_id: string | null;
  author_person_id: string;
  acted_at: string;
};
type ClosingVersionRow = { id: string; version_number: number; preceding_closing_id: string | null; record: PeriodAttendanceClosingRecord };

export function attendanceClosingStateFromRows(events: ClosingEventRow[], versions: ClosingVersionRow[]) {
  const records = versions.map<PeriodAttendanceClosingRecord>((v) => ({
    ...v.record,
    id: v.id,
    version: v.version_number,
    ...(v.preceding_closing_id ? { precedingClosingId: v.preceding_closing_id } : {}),
  }));
  const byId = new Map(records.map((r) => [r.id, r]));
  const workflows: Record<string, AttendanceClosingWorkflow> = {};
  const last: Record<string, string> = {};
  for (const e of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const action = e.action as AttendanceClosingAction;
    const rec = e.closing_version_id ? byId.get(e.closing_version_id) : undefined;
    const event: AttendanceClosingEvent = {
      at: e.acted_at,
      action,
      actor: { actorId: e.author_person_id, actorName: e.author_person_id, profileLabel: "", at: e.acted_at },
      detail: e.detail,
      ...(e.justification ? { justification: e.justification } : {}),
      ...(rec ? { closingId: rec.id, closingVersion: rec.version } : {}),
    };
    workflows[e.scope_key] = {
      scopeKey: e.scope_key,
      scope: e.scope,
      stage: ATTENDANCE_STAGE_AFTER[action],
      events: [...(workflows[e.scope_key]?.events ?? []), event],
    };
    last[e.scope_key] = e.id;
  }
  return { state: { workflows, records }, last };
}

type ExperienceRow = {
  id: string;
  logical_experience_id: string;
  supersedes_version_id: string | null;
  lesson_logical_id: string;
  record: InfantExperienceInput;
  registered_at: string;
};

function toLessonPolicy(p: PolicyRow): LessonCorrectionPolicy {
  return {
    id: p.logical_policy_id,
    version: p.version,
    label: String(p.definition?.["label"] ?? p.logical_policy_id),
    homologated: true,
    appliesWhenOfficialClosing: p.applies_when_official_closing as LessonCorrectionPolicy["appliesWhenOfficialClosing"],
    outcome: p.outcome === "admissible" ? "admissible" : "forbidden",
    requiredCapabilities: p.required_capabilities,
    requirements: p.requirement_codes.map((code) => ({
      code,
      label: code === "justificativa" ? "Justificativa da correção" : code,
      provenance: `Exigida pela regra homologada ${p.logical_policy_id} (versão ${p.version}).`,
    })),
    admissibleChanges: p.admissible_changes ?? [],
    disclosesNormativeContext: true,
  };
}

// ---------------------------------------------------------------- leitura

export async function hydrateDiaryFromCloud() {
  const [l, a, ce, cv, x, p, caps] = await Promise.all([
    supabase.from("lesson_record_versions").select("id, logical_record_id, version_number, supersedes_version_id, facts, rectification, author_person_id, concluded_at"),
    supabase.from("attendance_record_versions").select("id, lesson_logical_id, version_number, supersedes_version_id, marks, rectification, author_person_id, recorded_at"),
    supabase.from("attendance_closing_events").select("id, scope_key, sequence, action, scope, detail, justification, closing_version_id, author_person_id, acted_at"),
    supabase.from("attendance_closing_versions").select("id, version_number, preceding_closing_id, record"),
    supabase.from("infant_experience_versions").select("id, logical_experience_id, supersedes_version_id, lesson_logical_id, record, registered_at"),
    supabase.from("diary_correction_policies").select("id, logical_policy_id, version, family_id, applies_when_official_closing, outcome, required_capabilities, requirement_codes, admissible_changes, definition"),
    supabase.rpc("effective_capabilities"),
  ]);
  const failure = l.error ?? a.error ?? ce.error ?? cv.error ?? x.error ?? p.error;
  if (failure) throw failure;

  const lessons = (l.data ?? []) as unknown as LessonRow[];
  const lessonCurrent = currentOf(lessons, (r) => r.logical_record_id, (r) => r.supersedes_version_id);
  meta.lessonCurrent = Object.fromEntries([...lessonCurrent].map(([k, r]) => [k, r.id]));
  localLessonStore.hydrateOfficial(
    [...lessonCurrent.values()].map<LocalLessonRecord>((r) => ({
      ...r.facts,
      id: r.logical_record_id,
      status: "Registrado oficialmente",
      createdAt: r.concluded_at,
    })),
  );
  lessonVersionStore.hydrate(lessons.map(lessonRowToVersion));

  const attendance = (a.data ?? []) as unknown as AttendanceRow[];
  const attCurrent = currentOf(attendance, (r) => r.lesson_logical_id, (r) => r.supersedes_version_id);
  meta.attendanceCurrent = Object.fromEntries([...attCurrent].map(([k, r]) => [k, r.id]));
  meta.attendanceCurrentByLesson = meta.attendanceCurrent;
  const currentIds = new Set([...attCurrent.values()].map((r) => r.id));
  attendanceStore.hydrateOfficial(
    [...attCurrent.values()].map(attendanceRowToRecord),
    attendance.filter((r) => !currentIds.has(r.id)).sort((m, n) => m.version_number - n.version_number).map(attendanceRowToRecord),
  );

  const built = attendanceClosingStateFromRows(
    (ce.data ?? []) as unknown as ClosingEventRow[],
    (cv.data ?? []) as unknown as ClosingVersionRow[],
  );
  meta.closingLastEvent = built.last;
  attendanceClosingStore.hydrate(built.state);

  const experiences = (x.data ?? []) as unknown as ExperienceRow[];
  const expCurrent = currentOf(experiences, (r) => r.logical_experience_id, (r) => r.supersedes_version_id);
  meta.experienceCurrent = Object.fromEntries([...expCurrent].map(([k, r]) => [k, r.id]));
  infantExperienceStore.hydrateOfficial(
    [...expCurrent.values()].map<InfantExperienceRecord>((r) => ({
      ...r.record,
      id: r.logical_experience_id,
      status: "Registrada oficialmente",
      origin: "local",
      relatedLessonId: r.lesson_logical_id,
      createdAt: r.registered_at,
    })),
  );

  meta.policies = (p.data ?? []) as unknown as PolicyRow[];
  setLessonCorrectionCloud({
    agent: {
      agentId: "sessao",
      capabilities: ((caps.data ?? []) as { capability_id: string }[]).map((c) => c.capability_id),
    },
    policies: cloudCorrectionPolicies("registro-de-aula").map(toLessonPolicy),
  });
}

/**
 * Liga o modo com sessão enquanto houver usuário autenticado e mantém o
 * espelho hidratado. Montado no cabeçalho de todas as telas do Diário.
 */
export function useDiaryCloudSync() {
  const { user, loading } = useSessionUser();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setDiaryPersistenceMode("laboratorio");
      setLessonCorrectionCloud(null);
      resetInstitutionalRoster();
      return;
    }
    setDiaryPersistenceMode("cloud");
    // Estudantes primeiro: as demais famílias se projetam sobre a lista canônica.
    void hydrateInstitutionalRoster()
      .then(() => hydrateDiaryFromCloud())
      .catch(() => undefined);
  }, [user, loading]);
}

// ---------------------------------------------------------------- escrita

async function finish(error: { message: string } | null, id: unknown): Promise<CloudResult> {
  await hydrateDiaryFromCloud().catch(() => undefined);
  return error ? { ok: false, message: refusalMessage(error.message) } : { ok: true, id: String(id) };
}

export function newLogicalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Conclusão do registro de aula = nascimento da versão oficial v1. */
export async function concludeLessonInCloud(facts: LessonRecordInput, logicalId: string): Promise<CloudResult> {
  const scope = assignmentScope(facts.assignmentId);
  if (!scope) return { ok: false, message: "Atuação pedagógica não encontrada. Nada foi gravado." };
  const { data, error } = await supabase.rpc("record_lesson_version", {
    _logical: logicalId,
    _class: scope.classId,
    _component: scope.componentId,
    _assignment: facts.assignmentId,
    _date: facts.date,
    _base_version_id: null as unknown as string,
    _facts: facts as never,
    _justification: "",
    _changed_aspects: [],
    _plan_id: `aula:${logicalId}:origem`,
  });
  return finish(error, data);
}

export async function rectifyLessonInCloud(input: {
  logicalRecordId: string;
  baseVersionId: string;
  facts: LessonRecordInput;
  justification?: string;
  changedAspects: readonly string[];
}): Promise<CloudResult> {
  const scope = assignmentScope(input.facts.assignmentId);
  if (!scope) return { ok: false, message: "Atuação pedagógica não encontrada. Nada foi gravado." };
  const { data, error } = await supabase.rpc("record_lesson_version", {
    _logical: input.logicalRecordId,
    _class: scope.classId,
    _component: scope.componentId,
    _assignment: input.facts.assignmentId,
    _date: input.facts.date,
    _base_version_id: input.baseVersionId,
    _facts: input.facts as never,
    _justification: input.justification ?? "",
    _changed_aspects: [...input.changedAspects],
    _plan_id: `aula:${input.logicalRecordId}:${input.baseVersionId}`,
  });
  return finish(error, data);
}

/** Chamada concluída (v1) ou corrigida (vN+1). Rascunho nunca vai ao banco. */
export async function recordAttendanceInCloud(entryId: string, marks: AttendanceMarks, justification = ""): Promise<CloudResult> {
  const base = meta.attendanceCurrent[entryId] ?? null;
  const { data, error } = await supabase.rpc("record_attendance_version", {
    _lesson_logical: entryId,
    _base_version_id: base as string,
    _marks: marks as never,
    _justification: justification,
    _plan_id: `chamada:${entryId}:${base ?? "origem"}`,
  });
  return finish(error, data);
}

export function isOfficialLesson(entryId: string) {
  return Boolean(meta.lessonCurrent[entryId]);
}

export async function recordAttendanceClosingActInCloud(input: {
  scope: AttendanceClosingScope;
  action: AttendanceClosingAction;
  detail: string;
  justification?: string;
  record?: PeriodAttendanceClosingRecord;
}): Promise<CloudResult> {
  const scopeKey = attendanceScopeKey(input.scope);
  const last = meta.closingLastEvent[scopeKey] ?? null;
  const current = attendanceClosingStore.current(input.scope);
  const expectedUsed = input.record
    ? input.record.lessonEntryIds.map((id) => meta.attendanceCurrentByLesson[id]).filter((id): id is string => Boolean(id))
    : [];
  const { data, error } = await supabase.rpc("record_attendance_closing_act", {
    _scope_key: scopeKey,
    _class: input.scope.classId,
    _period: input.scope.periodId,
    _scope: input.scope as never,
    _action: input.action,
    _expected_last_event_id: last as string,
    _expected_closing_id: (current?.id ?? null) as string,
    _detail: input.detail,
    _justification: input.justification ?? "",
    _record: (input.record ?? null) as never,
    _expected_attendance_version_ids: expectedUsed,
    _plan_id: `frequencia:${scopeKey}:${last ?? "origem"}:${input.action}`,
  });
  return finish(error, data);
}

/** Primeira oficialização grava experiência + aula numa única transação. */
export async function registerInfantExperienceInCloud(input: {
  logicalId: string;
  record: InfantExperienceInput;
  lessonLogicalId: string;
  lessonFacts: LessonRecordInput;
  justification?: string;
}): Promise<CloudResult> {
  const scope = assignmentScope(input.record.assignmentId);
  if (!scope) return { ok: false, message: "Atuação pedagógica não encontrada. Nada foi gravado." };
  const base = meta.experienceCurrent[input.logicalId] ?? null;
  const { data, error } = await supabase.rpc("register_infant_experience", {
    _logical: input.logicalId,
    _base_version_id: base as string,
    _class: scope.classId,
    _component: scope.componentId,
    _assignment: input.record.assignmentId,
    _date: input.record.date,
    _record: input.record as never,
    _lesson_logical: input.lessonLogicalId,
    _lesson_facts: input.lessonFacts as never,
    _justification: input.justification ?? "",
    _plan_id: `experiencia:${input.logicalId}:${base ?? "origem"}`,
  });
  return finish(error, data);
}
