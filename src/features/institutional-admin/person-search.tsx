import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sessionContextKey, useSessionAuthority } from "@/features/authority/session-authority";
import { withListTimeout } from "@/lib/server-page";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { readPages } from "@/lib/list-paging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const personSchema = z.object({ id: z.string(), display_name: z.string(), institutional_identifier: z.string().nullable() });
export type AdminPerson = z.infer<typeof personSchema>;
const columns = "id, display_name, institutional_identifier";
const PAGE_SIZE = 50;

export function personSearchTerm(raw: string): string | null {
  const clean = raw.trim().replace(/[\\%_,()."']/g, " ").replace(/\s+/g, " ").trim();
  return clean.length >= 2 ? `%${clean}%` : null;
}

/** Only resolve identities actually displayed; never download the municipal directory for labels. */
export function useAdminPersonNames(ids: string[]) {
  const authority = useSessionAuthority();
  const unique = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["admin-person-names", sessionContextKey(authority), unique],
    enabled: authority.status === "signed-in" && unique.length > 0,
    retry: false,
    queryFn: ({ signal }) => withListTimeout(signal, async (s) => {
      const out: AdminPerson[] = [];
      for (let i = 0; i < unique.length; i += 100) {
        const r = await readPages((from, to) => supabase.from("institutional_persons").select(columns)
          .in("id", unique.slice(i, i + 100)).order("id").range(from, to).abortSignal(s), 1000);
        if (r.error) throw r.error;
        if (r.truncated) throw new Error("Person lookup incomplete");
        out.push(...parseBoundary(z.array(personSchema), r.data, "admin-person-names"));
      }
      return new Map(out.map((p) => [p.id, p.display_name]));
    }),
  });
}

/** Existing RLS remains authoritative; pages contain at most 50 choices plus one look-ahead row. */
export function AdminPersonSearch({ id, picker = false, excluded = [] }: { id: string; picker?: boolean; excluded?: string[] }) {
  const authority = useSessionAuthority();
  const [raw, setRaw] = useState("");
  const [search, setSearch] = useState({ term: null as string | null, page: 1 });
  const [selected, setSelected] = useState<AdminPerson | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch({ term: personSearchTerm(raw), page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [raw]);
  const enabled = authority.status === "signed-in" && (!picker || !!search.term);
  const q = useQuery({
    queryKey: ["admin-person-search", sessionContextKey(authority), search.term, search.page],
    enabled, retry: false,
    queryFn: ({ signal }) => withListTimeout(signal, async (s) => {
      let builder = supabase.from("institutional_persons").select(columns);
      if (search.term) builder = builder.or(`display_name.ilike.${search.term},institutional_identifier.ilike.${search.term}`);
      const from = (search.page - 1) * PAGE_SIZE;
      const r = await builder.order("display_name").order("id").range(from, from + PAGE_SIZE).abortSignal(s);
      if (r.error) throw r.error;
      return parseBoundary(z.array(personSchema), r.data, "admin-person-search");
    }),
  });
  const rows = (q.data ?? []).slice(0, PAGE_SIZE).filter((p) => !excluded.includes(p.id));
  const choices = selected && !rows.some((p) => p.id === selected.id) ? [selected, ...rows] : rows;
  return <div className="mb-3 grid min-w-0 gap-2">
    <Label htmlFor={`${id}-search`}>{picker ? "Localizar pessoa" : "Localizar por nome ou matrícula"}</Label>
    <Input id={`${id}-search`} placeholder="Nome ou matrícula" value={raw} onChange={(e) => setRaw(e.target.value)} />
    {picker && <select id={id} name={id} aria-label="Pessoa" required value={selected?.id ?? ""}
      onChange={(e) => setSelected(choices.find((p) => p.id === e.target.value) ?? null)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
      <option value="">Escolha uma pessoa…</option>
      {choices.map((p) => <option key={p.id} value={p.id}>{p.display_name}{p.institutional_identifier ? ` — ${p.institutional_identifier}` : ""}</option>)}
    </select>}
    {!enabled && picker && <p className="text-xs text-muted-foreground">Informe pelo menos dois caracteres.</p>}
    {enabled && q.isPending && <p role="status" className="text-sm text-muted-foreground">Localizando pessoas…</p>}
    {q.isError && <div role="alert" className="text-sm text-destructive">Não foi possível consultar as pessoas. <Button type="button" size="sm" variant="outline" onClick={() => void q.refetch()}>Tentar novamente</Button></div>}
    {enabled && q.isSuccess && <>
      {!picker && <ul className="grid gap-1 text-sm">{rows.map((p) => <li key={p.id}>{p.display_name}{p.institutional_identifier ? ` — ${p.institutional_identifier}` : ""}</li>)}</ul>}
      {!rows.length && <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada nesta página.</p>}
      <nav aria-label={`Páginas de ${id}`} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button type="button" size="sm" variant="outline" disabled={search.page <= 1} onClick={() => setSearch((v) => ({ ...v, page: v.page - 1 }))}>Página anterior</Button>
        <span>Página {search.page}</span>
        <Button type="button" size="sm" variant="outline" disabled={(q.data?.length ?? 0) <= PAGE_SIZE} onClick={() => setSearch((v) => ({ ...v, page: v.page + 1 }))}>Próxima página</Button>
      </nav>
    </>}
  </div>;
}