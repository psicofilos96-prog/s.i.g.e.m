import { SkeletonState } from "@/components/sigem/guidance";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { useSessionAuthority, sessionActor } from "@/features/authority/session-authority";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { AUDIT_REPORT } from "./audit-report";
import { Link } from "@tanstack/react-router";
import { NATURE_LABEL, actionLabel, filterTimeline, groupByDay, minimizedDetail, originalFactLink, type ActorDirectory, type ActorInfo, type ActorNature } from "./audit-timeline";
import { stationLabel } from "@/features/institutional-admin/access-inventory";
import {
  ADAPTERS, RETENTION_UNDECIDED, auditRows, canExport, correlated, isRetroactive, page, provenanceFindings, retentionLabel,
  type AuditEvent, type AuditKind,
} from "./audit-model";

const PAGE = 25;

/** Teto por fonte; fonte que atinge o teto é declarada incompleta na tela e na exportação. */
export const AUDIT_SOURCE_LIMIT = 500;
export async function loadAll(): Promise<AuditEvent[]> { return (await loadAuditTrail()).events; }
export async function loadAuditTrail(): Promise<{ events: AuditEvent[]; truncatedModules: string[] }> {
  const out: AuditEvent[] = []; const truncatedModules: string[] = [];
  // RLS de quem consulta decide o que volta; fonte recusada = nada visível (igual a vazio, contra enumeração).
  await Promise.all(ADAPTERS.map(async (a) => {
    const { data, error } = await supabase.from(a.table as never).select(a.select).order(a.atColumn, { ascending: false }).limit(AUDIT_SOURCE_LIMIT);
    if (!error && Array.isArray(data)) {
      if (data.length >= AUDIT_SOURCE_LIMIT) truncatedModules.push(a.module);
      for (const r of data as Record<string, unknown>[]) out.push(a.map(r));
    }
  }));
  return { events: out, truncatedModules: [...new Set(truncatedModules)] };
}

