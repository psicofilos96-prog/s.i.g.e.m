import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { presentError } from "@/lib/observability/governed-errors";
import { exportFollowupPreparation } from "./preparation-report";
import {
  currentSituation, currentUpdate, filterSchoolActions, isOverdue, NO_UPDATE, type SchoolSnapshot,
} from "./model";

const INITIAL_SHOWN = 5;
type PreparationFilter = "todas" | "prazo vencido" | "sem prazo" | typeof NO_UPDATE;

/** Preparação da visita: somente dados da ficha escolar já autorizada no PostgreSQL. */
export function SchoolOpenActionsPanel({ snapshot, schoolId, schoolName, inep, today, onInspect, onStartUpdate }: {
  snapshot: SchoolSnapshot; schoolId: string; schoolName: string; inep: string | null;
  today: string; onInspect: (actionId: string) => void;
  /** O Gabinete não recebe esse callback: nenhuma operação de escrita é oferecida. */
  onStartUpdate?: ((actionId: string) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<PreparationFilter>("todas");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exportScope, setExportScope] = useState<"all" | "selected">("all");
  const ordered = filterSchoolActions(snapshot.actions, snapshot.updates, "todas", "", today);
  const pending = ordered.filter((a) =>
    currentSituation(a, snapshot.updates) !== "concluída");
  const overdue = pending.filter((a) => isOverdue(a, snapshot.updates, today)).length;
  const withoutUpdate = pending.filter((a) =>
    currentSituation(a, snapshot.updates) === NO_UPDATE).length;
  // Filtros locais sobre a ficha já autorizada. A exportação permanece integral.
  const filtered = filterSchoolActions(pending, snapshot.updates, view, search, today);
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_SHOWN);
  const pendingIds = new Set(pending.map((a) => a.id));
  const selectedPendingIds = [...selectedIds].filter((id) => pendingIds.has(id));
  const staleSelectedCount = selectedIds.size - selectedPendingIds.length;
  const selectedExportReady = selectedPendingIds.length > 0 && staleSelectedCount === 0;
  function toggleSelection(actionId: string, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(actionId);
      else next.delete(actionId);
      return next;
    });
    if (checked) setExportScope("selected");
  }
  async function exportPreparation(format: "csv" | "xlsx" | "pdf") {
    if (exporting || pending.length === 0 ||
        (exportScope === "selected" && !selectedExportReady)) return;
    setExportError(""); setExporting(true);
    try {
      await exportFollowupPreparation(snapshot, schoolId, schoolName, inep, today, format,
        exportScope === "selected" ? selectedPendingIds : undefined);
    } catch (error) {
      setExportError(presentError(error));
    } finally {
      setExporting(false);
    }
  }

  return <section className="space-y-3 rounded-xl border border-border p-4"
    aria-label="Providências da unidade para preparação da visita">
    <div>
      <h3 className="font-semibold">Antes da próxima visita — providências sem conclusão declarada</h3>
      <p className="text-sm text-muted-foreground">
        Consulte as medidas que merecem acompanhamento antes de registrar uma nova visita.
        A situação é declarada pela equipe e não representa cobrança ou homologação.
      </p>
    </div>
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="rounded-md bg-muted/40 p-2">{pending.length} sem conclusão declarada</span>
      <span className="rounded-md bg-muted/40 p-2">{overdue} com prazo vencido</span>
      <span className="rounded-md bg-muted/40 p-2">{withoutUpdate} sem atualização</span>
    </div>
    {pending.length > 0 && <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Filtrar providências da visita
          <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={view} onChange={(e) => { setView(e.target.value as PreparationFilter); setExpanded(false); }}>
            <option value="todas">Todas sem conclusão declarada</option>
            <option value="prazo vencido">Com prazo vencido</option>
            <option value={NO_UPDATE}>Sem atualização registrada</option>
            <option value="sem prazo">Sem prazo declarado</option>
          </select>
        </label>
        <label className="text-sm">Pesquisar descrição ou responsável
          <input type="search" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Descrição, responsável ou data" value={search}
            onChange={(e) => { setSearch(e.target.value); setExpanded(false); }} />
        </label>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {filtered.length} de {pending.length} medidas sem conclusão declarada correspondem aos filtros.
        Os totais acima não mudam com a seleção.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={filtered.length === 0}
          onClick={() => {
            setSelectedIds((old) => new Set([...old, ...filtered.map((a) => a.id)]));
            setExportScope("selected");
          }}>Selecionar todas do filtro ({filtered.length})</Button>
        <Button type="button" size="sm" variant="outline" disabled={selectedIds.size === 0}
          onClick={() => { setSelectedIds(new Set()); setExportScope("all"); }}>Limpar seleção</Button>
        <span role="status" className="text-xs text-muted-foreground">
          {selectedPendingIds.length} medidas selecionadas para roteiro de foco.
        </span>
      </div>
      {staleSelectedCount > 0 && <p role="alert" className="text-sm text-destructive">
        {staleSelectedCount} medida(s) selecionada(s) não constam mais entre as pendentes.
        Limpe a seleção antes de exportar somente as selecionadas.
      </p>}
      <div className="flex flex-wrap items-end gap-2" aria-label="Exportar roteiro de preparação da visita">
        <label className="text-sm">Conteúdo do roteiro
          <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={exportScope} onChange={(e) => setExportScope(e.target.value as "all" | "selected")}>
            <option value="all">Todas as medidas sem conclusão declarada</option>
            <option value="selected">Somente as medidas selecionadas ({selectedPendingIds.length})</option>
          </select>
        </label>
        <Button size="sm" variant="outline"
          disabled={exporting || (exportScope === "selected" && !selectedExportReady)}
          onClick={() => void exportPreparation("pdf")}>Roteiro PDF</Button>
        <Button size="sm" variant="outline"
          disabled={exporting || (exportScope === "selected" && !selectedExportReady)}
          onClick={() => void exportPreparation("xlsx")}>Excel</Button>
        <Button size="sm" variant="outline"
          disabled={exporting || (exportScope === "selected" && !selectedExportReady)}
          onClick={() => void exportPreparation("csv")}>CSV</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O roteiro integral inclui todas as medidas sem conclusão declarada, mesmo fora dos filtros ou da prévia.
        O roteiro selecionado inclui apenas as medidas marcadas, inclusive em outro filtro, e a última evolução informada.
        A seleção é temporária e não cria visita, nova medida ou ordem de cobrança.
      </p>
      {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
    </div>}
    {snapshot.actions.length === 0 && <p className="text-sm text-muted-foreground">
      Nenhuma medida cadastrada para esta unidade.
    </p>}
    {snapshot.actions.length > 0 && pending.length === 0 &&
      <p className="text-sm text-muted-foreground">
        Todas as medidas cadastradas constam como concluídas pela equipe. A conclusão não foi homologada pelo Gabinete.
      </p>}
    {pending.length > 0 && filtered.length === 0 && <p className="text-sm text-muted-foreground">
      Nenhuma providência corresponde aos filtros desta visita. Ajuste a pesquisa ou a situação; os registros não foram excluídos.
    </p>}
    {filtered.length > 0 && <ul className="space-y-2">
      {visible.map((a) => {
        const situation = currentSituation(a, snapshot.updates);
        const last = currentUpdate(a, snapshot.updates);
        const expired = isOverdue(a, snapshot.updates, today);
        return <li key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex shrink-0 items-center gap-2 text-xs">
            <input type="checkbox" checked={selectedIds.has(a.id)}
              aria-label={`Incluir no roteiro selecionado: ${a.description}`}
              onChange={(e) => toggleSelection(a.id, e.target.checked)} />
            Incluir no roteiro
          </label>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium break-words">{a.description}</p>
            <p className="text-xs text-muted-foreground">
              Responsável: {a.responsible_label || "Não informado"} · Prazo: {formatAcademicDate(a.due_on, "Não informado")}
            </p>
            <p className="text-xs text-muted-foreground">
              Situação: {situation}{expired ? " · Prazo vencido" : ""}
            </p>
            {last ? <details className="rounded-md border border-border/70 p-2 text-sm">
              <summary className="cursor-pointer font-medium">
                Última evolução declarada: {formatAcademicDate(last.occurred_on)} — {last.situation}
              </summary>
              <div className="mt-2 space-y-1 text-sm">
                <p><strong>Registrada por:</strong> {last.author_name || "Autoria institucional registrada"}</p>
                <p><strong>O que foi feito:</strong> {last.done_text || "Não informado"}</p>
                <p><strong>O que não foi feito:</strong> {last.not_done_text || "Não informado"}</p>
                <p><strong>Resultados:</strong> {last.results || "Não informado"}</p>
                <p><strong>Encaminhamentos:</strong> {last.referrals || "Não informado"}</p>
                <p className="text-xs text-muted-foreground">
                  Consulte o histórico completo para ver as evoluções anteriores e visitas vinculadas.
                </p>
              </div>
            </details> : <p className="text-xs text-muted-foreground">Sem evolução registrada para esta medida.</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline"
              aria-label={`Ver acompanhamento da medida: ${a.description}`}
              onClick={() => onInspect(a.id)}>Ver acompanhamento</Button>
            {onStartUpdate && <Button size="sm" variant="outline"
              aria-label={`Registrar evolução da medida: ${a.description}`}
              onClick={() => onStartUpdate(a.id)}>Registrar evolução</Button>}
          </div>
        </li>;
      })}
    </ul>}
    {filtered.length > INITIAL_SHOWN && <Button size="sm" variant="outline"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}>
      {expanded ? "Mostrar menos medidas" : `Mostrar todas as ${filtered.length} medidas`}
    </Button>}
    <p className="text-xs text-muted-foreground">
      A lista visível segue os filtros e é ordenada pelo prazo declarado; medidas sem prazo vêm por último.
      Sem atualização não significa não realizada. O resumo mostra somente a última evolução declarada;
      as anteriores permanecem no histórico. Ver acompanhamento abre o histórico sem alterar registros.
      Registrar evolução apenas abre o formulário para servidores autorizados; nada é gravado automaticamente.
      A seleção para o roteiro de foco permanece apenas nesta tela e não altera as medidas.
    </p>
  </section>;
}
