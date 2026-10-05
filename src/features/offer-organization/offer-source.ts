/**
 * Frente V — única porta TS da organização da oferta. Lê só readers canônicos e grava só pelos
 * writers estreitos do banco (sessão → pessoa → atuação → capacidade na data-alvo → estado anual).
 * Nada é calculado como fato aqui; a tela apenas apresenta.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DraftBlock, Interval, ReadinessRow } from "./offer-model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: { message: string } | null }>;
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const OFFER_CAPS = {
  journey: "manter-jornada-da-turma",
  schedule: "manter-grade-da-turma",
  assignment: "manter-atribuicao-docente",
  read: "consultar-organizacao-da-oferta",
} as const;

export type OfferContext = {
  classId: string; className: string; schoolId: string; academicYearId: string;
  yearStart: string | null; yearEnd: string | null; yearState: string | null;
};

export async function readOfferContext(classId: string): Promise<OfferContext | null> {
  const { data: c, error } = await supabase.from("institutional_classes").select("id,name,school_id,academic_year_id").eq("id", classId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) return null;
  const { data: y } = await supabase.from("institutional_academic_year_versions").select("starts_on,ends_on,version")
    .eq("academic_year_id", c.academic_year_id).order("version", { ascending: false }).limit(1);
  const { data: s } = await supabase.from("academic_year_operational_states").select("state,sequence")
    .eq("academic_year_id", c.academic_year_id).order("sequence", { ascending: false }).limit(1);
  const yr = (y ?? [])[0] as { starts_on: string; ends_on: string } | undefined;
  const st = (s ?? [])[0] as { state: string } | undefined;
  return { classId: c.id, className: c.name, schoolId: c.school_id, academicYearId: c.academic_year_id,
    yearStart: yr?.starts_on ?? null, yearEnd: yr?.ends_on ?? null, yearState: st?.state ?? null };
}

/** Capacidades efetivas na data-alvo (não no relógio), só para mostrar/ocultar ações. */
export async function capabilitiesOn(on: string, schoolId: string): Promise<Set<string>> {
  const rows = await call<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null }[]>("effective_scope_capabilities", { _on: on });
  return new Set((rows ?? []).filter((r) => r.policy_id && ((r.scope_level === "escola" && r.school_id === schoolId) || r.scope_level === "rede")).map((r) => r.capability_id));
}

export async function canWriteOn(on: string, schoolId: string, cap: string): Promise<boolean> {
  const rows = await call<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null }[]>("effective_scope_capabilities", { _on: on });
  return (rows ?? []).some((r) => r.policy_id && r.capability_id === cap && r.scope_level === "escola" && r.school_id === schoolId);
}

type Head = { id: string; version: number } | null;
async function head(table: "class_journey_versions" | "class_schedule_versions", parent: "class_journeys" | "class_schedules", fk: "journey_id" | "schedule_id", classId: string): Promise<Head> {
  const { data: p } = await supabase.from(parent).select("id").eq("class_id", classId).maybeSingle();
  if (!p) return null;
  const { data, error } = await supabase.from(table).select("id,version").eq(fk, (p as { id: string }).id).order("version", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as Head) ?? null;
}
export const journeyHead = (classId: string) => head("class_journey_versions", "class_journeys", "journey_id", classId);
export const scheduleHead = (classId: string) => head("class_schedule_versions", "class_schedules", "schedule_id", classId);

export type JourneyRead = { kind: "negado" | "ausente" | "vigente"; intervals: Interval[]; version: number | null; validFrom: string | null };
export async function readJourney(classId: string, on: string, knownAt: string): Promise<JourneyRead> {
  const rows = await call<{ result_kind: string; weekday: number; starts_at: string; ends_at: string; version: number; valid_from: string }[]>(
    "class_journey_at", { _class_id: classId, _on: on, _known_at: knownAt });
  const r0 = rows?.[0];
  if (!r0 || r0.result_kind === "absent") return { kind: "ausente", intervals: [], version: null, validFrom: null };
  if (r0.result_kind === "access-denied") return { kind: "negado", intervals: [], version: null, validFrom: null };
  return { kind: "vigente", version: r0.version, validFrom: r0.valid_from,
    intervals: rows.map((r) => ({ weekday: r.weekday, startsAt: r.starts_at.slice(0, 5), endsAt: r.ends_at.slice(0, 5) })) };
}

