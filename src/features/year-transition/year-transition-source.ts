import { supabase } from "@/integrations/supabase/client";
import type { Candidate, LookupOutcome, PreparationSummary, ProfessionalLookupKind, StudentLookupKind, TransitionDecision } from "./year-transition";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: { message: string } | null }>;

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export interface YearOption { id: string; label: string; state: string | null }

export async function readYears(): Promise<YearOption[]> {
  const { data: yrs, error } = await supabase.from("institutional_academic_year_versions").select("academic_year_id,official_name,version").order("version", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: st } = await supabase.from("academic_year_operational_states").select("academic_year_id,state,sequence").order("sequence", { ascending: false });
  const seen = new Map<string, YearOption>();
  for (const y of (yrs ?? []) as { academic_year_id: string; official_name: string }[]) {
    if (!seen.has(y.academic_year_id)) {
      const s = ((st ?? []) as { academic_year_id: string; state: string }[]).find((x) => x.academic_year_id === y.academic_year_id);
      seen.set(y.academic_year_id, { id: y.academic_year_id, label: y.official_name, state: s?.state ?? null });
    }
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export const readCandidates = (school: string, fromYear: string, toYear: string) =>
  call<Candidate[]>("year_transition_candidates", { _school: school, _from_year: fromYear, _to_year: toYear });

export const readSummary = (school: string, fromYear: string, toYear: string) =>
  call<PreparationSummary>("year_preparation_summary", { _school: school, _from_year: fromYear, _to_year: toYear });

export const recordDecision = (a: { school: string; student: string; fromYear: string; toYear: string; decision: TransitionDecision; expected: number; declaredOn: string | null; reason: string }) =>
  call<string>("record_year_transition_decision", { _school: a.school, _student: a.student, _from_year: a.fromYear, _to_year: a.toYear, _decision: a.decision, _expected_sequence: a.expected, _declared_on: a.declaredOn, _reason: a.reason });

export interface StudentLookupResult { outcome: LookupOutcome; student_id: string | null; display_name: string | null; active_here: boolean | null; active_elsewhere: boolean | null }
export async function locateStudent(school: string, kind: StudentLookupKind, value: string, year: string): Promise<StudentLookupResult> {
  const rows = await call<StudentLookupResult[]>("locate_student_exact", { _school: school, _kind: kind, _value: value, _year: year });
  return rows[0] ?? { outcome: "nao-encontrado", student_id: null, display_name: null, active_here: null, active_elsewhere: null };
}

export const enrollStudent = (student: string, school: string, year: string, declaredOn: string | null) =>
  call<string>("enroll_student_in_school_year", { _student: student, _school: school, _year: year, _declared_on: declaredOn, _act_ref: null });

export const registerStudent = (name: string, cpf: string, inep: string) =>
  call<string>("register_student_with_exact_identity", { _display_name: name, _cpf: cpf, _inep: inep });

export interface ProfessionalLookupResult { outcome: LookupOutcome; person_id: string | null; display_name: string | null; functional_link_logical_ids: string[] | null }
export async function locateProfessional(school: string, kind: ProfessionalLookupKind, value: string): Promise<ProfessionalLookupResult> {
  const rows = await call<ProfessionalLookupResult[]>("locate_professional_exact", { _school: school, _kind: kind, _value: value });
  return rows[0] ?? { outcome: "nao-encontrado", person_id: null, display_name: null, functional_link_logical_ids: null };
}
