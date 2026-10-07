import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ClassOption, WizardPayload } from "./enrollment-wizard-model";

/** N5.2.1 — único acesso da matrícula guiada ao banco: só RPCs governadas (escopo, expected-head, transação). */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>)(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export type OpenDraft = {
  draftId: string; sequence: number; step: number; payload: WizardPayload; hasCpf: boolean; cpfHint: string | null;
  inep: string | null; existingStudentId: string | null; existingStudentName: string | null; updatedAt: string; mine: boolean;
};

export async function openDrafts(school: string): Promise<OpenDraft[]> {
  const rows = await rpc<Record<string, unknown>[]>("enrollment_drafts_open", { _school: school });
  return (rows ?? []).map((r) => ({
    draftId: r["draft_id"] as string, sequence: r["sequence"] as number, step: r["step"] as number,
    payload: (r["payload"] ?? {}) as WizardPayload, hasCpf: !!r["has_cpf"], cpfHint: (r["cpf_hint"] as string) ?? null,
    inep: (r["inep"] as string) ?? null, existingStudentId: (r["existing_student_id"] as string) ?? null,
    existingStudentName: (r["existing_student_name"] as string) ?? null, updatedAt: r["updated_at"] as string, mine: !!r["mine"],
  }));
}

export const saveDraft = (a: { draft: string; school: string; expected: number; step: number; payload: WizardPayload; cpf?: string | null; inep?: string | null; existingStudent?: string | null }) =>
  rpc<number>("enrollment_draft_save", {
    _draft: a.draft, _school: a.school, _expected: a.expected, _step: a.step, _payload: a.payload as unknown as Json,
    _cpf: a.cpf ?? null, _inep: a.inep ?? null, _existing_student: a.existingStudent ?? null,
  });

export const abandonDraft = (draft: string, expected: number, reason: string) =>
  rpc<number>("enrollment_draft_abandon", { _draft: draft, _expected: expected, _reason: reason });

export async function classOptions(school: string, year: string, on: string): Promise<ClassOption[]> {
  const rows = await rpc<Record<string, unknown>[]>("enrollment_wizard_class_options", { _school: school, _year: year, _on: on });
  return (rows ?? []).map((r) => ({ id: r["class_id"] as string, name: r["name"] as string, shift: (r["shift_label"] as string) ?? null,
    capacity: (r["capacity"] as number | null) ?? null, occupancy: (r["occupancy"] as number) ?? 0 }));
}

export const completeDraft = (a: { draft: string; expected: number; year: string; on: string; classId: string }) =>
  rpc<{ student_id: string; enrollment_id: string; episode_id: string | null; student_created: boolean }>("enrollment_draft_complete", {
    _draft: a.draft, _expected: a.expected, _year: a.year, _declared_on: a.on, _class: a.classId,
  });
