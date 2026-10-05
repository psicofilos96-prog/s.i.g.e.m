/** Leitura dos fatos pelos readers canônicos (RLS de quem consulta). Falha de reader ⇒ null, nunca "não". */
import { supabase } from "@/integrations/supabase/client";
import type { ClassFacts, SchoolFacts } from "./onboarding-model";

type R = { data: unknown; error: unknown };
const rows = (r: R) => (r.error ? null : ((r.data ?? []) as Record<string, unknown>[]));
const rpc = (fn: string, args: Record<string, unknown>) => supabase.rpc(fn as never, args as never) as unknown as Promise<R>;

export async function listSchools(): Promise<{ id: string; name: string }[]> {
  const r = await supabase.from("institutional_schools").select("id");
  if (r.error) throw new Error("Não foi possível ler as unidades.");
  const ids = (r.data ?? []).map((x) => (x as { id: string }).id);
  const names = await supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number").in("school_id", ids);
  const latest = new Map<string, { name: string; version: number }>();
  for (const v of (names.data ?? []) as { school_id: string; official_name: string; version_number: number }[])
    if (!latest.has(v.school_id) || latest.get(v.school_id)!.version < v.version_number) latest.set(v.school_id, { name: v.official_name, version: v.version_number });
  return ids.map((id) => ({ id, name: latest.get(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSchoolFacts(schoolId: string, schoolName: string | null, validOn: string): Promise<SchoolFacts> {
  const knownAt = new Date().toISOString();
  const cls = await supabase.from("institutional_classes").select("id").eq("school_id", schoolId);
  const [enr, cal, eng] = await Promise.all([
    rpc("cycle_enrollments_at", { _school: schoolId, _valid_on: validOn, _known_at: knownAt }),
    rpc("calendar_applicability_candidates", { _on: validOn, _known_at: knownAt, _school: schoolId, _allocation: null, _position: null, _axis: null }),
    supabase.from("institutional_engagements").select("id").eq("school_id", schoolId)
      .lte("valid_from", validOn).or(`valid_until.is.null,valid_until.gte.${validOn}`) as unknown as Promise<R>,
  ]);
  const calRows = rows(cal);
  const classes = cls.error ? null : await Promise.all((cls.data ?? []).map(async ({ id }): Promise<ClassFacts> => {
    const a = { _class_id: id, _valid_on: validOn, _known_at: knownAt }, o = { _class_id: id, _on: validOn, _known_at: knownAt };
    const [rec, per, mat, jou, sch, asg, alo, off, shf] = await Promise.all([
      rpc("class_at", a), rpc("class_period_organization_at", a),
      rpc("class_curricular_matrices_at", { _school: schoolId, _class_id: id, _on: validOn, _known_at: knownAt }),
      rpc("class_journey_at", o), rpc("class_schedule_at", o), rpc("teaching_assignments_at", o),
      rpc("class_allocations_at", { _school: schoolId, _class: id, _valid_on: validOn, _known_at: knownAt }),
      rpc("class_offering_at", a), rpc("class_shift_at", a),
    ]);
    const m = rows(mat); const matrices = m == null ? null : new Set(m.map((x) => x["matrix_id"]).filter(Boolean)).size;
    const r = rows(rec);
    return {
      classId: id, name: r?.[0] ? String(r[0]["name"] ?? "") || null : null,
      record: r == null ? null : r.length === 1, periodOrganization: rows(per) == null ? null : rows(per)!.length > 0,
      matrix: matrices == null ? null : matrices === 1 ? "resolvida" : matrices > 1 ? "ambigua" : "ausente",
      journey: rows(jou) == null ? null : rows(jou)!.some((x) => x["journey_id"]),
      schedule: rows(sch) == null ? null : rows(sch)!.some((x) => x["schedule_id"]),
      assignments: rows(asg) == null ? null : new Set(rows(asg)!.map((x) => x["assignment_id"])).size,
      allocations: rows(alo)?.length ?? null, offering: rows(off) == null ? null : rows(off)!.length > 0, shift: rows(shf) == null ? null : rows(shf)!.length > 0,
    };
  }));
  return {
    schoolId, schoolName, validOn,
    enrollments: rows(enr)?.length ?? null,
    calendars: calRows == null ? null : new Set(calRows.map((x) => x["calendar_id"]).filter(Boolean)).size,
    engagements: rows(eng)?.length ?? null,
    classes,
  };
}
