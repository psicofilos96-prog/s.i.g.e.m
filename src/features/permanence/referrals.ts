/**
 * L13 Permanência — encaminhamentos intersetoriais (migration 0401).
 * Destino (setor/rede de proteção) é versão append-only aprovada por pessoa ≠ autor com
 * decisão, declarando fundamento legal e allowlist de campos (prontuário, laudo, CID, CPF,
 * endereço completo vedados por CHECK). Encaminhamento usa só a versão vigente aprovada,
 * finalidade obrigatória e campos ⊂ allowlist; protocolo opcional (L06). "Enviado" e
 * "recebido" só com comprovante + SHA-256; retorno/encerramento com nota. O pacote enviado
 * é montado AQUI pela allowlist — nunca o prontuário/ficha integral.
 */
export interface Destination { id: string; destKey: string; version: number; label: string; legalBasis: string; allowedFields: string[]; agreementRef: string | null; authorPerson: string; approvedBy: string | null; decisionRef: string | null }
export type ReferralEventKind = "envio-comprovado" | "recebimento-confirmado" | "retorno" | "sem-retorno-registrado" | "encerrado";
export interface ReferralEvent { referralId: string; seq: number; kind: ReferralEventKind; evidenceRef: string | null; evidenceSha256: string | null; note: string | null }

export const VETOED_FIELDS = ["prontuario", "prontuario-integral", "laudo", "cid", "cpf", "endereco-completo"] as const;

export function currentDestinations(all: readonly Destination[]): Destination[] {
  const head = new Map<string, Destination>();
  for (const d of all) if (!head.has(d.destKey) || d.version > head.get(d.destKey)!.version) head.set(d.destKey, d);
  return [...head.values()].filter((d) => d.approvedBy && d.decisionRef && d.approvedBy !== d.authorPerson
    && !d.allowedFields.some((f) => (VETOED_FIELDS as readonly string[]).includes(f)));
}

/** Pacote mínimo: só campos pedidos ∩ allowlist do destino, valores ausentes ficam "não informado". */
export function buildMinimalPacket(dest: Destination, requested: readonly string[], source: Readonly<Record<string, unknown>>):
  { ok: true; packet: Record<string, unknown>; fields: string[] } | { ok: false; reason: string } {
  if (requested.length === 0) return { ok: false, reason: "Selecione os dados necessários." };
  const bad = requested.filter((f) => !dest.allowedFields.includes(f) || (VETOED_FIELDS as readonly string[]).includes(f));
  if (bad.length) return { ok: false, reason: `Dados não autorizados para este destino: ${bad.join(", ")}.` };
  const packet: Record<string, unknown> = {};
  for (const f of requested) packet[f] = source[f] ?? "não informado";
  return { ok: true, packet, fields: [...requested] };
}

export function validateReferral(d: { purpose: string; destination: Destination | null }): string | null {
  if (!d.destination) return "Destino não autorizado ou sem aprovação vigente.";
  if (d.purpose.trim().length < 10) return "Informe a finalidade do encaminhamento.";
  return null;
}

export type ReferralState = "registrado" | "enviado" | "recebido" | "retornado" | "sem-retorno" | "encerrado";
export function projectReferral(evs: readonly ReferralEvent[]): { state: ReferralState; seq: number; sentProof: string | null; returnNote: string | null } {
  const h = [...evs].sort((a, b) => a.seq - b.seq);
  if (h.some((e, i) => e.seq !== i + 1)) throw new Error("referrals:broken-chain");
  const valid = (e: ReferralEvent) => e.kind !== "envio-comprovado" && e.kind !== "recebimento-confirmado" || (!!e.evidenceSha256 && /^[0-9a-f]{64}$/.test(e.evidenceSha256));
  let state: ReferralState = "registrado";
  for (const e of h.filter(valid)) state = ({ "envio-comprovado": "enviado", "recebimento-confirmado": "recebido", retorno: "retornado", "sem-retorno-registrado": "sem-retorno", encerrado: "encerrado" } as const)[e.kind];
  return { state, seq: h.length, sentProof: h.find((e) => e.kind === "envio-comprovado" && valid(e))?.evidenceRef ?? null,
    returnNote: [...h].reverse().find((e) => e.kind === "retorno")?.note ?? null };
}
