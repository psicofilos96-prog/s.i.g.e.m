import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { parseBoundary, z } from "@/lib/runtime-shape";

const person = z.object({ id: z.string(), display_name: z.string(), actor_nature: z.string(), institutional_identifier: z.string().nullable() });
const engagement = z.object({ id: z.string(), person_id: z.string(), engagement_kind_id: z.string(), scope_level: z.string().nullable(), school_id: z.string().nullable(), valid_from: z.string(), valid_until: z.string().nullable(), position_label_snapshot: z.string().nullable() });
const ending = z.object({ engagement_id: z.string(), ended_on: z.string() });
export const ACCESS_PEOPLE_PAGE = 50;

export async function readAccessPeople(page: number, search: string, signal: AbortSignal) {
  const offset = (Math.max(1, Math.floor(page)) - 1) * ACCESS_PEOPLE_PAGE;
  let query = supabase.from("institutional_persons").select("id, display_name, actor_nature, institutional_identifier").order("display_name").order("id");
  const needle = search.trim().replace(/[%_\\]/g, "\\$&");
  if (needle) query = query.ilike("display_name", `%${needle}%`);
  const p = await query.range(offset, offset + ACCESS_PEOPLE_PAGE).abortSignal(signal);
  if (p.error) throw p.error;
  const rows = parseBoundary(z.array(person), p.data, "access-people");
  const persons = rows.slice(0, ACCESS_PEOPLE_PAGE);
  const ids = persons.map((x) => x.id);
  if (!ids.length) return { persons, engagements: [], endings: [], hasNext: false };
  const e = await readPages((from, to) => supabase.from("institutional_engagements")
    .select("id, person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until, position_label_snapshot")
    .in("person_id", ids).order("id").range(from, to).abortSignal(signal), 20_000);
  if (e.error || e.truncated) throw e.error ?? new Error("Não foi possível consultar todas as atuações desta página.");
  const engagements = parseBoundary(z.array(engagement), e.data, "access-engagements");
  const endings: z.infer<typeof ending>[] = [];
  for (let start = 0; start < engagements.length; start += 100) {
    const batch = engagements.slice(start, start + 100).map((x) => x.id);
    const end = await readPages((from, to) => supabase.from("engagement_endings").select("engagement_id, ended_on")
      .in("engagement_id", batch).order("engagement_id").range(from, to).abortSignal(signal), 20_000);
    if (end.error || end.truncated) throw end.error ?? new Error("Não foi possível consultar todos os encerramentos.");
    endings.push(...parseBoundary(z.array(ending), end.data, "access-endings"));
  }
  return { persons, engagements, endings, hasNext: rows.length > ACCESS_PEOPLE_PAGE };
}