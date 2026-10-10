/**
 * PERF.LOADING.2 — listas reais (base oficial importada) de Alunos e Profissionais,
 * paginadas no servidor, com busca no servidor, tempo-limite e "Tentar novamente".
 * Nunca misturam dados demonstrativos: com sessão, só a base institucional.
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RegistryHero, RegistryToolbar, RegistryList, RegistryCard, CardFact, registryTh, registryTd, registryRow } from "@/components/sigem/registry-layout";
import { Label } from "@/components/ui/label";
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
      <section role="alert" className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm">
        <p className="font-medium text-foreground">{denied ? `Você não tem acesso a ${noun}.` : timeout ? `A lista de ${noun} demorou demais para responder.` : `Não foi possível carregar ${noun}.`}</p>
        {!denied && <Button className="mt-3" size="sm" onClick={() => void q.refetch()}>Tentar novamente</Button>}
      </section>
    );
  }
  if (q.data && q.data.items.length === 0)
    return <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{searching ? `Nenhum resultado para a pesquisa.` : emptyAll}</p>;
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

const NR = "Não registrado";
const countOf = (q: Q, noun: string) => q.data?.total != null ? <>{q.data.total.toLocaleString("pt-BR")}<span className="ml-2 align-middle text-sm font-normal text-muted-foreground">{noun}</span></> : undefined;

function SearchField({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid min-w-0 flex-1 gap-1 sm:max-w-sm">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

export function InstitutionalStudentsListPage() {
  const [query, setQueryRaw] = useState(""); const [page, setPage] = useState(1);
  const term = ilikeTerm(useDebounced(query, 300));
  const setQuery = (v: string) => { setQueryRaw(v); setPage(1); };
  const q = useServerPage<StudentRow>(["inst-students", term], page, async ({ from, to, signal }) => {
    // PERF.LOADING.3 — contagem EXATA: sem busca, pelo leitor de contagem por conjunto (mesmo alcance da RLS,
    // calculado uma vez); com busca, count exato do próprio filtro (conjunto pequeno).
    if (term) return supabase.from("institutional_students").select("id, display_name, institutional_identifier", { count: "exact" })
      .or(`display_name.ilike.${term},institutional_identifier.ilike.${term}`).order("display_name").order("id").range(from, to).abortSignal(signal);
    const [rows, count] = await Promise.all([
      supabase.from("institutional_students").select("id, display_name, institutional_identifier").order("display_name").order("id").range(from, to).abortSignal(signal),
      supabase.rpc("readable_students_count").abortSignal(signal),
    ]);
    return { data: rows.data, error: rows.error ?? count.error, count: typeof count.data === "number" ? count.data : null };
  });
  const items = q.data?.items ?? [];
  return (
    <div className="space-y-6">
      <RegistryHero
        eyebrow="Rede Municipal de Itaperuna · Estudantes 2026"
        title="Alunos e matrículas"
        lede="Estudantes da base institucional no seu alcance de acesso. Abra um nome para ver a ficha longitudinal com matrícula, turma e percurso."
        count={term ? undefined : countOf(q as Q, "alunos")}
        actions={<Button asChild size="sm" variant="outline"><Link to="/matriculas">Ver matrículas</Link></Button>}
      />
      <RegistryToolbar summary={term && q.data?.total != null ? <>{q.data.total.toLocaleString("pt-BR")} resultado(s) para a pesquisa</> : <>Ordem alfabética · {LIST_PAGE_SIZE} por página</>}>
        <SearchField id="students-search" label="Pesquisar alunos" placeholder="Nome ou identificador" value={query} onChange={setQuery} />
      </RegistryToolbar>
      <ListStates q={q as Q} noun="alunos" emptyAll="Nenhum aluno registrado no seu escopo." searching={!!term}>
        <RegistryList
          label="Alunos"
          table={
            <table className="w-full text-sm" aria-busy={q.isFetching}>
              <caption className="sr-only">Alunos</caption>
              <thead><tr><th scope="col" className={registryTh}>Nome</th><th scope="col" className={registryTh}>Identificador</th><th scope="col" className={registryTh}><span className="sr-only">Ação</span></th></tr></thead>
              <tbody>{items.map((r) => (
                <tr key={r.id} className={registryRow}>
                  <td className={registryTd}><Link to="/alunos/$id" params={{ id: r.id }} className="font-medium text-foreground hover:text-primary hover:underline">{r.display_name}</Link></td>
                  <td className={`${registryTd} font-mono text-xs tabular-nums text-muted-foreground`}>{r.institutional_identifier ?? NR}</td>
                  <td className={`${registryTd} text-right`}><Link to="/alunos/$id" params={{ id: r.id }} aria-label={`Abrir ficha de ${r.display_name}`} className="text-sm font-medium text-primary hover:underline">Abrir ficha</Link></td>
                </tr>))}</tbody>
            </table>
          }
          cards={items.map((r) => (
            <RegistryCard key={r.id} title={<Link to="/alunos/$id" params={{ id: r.id }} className="text-foreground hover:text-primary hover:underline">{r.display_name}</Link>}>
              <CardFact label="Identificador"><span className="tabular-nums">{r.institutional_identifier ?? NR}</span></CardFact>
            </RegistryCard>
          ))}
        />
        <Pager q={q as Q} page={page} setPage={setPage} noun="alunos" />
      </ListStates>
    </div>
  );
}

type ProfRow = { id: string; display_name: string; professional_census_declarations: { function_literal: string | null }[] };

export const declaredFunctions = (r: ProfRow) => [...new Set(r.professional_census_declarations.map((l) => l.function_literal).filter((x): x is string => !!x))];

export function InstitutionalProfessionalsListPage() {
  const [query, setQueryRaw] = useState(""); const [fn, setFnRaw] = useState(""); const [page, setPage] = useState(1);
  const term = ilikeTerm(useDebounced(query, 300));
  const fnTerm = ilikeTerm(useDebounced(fn, 300));
  const setQuery = (v: string) => { setQueryRaw(v); setPage(1); };
  const setFn = (v: string) => { setFnRaw(v); setPage(1); };
  const q = useServerPage<ProfRow>(["inst-professionals", term, fnTerm], page, ({ from, to, signal }) => {
    let b = supabase.from("institutional_persons").select("id, display_name, professional_census_declarations!professional_census_declarations_person_id_fkey!inner(function_literal)", { count: "estimated" });
    if (term) b = b.ilike("display_name", term);
    if (fnTerm) b = b.ilike("professional_census_declarations.function_literal", fnTerm);
    return b.order("display_name").order("id").range(from, to).abortSignal(signal) as unknown as PromiseLike<{ data: ProfRow[] | null; error: { message: string } | null; count: number | null }>;
  });
  const items = q.data?.items ?? [];
  const searching = !!term || !!fnTerm;
  return (
    <div className="space-y-6">
      <RegistryHero
        eyebrow="Rede Municipal de Itaperuna · Pessoal 2026"
        title="Profissionais"
        lede="Pessoas declaradas na base oficial 2026 (Censo Escolar), no seu alcance de acesso. A função mostrada é a declarada no Censo; ela não concede acesso ao SIGEM."
        count={searching || q.data?.total == null ? undefined : <>≈ {q.data.total.toLocaleString("pt-BR")}<span className="ml-2 align-middle text-sm font-normal text-muted-foreground">profissionais</span></>}
        actions={<Button asChild size="sm" variant="outline"><Link to="/pessoal-2026">Pessoal por escola (planilhas 2026)</Link></Button>}
      />
      <RegistryToolbar summary={searching ? <Button variant="link" size="sm" className="h-auto p-0" onClick={() => { setQuery(""); setFn(""); }}>Limpar pesquisa</Button> : <>Ordem alfabética · {LIST_PAGE_SIZE} por página</>}>
        <SearchField id="prof-search" label="Pesquisar profissionais" placeholder="Nome" value={query} onChange={setQuery} />
        <SearchField id="prof-fn" label="Função declarada" placeholder="Ex.: docente, auxiliar" value={fn} onChange={setFn} />
      </RegistryToolbar>
      <ListStates q={q as Q} noun="profissionais" emptyAll="Nenhum profissional visível no seu escopo." searching={searching}>
        <RegistryList
          label="Profissionais"
          table={
            <table className="w-full text-sm" aria-busy={q.isFetching}>
              <caption className="sr-only">Profissionais</caption>
              <thead><tr><th scope="col" className={registryTh}>Nome</th><th scope="col" className={registryTh}>Função declarada (Censo 2026)</th><th scope="col" className={registryTh}>Declarações</th></tr></thead>
              <tbody>{items.map((r) => { const f = declaredFunctions(r); return (
                <tr key={r.id} className={registryRow}>
                  <td className={`${registryTd} font-medium text-foreground`}>{r.display_name}</td>
                  <td className={`${registryTd} text-muted-foreground`}>{f.join(", ") || "Não declarada"}</td>
                  <td className={`${registryTd} tabular-nums text-muted-foreground`}>{r.professional_census_declarations.length}</td>
                </tr>); })}</tbody>
            </table>
          }
          cards={items.map((r) => (
            <RegistryCard key={r.id} title={r.display_name}>
              <CardFact label="Função declarada">{declaredFunctions(r).join(", ") || "Não declarada"}</CardFact>
              <CardFact label="Declarações"><span className="tabular-nums">{r.professional_census_declarations.length}</span></CardFact>
            </RegistryCard>
          ))}
        />
        <Pager q={q as Q} page={page} setPage={setPage} noun="profissionais" />
      </ListStates>
    </div>
  );
}
