import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { listSchools, loadSchoolFacts } from "@/features/onboarding/onboarding-source";
import { goDecision, pilotChecklist, type NetworkFacts, type PilotState } from "./pilot-readiness";

const LABEL: Record<PilotState, string> = { concluido: "Concluído", pendente: "Pendente", "nao-aplicavel": "Não aplicável", bloqueado: "Bloqueado" };
const head = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? null : r.count ?? 0; };

async function loadNetwork(familyEnabled: boolean): Promise<NetworkFacts> {
  const c = (t: string) => supabase.from(t as never).select("*", { count: "exact", head: true });
  const [homologatedPolicies, schools, schoolEngagements, importBatches, documentTemplates, guardianAuthorizations] = await Promise.all([
    head(supabase.from("capability_policies").select("id", { count: "exact", head: true }).eq("status", "homologated")),
    head(c("institutional_schools")),
    head(supabase.from("institutional_engagements").select("id", { count: "exact", head: true }).not("school_id", "is", null)),
    head(c("import_batches")), head(c("school_document_templates")), head(c("guardian_authorizations")),
  ]);
  return { homologatedPolicies, schools, schoolEngagements, importBatches, documentTemplates, guardianAuthorizations, familyEnabled };
}

export function PilotReadinessPage() {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [family, setFamily] = useState(false);
  const schools = useQuery({ queryKey: ["pilot-schools", uid], enabled: !!uid, queryFn: listSchools });
  const net = useQuery({ queryKey: ["pilot-net", uid, family], enabled: !!uid, queryFn: () => loadNetwork(family) });
  const school = schools.data?.find((s) => s.id === schoolId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const facts = useQuery({ queryKey: ["pilot-school", uid, schoolId, today], enabled: !!school, queryFn: () => loadSchoolFacts(school!.id, school!.name, today) });

  if (a.status === "signed-out") return <EmptyState title="Entre para ver a prontidão" description="A verificação usa só o que sua conta pode ler." />;
  if (a.status === "loading" || net.isLoading) return <p role="status">Verificando…</p>;
  if (net.isError) return <EmptyState title="Não foi possível verificar" description="Tente novamente em instantes." />;
  const items = pilotChecklist(net.data!, facts.data ?? null);
  const d = goDecision(items);

  return (
    <div className="space-y-6">
      <PageHeader title="Prontidão para piloto" description="Itens derivados dos registros oficiais. Cada item leva à tela onde se corrige. O roteiro completo está no runbook do piloto." />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Escola piloto
          <select className="mt-1 block min-h-9 rounded-md border border-border bg-background px-2" value={schoolId ?? ""} onChange={(e) => setSchoolId(e.target.value || null)}>
            <option value="">Selecione…</option>{schools.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} /> Família habilitada no piloto</label>
        <Button variant="outline" onClick={() => { void net.refetch(); void facts.refetch(); }}>Verificar de novo</Button>
      </div>
      <p role="status" className="rounded-md border border-border p-3 font-medium">
        {d.go ? "Decisão técnica: GO — nenhum item obrigatório em aberto." : `Decisão técnica: NO-GO — ${d.open.length} item(ns) obrigatório(s) em aberto.`}
      </p>
      {facts.isLoading && <p role="status">Conferindo turmas…</p>}
      <ul className="space-y-2">{items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
          <div><p className="font-medium">{i.label}{i.goBlocking ? "" : " (opcional)"}</p><p className="text-sm text-muted-foreground">{i.why}</p></div>
          <div className="flex items-center gap-3"><span className="text-sm font-medium">{LABEL[i.state]}</span>
            <a href={i.fix} className="text-sm text-primary underline">Abrir</a></div>
        </li>))}</ul>
    </div>
  );
}
