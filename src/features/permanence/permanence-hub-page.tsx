/** SIGEM Permanência L23 — painel, central de casos, ficha com linha do tempo, agenda, mapa e relatórios.
 *  Nada é lido antes da sessão; toda leitura passa pela RLS do usuário (escola × capacidade × caso). */
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { buildMap } from "./territorial-map";
import { PERMANENCE_REPORTS, EXPORT_CAP } from "./permanence-reports";
import { caseCentralRows, dashboardCounts, timelineOf, type CaseRow, type TimelineEvent } from "./permanence-hub-model";

const TABS = [["painel", "Painel"], ["casos", "Central de casos"], ["agenda", "Agenda"], ["mapa", "Mapa"], ["relatorios", "Relatórios"]] as const;
type Tab = (typeof TABS)[number][0];

type Load<T> = { rows?: T; err?: string } | null;

function useCases(): Load<CaseRow[]> {
  const [s, setS] = useState<Load<CaseRow[]>>(null);
  useEffect(() => {
    let live = true;
    supabase.from("aa_outreach_cases").select("id, school_id, student_id, opened_at").order("opened_at", { ascending: false }).limit(500)
      .then(({ data, error }) => live && setS(error ? { err: "Casos não disponíveis para a sua conta." } : { rows: (data ?? []).map((r) => ({ id: r.id, schoolId: r.school_id, studentRef: r.student_id, openedAt: r.opened_at })) }));
    return () => { live = false; };
  }, []);
  return s;
}

function CaseDossier({ c, onBack }: { c: CaseRow; onBack: () => void }) {
  const [ev, setEv] = useState<Load<TimelineEvent[]>>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from("aa_outreach_events").select("id, kind, recorded_at").eq("case_id", c.id).limit(500),
      supabase.from("permanence_returns").select("id, returned_on").eq("case_id", c.id).limit(100),
    ]).then(([a, b]) => {
      if (!live) return;
      if (a.error) return setEv({ err: "Histórico não disponível para a sua conta." });
      setEv({ rows: timelineOf(
        (a.data ?? []).map((e) => ({ id: String(e.id), at: String(e.recorded_at), label: String(e.kind) })),
        b.error ? null : (b.data ?? []).map((r) => ({ id: r.id, at: r.returned_on, label: "Retorno à escola registrado" })),
      ) });
    });
    return () => { live = false; };
  }, [c.id]);
  return (
    <section aria-labelledby="ficha-titulo" className="space-y-3">
      <button onClick={onBack} className="rounded-md border px-3 py-1.5 text-sm">Voltar à central</button>
      <h3 id="ficha-titulo" className="font-medium">Ficha do caso aberto em {c.openedAt.slice(0, 10)}</h3>
      <p className="text-xs text-muted-foreground">Abas sensíveis (barreiras, contatos, visitas, encaminhamentos, documentos) só aparecem com a capacidade própria; anexos abrem pelo SIGEM Documentos com finalidade registrada.</p>
      {!ev ? <SkeletonState label="Carregando linha do tempo" /> : ev.err ? <p role="alert" className="text-destructive">{ev.err}</p> : (
        <ol className="space-y-2 border-l pl-4">{(ev.rows ?? []).length === 0 ? <li className="text-sm text-muted-foreground">Nenhum registro.</li> :
          ev.rows!.map((e) => <li key={e.id} className="text-sm"><span className="text-xs text-muted-foreground">{e.at.slice(0, 10)}</span> — {e.label}</li>)}</ol>
      )}
      {ev?.rows && ev.partial && <p className="text-xs text-muted-foreground">Parte do histórico (retornos) não está disponível para a sua conta.</p>}
    </section>
  );
}

export function PermanenceHubPage() {
  const a = useSessionAuthority();
  const [tab, setTab] = useState<Tab>("painel");
  const [open, setOpen] = useState<CaseRow | null>(null);
  if (a.status === "signed-out") return <SignInRequired title="SIGEM Permanência" what="os casos de acompanhamento da sua escola" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  return <Hub caps={new Set(a.status === "signed-in" ? a.capabilities.map((c) => c.capability) : [])} tab={tab} setTab={setTab} open={open} setOpen={setOpen} />;
}

function Hub({ caps, tab, setTab, open, setOpen }: { caps: ReadonlySet<string>; tab: Tab; setTab: (t: Tab) => void; open: CaseRow | null; setOpen: (c: CaseRow | null) => void }) {
  const cases = useCases();
  const counts = cases?.rows ? dashboardCounts(cases.rows) : null;
  const map = buildMap([], [], "escola", null);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SIGEM Permanência" title="Cada estudante na escola" description="Acompanhamento cuidadoso, com o mínimo de informação necessária. Alerta é hipótese para conversar, nunca rótulo." />
      <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">{TABS.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(null); }} className={`min-h-11 rounded-md border px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>

      {tab === "painel" && (!cases ? <SkeletonState label="Carregando painel" /> : cases.err ? <p role="alert" className="text-destructive">{cases.err}</p> : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Casos visíveis para você</dt><dd className="text-2xl font-semibold">{counts!.cases}</dd></div>
          <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Estudantes únicos</dt><dd className="text-2xl font-semibold">{counts!.students}</dd></div>
          <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Escolas</dt><dd className="text-2xl font-semibold">{counts!.schools}</dd></div>
          {counts!.truncated && <p className="sm:col-span-3 text-xs text-muted-foreground">Mostrando os 500 casos mais recentes; o total pode ser maior.</p>}
        </dl>))}

      {tab === "casos" && (open ? <CaseDossier c={open} onBack={() => setOpen(null)} /> : !cases ? <SkeletonState label="Carregando casos" /> : cases.err ? <p role="alert" className="text-destructive">{cases.err}</p> : (
        (cases.rows ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum caso visível para a sua conta.</p> :
          <ul className="grid gap-2 md:grid-cols-2">{caseCentralRows(cases.rows!).map((r) => (
            <li key={r.id}><button onClick={() => setOpen(r.row)} className="w-full rounded-md border p-3 text-left text-sm">
              <span className="font-medium">Caso aberto em {r.opened}</span><span className="block text-xs text-muted-foreground">Escola {r.school}</span></button></li>))}</ul>))}

      {tab === "agenda" && <p className="text-sm text-muted-foreground">A agenda reúne contatos, visitas, ações e retornos com prazo declarado nos próprios registros. Sem prazo declarado, nada é presumido; avisos saem pela central de notificações.</p>}

      {tab === "mapa" && <p role="status" className="text-sm text-muted-foreground">{map.status === "bloqueado" ? "Mapa indisponível: falta o limite mínimo de supressão aprovado. Nunca há ponto de residência." : "Mapa agregado por escola."}</p>}

      {tab === "relatorios" && <>
        {!caps.has(EXPORT_CAP) && <p className="text-xs text-muted-foreground">Sua conta não tem permissão de exportar; os relatórios ficam só para consulta.</p>}
        <ul className="grid gap-2 md:grid-cols-2">{PERMANENCE_REPORTS.map((r) => (
          <li key={r.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{r.title}</p>
            <p className="text-xs text-muted-foreground">{r.methodology} Conta: {r.unit}.</p>
            {r.dependency && <p className="mt-1 text-xs text-destructive">Indisponível: {r.dependency}</p>}</li>))}</ul></>}
    </div>
  );
}
