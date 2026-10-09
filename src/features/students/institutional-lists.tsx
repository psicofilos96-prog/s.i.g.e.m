/**
 * PERF.LOADING.2 — listas reais (base oficial importada) de Alunos e Profissionais,
 * paginadas no servidor, com busca no servidor, tempo-limite e "Tentar novamente".
 * Nunca misturam dados demonstrativos: com sessão, só a base institucional.
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { SkeletonState } from "@/components/sigem/guidance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounced } from "@/features/global-search/global-search";
import { LIST_PAGE_SIZE, ListTimeoutError, useServerPage } from "@/lib/server-page";

/** Escapa curingas do ILIKE: a busca é por texto, nunca por padrão. */
export function ilikeTerm(raw: string): string | null {
  const t = raw.trim().replace(/[\\%_,()]/g, " ").replace(/\s+/g, " ").trim();
  return t.length >= 2 ? `%${t}%` : null;
}

type Q = ReturnType<typeof useServerPage<unknown>>;

function ListStates({ q, noun, emptyAll, searching, children }: { q: Q; noun: string; emptyAll: string; searching: boolean; children: ReactNode }) {
  if (q.isPending) return <SkeletonState label={`Carregando ${noun}`} />;
  if (q.isError) {
    const timeout = q.error instanceof ListTimeoutError;
    const denied = (q.error as { code?: string } | null)?.code === "42501";
    return (
      <section role="alert" className="rounded-lg border border-border bg-card p-6 text-center text-sm">
        <p className="font-medium text-foreground">{denied ? `Você não tem acesso a ${noun}.` : timeout ? `A lista de ${noun} demorou demais para responder.` : `Não foi possível carregar ${noun}.`}</p>
        {!denied && <Button className="mt-3" size="sm" onClick={() => void q.refetch()}>Tentar novamente</Button>}
      </section>
    );
  }
  if (q.data && q.data.items.length === 0)
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{searching ? `Nenhum resultado para a pesquisa.` : emptyAll}</p>;
  return <>{children}</>;
}

function Pager({ q, page, setPage, noun }: { q: Q; page: number; setPage: (p: number) => void; noun: string }) {
  const d = q.data; if (!d) return null;
  const from = (page - 1) * LIST_PAGE_SIZE + 1, to = from + d.items.length - 1;
  const last = d.total !== null ? Math.max(1, Math.ceil(d.total / LIST_PAGE_SIZE)) : null;
  const hasNext = last !== null ? page < last : d.items.length === LIST_PAGE_SIZE;
  return (
    <nav aria-label={`Paginação de ${noun}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <p aria-live="polite">{d.items.length ? `${from}–${to}` : "0"}{d.total !== null ? ` de cerca de ${d.total.toLocaleString("pt-BR")}` : ""} {noun}{q.isFetching ? " · atualizando…" : ""}</p>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Página anterior</Button>
        <span>Página {page}{last ? ` de ${last}` : ""}</span>
        <Button type="button" size="sm" variant="outline" disabled={!hasNext} onClick={() => setPage(page + 1)}>Próxima página</Button>
      </div>
    </nav>
  );
}

type StudentRow = { id: string; display_name: string; institutional_identifier: string | null };

export function InstitutionalStudentsListPage() {
  const [query, setQueryRaw] = useState(""); const [page, setPage] = useState(1);
  const term = ilikeTerm(useDebounced(query, 300));
  const setQuery = (v: string) => { setQueryRaw(v); setPage(1); };
  const q = useServerPage<StudentRow>(["inst-students", term], page, ({ from, to, signal }) => {
    let b = supabase.from("institutional_students").select("id, display_name, institutional_identifier", { count: "estimated" });
    if (term) b = b.or(`display_name.ilike.${term},institutional_identifier.ilike.${term}`);
    return b.order("display_name").order("id").range(from, to).abortSignal(signal);
  });
  return (
    <div className="grid gap-4">
      <OperationalPageHeader title="Alunos" description="Base institucional da rede no seu escopo de acesso." />
      <Input aria-label="Pesquisar alunos" placeholder="Pesquisar por nome ou identificador" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" />
      <ListStates q={q as Q} noun="alunos" emptyAll="Nenhum aluno registrado no seu escopo." searching={!!term}>
        <Pager q={q as Q} page={page} setPage={setPage} noun="alunos" />
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm" aria-busy={q.isFetching}>
            <caption className="sr-only">Alunos</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th scope="col" className="p-2">Nome</th><th scope="col" className="p-2">Identificador</th></tr></thead>
            <tbody>{q.data?.items.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 font-medium"><Link to="/ficha-longitudinal/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.display_name}</Link></td>
                <td className="p-2 text-muted-foreground">{r.institutional_identifier ?? "Não registrado"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </ListStates>
    </div>
  );
}

type ProfRow = { id: string; display_name: string; professional_census_declarations: { function_literal: string | null }[] };

export function InstitutionalProfessionalsListPage() {
  const [query, setQueryRaw] = useState(""); const [page, setPage] = useState(1);
  const term = ilikeTerm(useDebounced(query, 300));
  const setQuery = (v: string) => { setQueryRaw(v); setPage(1); };
  const q = useServerPage<ProfRow>(["inst-professionals", term], page, ({ from, to, signal }) => {
    let b = supabase.from("institutional_persons").select("id, display_name, professional_census_declarations!professional_census_declarations_person_id_fkey!inner(function_literal)", { count: "estimated" });
    if (term) b = b.ilike("display_name", term);
    return b.order("display_name").order("id").range(from, to).abortSignal(signal) as unknown as PromiseLike<{ data: ProfRow[] | null; error: { message: string } | null; count: number | null }>;
  });
  return (
    <div className="grid gap-4">
      <OperationalPageHeader title="Profissionais" description="Profissionais declarados na base oficial 2026 (Censo), no seu escopo de acesso." />
      <Input aria-label="Pesquisar profissionais" placeholder="Pesquisar pelo nome" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" />
      <ListStates q={q as Q} noun="profissionais" emptyAll="Nenhum profissional visível no seu escopo." searching={!!term}>
        <Pager q={q as Q} page={page} setPage={setPage} noun="profissionais" />
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm" aria-busy={q.isFetching}>
            <caption className="sr-only">Profissionais</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th scope="col" className="p-2">Nome</th><th scope="col" className="p-2">Função declarada (Censo 2026)</th></tr></thead>
            <tbody>{q.data?.items.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 font-medium">{r.display_name}</td>
                <td className="p-2 text-muted-foreground">{[...new Set(r.professional_census_declarations.map((l) => l.function_literal).filter(Boolean))].join(", ") || "Não declarada"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </ListStates>
    </div>
  );
}
