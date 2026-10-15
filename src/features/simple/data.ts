import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ENTITIES, type EntityKey } from "./entities";

type Row = Record<string, unknown> & { id: string };
const db = supabase as unknown as { from: (t: string) => any };

/** Lê todas as linhas em páginas de 1000 (o servidor corta em 1000). */
export async function readAll(table: string, columns = "*", filter?: (q: any) => any): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns).order("id").range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Nomes para listas de escolha (escolas, turmas, servidores). */
export function useOptions(key: EntityKey, enabled = true) {
  return useQuery({
    queryKey: ["sg-options", key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await readAll(ENTITIES[key].table, key === "classes" ? "id,name,school_id" : "id,name");
      rows.sort((a, b) => String(a["name"]).localeCompare(String(b["name"]), "pt-BR"));
      return rows as { id: string; name: string; school_id?: string }[];
    },
  });
}

export async function saveRow(key: EntityKey, row: Record<string, unknown>) {
  const t = ENTITIES[key].table;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) clean[k] = v === "" ? null : v;
  clean["updated_at"] = new Date().toISOString();
  const { id, ...rest } = clean;
  const r = id ? await db.from(t).update(rest).eq("id", id) : await db.from(t).insert(rest);
  if (r.error) throw new Error(r.error.message);
}

export async function deleteRow(key: EntityKey, id: string) {
  const r = await db.from(ENTITIES[key].table).delete().eq("id", id);
  if (r.error) throw new Error(r.error.message);
}

export async function countOf(table: string, filter?: (q: any) => any): Promise<number> {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.count ?? 0;
}

export { db };
