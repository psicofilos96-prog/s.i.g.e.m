import { readPages } from "@/lib/list-paging";
import { guardUpload, safeLabel, assertSafePath } from "@/features/privacy/upload-policy";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { supabase } from "@/integrations/supabase/client";
import type { CurricularRef, PlanBlock, PlanStatus, PlanVersion } from "./planning-model";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any; storage: any };
const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };

/** NFINAL.7 — leitura paginada; acima do limite falha em vez de devolver lista cortada em silêncio. */
const allPages = async <T,>(build: (f: number, t: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 20000): Promise<T[]> => {
  const r = await readPages<T>(build, max);
  if (r.error) throw new Error(r.error.message);
  if (r.truncated) throw new Error("list:truncated — há mais registros do que o limite de leitura desta tela.");
  return r.data ?? [];
};

export type Assignment = { assignment_id: string; class_id: string; component_label_snapshot: string; item_key: string; version_id: string; effective_from: string; effective_until: string | null };

export const myAssignments = (on: string) => must<Assignment[]>(db.rpc("my_teaching_assignments_at", { _on: on, _known_at: new Date().toISOString() }));
export const visiblePlans = () => allPages<PlanVersion>((f, t) => db.from("teaching_plan_versions").select("id, plan_id, version, period_id, target_date, supersedes_id, assignment_id, class_id, school_id, matrix_version_id, level_value_id, covers_from, covers_until, title, blocks, curricular_refs, status, copied_from_version_id, change_reason, author_user_id, recorded_at").order("recorded_at", { ascending: false }).order("id").range(f, t));
export const matrixItemKeys = async (versionIds: string[]) => versionIds.length
  ? must<{ id: string; matrix_version_id: string }[]>(db.from("teaching_assignment_versions").select("id, matrix_version_id").in("id", versionIds))
  : [];
export const itemsOfMatrix = (matrixVersionId: string) => must<{ item_key: string; component_label_snapshot: string | null }[]>(db.from("curricular_matrix_items").select("item_key, component_label_snapshot").eq("matrix_version_id", matrixVersionId));

export type SavePlan = { planId: string | null; expectedHead: string | null; assignmentId: string; title: string; levelValueId: string | null; coversFrom: string | null; coversUntil: string | null; blocks: PlanBlock[]; refs: CurricularRef[]; status: PlanStatus; copiedFrom: string | null; reason: string | null; targetDate: string; periodId?: string | null };
export type PlanPeriod = { period_id: string; label: string; starts_on: string; ends_on: string };
/** Períodos oficiais (versão vigente) da organização da turma na data — via reader 0150, nunca pela tabela-base. */
export const planPeriods = (assignmentId: string, on: string) => must<PlanPeriod[]>(db.rpc("plan_periods_for_assignment", { _assignment: assignmentId, _on: on }));
export type ClassPosition = { position_logical_id: string; axes: unknown };
export const classPositions = async (schoolId: string, classId: string, on: string) => {
  const rows = await must<ClassPosition[]>(db.rpc("allocation_curricular_positions_at", { _school: schoolId, _class: classId, _valid_on: on, _known_at: new Date().toISOString() }));
  return [...new Map((rows ?? []).filter((r) => r.position_logical_id).map((r) => [r.position_logical_id, r])).values()];
};
export type OverviewPlan = { result_kind: string; plan_id: string | null; version: number | null; plan_version_id: string | null; class_id: string | null; assignment_id: string | null; title: string | null; period_id: string | null; covers_from: string | null; covers_until: string | null; blocks: unknown; curricular_refs: unknown; recorded_at: string | null };
/** Acompanhamento SOMENTE LEITURA: só compartilhados, capability `consultar-planejamento-docente`. */
export const plansOverview = (schoolId: string, on: string) => must<OverviewPlan[]>(db.rpc("teaching_plans_overview_at", { _school: schoolId, _on: on }));
export const linkLessonToPlan = (lessonLogicalId: string, planVersionId: string) => must<string>(db.rpc("link_lesson_to_plan", { _lesson_logical_record_id: lessonLogicalId, _plan_version_id: planVersionId, _revoke_link: null }));
export const revokeLessonLink = (linkId: string) => must<string>(db.rpc("link_lesson_to_plan", { _lesson_logical_record_id: null, _plan_version_id: null, _revoke_link: linkId }));

export const savePlan = (s: SavePlan) => must<string>(db.rpc("record_teaching_plan_version_v2", {
  _target_date: s.targetDate, _period_id: s.periodId ?? null,
  _plan_id: s.planId, _expected_head: s.expectedHead, _assignment_id: s.assignmentId, _title: s.title, _level_value_id: s.levelValueId,
  _covers_from: s.coversFrom || null, _covers_until: s.coversUntil || null, _blocks: s.blocks, _curricular_refs: s.refs, _status: s.status,
  _copied_from: s.copiedFrom, _change_reason: s.reason,
}));

export const planAttachments = (planId: string) => must<{ id: string; label: string; object_path: string; revoked: boolean; supersedes_id: string | null }[]>(db.from("teaching_plan_attachments").select("id, label, object_path, revoked, supersedes_id").eq("plan_id", planId));
export async function uploadAttachment(userId: string, planId: string, file: File) {
  const buf = await file.arrayBuffer();
  const mime = guardUpload("planejamento-docente", new Uint8Array(buf), file.type);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const path = assertSafePath(`${userId}/${planId}/${crypto.randomUUID()}`);
  const up = await db.storage.from("planejamento-docente").upload(path, buf, { upsert: false, contentType: mime });
  if (up.error) throw new Error("upload");
  return must<string>(db.rpc("record_teaching_plan_attachment", { _plan_id: planId, _object_path: path, _label: safeLabel(file.name), _sha256: hash, _revoke: null }));
}
export const revokeAttachment = (planId: string, id: string) => must<string>(db.rpc("record_teaching_plan_attachment", { _plan_id: planId, _object_path: "", _label: "-", _sha256: "0".repeat(64), _revoke: id }));
export async function attachmentUrl(path: string) {
  const r = await db.storage.from("planejamento-docente").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (r.error) throw new Error("url"); return r.data.signedUrl as string;
}
