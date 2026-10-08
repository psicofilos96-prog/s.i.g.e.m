import { supabase } from "@/integrations/supabase/client";
import type { CardChainRow, IssuedCard } from "./card-issuance";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const readCardChain = (school: string) => call<CardChainRow[]>("student_card_chain", { _school: school });
export const readFamilyCards = (student: string) => call<IssuedCard[]>("family_student_cards", { _student: student });
export const recordCard = (a: { publicId: string | null; expected: number | null; kind: "emissao" | "reemissao" | "cancelamento"; student: string | null; school: string;
  year: string | null; validUntil: string | null; studentName: string | null; schoolName: string | null; classLabel: string | null; reason: string | null }) =>
  call<string>("record_student_card", { _public_id: a.publicId, _expected_version: a.expected, _kind: a.kind, _student: a.student, _school: a.school, _year: a.year,
    _valid_until: a.validUntil || null, _student_name: a.studentName, _school_name: a.schoolName, _class_label: a.classLabel, _reason: a.reason || null });
