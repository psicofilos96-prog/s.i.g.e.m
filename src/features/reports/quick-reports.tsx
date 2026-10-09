/**
 * ONDA 3 — "Relatórios mais usados": um clique gera e outro exporta.
 * Usa o mesmo assunto, leitura (sessão do usuário), resultado e exportadores
 * do gerador; não há leitura nem cálculo próprio aqui.
 */
import { useState } from "react";
import { FileSpreadsheet, FileText, Printer, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operationalToday } from "@/lib/academic-date";
import { governError } from "@/lib/observability/governed-errors";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { useSessionUser } from "@/features/authority/session-authority";
import { cellText, toCsv, type ReportResult } from "./report-engine";
import { sourceById } from "./builder-sources";
import { SECTOR_LABEL, buildResult, collectAll, columnsOf, provenance, type BuilderChoice, type Collected, type Sector } from "./report-builder";
import { analyze, emptySpec, toStudioHtml, toStudioXlsx } from "./report-studio";

export const QUICK_REPORTS: { sourceId: string; sector: Sector; blurb: string }[] = [
  { sourceId: "gerador-panorama-escolas", sector: "secretaria", blurb: "Turmas, matrículas, alunos distintos e pessoal de cada escola, conferidos com o Censo 2026." },
  { sourceId: "gerador-pessoal", sector: "dp", blurb: "Registros das planilhas de pessoal 2026 por escola e setor da SEMED. Nomes só saem se você incluir a coluna." },
];

function save(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

type Run = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Collected; result: ReportResult; choice: BuilderChoice };

export function QuickReportCard({ sourceId, sector, blurb }: { sourceId: string; sector: Sector; blurb: string }) {
  const { user } = useSessionUser();
  const src = sourceById(sourceId);
  const [run, setRun] = useState<Run>({ status: "idle" });
  if (!src) return null;
  const choice: BuilderChoice = { sourceId, from: null, to: null, columns: columnsOf(src).filter((c) => !c.sensitive).map((c) => c.id), filters: [], sort: [] };
  async function generate() {
    if (!src) return;
    setRun({ status: "loading" });
    try {
      let col = await collectAll(src, null, null);
      const sc = src.schoolIdColumn ?? null;
      if (sc) {
        const n = await readCurrentSchoolNames().catch(() => new Map<string, string>());
        col = { ...col, rows: col.rows.map((r) => ({ ...r, [sc]: r[sc] === null ? null : n.get(String(r[sc])) ?? "Escola sem nome visível" })) };
      }
      setRun({ status: "ready", data: col, result: buildResult(src, choice, col.rows), choice });
    } catch (e) { setRun({ status: "error", message: governError(e).userMessage }); }
  }
  async function exportAs(fmt: "csv" | "xlsx" | "pdf") {
    if (!src || run.status !== "ready") return;
    if (run.data.truncated) { setRun({ status: "error", message: "Leitura incompleta (limite de linhas atingido). Use o gerador completo para restringir antes de exportar." }); return; }
    const spec = emptySpec(src.title);
    const analysis = analyze(run.result, spec, src.definition.source);
    const meta = provenance(src, run.choice, run.data, SECTOR_LABEL[sector]);
    const method = [`Assunto: ${src.title} (v${src.definition.version})`, `Fonte: ${src.definition.source}`, `Metodologia: ${src.methodology}`, `Acesso: ${src.acl}`];
    const base = `${src.definition.id}-${operationalToday()}`;
    if (fmt === "csv") save(`${base}.csv`, new Blob([toCsv(run.result, { title: src.title }, meta)], { type: "text/csv;charset=utf-8" }));
    else if (fmt === "xlsx") save(`${base}.xlsx`, new Blob([await toStudioXlsx(run.result, spec, meta, analysis, method)]));
    else { const w = window.open("", "_blank"); if (w) { w.document.write(toStudioHtml(run.result, spec, meta, analysis, method)); w.document.close(); w.focus(); w.print(); } }
  }
  const formats = src.definition.formats;
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-territory-accent">Pronto para gerar</p>
        <h3 className="font-display text-xl font-semibold text-foreground">{src.title}</h3>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
      {!user ? (
        <p className="text-sm text-muted-foreground">Entre no SIGEM para gerar. O relatório é lido com o acesso da sua conta.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void generate()} disabled={run.status === "loading"}>
            {run.status === "loading" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Play className="mr-1 h-4 w-4" aria-hidden />}
            {run.status === "ready" ? "Gerar de novo" : "Gerar agora"}
          </Button>
          {run.status === "ready" && run.result.rows.length > 0 && (<>
            {formats.includes("csv") && <Button size="sm" variant="outline" onClick={() => void exportAs("csv")}><FileText className="mr-1 h-4 w-4" aria-hidden />CSV</Button>}
            {formats.includes("xlsx") && <Button size="sm" variant="outline" onClick={() => void exportAs("xlsx")}><FileSpreadsheet className="mr-1 h-4 w-4" aria-hidden />XLSX</Button>}
            {formats.includes("pdf") && <Button size="sm" variant="outline" onClick={() => void exportAs("pdf")}><Printer className="mr-1 h-4 w-4" aria-hidden />PDF / imprimir</Button>}
          </>)}
        </div>
      )}
      <div aria-live="polite">
        {run.status === "error" && <p role="alert" className="text-sm text-destructive">{run.message}</p>}
        {run.status === "ready" && run.result.rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma linha visível para a sua conta neste relatório.</p>}
        {run.status === "ready" && run.result.rows.length > 0 && <Preview result={run.result} />}
      </div>
    </article>
  );
}

function Preview({ result }: { result: ReportResult }) {
  const rows = result.rows.slice(0, 8);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{result.rows.length.toLocaleString("pt-BR")} linhas · prévia das primeiras {rows.length}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left"><tr>{result.columns.map((c) => <th key={c.id} scope="col" className="whitespace-nowrap p-2 font-medium text-muted-foreground">{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{result.columns.map((c) => <td key={c.id} className="whitespace-nowrap p-2 tabular-nums">{cellText(r[c.id] ?? null)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
