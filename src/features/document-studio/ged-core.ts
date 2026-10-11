/**
 * Lote 04 (Expansão) — SIGEM Docs GED administrativo, núcleo puro sobre o Studio de documentos.
 * Distinto do DocServ (documentos funcionais do servidor). Nada grava; tipos, numeração,
 * tramitação, assinatura e verificação pública seguem regras fechadas e falham fechado.
 */

export const GED_TYPES = ["oficio", "memorando", "ata", "requerimento", "encaminhamento", "declaracao", "circular", "processo"] as const;
export type GedType = (typeof GED_TYPES)[number];

/** Numeração por tipo/ano/unidade: sequência +1 sobre os números já emitidos na mesma série. */
export function nextNumber(issued: readonly { type: GedType; year: number; unit: string; seq: number }[], type: GedType, year: number, unit: string) {
  const seqs = issued.filter((i) => i.type === type && i.year === year && i.unit === unit).map((i) => i.seq);
  const seq = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return { seq, label: `${type.toUpperCase()} Nº ${String(seq).padStart(3, "0")}/${year} — ${unit}` };
}

export type GedState = "rascunho" | "protocolado" | "em-tramitacao" | "despachado" | "ciente" | "arquivado";
const NEXT: Record<GedState, readonly GedState[]> = {
  rascunho: ["protocolado"], protocolado: ["em-tramitacao", "arquivado"],
  "em-tramitacao": ["despachado", "em-tramitacao"], despachado: ["ciente", "em-tramitacao"],
  ciente: ["arquivado", "em-tramitacao"], arquivado: [],
};
export const canMove = (from: GedState, to: GedState) => NEXT[from].includes(to);

/** Assinatura: simples ≠ qualificada. Qualificada só com evidência de certificado ICP-Brasil validado externamente. */
export type Signature = Readonly<{ kind: "simples" | "qualificada-icp"; personId: string | null; icpEvidence: string | null }>;
export function signatureLabel(s: Signature): { ok: boolean; label: string } {
  if (!s.personId) return { ok: false, label: "Assinatura recusada: exige pessoa real identificada" };
  if (s.kind === "qualificada-icp")
    return s.icpEvidence ? { ok: true, label: "Assinatura qualificada ICP-Brasil (evidência registrada)" }
      : { ok: false, label: "Qualificada ICP-Brasil sem evidência de certificado: recusada" };
  return { ok: true, label: "Assinatura eletrônica simples (não equivale à qualificada ICP-Brasil)" };
}

/** Verificação pública só devolve metadados permitidos; nunca conteúdo, pessoas ou anexos. */
export const PUBLIC_FIELDS = ["numero", "tipo", "unidade", "emitidoEm", "hash", "situacao"] as const;
export function publicVerification(doc: Record<string, unknown>) {
  return Object.fromEntries(PUBLIC_FIELDS.filter((k) => k in doc).map((k) => [k, doc[k]]));
}

/** Retenção sem decisão institucional ⇒ reter sempre. */
export function retentionAction(policy: { years: number | null; legalBasis: string | null } | null, archivedOn: string, today: string) {
  if (!policy || policy.years == null || !policy.legalBasis) return "reter" as const;
  const limit = `${Number(archivedOn.slice(0, 4)) + policy.years}${archivedOn.slice(4)}`;
  return today >= limit ? "elegivel-para-descarte-com-revisao" as const : "reter" as const;
}

/** Anexo só por URL assinada de curta duração; caminho público é recusado. */
export const attachmentAllowed = (path: string) => !/^https?:\/\//i.test(path) && !path.includes("/public/");
