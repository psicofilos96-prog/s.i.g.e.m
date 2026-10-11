import { supabase } from "@/integrations/supabase/client";
import type { HealthKind, HealthRow } from "./family-health";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const readHealthHistory = (student: string) => call<HealthRow[]>("family_health_history", { _student: student });
export const recordHealth = (a: { student: string; base: string | null; event: "declaracao" | "retificacao" | "retirada"; kind: HealthKind | null;
  description: string | null; instructions: string | null; consentVersion: string }) =>
  call<string>("record_family_health_declaration", { _student: a.student, _base: a.base, _event: a.event, _kind: a.kind,
    _description: a.description, _instructions: a.instructions, _consent_version: a.consentVersion });

export type SchoolHealthRow = { student_name: string; internal_id: string | null; kind: HealthKind; description: string; instructions: string | null; version: number; recorded_at: string };
export const readSchoolHealth = (school: string) => call<SchoolHealthRow[]>("school_family_health_declarations", { _school: school });
