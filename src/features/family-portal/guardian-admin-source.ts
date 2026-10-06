import { supabase } from "@/integrations/supabase/client";
import type { ChainRow } from "./guardian-admin";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type GuardianLookup = { outcome: string; person_id: string | null; display_name: string | null; account_state: "sem-conta" | "conta-unica" | "conta-ambigua" | null };
export type StudentLookup = { outcome: string; student_id: string | null; display_name: string | null };

export const readChain = (school: string, student: string) => call<ChainRow[]>("guardian_authorization_chain", { _school: school, _student: student });
export async function locateGuardian(school: string, cpf: string): Promise<GuardianLookup> {
  const r = await call<GuardianLookup[]>("locate_guardian_person_exact", { _school: school, _kind: "cpf", _value: cpf });
  return r[0] ?? { outcome: "nao-encontrado", person_id: null, display_name: null, account_state: null };
}
export async function locateStudentForGuardian(school: string, kind: "cpf" | "inep", value: string): Promise<StudentLookup> {
  const r = await call<StudentLookup[]>("locate_student_exact", { _school: school, _kind: kind, _value: value, _year: null });
  return r[0] ?? { outcome: "nao-encontrado", student_id: null, display_name: null };
}
export const recordAuthorization = (a: { base: string | null; kind: "constituicao" | "substituicao" | "revogacao"; student: string | null; person: string | null; school: string | null;
  sections: string[] | null; validFrom: string | null; validUntil: string | null; reason: string | null }) =>
  call<string>("record_guardian_authorization_v3", { _base_id: a.base, _kind: a.kind, _student: a.student, _guardian_person: a.person, _school: a.school,
    _relation_scheme: null, _relation_value: null, _sections: a.sections, _valid_from: a.validFrom, _valid_until: a.validUntil || null, _reason: a.reason, _source_ref: null });
