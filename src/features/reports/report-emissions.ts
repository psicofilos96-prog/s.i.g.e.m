/**
 * Trilha imutável de emissões de relatório (0288 `report_emissions`).
 * Só metadados + SHA-256 do conteúdo; o arquivo nunca é armazenado — reemissão
 * relê a fonte com a sessão de quem gera, para herdar a mesma ACL da tela.
 */
import { callRpc } from "@/lib/rpc-call";
import { supabase } from "@/integrations/supabase/client";
import { qrDataUrl } from "@/features/document-studio/studio-cloud";
import type { BuilderChoice } from "./report-builder";

export const REPORT_VERIFY_PATH = "/verificar/relatorio/";
export type EmissionFormat = "pdf" | "xlsx" | "csv";
export type ReportEmission = Readonly<{ id: string; verification_code: string; report_id: string; report_version: number; title: string; format: EmissionFormat; params: { choice?: BuilderChoice; sector?: string }; row_count: number; content_sha256: string; reissue_of: string | null; issued_at: string }>;
export type ReportVerification = Readonly<{ status: "emitido" | "nao-encontrado"; title?: string; issued_at?: string; format?: string; row_count?: number; content_sha256?: string; reissue?: boolean }>;

export const isReportCode = (c: unknown): c is string => typeof c === "string" && /^[0-9A-F]{20}$/.test(c.trim().toUpperCase());
export function reportVerifyUrl(code: string, origin: string): string {
  if (!isReportCode(code)) throw new Error("Código de verificação inválido.");
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) throw new Error("Origem inválida.");
  return `${origin}${REPORT_VERIFY_PATH}${code.toUpperCase()}`;
}
/** Bloco HTML com QR + código; só URL e código, nunca dado do relatório. */
export function verificationBlock(code: string, origin: string): string {
  const url = reportVerifyUrl(code, origin);
  return `<div style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:9px;page-break-inside:avoid"><img alt="QR de verificação" src="${qrDataUrl(url, 3)}" style="width:72px;height:72px"><div>Verifique em ${url}<br>Código ${code.toUpperCase()}</div></div>`;
}
/** Reemissão: mesmo conteúdo ⇔ mesmo SHA-256. */
export function reissueComparison(original: string | null, current: string): "identico" | "divergente" | "primeira" {
  if (!original) return "primeira";
  return original === current ? "identico" : "divergente";
}

export async function recordEmission(a: { reportId: string; version: number; title: string; format: EmissionFormat; choice: BuilderChoice; sector: string; rows: number; sha256: string; reissueOf: string | null; key: string }) {
  const r = await callRpc<{ emission_id: string; verification_code: string; issued_at: string; original_sha256: string | null }[]>("record_report_emission", {
    _report_id: a.reportId, _report_version: a.version, _title: a.title.slice(0, 200), _format: a.format,
    _params: { choice: a.choice, sector: a.sector }, _row_count: a.rows, _content_sha256: a.sha256, _reissue_of: a.reissueOf, _idempotency_key: a.key,
  });
  const row = r[0]; if (!row) throw new Error("Emissão não registrada.");
  return row;
}
export async function listMyEmissions(limit = 50): Promise<ReportEmission[]> {
  const { data, error } = await supabase.from("report_emissions").select("id,verification_code,report_id,report_version,title,format,params,row_count,content_sha256,reissue_of,issued_at").order("issued_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReportEmission[];
}
export const verifyReport = (code: string) => callRpc<ReportVerification>("verify_report_emission", { _code: code.toUpperCase() });
