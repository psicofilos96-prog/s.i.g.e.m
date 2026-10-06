import { supabase } from "@/integrations/supabase/client";
import type { AllocationRow, ClassRow, ClosingRow, EnrollmentRow, FollowupRecord, PanelInput } from "./followup-panel";

type Res = { data: unknown; error: { message: string } | null };
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<Res>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
const db = supabase as unknown as { from: (t: string) => any };

/** Leitura que a sessão não pode fazer vira null (não disponível), nunca lista vazia. */
const orNull = async <T>(p: PromiseLike<Res>): Promise<T[] | null> => { const r = await p; return r.error ? null : ((r.data as T[]) ?? []); };

export async function schoolsInScope(): Promise<string[]> {
  const { data, error } = await rpc("effective_scope_capabilities", {});
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const c of (data as { scope_level: string; school_id: string | null; policy_id: string | null }[]) ?? [])
    if (c.scope_level === "escola" && c.school_id && c.policy_id) ids.add(c.school_id);
  return [...ids].sort();
}

export async function readPanel(school: string, t: { validOn: string; knownAt: string | null }): Promise<PanelInput> {
  const classes = await orNull<ClassRow>(db.from("institutional_classes").select("id, name").eq("school_id", school).order("name"));
  const ids = (classes ?? []).map((c) => c.id);
  const closings = (table: string) => ids.length === 0 ? Promise.resolve(classes === null ? null : [] as ClosingRow[])
    : orNull<ClosingRow>(db.from(table).select("id, class_id, period_id, version_number, closed_at").in("class_id", ids));
  const [enrollments, allocations, attendanceClosings, assessmentClosings] = await Promise.all([
    orNull<EnrollmentRow>(rpc("cycle_enrollments_at", { _school: school, _valid_on: t.validOn, _known_at: t.knownAt })),
    orNull<AllocationRow>(rpc("class_allocations_at", { _school: school, _class: null, _valid_on: t.validOn, _known_at: t.knownAt })),
    closings("attendance_closing_versions"), closings("period_closing_versions"),
  ]);
  return { classes, enrollments, allocations, attendanceClosings, assessmentClosings };
}

export async function readRecords(a: { school: string; subjectKind?: string | null; subjectId?: string | null; knownAt?: string | null; logicalId?: string | null }): Promise<FollowupRecord[]> {
  const { data, error } = await rpc("school_pedagogical_records_at", {
    _school: a.school, _subject_kind: a.subjectKind ?? null, _subject_id: a.subjectId ?? null, _known_at: a.knownAt ?? null, _logical_id: a.logicalId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as FollowupRecord[]) ?? [];
}

export async function readCategories(): Promise<{ value_id: string; label: string }[]> {
  const { data, error } = await db.from("attribute_value_definitions").select("value_id, label, status, version").eq("scheme_id", "categoria-de-acompanhamento-pedagogico").eq("status", "homologada");
  if (error) throw new Error(error.message);
  const best = new Map<string, { value_id: string; label: string; version: number }>();
  for (const d of data ?? []) { const b = best.get(d.value_id); if (!b || d.version > b.version) best.set(d.value_id, d); }
  return [...best.values()];
}

export type InterventionFields = { referral?: string | null; responsiblePersonId?: string | null; periodId?: string | null; returnOn?: string | null; statusValue?: string | null };
export async function writeRecord(a: { baseId: string | null; kind: "registro" | "retificacao" | "anulacao"; school: string; subjectKind: string; subjectId: string; category: string | null; body: string | null; visibility: string | null; occurredOn: string | null; reason: string | null } & InterventionFields) {
  const { error } = await rpc("record_school_pedagogical_record_v2", {
    _base_id: a.baseId, _kind: a.kind, _school: a.school, _subject_kind: a.subjectKind, _subject_id: a.subjectId,
    _category_value: a.category, _body: a.body, _visibility: a.visibility, _occurred_on: a.occurredOn, _reason: a.reason,
    _referral: a.referral ?? null, _responsible_person_id: a.responsiblePersonId ?? null, _period_id: a.periodId ?? null,
    _return_on: a.returnOn ?? null, _status_value: a.statusValue ?? null,
  });
  if (error) throw new Error(error.message);
}