export type ScheduleBlockRead = { blockId: string; blockKey: string; weekday: number; startsAt: string; endsAt: string; label: string | null; state: string; coverage: string; responsibles: number };
export type ScheduleRead = { kind: "negado" | "ausente" | "vigente"; state: string | null; version: number | null; blocks: ScheduleBlockRead[] };
export async function readSchedule(classId: string, on: string, knownAt: string): Promise<ScheduleRead> {
  const rows = await call<{ result_kind: string; schedule_state: string; version: number; block_id: string; block_key: string; weekday: number; starts_at: string; ends_at: string; component_name: string | null; nature_label: string | null; block_state: string; coverage_state: string; engagement_ids: string[] }[]>(
    "class_schedule_at", { _class_id: classId, _on: on, _known_at: knownAt });
  const r0 = rows?.[0];
  if (!r0 || r0.result_kind === "absent") return { kind: "ausente", state: null, version: null, blocks: [] };
  if (r0.result_kind === "access-denied") return { kind: "negado", state: null, version: null, blocks: [] };
  return { kind: "vigente", state: r0.schedule_state, version: r0.version, blocks: rows.map((r) => ({
    blockId: r.block_id, blockKey: r.block_key, weekday: r.weekday, startsAt: r.starts_at.slice(0, 5), endsAt: r.ends_at.slice(0, 5),
    label: r.component_name ?? r.nature_label, state: r.block_state, coverage: r.coverage_state, responsibles: r.engagement_ids?.length ?? 0 })) };
}

export type CurricularElement = { matrixVersionId: string; matrixId: string; itemKey: string; label: string | null };
/** Elementos das matrizes efetivamente resolvidas para a turma na data (nenhuma é escolhida como dominante). */
export async function readApplicableElements(schoolId: string, classId: string, on: string, knownAt: string): Promise<CurricularElement[]> {
  const ms = await call<{ result_kind: string; state: string; matrix_id: string; matrix_version_id: string | null }[]>(
    "class_curricular_matrices_at", { _school: schoolId, _class_id: classId, _on: on, _known_at: knownAt });
  const resolved = (ms ?? []).filter((m) => m.matrix_version_id && ((m.result_kind === "matrix" && m.state === "resolvida-por-posicao") || (m.result_kind === "specific-link" && m.state === "associacao-explicita")));
  if (!resolved.length) return [];
  const { data, error } = await supabase.from("curricular_matrix_items").select("matrix_version_id,item_key,component_label_snapshot")
    .in("matrix_version_id", resolved.map((m) => m.matrix_version_id!));
  if (error) throw new Error(error.message);
  return ((data ?? []) as { matrix_version_id: string; item_key: string; component_label_snapshot: string | null }[]).map((i) => ({
    matrixVersionId: i.matrix_version_id, itemKey: i.item_key, label: i.component_label_snapshot,
    matrixId: resolved.find((m) => m.matrix_version_id === i.matrix_version_id)!.matrix_id }));
}

export type AssignmentRead = { assignmentId: string; versionId: string; from: string; until: string | null; engagementId: string; personId: string | null; label: string | null; state: string; co: number };
export async function readAssignments(classId: string, on: string, knownAt: string): Promise<AssignmentRead[]> {
  const rows = await call<{ assignment_id: string; version_id: string; effective_from: string; effective_until: string | null; engagement_id: string; person_id: string | null; component_label_snapshot: string | null; assignment_state: string; co_assigned_engagement_ids: string[] | null }[]>(
    "teaching_assignments_at", { _class_id: classId, _on: on, _known_at: knownAt });
  return (rows ?? []).map((r) => ({ assignmentId: r.assignment_id, versionId: r.version_id, from: r.effective_from, until: r.effective_until,
    engagementId: r.engagement_id, personId: r.person_id, label: r.component_label_snapshot, state: r.assignment_state, co: r.co_assigned_engagement_ids?.length ?? 0 }));
}

export type SubstitutionRead = { substitutionId: string; assignmentId: string; versionId: string; from: string; until: string; substituteEngagementId: string; titularEngagementId: string | null; reason: string };
export async function readSubstitutions(classId: string, on: string, knownAt: string): Promise<SubstitutionRead[]> {
  const rows = await call<{ substitution_id: string; assignment_id: string; version_id: string; effective_from: string; effective_until: string; substitute_engagement_id: string; titular_engagement_id: string | null; reason: string }[]>(
    "teaching_substitutions_at", { _class_id: classId, _on: on, _known_at: knownAt });
  return (rows ?? []).map((r) => ({ substitutionId: r.substitution_id, assignmentId: r.assignment_id, versionId: r.version_id, from: r.effective_from,
    until: r.effective_until, substituteEngagementId: r.substitute_engagement_id, titularEngagementId: r.titular_engagement_id, reason: r.reason }));
}

export type SchoolScheduleRow = { personId: string; engagementId: string; origin: "titular" | "substituicao"; classId: string; className: string; blockId: string; weekday: number; startsAt: string; endsAt: string; minutes: number; label: string | null; conflicts: string[] };
export async function readSchoolSchedule(schoolId: string, on: string, knownAt: string): Promise<{ denied: boolean; rows: SchoolScheduleRow[] }> {
  const rows = await call<{ result_kind: string; person_id: string; engagement_id: string; origin: "titular" | "substituicao"; class_id: string; class_name: string; block_id: string; weekday: number; starts_at: string; ends_at: string; block_minutes: number; component_label: string | null; conflict_with_block_ids: string[] }[]>(
    "school_teaching_schedule_at", { _school_id: schoolId, _on: on, _known_at: knownAt });
  if ((rows ?? []).some((r) => r.result_kind === "access-denied")) return { denied: true, rows: [] };
  return { denied: false, rows: (rows ?? []).map((r) => ({ personId: r.person_id, engagementId: r.engagement_id, origin: r.origin, classId: r.class_id, className: r.class_name,
    blockId: r.block_id, weekday: r.weekday, startsAt: r.starts_at.slice(0, 5), endsAt: r.ends_at.slice(0, 5), minutes: r.block_minutes, label: r.component_label, conflicts: r.conflict_with_block_ids ?? [] })) };
}

