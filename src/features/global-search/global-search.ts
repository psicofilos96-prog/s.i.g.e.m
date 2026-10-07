/**
 * Pesquisa global — o banco (`global_search`, SECURITY INVOKER) filtra pela RLS de quem pesquisa
 * antes de devolver; a tela nunca busca tudo para filtrar depois. Conteúdo sensível (inclusão,
 * saúde, notas, endereço) não é indexado. Buscas recentes não são guardadas, porque nomes de
 * estudantes são dados pessoais.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SearchCategory = "aluno" | "escola" | "turma" | "pessoa" | "matriz" | "componente";
export type SearchHit = { category: string; entity_id: string; title: string; subtitle: string | null; match_kind: string; score: number };

export const CATEGORY_LABEL: Record<SearchCategory, string> = {
  aluno: "Estudantes", escola: "Unidades escolares", turma: "Turmas", pessoa: "Pessoas institucionais", matriz: "Matrizes curriculares", componente: "Componentes curriculares",
};
export const MATCH_LABEL: Record<string, string> = {
  "identificador-exato": "identificador exato", "inicio-do-nome": "começa com o termo", contem: "contém o termo", "todas-as-palavras": "todas as palavras",
};

/** Destino de cada resultado; a página de destino revalida a autorização ao abrir. */
export function deepLink(hit: Pick<SearchHit, "category" | "entity_id">): { to: string; params?: Record<string, string> } | null {
  switch (hit.category) {
    case "aluno": return { to: "/alunos/$id", params: { id: hit.entity_id } };
    case "turma": return { to: "/turmas/$id", params: { id: hit.entity_id } };
    case "escola": return { to: "/unidades/$id", params: { id: hit.entity_id } };
    case "matriz": return { to: "/matrizes-curriculares/$id", params: { id: hit.entity_id } };
    case "pessoa": return { to: "/central-de-acessos" };
    case "componente": return { to: "/administracao" };
    default: return null;
  }
}

export function groupHits(hits: readonly SearchHit[]): [SearchCategory, SearchHit[]][] {
  const out = new Map<SearchCategory, SearchHit[]>();
  for (const h of hits) if (h.category in CATEGORY_LABEL) out.set(h.category as SearchCategory, [...(out.get(h.category as SearchCategory) ?? []), h]);
  return [...out];
}

export const MIN_QUERY = 2;
export const PAGE_SIZE = 20;

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useGlobalSearch(query: string, enabled: boolean, page = 0) {
  const q = query.trim();
  return useQuery({
    queryKey: ["global-search", q, page],
    enabled: enabled && q.length >= MIN_QUERY,
    staleTime: 0, gcTime: 30_000, retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("global_search", { _q: q, _limit: PAGE_SIZE + 1, _offset: page * PAGE_SIZE });
      if (error) throw new Error("search-failed");
      const rows = (data ?? []) as SearchHit[];
      return { hits: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
    },
  });
}

/** NSEARCH.2 — conta de setor só vê resultados cujo destino pertence à estação (RLS já filtrou escola/capability no banco). */
export function stationScopedHits(hits: readonly SearchHit[], allows: ((path: string) => boolean) | null): SearchHit[] {
  if (!allows) return [...hits];
  return hits.filter((h) => { const l = deepLink(h); return !!l && allows(l.to.replace(/\/\$[a-z]+$/i, "")); });
}
