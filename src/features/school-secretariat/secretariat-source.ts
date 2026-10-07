import { supabase } from "@/integrations/supabase/client";
import type { LifeEvent, PendingRow, SecretariatOverview } from "./secretariat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: { message: string } | null }>;
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const readOverview = (school: string, year: string, on: string) =>
  call<SecretariatOverview>("secretariat_overview_at", { _school: school, _year: year, _on: on });
export const readPending = (school: string, year: string, on: string) =>
  call<PendingRow[]>("secretariat_pending_at", { _school: school, _year: year, _on: on }).then((r) => r ?? []);
export const readSchoolLife = (school: string, student: string) =>
  call<LifeEvent[]>("student_school_life", { _school: school, _student: student }).then((r) => r ?? []);

export const allocateToClass = (a: { enrollment: string; classId: string; validFrom: string; reason: string | null }) =>
  call<string>("secretariat_allocate_to_class", { _enrollment: a.enrollment, _class: a.classId, _valid_from: a.validFrom, _reason: a.reason });
export const endClassEpisode = (a: { episode: string; endedOn: string; reason: string }) =>
  call<string>("secretariat_end_class_episode", { _episode: a.episode, _ended_on: a.endedOn, _reason: a.reason });
/** Remanejamento intraescolar: encerra a turma atual na véspera e abre a nova na data; nunca entre escolas. */
export const reassignClass = (a: { episode: string; toClass: string; effectiveOn: string; reason: string }) =>
  call<string>("secretariat_reassign_class", { _episode: a.episode, _new_class: a.toClass, _effective_on: a.effectiveOn, _reason: a.reason });
export const recordExit =  (a: { enrollment: string; effectiveOn: string; movementType: string; typeVersion: number; destinationSchool: string | null; reason: string }) =>
  call<string>("secretariat_record_exit", {
    _enrollment: a.enrollment, _effective_on: a.effectiveOn, _movement_type: a.movementType, _type_version: a.typeVersion,
    _destination_school: a.destinationSchool, _reason: a.reason,
  });

/** Só tipos de movimentação HOMOLOGADOS; lista vazia = nada a registrar (sem tipo inventado). */
export async function readMovementTypes(): Promise<{ id: string; version: number; label: string }[]> {
  const { data, error } = await supabase.from("movement_type_definitions").select("id,version,label,status").eq("status", "homologada");
  if (error) return [];
  return (data ?? []) as { id: string; version: number; label: string }[];
}
