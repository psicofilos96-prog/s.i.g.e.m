import { supabase } from "@/integrations/supabase/client";
import { shiftDays, type Inputs, type Probe } from "./management-panel";

// Somente leituras pelos readers/tabelas canônicos, com a sessão do usuário. Nenhuma escrita.
type Res = { data: unknown; error: { message: string } | null; count?: number | null };
type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<Res>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const db = supabase as unknown as { from: (t: string) => any };
const probe = async <T,>(p: PromiseLike<Res>): Promise<Probe<T>> => { try { const r = await p; return r.error ? { ok: false, error: r.error.message } : { ok: true, data: (r.data ?? []) as T }; } catch (e) { return { ok: false, error: (e as Error).message }; } };
const countOf = async (p: PromiseLike<Res>): Promise<Probe<number>> => { try { const r = await p; return r.error ? { ok: false, error: r.error.message } : { ok: true, data: r.count ?? (Array.isArray(r.data) ? r.data.length : 0) }; } catch (e) { return { ok: false, error: (e as Error).message }; } };

export async function readManagementInputs(school: string, year: string, on: string, knownAt: string | null): Promise<Inputs> {
  const window = { from: shiftDays(on, -30), to: on };
  const classes = await probe<{ id: string; name: string }[]>(db.from("institutional_classes").select("id, name").eq("school_id", school).eq("academic_year_id", year).order("name"));
  const ids = classes.ok ? classes.data.map((c) => c.id) : [];
  const schedules: Promise<Probe<Record<string, boolean>>> = classes.ok ? (async () => {
    const out: Record<string, boolean> = {};
    for (const id of ids) {
      const r = await probe<{ result_kind: string; schedule_id: string | null }[]>(rpc("class_schedule_at", { _class_id: id, _on: on, _known_at: knownAt }));
      if (!r.ok) return r;
      if (r.data[0]?.result_kind === "access-denied") return { ok: false, error: "access-denied" } as const;
      out[id] = r.data.some((x) => x.schedule_id);
    }
    return { ok: true, data: out } as const;
  })() : Promise.resolve({ ok: false, error: classes.error } as const);
  const closings = (t: string) => ids.length === 0 ? Promise.resolve<Probe<number>>(classes.ok ? { ok: true, data: 0 } : { ok: false, error: classes.error })
    : countOf(db.from(t).select("id", { count: "exact", head: true }).in("class_id", ids));
  const [overview, sch, diary, plans, attendanceClosings, assessmentClosings, followups, documents, communications, aee, meals, staff, infrastructure, declaredMaps] = await Promise.all([
    probe<Inputs["overview"] extends Probe<infer T> ? T : never>(rpc("secretariat_overview_at", { _school: school, _year: year, _on: on })),
    schedules,
    probe<any[]>(rpc("diary_school_overview_at", { _school: school, _from: window.from, _to: window.to })),
    probe<any[]>(rpc("teaching_plans_overview_at", { _school: school, _on: on })),
    closings("attendance_closing_versions"), closings("period_closing_versions"),
    countOf(rpc("school_pedagogical_records_at", { _school: school, _subject_kind: null, _subject_id: null, _known_at: knownAt, _logical_id: null })),
    Promise.resolve<Probe<number>>({ ok: false, error: "source:no-school-reader" }),
    probe<{ state: string }[]>(rpc("school_communications_at", { _school: school })),
    probe<any[]>(rpc("aee_services_at", { _school: school, _student: null, _known_at: knownAt })),
    countOf(rpc("meal_services_at", { _school: school, _from: window.from, _to: window.to, _known_at: knownAt })),
    countOf(db.from("staff_administrative_records").select("id", { count: "exact", head: true }).eq("school_id", school)),
    countOf(db.from("school_infrastructure_observations").select("id", { count: "exact", head: true }).eq("school_id", school)),
    countOf(db.from("school_declared_monthly_maps").select("id", { count: "exact", head: true }).eq("school_id", school)),
  ]);
  return { school, year, on, knownAt, window, overview, classes, schedules: sch, diary, plans, attendanceClosings, assessmentClosings, followups, documents, communications, aee, meals, staff, infrastructure, declaredMaps };
}
