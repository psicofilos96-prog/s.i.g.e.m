import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CONFIG_HUB, governanceMatrix } from "./governance-station";
import type { PolicyRule } from "./policy-governance";

/** Somente leitura: regras chegam pela RLS da sessão; recusa/erro ⇒ nada é afirmado. */
export function GovernanceStationPage() {
  const [rules, setRules] = useState<PolicyRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: pol, error: e1 } = await supabase.from("capability_policies").select("id,status").eq("status", "homologada").order("version", { ascending: false }).limit(1);
      if (e1) { setError("Política não legível com esta sessão."); return; }
      if (!pol?.length) { setRules([]); return; }
      const { data, error: e2 } = await supabase.from("capability_policy_rules").select("engagement_kind_id,capability_id,scope_dimensions").eq("policy_id", pol[0]!.id);
      if (e2) setError("Regras não legíveis com esta sessão."); else setRules((data ?? []) as PolicyRule[]);
    })();
  }, []);
  const matrix = rules ? governanceMatrix(rules) : null;
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header><h1 className="text-2xl font-semibold text-foreground">Estação administrativa</h1>
        <p className="text-sm text-muted-foreground">Leitura da governança vigente. Nenhuma ação aqui concede acesso ou homologa regra; alterações só nos módulos donos.</p></header>
      <section><h2 className="mb-2 font-medium text-foreground">Quem exerce cada ato</h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !matrix && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {matrix && (
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Ato</th><th>Domínio</th><th>Capacidade</th><th>Atuações (política homologada)</th></tr></thead>
            <tbody>{matrix.map((m) => (
              <tr key={m.capability} className="border-t border-border"><td>{m.act}</td><td>{m.domain}</td><td className="font-mono text-xs">{m.capability}</td>
                <td>{m.pending ? <span className="text-muted-foreground">Atribuição pendente — ninguém</span> : m.holders.join("; ")}</td></tr>))}</tbody></table>)}
      </section>
      <section><h2 className="mb-2 font-medium text-foreground">Configuração por módulo</h2>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">{CONFIG_HUB.map((c) => (
          <li key={c.to}><Link to={c.to} className="block rounded border border-border p-3 text-sm text-foreground hover:bg-muted">{c.label}</Link></li>))}</ul>
      </section>
    </main>
  );
}
