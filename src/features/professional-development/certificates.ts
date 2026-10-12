// L16 — certificado versionado (migration 0445): versão → validação humana → emissão com código único; PDF no SIGEM Documentos.
import { supabase } from "@/integrations/supabase/client";

export type CertificateStatus = "valido" | "substituido" | "revogado" | "nao-encontrado";
export interface CertificateVerification {
  status: CertificateStatus; course_title: string | null; hours_minutes: number | null; period_start: string | null;
  period_end: string | null; institution: string | null; version: number | null; issued_on: string | null; pdf_sha256: string | null;
}

export function issueProblems(x: { validated: boolean; isLatest: boolean; pdfShaNow: string | null; pdfShaVersion: string;
  hasPrevious: boolean; reason: string | null }): string[] {
  const p: string[] = [];
  if (!x.validated) p.push("Sem validação humana: não emite");
  if (!x.isLatest) p.push("Só a versão mais recente pode ser emitida");
  if (x.pdfShaNow !== x.pdfShaVersion) p.push("PDF mudou depois da versão: crie nova versão");
  if (x.hasPrevious && !x.reason) p.push("Reemissão exige motivo explícito");
  return p;
}

export function validationProblems(x: { validator: string; author: string; holder: string; completionConfirmer: string }): string[] {
  return [x.author, x.holder, x.completionConfirmer].includes(x.validator) ? ["Validador deve ser pessoa distinta do autor, titular e confirmador"] : [];
}

/** Lote 19: o PDF só é oferecido como certificado de certificado emitido (emissão exige validação humana autorizada) e vigente. */
export function certificatePdfOffered(status: CertificateStatus): boolean {
  return status === "valido";
}

export function formatHours(minutes: number | null): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export async function verifyCertificate(code: string): Promise<CertificateVerification> {
  const { data, error } = await supabase.rpc("verify_dev_certificate", { _code: code });
  if (error) throw error;
  const row = (data as CertificateVerification[] | null)?.[0];
  return row ?? { status: "nao-encontrado", course_title: null, hours_minutes: null, period_start: null, period_end: null, institution: null, version: null, issued_on: null, pdf_sha256: null };
}
