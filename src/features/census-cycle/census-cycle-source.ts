import { supabase } from "@/integrations/supabase/client";
import type { CompareRow, CycleView, SnapshotContent, Stage } from "./census-cycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: { message: string } | null }>;
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const readCycles = () => call<CycleView[]>("census_cycles_overview", {}).then((r) => r ?? []);
export const readSnapshot = (id: string) => call<SnapshotContent>("census_snapshot_content", { _snapshot: id });
export const readLivePreview = (cycle: string) => call<{ content: SnapshotContent; fingerprint: string }>("census_live_preview", { _cycle: cycle });
export const readSchoolPending = (cycle: string, school: string) => call<{
  snapshot: null | { id: string; version: number; fingerprint: string; school: { measures: Record<string, { value: number | null; reason: string | null }> } | null; findings: { rule: string; count: number }[] };
  live_items: { rule: string; enrollment_id: string; institutional_number: string | null }[];
}>("census_school_pending", { _cycle: cycle, _school: school });
export const readCompare = (snapshot: string, imp: string) =>
  call<CompareRow[]>("census_compare", { _snapshot: snapshot, _import: imp }).then((r) => r ?? []);

export const openCycle = (year: string, referenceDate: string, reason: string) =>
  call<string>("census_open_cycle", { _year: year, _reference_date: referenceDate, _reason: reason });
export const takeSnapshot = (cycle: string, expectedHead: string | null, reason: string | null) =>
  call<{ id: string; version: number; fingerprint: string }>("census_take_snapshot", { _cycle: cycle, _expected_head: expectedHead, _reason: reason });
export const conferSnapshot = (snapshot: string, fingerprint: string, note: string | null) =>
  call<string>("census_confer_snapshot", { _snapshot: snapshot, _fingerprint: fingerprint, _note: note });
export const advanceStage = (cycle: string, expectedSeq: number, stage: Stage, reason: string) =>
  call<number>("census_advance_stage", { _cycle: cycle, _expected_seq: expectedSeq, _stage: stage, _reason: reason });
export const stageSource = (a: { cycle: string; origin: string; editionLayout: string; sha256: string; rows: unknown }) =>
  call<{ id: string; idempotent: boolean; accepted?: number; rejected?: number }>("census_stage_source", {
    _cycle: a.cycle, _origin: a.origin, _edition_layout: a.editionLayout, _parser_id: "sigem-agregado-por-escola", _parser_version: 1,
    _source_sha256: a.sha256, _rows: a.rows,
  });

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
