import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { presentError } from "@/lib/observability/governed-errors";
import { exportFollowupPreparation } from "./preparation-report";
import {
  currentSituation, filterSchoolActions, isOverdue, NO_UPDATE, type SchoolSnapshot,
} from "./model";

const INITIAL_SHOWN = 5;

/** Preparação da visita: somente dados da ficha escolar já autorizada no PostgreSQL. */
export function SchoolOpenActionsPanel({ snapshot, schoolId, schoolName, inep, today, onInspect, onStartUpdate }: {
  snapshot: SchoolSnapshot; schoolId: string; schoolName: string; inep: string | null;
  today: string; onInspect: (actionId: string) => void;
  /** O Gabinete não recebe esse callback: nenhuma operação de escrita é oferecida. */
  onStartUpdate?: ((actionId: string) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const ordered = filterSchoolActions(snapshot.actions, snapshot.updates, "todas", "", today);
  const pending = ordered.filter((a) =>
    currentSituation(a, snapshot.updates) !== "concluída");
  const overdue = pending.filter((a) => isOverdue(a, snapshot.updates, today)).length;
  const withoutUpdate = pending.filter((a) =>
    currentSituation(a, snapshot.updates) === NO_UPDATE).length;
  const visible = expanded ? pending : pending.slice(0, INITIAL_SHOWN);
  async function exportPreparation(format: "csv" | "xlsx" | "pdf") {
    if (exporting || pending.length === 0) return;
    setExportError(""); setExporting(true);
    try {
      await exportFollowupPreparation(snapshot, schoolId, schoolName, inep, today, format);
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
    {pending.length > 0 && <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" aria-label="Exportar roteiro de preparação da visita">
        <span className="text-sm text-muted-foreground">Levar à visita:</span>
        <Button size="sm" variant="outline" disabled={exporting}
          onClick={() => void exportPreparation("pdf")}>Roteiro PDF</Button>
        <Button size="sm" variant="outline" disabled={exporting}
          onClick={() => void exportPreparation("xlsx")}>Excel</Button>
        <Button size="sm" variant="outline" disabled={exporting}
          onClick={() => void exportPreparation("csv")}>CSV</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O roteiro inclui todas as medidas sem conclusão declarada da unidade, mesmo as que não aparecem nesta prévia,
        e a última evolução informada. É uma consulta, não uma nova visita ou ordem de cobrança.
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
    {pending.length > 0 && <ul className="space-y-2">
      {visible.map((a) => {
        const situation = currentSituation(a, snapshot.updates);
        const expired = isOverdue(a, snapshot.updates, today);
        return <li key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-medium break-words">{a.description}</p>
            <p className="text-xs text-muted-foreground">
              Responsável: {a.responsible_label || "Não informado"} · Prazo: {formatAcademicDate(a.due_on, "Não informado")}
            </p>
            <p className="text-xs text-muted-foreground">
              Situação: {situation}{expired ? " · Prazo vencido" : ""}
            </p>
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
    {pending.length > INITIAL_SHOWN && <Button size="sm" variant="outline"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}>
      {expanded ? "Mostrar menos medidas" : `Mostrar todas as ${pending.length} medidas`}
    </Button>}
    <p className="text-xs text-muted-foreground">
      A lista é ordenada pelo prazo declarado; medidas sem prazo vêm por último.
      Sem atualização não significa não realizada. Ver acompanhamento abre o histórico sem alterar registros.
      Registrar evolução apenas abre o formulário para servidores autorizados; nada é gravado automaticamente.
    </p>
  </section>;
}
