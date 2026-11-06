import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { presentError } from "@/lib/observability/governed-errors";
import { filterNetworkPending, type NetworkPendingAction, type PendingView } from "./model";
import { exportNetworkPending } from "./report";

const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const PAGE_SIZE = 25;

/** Consulta e exportação; nenhuma ação de cobrança ou alteração de dados. */
export function InstitutionalPendingPanel({ rows, loading, error, today, selectedSchoolId, cancelExportRef, onOpenAction }: {
  rows: readonly NetworkPendingAction[]; loading: boolean; error: unknown;
  today: string; selectedSchoolId?: string;
  // Parent actions (especially "Atualizar") must abort before the next React render.
  cancelExportRef?: { current: (() => void) | null };
  onOpenAction: (schoolId: string, actionId: string) => void;
}) {
  const [view, setView] = useState<PendingView>("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const activeExport = useRef<AbortController | null>(null);
  const cancelStaleExport = useCallback(() => {
    if (!activeExport.current) return;
    activeExport.current.abort();
    activeExport.current = null;
    setExporting(false);
    setExportError("");
    setExportNotice("O quadro, a escola ou o filtro mudou durante a geração. O download anterior foi cancelado; confira os dados e exporte novamente.");
  }, []);
  useEffect(() => () => {
    activeExport.current?.abort();
    activeExport.current = null;
  }, []);
  useEffect(() => {
    if (!cancelExportRef) return;
    cancelExportRef.current = cancelStaleExport;
    return () => {
      if (cancelExportRef.current === cancelStaleExport) cancelExportRef.current = null;
    };
  }, [cancelExportRef, cancelStaleExport]);
  // A refreshed set of authorized measures (or a different school/scope)
  // invalidates any report still converting asynchronously.
  useEffect(() => {
    cancelStaleExport();
  }, [rows, loading, error, today, selectedSchoolId, cancelStaleExport]);
  const filtered = filterNetworkPending(rows, view, search, today);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const active = Math.min(page, pages - 1);
  const visible = filtered.slice(active * PAGE_SIZE, (active + 1) * PAGE_SIZE);
  const overdue = rows.filter((r) => r.due_on && r.due_on < today).length;
  const noUpdate = rows.filter((r) => r.situation === "sem atualização").length;
  const noDeadline = rows.filter((r) => !r.due_on).length;
  async function exportRows(format: "csv" | "xlsx" | "pdf") {
    // A ref (rather than only React state) rejects two clicks in one tick.
    if (activeExport.current || loading || error) return;
    const controller = new AbortController();
    activeExport.current = controller;
    setExportError(""); setExportNotice(""); setExporting(true);
    try {
      await exportNetworkPending(filtered, format, controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setExportError(presentError(e));
    } finally {
      // A canceled conversion may resolve after a newer report starts.
      if (activeExport.current === controller) {
        activeExport.current = null;
        setExporting(false);
      }
    }
  }
  return <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Quadro de providências da rede">
    <div>
      <h2 className="text-lg font-semibold">Quadro de providências da rede</h2>
      <p className="text-sm text-muted-foreground">
        Medidas ainda não declaradas concluídas, exclusivamente das unidades autorizadas.
        Este quadro não envia cobranças nem homologa execuções.
      </p>
    </div>
    {loading && <p role="status" className="text-sm">Consultando providências autorizadas…</p>}
    {Boolean(error) && <p role="alert" className="text-sm text-destructive">
      {presentError(error)}
    </p>}
    {!loading && !error && <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Medidas não concluídas", rows.length],
          ["Com prazo vencido", overdue],
          ["Sem atualização", noUpdate],
          ["Sem prazo declarado", noDeadline],
        ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>)}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm">Pesquisar medida, escola, INEP ou responsável
          <input className={field} type="search" value={search} placeholder="Pesquisar entre medidas autorizadas"
            onChange={(e) => { cancelStaleExport(); setSearch(e.target.value); setPage(0); }} />
        </label>
        <label className="text-sm">Situação
          <select className={field} value={view} onChange={(e) => {
            cancelStaleExport(); setView(e.target.value as PendingView); setPage(0);
          }}>
            <option value="todas">Todas as não concluídas</option>
            <option value="vencidas">Prazo vencido</option>
            <option value="sem prazo">Sem prazo declarado</option>
            <option value="sem atualização">Sem atualização</option>
            <option value="prevista">Prevista</option>
            <option value="em andamento">Em andamento</option>
            <option value="não realizada">Não realizada (declarada)</option>
            <option value="suspensa">Suspensa</option>
          </select>
        </label>
        <div className="flex gap-2" aria-label="Exportar quadro filtrado">
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportRows("pdf")}>PDF</Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportRows("xlsx")}>Excel</Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportRows("csv")}>CSV</Button>
        </div>
      </div>
      {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
      {exportNotice && <p role="status" className="text-sm text-muted-foreground">{exportNotice}</p>}
      <p className="text-xs text-muted-foreground">
        {filtered.length} medidas no filtro. Ordenação por prazo declarado; sem prazo por último.
        Sem atualização não significa não realizada.
      </p>
      {filtered.length === 0 ? <p className="text-sm text-muted-foreground">
        Nenhuma providência corresponde à seleção atual.
      </p> : <>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] text-left text-sm">
            <caption className="sr-only">Providências ainda não declaradas concluídas</caption>
            <thead className="bg-muted/30"><tr>
              <th scope="col" className="p-2">Unidade</th>
              <th scope="col" className="p-2">Medida e responsável</th>
              <th scope="col" className="p-2">Prazo</th>
              <th scope="col" className="p-2">Situação</th>
              <th scope="col" className="p-2">Consulta</th>
            </tr></thead>
            <tbody>{visible.map((r) => <tr key={r.action_id} className="border-t align-top">
              <td className="p-2"><strong>{r.school_name}</strong>
                {r.inep && <p className="text-xs text-muted-foreground">INEP {r.inep}</p>}
              </td>
              <td className="p-2">{r.description}
                <p className="text-xs text-muted-foreground">Responsável: {r.responsible_label || "Não informado"}</p>
              </td>
              <td className="p-2">{formatAcademicDate(r.due_on, "Não informado")}
                {r.due_on && r.due_on < today && <p className="font-medium text-destructive">Prazo vencido</p>}
              </td>
              <td className="p-2">{r.situation}
                <p className="text-xs text-muted-foreground">
                  Última evolução: {formatAcademicDate(r.last_update_on, "Sem registro")}
                </p>
              </td>
              <td className="p-2"><Button type="button" size="sm" variant="outline"
                onClick={() => { cancelStaleExport(); onOpenAction(r.school_id, r.action_id); }}>Ver medida</Button>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        {pages > 1 && <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Página {active + 1} de {pages}</span>
          <Button type="button" size="sm" variant="outline" disabled={active === 0}
            onClick={() => setPage((v) => Math.max(0, v - 1))}>Anterior</Button>
          <Button type="button" size="sm" variant="outline" disabled={active >= pages - 1}
            onClick={() => setPage((v) => Math.min(pages - 1, v + 1))}>Próxima</Button>
        </div>}
      </>}
    </>}
  </section>;
}