/** Diretório de atores: só o Administrador Geral (titular da Central de Acessos) o recebe; demais veem "não visível". */
async function loadActorDirectory(): Promise<{ dir: ActorDirectory; schools: { id: string; name: string }[] }> {
  const empty = { dir: new Map<string, ActorInfo>(), schools: [] };
  const h = await supabase.rpc("access_center_holder" as never);
  if (h.error || h.data !== true) return empty;
  const inv = await supabase.rpc("access_center_inventory");
  if (inv.error || !Array.isArray(inv.data)) return empty;
  const dir = new Map<string, ActorInfo>(); const schools = new Map<string, string>();
  for (const r of inv.data as { user_id: string; account_kind: string; station_code: string | null; school_id: string | null; school_name: string | null }[]) {
    dir.set(r.user_id, { kind: r.account_kind, station: r.station_code, schoolId: r.school_id });
    if (r.school_id) schools.set(r.school_id, r.school_name ?? r.school_id);
  }
  return { dir, schools: [...schools].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}

export function AuditPage() {
  const authority = useSessionAuthority();
  const actor = sessionActor(authority);
  const q = useQuery({ queryKey: ["audit-central", authority.status === "signed-in" ? authority.user.id : null], enabled: authority.status === "signed-in", queryFn: loadAuditTrail });
  const d = useQuery({ queryKey: ["audit-actors", authority.status === "signed-in" ? authority.user.id : null], enabled: authority.status === "signed-in", queryFn: loadActorDirectory });
  const dir: ActorDirectory = d.data?.dir ?? new Map();
  const [f, setF] = useState({ from: "", to: "", module: "", kind: "", actor: "", entity: "", knownAt: "", station: "", schoolId: "", nature: "", search: "" });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [sel, setSel] = useState<AuditEvent | null>(null);

  const all = q.data?.events ?? [];
  const truncatedModules = q.data?.truncatedModules ?? [];
  const filtered = useMemo(() => filterTimeline(all, {
    from: f.from || null, to: f.to || null, module: f.module || null, kind: (f.kind || null) as AuditKind | null,
    actor: f.actor.trim() || null, entity: f.entity.trim() || null, knownAt: f.knownAt ? new Date(f.knownAt).toISOString() : null,
    station: f.station || null, schoolId: f.schoolId || null, nature: (f.nature || null) as ActorNature | null, search: f.search || null,
  }, dir), [all, f, dir]);
  const stations = [...new Set([...dir.values()].map((a) => a.station).filter((x): x is string => !!x))].sort();
  const pg = page(filtered, PAGE, cursors[cursors.length - 1]);
  const modules = [...new Set(ADAPTERS.map((a) => a.module))];
  const set = (k: keyof typeof f) => (v: string) => { setF({ ...f, [k]: v }); setCursors([null]); setSel(null); };

  if (authority.status === "signed-out") return <EmptyState title="Entre para consultar a auditoria" description="A trilha só existe com login e mostra apenas o que suas permissões alcançam." />;
  if (q.isLoading || authority.status === "loading") return <SkeletonState label="Carregando trilha" />;
  if (q.isError) return <EmptyState title="Não foi possível ler a trilha" description="Tente novamente em instantes." />;

  const exportable = canExport(actor?.capabilities ?? []);
  function exportCsv() {
    const r = runReport(AUDIT_REPORT, { params: {} }, auditRows(filtered));
    const blob = new Blob([toCsv(r, { headerLines: ["SIGEM"], title: "Trilha de auditoria" }, [`Eventos: ${filtered.length}`, ...(truncatedModules.length ? [`INCOMPLETO: só os ${AUDIT_SOURCE_LIMIT} eventos mais recentes de ${truncatedModules.join(", ")}.`] : [])])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "auditoria.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  const noProv = provenanceFindings(filtered);

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoria e governança de dados" description="Visão única dos registros históricos que sua conta pode ver. Senhas, chaves, conteúdo de documentos e dados clínicos nunca aparecem." />
      <section aria-label="Filtros" className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">De<DateInput value={f.from} onChange={(e) => set("from")(e.target.value)} /></label>
        <label className="text-sm">Até<DateInput value={f.to} onChange={(e) => set("to")(e.target.value)} /></label>
        <label className="text-sm">Área<select className="w-full rounded border border-border bg-background p-2" value={f.module} onChange={(e) => set("module")(e.target.value)}><option value="">Todas</option>{modules.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm">Tipo<select className="w-full rounded border border-border bg-background p-2" value={f.kind} onChange={(e) => set("kind")(e.target.value)}><option value="">Todos</option><option value="seguranca">Segurança</option><option value="funcional">Funcional</option></select></label>
        <label className="text-sm md:col-span-2">Buscar<Input type="search" placeholder="Ação, área, registro ou motivo" value={f.search} onChange={(e) => set("search")(e.target.value)} /></label>
        <label className="text-sm">Quem age<select className="w-full min-w-0 rounded border border-border bg-background p-2" value={f.nature} onChange={(e) => set("nature")(e.target.value)}><option value="">Todos</option>{(Object.keys(NATURE_LABEL) as ActorNature[]).map((k) => <option key={k} value={k}>{NATURE_LABEL[k]}</option>)}</select></label>
        <label className="text-sm">Setor<select disabled={!stations.length} className="w-full min-w-0 rounded border border-border bg-background p-2" value={f.station} onChange={(e) => set("station")(e.target.value)}><option value="">{stations.length ? "Todos" : "Não disponível para sua conta"}</option>{stations.map((st) => <option key={st} value={st}>{stationLabel(st)}</option>)}</select></label>
        <label className="text-sm">Escola<select disabled={!d.data?.schools.length} className="w-full min-w-0 rounded border border-border bg-background p-2" value={f.schoolId} onChange={(e) => set("schoolId")(e.target.value)}><option value="">{d.data?.schools.length ? "Todas" : "Não disponível para sua conta"}</option>{d.data?.schools.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}</select></label>
        <label className="text-sm">Ator (identificador)<Input value={f.actor} onChange={(e) => set("actor")(e.target.value)} /></label>
        <label className="text-sm">Registro (referência exata)<Input value={f.entity} onChange={(e) => set("entity")(e.target.value)} /></label>
        <label className="text-sm">Conhecido até<Input type="datetime-local" value={f.knownAt} onChange={(e) => set("knownAt")(e.target.value)} /></label>
        <div className="flex items-end gap-2"><Button variant="ghost" onClick={() => { setF({ from: "", to: "", module: "", kind: "", actor: "", entity: "", knownAt: "", station: "", schoolId: "", nature: "", search: "" }); setCursors([null]); setSel(null); }}>Limpar filtros</Button>{exportable
          ? <Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>
          : <p className="text-xs text-muted-foreground">Exportar exige a permissão específica de exportação de auditoria.</p>}</div>
      </section>

      {truncatedModules.length > 0 && (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">Lista incompleta: mostrando só os {AUDIT_SOURCE_LIMIT} eventos mais recentes de {truncatedModules.join(", ")}. A exportação traz o mesmo aviso.</p>
      )}
      <section aria-label="Eventos" className="min-w-0 max-w-full space-y-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">{filtered.length} evento(s) · página {cursors.length} de {Math.max(1, Math.ceil(filtered.length / PAGE))}</p>
        {pg.items.length === 0 ? <EmptyState title="Nenhum evento visível" description="Não há eventos que sua conta possa ver com esses filtros." /> : (
          <ol aria-label="Linha do tempo" className="space-y-4">{groupByDay(pg.items).map((g) => (
            <li key={g.day}><h3 className="text-sm font-semibold">{new Date(`${g.day}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</h3>
              <ul className="mt-1 space-y-1">{g.events.map((e) => (
                <li key={e.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                  <span className="rounded border border-border px-1 text-xs">{e.kind === "seguranca" ? "Segurança" : "Funcional"}</span>
                  <span className="min-w-0 flex-1 break-words">{actionLabel(e.action)}{isRetroactive(e) ? " · retroativo" : ""} <span className="text-muted-foreground">· {e.module}</span></span>
                  <Button size="sm" variant="ghost" aria-label={`Detalhes de ${actionLabel(e.action)}`} onClick={() => setSel(e)}>Detalhes</Button>
                </li>))}</ul></li>))}</ol>)}
        <div className="flex gap-2">
          <Button variant="outline" disabled={cursors.length < 2} onClick={() => setCursors(cursors.slice(0, -1))}>Página anterior</Button>
          <Button variant="outline" disabled={!pg.next} onClick={() => setCursors([...cursors, pg.next])}>Próxima página</Button>
        </div>
      </section>

      {sel && (
        <section aria-label="Detalhe do evento" className="rounded-md border border-border p-4 space-y-1 text-sm">
          <h2 className="font-semibold">{actionLabel(sel.action)}</h2>
          <dl className="grid gap-1 sm:grid-cols-[12rem_1fr]">{minimizedDetail(sel, dir).map((r) => <div key={r.label} className="contents"><dt className="text-muted-foreground">{r.label}</dt><dd className="break-words">{r.label === "Setor do ator" ? stationLabel(r.value) : r.value}</dd></div>)}</dl>
          {originalFactLink(sel) ? <p><Link to={originalFactLink(sel)!} className="underline">Abrir a tela de origem</Link> <span className="text-muted-foreground">(a tela aplica as suas próprias permissões)</span></p> : <p className="text-muted-foreground">Sem link para o fato original: a tela de origem não é segura para abrir daqui.</p>}
          <p>Relacionados: {correlated(all, sel).length ? correlated(all, sel).map((c) => c.action).join(", ") : "nenhum visível"}</p>
        </section>
      )}

      <section aria-label="Governança" className="grid gap-3 md:grid-cols-2 text-sm">
        <div className="rounded-md border border-border p-3"><h2 className="font-semibold">Sem proveniência</h2><p>{noProv.length} evento(s) visível(is) sem ator nem origem.</p></div>
        <div className="rounded-md border border-border p-3"><h2 className="font-semibold">Retenção</h2>
          <p>Segurança: {retentionLabel(RETENTION_UNDECIDED, "seguranca")}</p><p>Funcional: {retentionLabel(RETENTION_UNDECIDED, "funcional")}</p></div>
      </section>
    </div>
  );
}
