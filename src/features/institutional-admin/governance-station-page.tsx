import { humanizeForScreen } from "@/config/technical-codes";
import { operationalToday } from "@/lib/academic-date";
import { PageHeader } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CONFIG_HUB, governanceMatrix } from "./governance-station";
import { effectiveVersion, type PolicyRule, type PolicyVersion } from "./policy-governance";
import { explainAccess, GOVERNANCE_REVIEW_PENDING, type EngagementRow } from "./access-explainer";
import { filterEvents, type AuditEvent } from "@/features/audit/audit-model";
import { loadAll } from "@/features/audit/audit-page";
import { DateInput } from "@/components/sigem/date-input";
import { useSessionAuthority, sessionContextKey } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { withListTimeout } from "@/lib/server-page";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { readPages } from "@/lib/list-paging";

const ADMIN_MODULES = new Set(["Contas", "Políticas de acesso"]);
const today = () => operationalToday();

/** Somente leitura: regras chegam pela RLS da sessão; recusa/erro ⇒ nada é afirmado; explicar nunca concede. */
export function GovernanceStationPage() {
  const authority = useSessionAuthority();
  if (authority.status === "loading") return authority.error ? <p role="alert">Não foi possível conferir seu acesso. Recarregue a página para tentar novamente.</p> : <SkeletonState label="Conferindo seu acesso" />;
  if (!pathAllowed(authority, "/estacao-administrativa")) return <p role="alert">Sua conta não tem permissão para abrir a Estação administrativa.</p>;
  return <AuthorizedGovernanceStationPage key={sessionContextKey(authority)} />;
}

