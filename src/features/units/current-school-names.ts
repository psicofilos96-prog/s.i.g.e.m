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

/** Lê versões (RLS da sessão) e devolve id → nome vigente na data. Erro de leitura propaga. */
export async function readCurrentSchoolNames(ids?: readonly string[], on: string = todayIso()): Promise<Map<string, string>> {
  let q = supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number, valid_from");
  if (ids) q = q.in("school_id", ids.length ? [...ids] : ["-"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return currentSchoolNames((data ?? []) as SchoolVersionRow[], on);
}

export function sortedSchoolOptions(m: Map<string, string>): { id: string; name: string }[] {
  return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
