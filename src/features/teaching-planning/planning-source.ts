import { supabase } from "@/integrations/supabase/client";
import type { CurricularRef, PlanBlock, PlanStatus, PlanVersion } from "./planning-model";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any; storage: any };
const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };

export type Assignment = { assignment_id: string; class_id: string; component_label_snapshot: string; item_key: string; version_id: string; effective_from: string; effective_until: string | null };

export const myAssignments = (on: string) => must<Assignment[]>(db.rpc("my_teaching_assignments_at", { _on: on, _known_at: new Date().toISOString() }));
export const visiblePlans = () => must<PlanVersion[]>(db.from("teaching_plan_versions").select("id, plan_id, version, supersedes_id, assignment_id, class_id, school_id, matrix_version_id, level_value_id, covers_from, covers_until, title, blocks, curricular_refs, status, copied_from_version_id, change_reason, author_user_id, recorded_at").order("recorded_at", { ascending: false }).limit(2000));
export const matrixItemKeys = async (versionIds: string[]) => versionIds.length
  ? must<{ id: string; matrix_version_id: string }[]>(db.from("teaching_assignment_versions").select("id, matrix_version_id").in("id", versionIds))
  : [];
export const itemsOfMatrix = (matrixVersionId: string) => must<{ item_key: string; component_label_snapshot: string | null }[]>(db.from("curricular_matrix_items").select("item_key, component_label_snapshot").eq("matrix_version_id", matrixVersionId));

export type SavePlan = { planId: string | null; expectedHead: string | null; assignmentId: string; title: string; levelValueId: string | null; coversFrom: string | null; coversUntil: string | null; blocks: PlanBlock[]; refs: CurricularRef[]; status: PlanStatus; copiedFrom: string | null; reason: string | null };
export const savePlan = (s: SavePlan) => must<string>(db.rpc("record_teaching_plan_version", {
  _plan_id: s.planId, _expected_head: s.expectedHead, _assignment_id: s.assignmentId, _title: s.title, _level_value_id: s.levelValueId,
  _covers_from: s.coversFrom || null, _covers_until: s.coversUntil || null, _blocks: s.blocks, _curricular_refs: s.refs, _status: s.status,
  _copied_from: s.copiedFrom, _change_reason: s.reason,
}));

export const planAttachments = (planId: string) => must<{ id: string; label: string; object_path: string; revoked: boolean; supersedes_id: string | null }[]>(db.from("teaching_plan_attachments").select("id, label, object_path, revoked, supersedes_id").eq("plan_id", planId));
export async function uploadAttachment(userId: string, planId: string, file: File) {
  const buf = await file.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const path = `${userId}/${planId}/${crypto.randomUUID()}`;
  const up = await db.storage.from("planejamento-docente").upload(path, file, { upsert: false });
  if (up.error) throw new Error("upload");
  return must<string>(db.rpc("record_teaching_plan_attachment", { _plan_id: planId, _object_path: path, _label: file.name.slice(0, 160), _sha256: hash, _revoke: null }));
}
export const revokeAttachment = (planId: string, id: string) => must<string>(db.rpc("record_teaching_plan_attachment", { _plan_id: planId, _object_path: "", _label: "-", _sha256: "0".repeat(64), _revoke: id }));
export async function attachmentUrl(path: string) {
  const r = await db.storage.from("planejamento-docente").createSignedUrl(path, 60);
  if (r.error) throw new Error("url"); return r.data.signedUrl as string;
}
