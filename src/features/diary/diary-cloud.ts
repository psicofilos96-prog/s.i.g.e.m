import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
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
 *
 * B4.10.0c — leitura (`readDiaryFromCloud`) é pura e lança em QUALQUER erro (inclusive das capacidades);
 * só o controlador de sessão (diary-session.ts) aplica (`applyDiaryMirror`) e só para o contexto que pediu.
 * Toda escrita exige `diaryWriteContext()` (espelho aceito); a releitura pós-RPC só aplica se o contexto
 * que iniciou a escrita ainda for o corrente. RPC aceito não é desfeito: nada aqui promete rollback.
 */
import { supabase } from "@/integrations/supabase/client";
import { readAllEffectiveCapabilities } from "@/features/authority/read-all-capabilities";
import {
  diaryGeneration,
  diarySessionState,
  diaryWriteContext,
  isCurrentDiaryContext,
  nextDiaryGeneration,
  setDiarySessionState,
  type DiaryWriteContext,
} from "./diary-session-state";
import { refusalMessage } from "@/features/assessment/assessment-results-cloud";
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

const emptyMeta = (): Meta => ({
  lessonCurrent: {},
  attendanceCurrent: {},
  experienceCurrent: {},
  closingLastEvent: {},
  attendanceCurrentByLesson: {},
  policies: [],
});
let meta: Meta = emptyMeta();

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

/** Espelho preparado (nada aplicado ainda). */
export type DiaryMirror = {
  meta: Meta;
  lessons: LocalLessonRecord[];
  lessonVersions: LessonRecordVersion[];
  attendanceCurrent: AttendanceRecord[];
  attendanceSuperseded: AttendanceRecord[];
  closing: ReturnType<typeof attendanceClosingStateFromRows>["state"];
  experiences: InfantExperienceRecord[];
  capabilities: string[];
};

export async function readDiaryFromCloud(): Promise<DiaryMirror> {
  const [l, a, ce, cv, x, p, caps] = await Promise.all([
    supabase.from("lesson_record_versions").select("id, logical_record_id, version_number, supersedes_version_id, facts, rectification, author_person_id, concluded_at"),
    supabase.from("attendance_record_versions").select("id, lesson_logical_id, version_number, supersedes_version_id, marks, rectification, author_person_id, recorded_at"),
    supabase.from("attendance_closing_events").select("id, scope_key, sequence, action, scope, detail, justification, closing_version_id, author_person_id, acted_at"),
    supabase.from("attendance_closing_versions").select("id, version_number, preceding_closing_id, record"),
    supabase.from("infant_experience_versions").select("id, logical_experience_id, supersedes_version_id, lesson_logical_id, record, registered_at"),
    supabase.from("diary_correction_policies").select("id, logical_policy_id, version, family_id, applies_when_official_closing, outcome, required_capabilities, requirement_codes, admissible_changes, definition"),
    readAllEffectiveCapabilities(supabase),
  ]);
  // B4.10.0c — capacidades fazem parte do lote: erro nelas recusa o lote inteiro.
  const failure = l.error ?? a.error ?? ce.error ?? cv.error ?? x.error ?? p.error ?? caps.error;
  if (failure) throw new Error(failure.message);

  const m = emptyMeta();
  const lessons = (l.data ?? []) as unknown as LessonRow[];
  const lessonCurrent = currentOf(lessons, (r) => r.logical_record_id, (r) => r.supersedes_version_id);
  m.lessonCurrent = Object.fromEntries([...lessonCurrent].map(([k, r]) => [k, r.id]));

  const attendance = (a.data ?? []) as unknown as AttendanceRow[];
  const attCurrent = currentOf(attendance, (r) => r.lesson_logical_id, (r) => r.supersedes_version_id);
  m.attendanceCurrent = Object.fromEntries([...attCurrent].map(([k, r]) => [k, r.id]));
  m.attendanceCurrentByLesson = m.attendanceCurrent;
  const currentIds = new Set([...attCurrent.values()].map((r) => r.id));

  const built = attendanceClosingStateFromRows(
    (ce.data ?? []) as unknown as ClosingEventRow[],
    (cv.data ?? []) as unknown as ClosingVersionRow[],
  );
  m.closingLastEvent = built.last;

  const experiences = (x.data ?? []) as unknown as ExperienceRow[];
  const expCurrent = currentOf(experiences, (r) => r.logical_experience_id, (r) => r.supersedes_version_id);
  m.experienceCurrent = Object.fromEntries([...expCurrent].map(([k, r]) => [k, r.id]));
  m.policies = (p.data ?? []) as unknown as PolicyRow[];

  return {
    meta: m,
    lessons: [...lessonCurrent.values()].map<LocalLessonRecord>((r) => ({
      ...r.facts,
      id: r.logical_record_id,
      status: "Registrado oficialmente",
      createdAt: r.concluded_at,
    })),
    lessonVersions: lessons.map(lessonRowToVersion),
    attendanceCurrent: [...attCurrent.values()].map(attendanceRowToRecord),
    attendanceSuperseded: attendance
      .filter((r) => !currentIds.has(r.id))
      .sort((m1, n) => m1.version_number - n.version_number)
      .map(attendanceRowToRecord),
    closing: built.state,
    experiences: [...expCurrent.values()].map<InfantExperienceRecord>((r) => ({
      ...r.record,
      id: r.logical_experience_id,
      status: "Registrada oficialmente",
      origin: "local",
      relatedLessonId: r.lesson_logical_id,
      createdAt: r.registered_at,
    })),
    capabilities: ((caps.data ?? []) as { capability_id: string }[]).map((c) => c.capability_id),
  };
}

