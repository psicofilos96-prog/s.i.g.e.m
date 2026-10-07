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
import {
  ADAPTERS, RETENTION_UNDECIDED, auditRows, canExport, correlated, filterEvents, isRetroactive, page, provenanceFindings, retentionLabel,
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

export function AuditPage() {
  const authority = useSessionAuthority();
  const actor = sessionActor(authority);
  const q = useQuery({ queryKey: ["audit-central", authority.status === "signed-in" ? authority.user.id : null], enabled: authority.status === "signed-in", queryFn: loadAuditTrail });
  const [f, setF] = useState({ from: "", to: "", module: "", kind: "", actor: "", entity: "", knownAt: "" });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [sel, setSel] = useState<AuditEvent | null>(null);

  const all = q.data?.events ?? [];
  const truncatedModules = q.data?.truncatedModules ?? [];
  const filtered = useMemo(() => filterEvents(all, {
    from: f.from || null, to: f.to || null, module: f.module || null, kind: (f.kind || null) as AuditKind | null,
    actor: f.actor.trim() || null, entity: f.entity.trim() || null, knownAt: f.knownAt ? new Date(f.knownAt).toISOString() : null,
  }), [all, f]);
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
        <label className="text-sm">Ator (identificador)<Input value={f.actor} onChange={(e) => set("actor")(e.target.value)} /></label>
        <label className="text-sm">Registro (referência exata)<Input value={f.entity} onChange={(e) => set("entity")(e.target.value)} /></label>
        <label className="text-sm">Conhecido até<Input type="datetime-local" value={f.knownAt} onChange={(e) => set("knownAt")(e.target.value)} /></label>
        <div className="flex items-end">{exportable
          ? <Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>
          : <p className="text-xs text-muted-foreground">Exportar exige a permissão específica de exportação de auditoria.</p>}</div>
      </section>

      {truncatedModules.length > 0 && (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">Lista incompleta: mostrando só os {AUDIT_SOURCE_LIMIT} eventos mais recentes de {truncatedModules.join(", ")}. A exportação traz o mesmo aviso.</p>
      )}
      <section aria-label="Eventos" className="min-w-0 max-w-full space-y-2">
        {pg.items.length === 0 ? <EmptyState title="Nenhum evento visível" description="Não há eventos que sua conta possa ver com esses filtros." /> : (
          <div className="relative max-w-full overflow-x-auto" role="region" aria-label="Tabela de eventos" tabIndex={0}><table className="w-full text-sm [&_td]:break-words">
            <thead><tr className="text-left"><th>Quando</th><th>Tipo</th><th>Área</th><th>Ação</th><th>Registro</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{pg.items.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td>{new Date(e.at).toLocaleString("pt-BR")}</td><td>{e.kind === "seguranca" ? "Segurança" : "Funcional"}</td><td>{e.module}</td>
                <td>{e.action}{isRetroactive(e) ? " · retroativo" : ""}</td><td className="font-mono text-xs break-all">{e.entity ?? "—"}{e.entityVersion ? ` v${e.entityVersion}` : ""}</td>
                <td><Button size="sm" variant="ghost" onClick={() => setSel(e)}>Detalhes</Button></td>
              </tr>))}</tbody>
          </table></div>)}
        <div className="flex gap-2">
          <Button variant="outline" disabled={cursors.length < 2} onClick={() => setCursors(cursors.slice(0, -1))}>Anterior</Button>
          <Button variant="outline" disabled={!pg.next} onClick={() => setCursors([...cursors, pg.next])}>Próxima</Button>
        </div>
      </section>

      {sel && (
        <section aria-label="Detalhe do evento" className="rounded-md border border-border p-4 space-y-1 text-sm">
          <h2 className="font-semibold">{sel.action}</h2>
          <p>Ator: <span className="font-mono">{sel.actorUserId ?? sel.actorPersonId ?? "não declarado"}</span>{sel.engagementId ? ` · atuação ${sel.engagementId}` : ""}</p>
          <p>Efeito em: {sel.effectiveOn ?? "—"} · Origem: {sel.origin ?? "—"} · Motivo: {sel.reason ?? "—"}</p>
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
