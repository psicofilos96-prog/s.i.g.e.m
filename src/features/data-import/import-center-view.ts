/**
 * NIMPORT.3 — integração visual do núcleo comum (import-kernel) na Central de Importações e no Censo.
 * Puro: leitura segura, prévia, exceções, idempotência, proveniência e plano de compensação.
 * Não grava nada e não conhece writer de domínio.
 */
import {
  compensationPlan, exceptionReport, exceptionReportCsv, idempotencyKey, provenanceLabel, readFileSafely,
  type ExceptionRow,
} from "./import-kernel";
import { OUTCOME_LABEL, classifyRows, countRows, type CanonicalRecord, type ImportAdapter, type StagedRow } from "./import-engine";

export type CenterPreview = Readonly<{
  fileName: string; sha: string; rows: StagedRow[]; counts: ReturnType<typeof countRows>;
  exceptions: ExceptionRow[]; batchKey: string; provenance: string;
}>;
export type PreviewResult = Readonly<{ ok: true; preview: CenterPreview } | { ok: false; code: string; message: string }>;

export function buildCenterPreview(
  adapter: ImportAdapter, text: string, sha: string, fileName: string, existing: readonly CanonicalRecord[],
): PreviewResult {
  const read = readFileSafely(text, (t) => adapter.parse(t));
  if (!read.ok) return { ok: false, code: read.code, message: `${read.message} Nada foi recebido.` };
  const rows = classifyRows(adapter, read.rows, existing);
  return {
    ok: true,
    preview: {
      fileName, sha, rows, counts: countRows(rows),
      exceptions: centerExceptions(rows),
      batchKey: idempotencyKey(adapter.id, adapter.version, sha, "lote"),
      provenance: provenanceLabel({ adapter: adapter.id, version: adapter.version, sourceName: fileName, sourceSha256: sha, locator: `${rows.length} linha(s)` }),
    },
  };
}

export const centerExceptions = (rows: readonly StagedRow[]) =>
  exceptionReport(rows, (r) => ({ locator: r.line_ref, outcome: OUTCOME_LABEL[r.outcome], reasons: r.reasons }), [OUTCOME_LABEL.valida]);

export const centerExceptionsCsv = (rows: readonly StagedRow[]) => exceptionReportCsv(centerExceptions(rows));

/** Linhas que podem ser compensadas: aplicadas e ainda não compensadas (nada é apagado). */
export const compensableRows = (events: ReadonlyArray<{ row_id: string | null; kind: string }>) => compensationPlan(events);

/** Censo: fonte JSON agregada. Arquivo vazio/ilegível/não-lista nunca vira fonte vazia. */
export function readCensusSource(text: string) {
  return readFileSafely<unknown>(text, (t) => {
    const j = JSON.parse(t) as unknown;
    if (!Array.isArray(j)) throw new Error("o conteúdo não é uma lista de linhas");
    return j;
  });
}

export const censusRejectionsCsv = (rejections: ReadonlyArray<{ row: number | string; reason: string }>) =>
  exceptionReportCsv(rejections.map((r) => ({ locator: String(r.row), outcome: "Rejeitada", reasons: r.reason || "sem motivo informado" })));

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