export type LoadRow = { personId: string; engagementId: string; classes: number; blocks: number; minutes: number; conflicts: number; balance: string };
export async function readSchoolLoad(schoolId: string, on: string, knownAt: string): Promise<LoadRow[]> {
  const rows = await call<{ result_kind: string; person_id: string; engagement_id: string; class_count: number; block_count: number; assigned_block_minutes: number; conflict_block_count: number; balance_state: string }[]>(
    "school_teaching_load_at", { _school_id: schoolId, _on: on, _known_at: knownAt });
  return (rows ?? []).filter((r) => r.result_kind === "load").map((r) => ({ personId: r.person_id, engagementId: r.engagement_id, classes: r.class_count,
    blocks: r.block_count, minutes: r.assigned_block_minutes, conflicts: r.conflict_block_count, balance: r.balance_state }));
}

export async function readReadiness(classId: string, on: string, knownAt: string): Promise<ReadinessRow[]> {
  const rows = await call<{ scope: string; subject_ref: string; code: string; state: string }[]>("class_diary_readiness_at", { _class_id: classId, _on: on, _known_at: knownAt });
  return (rows ?? []).map((r) => ({ scope: r.scope, subjectRef: r.subject_ref, code: r.code, state: r.state }));
}

export type Window = { kind: "constituicao" | "sucessao" | "retificacao"; validFrom: string; validUntil: string | null; sourceRef: string | null; reason: string | null };

export const recordJourney = (classId: string, expectedHead: string | null, w: Window, intervals: Interval[]) =>
  call("record_class_journey_version", { _class_id: classId, _expected_head_id: expectedHead, _change_kind: w.kind, _valid_from: w.validFrom,
    _valid_until: w.validUntil, _source_ref: w.sourceRef, _reason: w.reason,
    _intervals: intervals.map((i) => ({ weekday: i.weekday, starts_at: i.startsAt, ends_at: i.endsAt })) });

export const recordSchedule = (classId: string, expectedHead: string | null, w: Window, blocks: DraftBlock[]) =>
  call("record_class_schedule_version", { _class_id: classId, _expected_head_id: expectedHead, _change_kind: w.kind, _valid_from: w.validFrom,
    _valid_until: w.validUntil, _source_ref: w.sourceRef, _reason: w.reason,
    _blocks: blocks.map((b) => ({ block_key: b.blockKey, weekday: b.weekday, starts_at: b.startsAt, ends_at: b.endsAt, matrix_version_id: b.matrixVersionId, item_key: b.itemKey })) });

export const recordAssignment = (classId: string, a: { assignmentId: string | null; expectedHead: string | null; w: Window; engagementId: string; functionalLinkId: string; element: CurricularElement }) =>
  call("record_teaching_assignment_version_v2", { _class_id: classId, _assignment_id: a.assignmentId, _expected_head_id: a.expectedHead, _change_kind: a.w.kind,
    _valid_from: a.w.validFrom, _valid_until: a.w.validUntil, _engagement_id: a.engagementId, _functional_link_logical_id: a.functionalLinkId,
    _matrix_version_id: a.element.matrixVersionId, _item_key: a.element.itemKey, _role_scheme_id: null, _role_value_id: null, _role_value_version: null,
    _source_ref: a.w.sourceRef, _reason: a.w.reason });

export const recordSubstitution = (s: { assignmentId: string; substitutionId: string | null; expectedHead: string | null; w: Window & { validUntil: string }; engagementId: string; functionalLinkId: string; withdrawn: boolean }) =>
  call("record_teaching_substitution_version", { _assignment_id: s.assignmentId, _substitution_id: s.substitutionId, _expected_head_id: s.expectedHead,
    _change_kind: s.w.kind, _valid_from: s.w.validFrom, _valid_until: s.w.validUntil, _substitute_engagement_id: s.engagementId,
    _functional_link_logical_id: s.functionalLinkId, _withdrawn: s.withdrawn, _source_ref: s.w.sourceRef, _reason: s.w.reason });

export type CandidateEngagement = { engagementId: string; positionLabel: string; validFrom: string; validUntil: string | null };
export async function candidateEngagements(schoolId: string, personId: string, on: string): Promise<CandidateEngagement[]> {
  const rows = await call<{ engagement_id: string; position_label: string; valid_from: string; valid_until: string | null }[]>(
    "teaching_candidate_engagements", { _school_id: schoolId, _person_id: personId, _on: on });
  return (rows ?? []).map((r) => ({ engagementId: r.engagement_id, positionLabel: r.position_label, validFrom: r.valid_from, validUntil: r.valid_until }));
}