/** Aplica o espelho aceito; meta, bases e capacidades pertencem à MESMA leitura. Rascunhos preservados. */
export function applyDiaryMirror(mirror: DiaryMirror) {
  meta = mirror.meta;
  localLessonStore.hydrateOfficial(mirror.lessons);
  lessonVersionStore.hydrate(mirror.lessonVersions);
  attendanceStore.hydrateOfficial(mirror.attendanceCurrent, mirror.attendanceSuperseded);
  attendanceClosingStore.hydrate(mirror.closing);
  infantExperienceStore.hydrateOfficial(mirror.experiences);
  setLessonCorrectionCloud({
    agent: { agentId: "sessao", capabilities: mirror.capabilities },
    policies: cloudCorrectionPolicies("registro-de-aula").map(toLessonPolicy),
  });
}

/** Esquece meta/bases/capacidades institucionais (troca de contexto ou erro). */
export function resetDiaryMirror() {
  meta = emptyMeta();
  setLessonCorrectionCloud(null);
}

/**
 * Releitura pós-RPC: só para o contexto que iniciou a escrita, se ainda corrente; a mais nova vence.
 * Falha ⇒ espelho esquecido e erro visível (nunca base antiga como atual).
 */
export async function refreshDiaryMirror(ctx: DiaryWriteContext): Promise<boolean> {
  if (!isCurrentDiaryContext(ctx)) return false;
  const mine = nextDiaryGeneration();
  try {
    const mirror = await readDiaryFromCloud();
    if (diaryGeneration() !== mine || !isCurrentDiaryContext(ctx)) return false;
    applyDiaryMirror(mirror);
    return true;
  } catch (e) {
    if (diaryGeneration() !== mine || diarySessionState().key !== ctx.key) return false;
    resetDiaryMirror();
    setDiaryPersistenceMode("pendente");
    setDiarySessionState({
      phase: "erro",
      key: ctx.key,
      userId: ctx.userId,
      error: `A gravação foi enviada, mas a releitura da base falhou: ${e instanceof Error ? e.message : String(e)}`,
    });
    return false;
  }
}

// ---------------------------------------------------------------- escrita

const NO_CONTEXT: CloudResult = {
  ok: false,
  message: "A base institucional do Diário ainda não está pronta para esta sessão. Nada foi gravado.",
};

async function finish(ctx: DiaryWriteContext, error: { message: string } | null, id: unknown): Promise<CloudResult> {
  // Recarrega só se o contexto que iniciou a escrita ainda for o corrente (A→B nunca hidrata B).
  await refreshDiaryMirror(ctx);
  return error ? { ok: false, message: refusalMessage(error.message) } : { ok: true, id: String(id) };
}

export function newLogicalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Frente W: gravação só pelo writer v2 — exige regência canônica (`ta-…`) ou substituição vigente da própria pessoa,
 * ano operacional, dia letivo, período e blocos da grade explícitos. Atuação sem regência falha fechada no banco.
 */
