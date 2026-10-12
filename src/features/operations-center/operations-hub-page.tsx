/** Centro de Operações L23 — painel integrado, abas por setor, mapa restrito e relatórios.
 *  Nada é lido antes da sessão; a leitura passa pela RLS do usuário; esta tela não grava. */
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { dashboardBySector, operationalMap, type RequestRow } from "./operations-hub-model";
import { OPS_EXPORT_CAP, OPS_REPORTS, type OpsSector } from "./operations-reports";

const TABS = [["painel", "Painel"], ["transporte", "Transporte"], ["infraestrutura", "Infraestrutura"], ["patrimonio", "Patrimônio e Almoxarifado"], ["mapa", "Mapa"], ["relatorios", "Relatórios"]] as const;
type Tab = (typeof TABS)[number][0];
const LIMIT = 500;
const SECTOR_LABEL: Record<string, string> = { transporte: "Transporte", infraestrutura: "Infraestrutura", patrimonio: "Patrimônio e Almoxarifado" };
const SECTOR_NOTE: Record<OpsSector, string> = {
  transporte: "Solicitações e autorizações, rotas aprovadas, pontos avaliados, frota, equipe, viagens e contratos. Veículo indisponível só é usado com validação de outra pessoa.",
  infraestrutura: "Espaços, vistorias, manutenção, ordens de serviço, preventiva e obras. Vistoria não é laudo e capacidade sem fonte fica indeterminada.",
  patrimonio: "Bens permanentes, transferências, inventários e baixas por processo; materiais de consumo com saldo derivado dos movimentos.",
};

function useRequests() {
  const [s, setS] = useState<{ rows?: RequestRow[]; err?: string } | null>(null);
  useEffect(() => {
    let live = true;
    supabase.from("ops_requests").select("id, sector, school_id, created_at").order("created_at", { ascending: false }).limit(LIMIT)
      .then(({ data, error }) => live && setS(error ? { err: "Solicitações não disponíveis para a sua conta." } : { rows: (data ?? []).map((r) => ({ id: r.id, sector: r.sector, schoolId: r.school_id, createdAt: r.created_at })) }));
    return () => { live = false; };
  }, []);
  return s;
}

export function OperationsHubPage() {
  const a = useSessionAuthority();
  const [tab, setTab] = useState<Tab>("painel");
  if (a.status === "signed-out") return <SignInRequired title="Centro de Operações" what="as operações e recursos das escolas" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  return <Hub caps={new Set(a.status === "signed-in" ? a.capabilities.map((c) => c.capabilityId) : [])} tab={tab} setTab={setTab} />;
}

function Hub({ caps, tab, setTab }: { caps: ReadonlySet<string>; tab: Tab; setTab: (t: Tab) => void }) {
  const req = useRequests();
  const dash = req?.rows ? dashboardBySector(req.rows, LIMIT) : null;
  const map = operationalMap([], null);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SIGEM" title="Centro de Operações e Recursos Escolares" description="Transporte, infraestrutura e patrimônio em um só lugar, cada um com sua fonte e sua autoridade." />
      <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">{TABS.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 rounded-md border px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>

      {tab === "painel" && (!req ? <SkeletonState label="Carregando painel" /> : req.err ? <p role="alert" className="text-destructive">{req.err}</p> : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {dash!.sectors.map((s) => (
            <div key={s.sector} className="rounded-md border p-3">
              <dt className="text-xs text-muted-foreground">{SECTOR_LABEL[s.sector]}</dt>
              <dd className="text-2xl font-semibold">{s.requests}</dd>
              <dd className="text-xs text-muted-foreground">solicitações visíveis · {s.schools} escola(s)</dd>
            </div>))}
          {dash!.truncated && <p className="sm:col-span-3 text-xs text-muted-foreground">Mostrando as {LIMIT} solicitações mais recentes; o total pode ser maior.</p>}
        </dl>))}

      {(tab === "transporte" || tab === "infraestrutura" || tab === "patrimonio") && (
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground">{SECTOR_NOTE[tab]}</p>
          <ul className="grid gap-2 md:grid-cols-2">{OPS_REPORTS.filter((r) => r.sector === tab).map((r) => (
            <li key={r.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.methodology}</p></li>))}</ul>
        </section>)}

      {tab === "mapa" && <p role="status" className="text-sm text-muted-foreground">{map.status === "bloqueado" ? "Mapa indisponível: falta o limite mínimo de supressão aprovado. O mapa mostra só escolas, nunca residências, pontos de embarque individuais ou trajetos de estudantes." : "Mapa por escola."}</p>}

      {tab === "relatorios" && <>
        {!caps.has(OPS_EXPORT_CAP) && <p className="text-xs text-muted-foreground">Sua conta não tem permissão de exportar; os relatórios ficam só para consulta.</p>}
        {(["transporte", "infraestrutura", "patrimonio"] as const).map((s) => (
          <section key={s} className="space-y-2"><h2 className="font-medium">{SECTOR_LABEL[s]} ({OPS_REPORTS.filter((r) => r.sector === s).length})</h2>
            <ul className="grid gap-2 md:grid-cols-2">{OPS_REPORTS.filter((r) => r.sector === s).map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">Fonte: {r.source}. {r.methodology} Conta: {r.unit}.</p>
                {r.dependency && <p className="mt-1 text-xs text-destructive">Indisponível: {r.dependency}</p>}</li>))}</ul></section>))}
      </>}
    </div>
  );
}
