/**
 * Exportação auditada (P1-06): única porta de arquivo para relatórios setoriais
 * (Matrículas, Tecnologia). O arquivo sai só do `report-engine`; antes do download
 * a emissão é registrada em `report_emissions` (RLS: ator = sessão, append-only,
 * SHA-256, código opaco); o cabeçalho leva origem, data e a política LGPD aplicada.
 * Linhas devem vir de leitura já feita com a sessão de quem exporta.
 */
import type { BuilderChoice } from "./report-builder";
import { toCsv, toPrintableHtml, toXlsx, type Branding, type ReportResult } from "./report-engine";
import { recordEmission, verificationBlock, type EmissionFormat } from "./report-emissions";

export const LGPD_EXPORT_LINE = "LGPD: colunas sensíveis excluídas por padrão; uso restrito à finalidade institucional; não redistribuir.";

export type AuditedExportInput = Readonly<{
  sector: "matriculas" | "tecnologia";
  definitionId: string; definitionVersion: number; title: string;
  source: string; result: ReportResult; format: EmissionFormat;
  meta?: readonly string[]; branding: Branding; idempotencyKey: string;
}>;

/** Cabeçalho obrigatório: origem, data de geração, política LGPD. */
export function auditedMeta(i: Pick<AuditedExportInput, "source" | "result" | "meta">): string[] {
  const hidden = i.result.columns.some((c) => c.sensitive);
  if (hidden) throw new Error("export:sensitive-column");
  return [`Origem: ${i.source}`, `Gerado em: ${i.result.generatedAt}`, ...(i.meta ?? []), LGPD_EXPORT_LINE];
}

async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function auditedExport(i: AuditedExportInput, origin: string): Promise<{ blob: Blob; name: string; code: string }> {
  const meta = auditedMeta(i);
  const choice: BuilderChoice = { sourceId: i.definitionId, from: null, to: null, columns: i.result.columns.map((c) => c.id), filters: [], sort: [] };
  const content: ArrayBuffer | string = i.format === "csv" ? toCsv(i.result, i.branding, meta)
    : i.format === "xlsx" ? await toXlsx(i.result, i.branding, meta)
    : toPrintableHtml(i.result, i.branding, meta);
  const hash = await sha256(content);
  const e = await recordEmission({ reportId: i.definitionId, version: i.definitionVersion, title: i.title, format: i.format, choice, sector: i.sector, rows: i.result.rows.length, sha256: hash, reissueOf: null, key: i.idempotencyKey });
  const code = e.verification_code;
  let body: BlobPart = content;
  if (i.format === "pdf") body = (content as string).replace("</body>", `${verificationBlock(code, origin)}</body>`);
  const type = i.format === "csv" ? "text/csv;charset=utf-8" : i.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/html;charset=utf-8";
  const ext = i.format === "pdf" ? "html" : i.format;
  return { blob: new Blob([body], { type }), name: `${i.definitionId}-${code}.${ext}`, code };
}
