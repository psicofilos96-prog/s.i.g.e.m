import { readPages } from "@/lib/list-paging";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { withListTimeout } from "@/lib/server-page";
import { operationalToday } from "@/lib/academic-date";
// NSCHOOL.1 — nome vigente da escola numa data. Única projeção para listas e seletores:
// a versão vigente é a de maior número cuja vigência já começou (valid_from <= data);
// versão futura (renomeação agendada) nunca aparece antes da data, e o passado não é apagado.
import { supabase } from "@/integrations/supabase/client";

export type SchoolVersionRow = { school_id: string; official_name: string | null; version_number: number; valid_from: string | null };

export function currentSchoolNames(rows: readonly SchoolVersionRow[], on: string): Map<string, string> {
  const best = new Map<string, SchoolVersionRow>();
  for (const r of rows) {
    if (r.valid_from && r.valid_from > on) continue;
    const c = best.get(r.school_id);
    if (!c || c.version_number < r.version_number) best.set(r.school_id, r);
  }
  return new Map([...best].map(([id, r]) => [id, r.official_name ?? id]));
}

export function todayIso(): string { return operationalToday(); }

const schoolVersionSchema = z.object({
  school_id: z.string(),
  official_name: z.string().nullable(),
  version_number: z.number().int(),
  valid_from: z.string().nullable(),
});
const SCHOOL_NAMES_READ_MAX = 100_000;

/** Lê todas as versões autorizadas, em ordem estável; nunca apresenta uma lista truncada como completa. */
export async function readCurrentSchoolNames(ids?: readonly string[], on: string = todayIso(), signal?: AbortSignal): Promise<Map<string, string>> {
  if (ids?.length === 0) return new Map();
  return withListTimeout(signal, async (readSignal) => {
    const { data, error, truncated } = await readPages<unknown>((from, to) => {
      let query = supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number, valid_from");
      if (ids) query = query.in("school_id", [...new Set(ids)]);
      return query.order("school_id").order("version_number").range(from, to).abortSignal(readSignal);
    }, SCHOOL_NAMES_READ_MAX);
    if (error) throw new Error(error.message);
    if (truncated) throw new Error("A lista de escolas excedeu o limite de leitura. Refine a consulta e tente novamente.");
    return currentSchoolNames(parseBoundary(z.array(schoolVersionSchema), data ?? [], "current-school-names"), on);
  });
}

export function sortedSchoolOptions(m: Map<string, string>): { id: string; name: string }[] {
  return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
