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

const ADMIN_MODULES = new Set(["Contas", "Políticas de acesso"]);
const today = () => new Date().toISOString().slice(0, 10);

/** Somente leitura: regras chegam pela RLS da sessão; recusa/erro ⇒ nada é afirmado; explicar nunca concede. */
export function GovernanceStationPage() {
  const [policy, setPolicy] = useState<PolicyVersion | null | undefined>(undefined);
  const [rules, setRules] = useState<PolicyRule[] | null>(null);
  const [engs, setEngs] = useState<EngagementRow[]>([]);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cap, setCap] = useState(""); const [school, setSchool] = useState(""); const [on, setOn] = useState(today());
  const [q, setQ] = useState("");
  useEffect(() => {
    void (async () => {
      const { data: pols, error: e1 } = await supabase.from("capability_policies").select("*");
      if (e1) { setError("Política não legível com esta sessão."); return; }
      const v = effectiveVersion((pols ?? []) as unknown as PolicyVersion[], today());
      setPolicy(v);
      if (!v) { setRules([]); return; }
      const { data, error: e2 } = await supabase.from("capability_policy_rules").select("engagement_kind_id,capability_id,scope_dimensions").eq("policy_id", v.id);
      if (e2) setError("Regras não legíveis com esta sessão."); else setRules((data ?? []) as PolicyRule[]);
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: links } = await supabase.from("user_person_links" as never).select("person_id").eq("user_id", u.user.id);
        const ids = ((links ?? []) as { person_id: string }[]).map((l) => l.person_id);
        if (ids.length) {
          const { data: e } = await supabase.from("institutional_engagements").select("id,engagement_kind_id,scope_level,school_id,valid_from,valid_until").in("person_id", ids);
          setEngs((e ?? []) as EngagementRow[]);
        }
      }
      setEvents((await loadAll()).filter((x) => ADMIN_MODULES.has(x.module)));
    })();
  }, []);
  const matrix = rules ? governanceMatrix(rules) : null;
  const caps = useMemo(() => [...new Set((rules ?? []).map((r) => r.capability_id))].sort(), [rules]);
  const explanation = cap && rules ? explainAccess(policy?.id ?? null, rules, engs, { capability: cap, schoolId: school.trim() || null, on }) : null;
  const needle = q.trim().toLowerCase();
  const timeline = events ? filterEvents(events, {}).filter((e) => !needle || `${e.action} ${e.entity ?? ""}`.toLowerCase().includes(needle)).slice(0, 100) : null;
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header><h1 className="text-2xl font-semibold text-foreground">Estação administrativa</h1>
        <p className="text-sm text-muted-foreground">Leitura da governança vigente. Nenhuma ação aqui concede acesso ou homologa regra; alterações só nos módulos donos.</p></header>

      <section aria-labelledby="gov-review" className="rounded border border-border p-4">
        <h2 id="gov-review" className="mb-1 font-medium text-foreground">Revisão de governança pendente ({GOVERNANCE_REVIEW_PENDING.code})</h2>
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
        {explanation && <p role="status" className="mt-2 text-sm"><strong>{explanation.allowed ? "Pode" : "Não pode"}</strong> — {explanation.reason}</p>}
      </section>

      <section><h2 className="mb-2 font-medium text-foreground">Quem exerce cada ato</h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !matrix && <SkeletonState label="Carregando" />}
        {policy === null && !error && <p className="text-sm text-muted-foreground">Nenhuma política homologada vigente legível por esta sessão.</p>}
        {matrix && (
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Ato</th><th>Domínio</th><th>Capacidade</th><th>Atuações (política homologada)</th></tr></thead>
            <tbody>{matrix.map((m) => (
              <tr key={m.capability} className="border-t border-border"><td>{m.act}</td><td>{m.domain}</td><td className="font-mono text-xs">{m.capability}</td>
                <td>{m.pending ? <span className="text-muted-foreground">Atribuição pendente — ninguém</span> : m.holders.join("; ")}</td></tr>))}</tbody></table>)}
      </section>

      <section aria-labelledby="timeline"><h2 id="timeline" className="mb-2 font-medium text-foreground">Linha do tempo administrativa</h2>
        <p className="mb-2 text-xs text-muted-foreground">Mesma trilha da Auditoria (contas e políticas), lida com a sua sessão; sem senha, e-mail ou conteúdo.</p>
        <input aria-label="Buscar por entidade" placeholder="Buscar (ex.: politica:, conta:)" className="mb-2 w-full rounded border border-input bg-background p-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        {!timeline ? <SkeletonState label="Carregando" /> : timeline.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ato visível para esta sessão.</p>
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
