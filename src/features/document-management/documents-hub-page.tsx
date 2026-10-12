/** SIGEM Documentos L24 — painel: caixa de entrada, pesquisa, relatórios e matriz. Nada é lido antes da sessão. */
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { DOCS_CLOSURE_BASE_SHA, DOCS_CLOSURE_CRITERIA, DOCS_CLOSURE_SECTIONS, DOC_LOTS, docClosureSummary, type DocClosureStatus } from "./documents-closure";
import { DOC_REPORTS } from "./documents-reports";
import { groupInbox, readInbox, type InboxRow } from "./unit-inbox";
import { sanitizeSearchTerm } from "./document-integration";

const LABEL: Record<DocClosureStatus, string> = { "persistido-com-tela": "No banco, com tela", persistido: "No banco", "nucleo-testado": "Regra testada", bloqueado: "Bloqueado" };
const TABS = [["caixa", "Caixa de entrada"], ["pesquisa", "Pesquisa"], ["relatorios", "Relatórios"], ["lotes", "Lotes"], ["matriz", "Seções"], ["criterios", "Critérios"]] as const;
type Tab = (typeof TABS)[number][0];
const BOX = { "a-receber": "A receber", "em-andamento": "Em andamento", devolvidos: "Devolvidos" } as const;

function Inbox() {
  const [s, setS] = useState<{ rows?: InboxRow[]; err?: string } | null>(null);
  useEffect(() => { let l = true; readInbox().then((r) => l && setS(r.ok ? { rows: r.rows } : { err: r.reason })); return () => { l = false; }; }, []);
  if (!s) return <SkeletonState label="Carregando caixa de entrada" />;
  if (s.err) return <p role="alert" className="text-destructive">{s.err}</p>;
  const g = groupInbox(s.rows ?? []);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(Object.keys(BOX) as (keyof typeof BOX)[]).map((k) => (
        <section key={k} className="rounded-md border p-3">
          <h3 className="font-medium">{BOX[k]} ({g[k].length})</h3>
          {g[k].length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro.</p> : (
            <ul className="mt-2 space-y-2 text-sm">{g[k].map((r) => (
              <li key={r.dispatchId} className="break-words"><span className="font-medium">{r.caseNumber}</span> — {r.subject}
                <span className="block text-xs text-muted-foreground">De {r.fromUnitId}{r.dueOn ? ` · prazo ${r.dueOn}` : " · sem prazo declarado"}</span></li>))}</ul>
          )}
        </section>
      ))}
    </div>
  );
}

function Search() {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<{ case_id: string; case_number: string; subject: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const { data, error } = await supabase.rpc("search_admin_cases", { _term: sanitizeSearchTerm(term), _classification: "", _year: null as unknown as number });
    if (error) setErr("Pesquisa indisponível."); else setRows(data ?? []);
  }
  return (
    <div className="space-y-3">
      <form onSubmit={go} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="doc-search">Número ou assunto</label>
        <input id="doc-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Número ou assunto" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2" />
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Pesquisar</button>
      </form>
      <p className="text-xs text-muted-foreground">Só aparecem processos que você pode ler; anexos e dados sensíveis nunca entram na pesquisa.</p>
      {err && <p role="alert" className="text-destructive">{err}</p>}
      {rows && (rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum resultado.</p> :
        <ul className="space-y-1 text-sm">{rows.map((r) => <li key={r.case_id}><span className="font-medium">{r.case_number}</span> — {r.subject}</li>)}</ul>)}
    </div>
  );
}

function Matrix({ rows }: { rows: typeof DOCS_CLOSURE_SECTIONS }) {
  return <ul className="grid gap-2 md:grid-cols-2">{rows.map((r) => (
    <li key={r.n} className="min-w-0 rounded-md border p-3">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{r.n}. {r.title}</span>
        <span className={`text-xs ${r.status === "bloqueado" ? "text-destructive" : "text-muted-foreground"}`}>{LABEL[r.status]}</span></div>
      {r.blocker && <p className="mt-1 text-sm text-muted-foreground">{r.blocker}</p>}
      {r.lots.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Lotes: {r.lots.join(", ")}</p>}
    </li>))}</ul>;
}

export function DocumentsHubPage() {
  const a = useSessionAuthority();
  const [tab, setTab] = useState<Tab>("caixa");
  if (a.status === "signed-out") return <SignInRequired title="SIGEM Documentos" what="a caixa de entrada, a pesquisa e os relatórios documentais" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  const sum = docClosureSummary(DOCS_CLOSURE_SECTIONS);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SIGEM Documentos" title="Protocolo, processos e tramitação" description="Situação real de cada parte. Nenhuma homologação institucional é presumida." />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(LABEL) as DocClosureStatus[]).map((k) => (
          <div key={k} className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">{LABEL[k]}</dt><dd className="text-2xl font-semibold">{sum[k]}</dd></div>))}
      </dl>
      <div role="tablist" className="flex flex-wrap gap-2">{TABS.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md border px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>
      {tab === "caixa" && <Inbox />}
      {tab === "pesquisa" && <Search />}
      {tab === "relatorios" && <ul className="grid gap-2 md:grid-cols-2">{DOC_REPORTS.map((r) => (
        <li key={r.key} className="rounded-md border p-3 text-sm"><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.methodology} Fonte: {r.source}.</p>
          {r.blocker && <p className="mt-1 text-xs text-destructive">{r.blocker}</p>}</li>))}</ul>}
      {tab === "lotes" && <ul className="grid gap-2 md:grid-cols-2">{DOC_LOTS.map((l) => (
        <li key={l.lot} className="rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">L{l.lot}. {l.title}</span><span className="text-xs text-muted-foreground">{LABEL[l.status]}</span></div>
          {l.blocker && <p className="mt-1 text-xs text-muted-foreground">{l.blocker}</p>}</li>))}</ul>}
      {tab === "matriz" && <Matrix rows={DOCS_CLOSURE_SECTIONS} />}
      {tab === "criterios" && <Matrix rows={DOCS_CLOSURE_CRITERIA} />}
      <p className="break-all text-xs text-muted-foreground">Base: {DOCS_CLOSURE_BASE_SHA}</p>
    </div>
  );
}
