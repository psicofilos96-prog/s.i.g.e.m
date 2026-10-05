import { supabase } from "@/integrations/supabase/client";
import type { FamilyStudent, FamilySummary } from "./family-portal";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

export async function readFamilyStudents(): Promise<FamilyStudent[]> {
  const { data, error } = await rpc("family_students", {});
  if (error) throw new Error(error.message);
  return (data as FamilyStudent[]) ?? [];
}

export async function readFamilySummary(studentId: string): Promise<FamilySummary> {
  const { data, error } = await rpc("family_student_summary", { _student: studentId });
  if (error) throw new Error(error.message);
  return data as FamilySummary;
}
