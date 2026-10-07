import { userErrorText } from "@/lib/observability/governed-errors";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/features/reports/report-engine";
import { institution } from "@/config/institution";
import { bulkReport, executeBulk, previewBulk, OUTCOME_LABEL, type BulkItem, type BulkOperation, type BulkPreview, type BulkResult, type CompletedKeys, BulkError } from "./bulk-engine";

const completedStore: CompletedKeys = new Set<string>();

/** Painel genérico: prévia → confirmação → execução → resultado por item → CSV. */
export function BulkPanel<P>({ op, items, authorizedScopes, onDone }: { op: BulkOperation<P>; items: readonly BulkItem<P>[]; authorizedScopes: ReadonlySet<string | null> | null; onDone?: () => void }) {
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const makePreview = () => { setError(null); setResult(null); setConfirmed(false);
    try { setPreview(previewBulk(op, items, authorizedScopes, crypto.randomUUID())); } catch (e) { setError(e instanceof BulkError ? e.message : userErrorText(e)); } };
  const run = async () => { if (!preview) return; setBusy(true); setError(null);
    try { setResult(await executeBulk(op, items, preview, { confirmed, completed: completedStore })); onDone?.(); }
    catch (e) { setError(e instanceof BulkError ? e.message : userErrorText(e)); } finally { setBusy(false); } };
  const download = () => { if (!result) return;
    const csv = toCsv(bulkReport(result), { headerLines: [institution.governmentName, institution.departmentName], title: op.label }, [`Lote ${result.batchId}`]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `lote-${result.batchId}.csv`; a.click(); URL.revokeObjectURL(a.href); };
  const rows = result?.rows ?? preview?.rows ?? [];
  return (
    <section aria-labelledby="bulk-h" className="rounded-md border p-4 space-y-3">
      <h2 id="bulk-h" className="font-medium">{op.label} em lote ({items.length} selecionados, limite {op.maxItems})</h2>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={items.length === 0 || busy} onClick={makePreview}>Gerar prévia</Button>
        {preview && !result && <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Confirmo: {preview.ready} serão enviados, {preview.refused} recusados {op.mode === "tudo-ou-nada" ? "(tudo ou nada)" : "(falhas não desfazem os demais)"}
        </label>}
        {preview && !result && <Button size="sm" disabled={!confirmed || busy || preview.ready === 0} onClick={run}>Executar</Button>}
        {result && <Button size="sm" variant="outline" onClick={download}>Baixar relatório (CSV)</Button>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && <p role="status" className="text-sm">{Object.entries(result.counts).filter(([, n]) => n > 0).map(([k, n]) => `${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL]}: ${n}`).join(" · ")}</p>}
      {rows.length > 0 && <ul className="max-h-64 overflow-auto text-xs">{rows.map((r, i) => <li key={`${r.key}-${i}`}>{r.key} — {OUTCOME_LABEL[r.outcome]}{r.reason ? `: ${r.reason}` : ""}</li>)}</ul>}
    </section>
  );
}
