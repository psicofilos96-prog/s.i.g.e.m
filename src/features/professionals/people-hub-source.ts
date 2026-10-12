/** L21 — leitura da Gestão de Pessoas com a sessão (RLS). Mesmas tabelas do DP; sem cópia nem fixture. */
import { readPages } from "@/lib/list-paging";
import { supabase } from "@/integrations/supabase/client";
import type { Sources } from "./functional-life";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };

async function readAll(t: string, col: string, school: string) {
  const { data, error } = await readPages<any>((a, b) => db.from(t).select("*").eq(col, school).order("id").range(a, b), 20000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Escolas onde a conta tem `consultar-registro-funcional` (rede ⇒ todas as escolas cadastradas). */
export async function peopleSchools(): Promise<{ id: string; name: string }[]> {
  const { data: caps, error } = await db.rpc("effective_scope_capabilities", {});
  if (error) throw new Error(error.message);
  const mine = (caps ?? []).filter((c: any) => c.policy_id && c.capability_id === "consultar-registro-funcional");
  if (!mine.length) return [];
  const { data } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false });
  const names = new Map<string, string>();
  for (const r of data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
  const ids = mine.some((c: any) => c.scope_level === "rede") ? [...names.keys()] : [...new Set<string>(mine.map((c: any) => c.school_id).filter(Boolean))];
  return ids.map((id) => ({ id, name: names.get(id) ?? "Escola sem nome declarado" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function loadPeopleSources(school: string): Promise<{ src: Sources; names: Map<string, string> }> {
  const [postings, exercises, qualifications, events, processes] = await Promise.all([
    readAll("professional_postings", "school_id", school), readAll("professional_exercises", "school_id", school),
    readAll("professional_qualifications", "school_id", school), readAll("professional_functional_events", "school_id", school),
    readAll("professional_functional_processes", "school_id", school)]);
  const linkIds = [...new Set(postings.map((p: any) => p.functional_link_logical_id))];
  const links = linkIds.length ? (await db.from("professional_functional_links").select("*").in("logical_id", linkIds)).data ?? [] : [];
  const persons = [...new Set<string>(links.map((l: any) => l.person_id))];
  const engagements = persons.length ? (await db.from("institutional_engagements").select("id, person_id, engagement_kind_id, school_id, scope_level, valid_from, valid_until, created_at").in("person_id", persons)).data ?? [] : [];
  const engIds = engagements.map((e: any) => e.id);
  const endRes = engIds.length ? await db.from("engagement_endings").select("engagement_id, ended_on, created_at").in("engagement_id", engIds) : { data: [], error: null };
  const ppl = persons.length ? (await db.from("institutional_persons").select("id, display_name").in("id", persons)).data ?? [] : [];
  return {
    src: { links, postings, exercises, qualifications, events, processes, engagements, engagementEndings: endRes.error ? null : (endRes.data ?? []) },
    names: new Map(ppl.map((p: any) => [p.id, p.display_name])),
  };
}
