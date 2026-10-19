import { panoramaRows, type ReconRow } from "@/features/reports/cross-reports";
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { withListTimeout } from "@/lib/server-page";

const number = z.union([z.number().finite(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).nullable();
const schema = z.array(z.object({ school_id: z.string(), inep: z.string().nullable(),
  measure: z.string(), operational_value: number, official_value: number }));
export type NetworkSchool = { id: string; name: string; inep: string | null; classes: number | null;
  enrollments: number | null; students: number | null; comparison: string | null };

/** IDs come from the authorized school catalogue, never from a name match. */
export function networkSchools(schools: readonly { id: string; name: string }[], rows: ReconRow[]): NetworkSchool[] {
  const bySchool = new Map<string, ReconRow[]>();
  for (const row of rows) bySchool.set(row.school_id, [...(bySchool.get(row.school_id) ?? []), row]);
  return schools.map((school) => {
    const facts = bySchool.get(school.id) ?? [];
    const p = panoramaRows(facts, new Map([[school.id, school.name]]), null)[0];
    return { ...school, inep: p?.inep ?? null, classes: p?.classes ?? null, enrollments: p?.enrollments ?? null,
      students: p?.students ?? null, comparison: p?.census_match ?? null };
  });
}

export async function readNetworkReconciliation(parent?: AbortSignal) {
  return withListTimeout(parent, async (signal) => {
    const knownAt = new Date().toISOString();
    const rpc = supabase.rpc as unknown as (name: string, args: object) => {
      range: (from: number, to: number) => { abortSignal: (s: AbortSignal) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };
    };
    const result = await readPages((from, to) => rpc("census_official_reconciliation", { _known_at: knownAt })
      .range(from, to).abortSignal(signal), 20_000);
    if (result.error) throw new Error(result.error.message);
    if (result.truncated) throw new Error("Consulta incompleta.");
    return { rows: parseBoundary(schema, result.data ?? [], "supervision-network"), knownAt };
  });
}