export type LessonW = { substitutionId?: string | null; blockIds?: readonly string[]; referenceItemIds?: readonly string[] };

/** W.1: só regência canônica (`ta-…`) grava; atuação/lotação do fluxo legado nunca chega ao writer. */
export const LEGACY_LESSON_WRITE_RETIRED: CloudResult = {
  ok: false,
  message: "Com sua conta, aulas são registradas em “Meus diários”, a partir da sua regência vigente. Nada foi gravado.",
};
export const isCanonicalAssignmentId = (id: string | null | undefined) => typeof id === "string" && id.startsWith("ta-");

export async function concludeLessonInCloud(facts: LessonRecordInput, logicalId: string, w: LessonW = {}): Promise<CloudResult> {
  const ctx = diaryWriteContext();
  if (!ctx) return NO_CONTEXT;
  if (!isCanonicalAssignmentId(facts.assignmentId)) return LEGACY_LESSON_WRITE_RETIRED;
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>)("record_lesson_version_v2", {
    _logical: logicalId, _assignment: facts.assignmentId, _substitution: w.substitutionId ?? null, _date: facts.date,
    _base_version_id: null, _facts: facts, _blocks: [...(w.blockIds ?? [])], _references: [...(w.referenceItemIds ?? [])],
    _justification: null, _changed_aspects: [], _plan_id: `aula:${logicalId}:origem`,
  });
  return finish(ctx, error, data);
}

export async function rectifyLessonInCloud(input: {
  logicalRecordId: string;
  baseVersionId: string;
  facts: LessonRecordInput;
  justification?: string;
  changedAspects: readonly string[];
} & LessonW): Promise<CloudResult> {
  const ctx = diaryWriteContext();
  if (!ctx) return NO_CONTEXT;
  if (!isCanonicalAssignmentId(input.facts.assignmentId)) return LEGACY_LESSON_WRITE_RETIRED;
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>)("record_lesson_version_v2", {
    _logical: input.logicalRecordId, _assignment: input.facts.assignmentId, _substitution: input.substitutionId ?? null, _date: input.facts.date,
    _base_version_id: input.baseVersionId, _facts: input.facts, _blocks: [...(input.blockIds ?? [])], _references: [...(input.referenceItemIds ?? [])],
    _justification: input.justification ?? null, _changed_aspects: [...input.changedAspects],
    _plan_id: `aula:${input.logicalRecordId}:${input.baseVersionId}`,
  });
  return finish(ctx, error, data);
}

/** Chamada concluída (v1) ou corrigida (vN+1). Rascunho nunca vai ao banco. */
export async function recordAttendanceInCloud(entryId: string, marks: AttendanceMarks, justification = ""): Promise<CloudResult> {
  const ctx = diaryWriteContext();
  if (!ctx) return NO_CONTEXT;
  const base = meta.attendanceCurrent[entryId] ?? null;
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>)("record_attendance_version_v2", {
    _lesson_logical: entryId,
    _base_version_id: base as string,
    _marks: marks as never,
    _justification: justification,
    _plan_id: `chamada:${entryId}:${base ?? "origem"}`,
  });
  return finish(ctx, error, data);
}

export function isOfficialLesson(entryId: string) {
  return Boolean(diaryWriteContext() && meta.lessonCurrent[entryId]);
}

export async function recordAttendanceClosingActInCloud(input: {
  scope: AttendanceClosingScope;
  action: AttendanceClosingAction;
  detail: string;
  justification?: string;
  record?: PeriodAttendanceClosingRecord;
}): Promise<CloudResult> {
  const ctx = diaryWriteContext();
  if (!ctx) return NO_CONTEXT;
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
  return finish(ctx, error, data);
}

/** Primeira oficialização grava experiência + aula numa única transação. */
export async function registerInfantExperienceInCloud(input: {
  logicalId: string;
  record: InfantExperienceInput;
  lessonLogicalId: string;
  lessonFacts: LessonRecordInput;
  justification?: string;
}): Promise<CloudResult> {
  const ctx = diaryWriteContext();
  if (!ctx) return NO_CONTEXT;
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
  return finish(ctx, error, data);
}