function AuthorizedGovernanceStationPage() {
  const authority = useSessionAuthority();
  const [cap, setCap] = useState(""); const [school, setSchool] = useState(""); const [on, setOn] = useState(today());
  const [q, setQ] = useState("");
  const state = useQuery({ queryKey: ["governance-station", sessionContextKey(authority)], enabled: authority.status === "signed-in", retry: false, staleTime: 60_000, queryFn: ({ signal }) => withListTimeout(signal, async (s) => {
    if (authority.status !== "signed-in") throw new Error("Sessão não confirmada.");
    const [pols, engagements] = await Promise.all([
      readPages((from, to) => supabase.from("capability_policies").select("*").order("id").range(from, to).abortSignal(s), 20_000),
      authority.person ? readPages((from, to) => supabase.from("institutional_engagements").select("id,engagement_kind_id,scope_level,school_id,valid_from,valid_until").eq("person_id", authority.person?.id ?? "").order("id").range(from, to).abortSignal(s), 20_000) : Promise.resolve({ data: [], error: null, truncated: false }),
    ]);
    if (pols.error || engagements.error || pols.truncated || engagements.truncated) throw pols.error ?? engagements.error ?? new Error("Consulta incompleta.");
    const policy = effectiveVersion((pols.data ?? []) as unknown as PolicyVersion[], today());
    if (!policy) return { policy: null, rules: [] as PolicyRule[], engagements: engagements.data as EngagementRow[] };
    const r = await readPages((from, to) => supabase.from("capability_policy_rules").select("engagement_kind_id,capability_id,scope_dimensions").eq("policy_id", policy.id).order("engagement_kind_id").order("capability_id").range(from, to).abortSignal(s), 100_000);
    if (r.error || r.truncated) throw r.error ?? new Error("Consulta incompleta.");
    return { policy, rules: (r.data ?? []) as PolicyRule[], engagements: (engagements.data ?? []) as EngagementRow[] };
  }) });
  const history = useQuery({ queryKey: ["governance-station-history", sessionContextKey(authority)], enabled: authority.status === "signed-in", retry: false, staleTime: 60_000, queryFn: ({ signal }) => withListTimeout(signal, async () => (await loadAll(ADMIN_MODULES)).filter((x) => ADMIN_MODULES.has(x.module))) });
  const policy = state.isError ? undefined : state.data?.policy;
  const rules = state.isError ? null : state.data?.rules ?? null;
  const engs = state.data?.engagements ?? [];
  const events = history.isError ? null : history.data ?? null;
  const error = state.isError ? "Não foi possível concluir a consulta." : null;
  const matrix = rules ? governanceMatrix(rules) : null;
  const caps = useMemo(() => [...new Set((rules ?? []).map((r) => r.capability_id))].sort(), [rules]);
  const explanation = cap && rules ? explainAccess(policy?.id ?? null, rules, engs, { capability: cap, schoolId: school.trim() || null, on }) : null;
  const needle = q.trim().toLowerCase();
  const timeline = events ? filterEvents(events, {}).filter((e) => !needle || `${e.action} ${e.entity ?? ""}`.toLowerCase().includes(needle)).slice(0, 100) : null;
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <PageHeader title="Estação administrativa" description="Leitura da governança vigente. Nenhuma ação aqui concede acesso ou homologa regra; alterações só nos módulos donos." />

      <section aria-labelledby="gov-review" className="rounded border border-border p-4">
        <h2 id="gov-review" className="mb-1 font-medium text-foreground">Revisão de governança pendente</h2>
        <p className="text-sm">{GOVERNANCE_REVIEW_PENDING.finding}</p>
        <p className="text-sm text-muted-foreground">Impacto: {GOVERNANCE_REVIEW_PENDING.impact} {GOVERNANCE_REVIEW_PENDING.decision}</p>
      </section>

      <section aria-labelledby="why"><h2 id="why" className="mb-2 font-medium text-foreground">Por que pode / por que não pode</h2>
        <p className="mb-2 text-xs text-muted-foreground">Explicação sobre a política vigente e as suas atuações. Não concede nada: o banco confere de novo no momento de cada ato.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Capacidade<select className="ml-2 rounded border border-input bg-background p-2" value={cap} onChange={(e) => setCap(e.target.value)}><option value="">Escolha…</option>{caps.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="text-sm">Escola (código, opcional)<input className="ml-2 rounded border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)} /></label>
          <label className="text-sm">Em <DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
        </div>
        {explanation && <p role="status" className="mt-2 text-sm"><strong>{explanation.allowed ? "Pode" : "Não pode"}</strong> — {humanizeForScreen(explanation.reason)}</p>}
      </section>

      <section><h2 className="mb-2 font-medium text-foreground">Quem exerce cada ato</h2>
        {error && <div role="alert" className="text-sm text-destructive">{error} <Button variant="outline" size="sm" onClick={() => void state.refetch()}>Tentar novamente</Button></div>}
        {!error && state.isPending && <SkeletonState label="Carregando" />}
        {policy === null && !error && <p className="text-sm text-muted-foreground">Nenhuma política homologada vigente legível por esta sessão.</p>}
        {matrix && (
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th scope="col">Ato</th><th scope="col">Domínio</th><th scope="col">Capacidade</th><th scope="col">Atuações (política homologada)</th></tr></thead>
            <tbody>{matrix.map((m) => (
              <tr key={m.capability} className="border-t border-border"><td>{m.act}</td><td>{m.domain}</td><td className="font-mono text-xs">{m.capability}</td>
                <td>{m.pending ? <span className="text-muted-foreground">Atribuição pendente — ninguém</span> : m.holders.join("; ")}</td></tr>))}</tbody></table>)}
      </section>

      <section aria-labelledby="timeline"><h2 id="timeline" className="mb-2 font-medium text-foreground">Linha do tempo administrativa</h2>
        <p className="mb-2 text-xs text-muted-foreground">Mesma trilha da Auditoria (contas e políticas), lida com a sua sessão; sem senha, e-mail ou conteúdo.</p>
        <input aria-label="Buscar por entidade" placeholder="Buscar (ex.: politica:, conta:)" className="mb-2 w-full rounded border border-input bg-background p-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        {history.isError ? <div role="alert" className="text-sm text-destructive">A consulta do histórico não foi concluída. <Button variant="outline" size="sm" onClick={() => void history.refetch()}>Tentar novamente</Button></div> : !timeline ? <SkeletonState label="Carregando" /> : timeline.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ato visível para esta sessão.</p>
          : <ul className="space-y-1 text-sm">{timeline.map((e) => <li key={e.id}><span className="text-muted-foreground">{e.at.slice(0, 16).replace("T", " ")}</span> {e.action} · {e.entity}{e.entityVersion ? ` v${e.entityVersion}` : ""}</li>)}</ul>}
        <Link to="/auditoria" className="text-sm underline">Abrir a auditoria completa</Link>
      </section>

      <section><h2 className="mb-2 font-medium text-foreground">Configuração por módulo</h2>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">{CONFIG_HUB.map((c) => (
          <li key={c.to}><Link to={c.to} className="block rounded border border-border p-3 text-sm text-foreground hover:bg-muted">{c.label}</Link></li>))}</ul>
      </section>
    </div>
  );
}
