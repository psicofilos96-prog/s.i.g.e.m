/**
 * Centro de Operações — L10: localização/responsabilidade temporais e transferência de bens (migration 0416).
 * Cadeia única por bem (seq único) ⇒ uma localização vigente por data; localização e responsável não retroagem.
 * Troca de ESCOLA só por transferência: solicitação (origem) → autorização/recusa por pessoa ≠ solicitante (origem) →
 * envio → recebimento na escola de destino com comprovante juntado, que grava a nova localização na cadeia do bem.
 * Uma transferência aberta por bem; em trânsito não muda localização, responsável nem baixa.
 */
import type { AssetEvent } from "./permanent-assets";

export interface Interval { from: string; to: string | null }
export interface LocationInterval extends Interval { schoolId: string; spaceId: string | null }
export interface ResponsibilityInterval extends Interval { engagementId: string; schoolId: string }

/** Linha do tempo de localização: intervalos [from, próximo from) — nunca sobrepostos por construção. */
export function locationTimeline(events: readonly AssetEvent[]): LocationInterval[] {
  const locs = [...events].filter((e) => e.kind === "localizacao").sort((a, b) => a.seq - b.seq);
  return locs.map((e, i) => ({ schoolId: e.schoolId!, spaceId: e.spaceId ?? null, from: e.on, to: locs[i + 1]?.on ?? null }));
}

/** Responsabilidade só vale enquanto o bem está na escola da atuação; mudança de escola encerra. */
export function responsibilityTimeline(events: readonly AssetEvent[]): ResponsibilityInterval[] {
  const out: ResponsibilityInterval[] = []; let school: string | null = null; let open: ResponsibilityInterval | null = null;
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (e.kind === "localizacao" && e.schoolId !== school) { if (open) open.to = e.on; open = null; school = e.schoolId ?? null; }
    if (e.kind === "responsavel" && school) { if (open) open.to = e.on; open = { engagementId: e.engagementId!, schoolId: school, from: e.on, to: null }; out.push(open); }
    if (e.kind === "baixa" && open) { open.to = e.on; open = null; }
  }
  return out;
}

export const at = <T extends Interval>(tl: readonly T[], on: string): T | null => tl.find((x) => x.from <= on && (x.to === null || on < x.to)) ?? null;

/** Prova de não sobreposição: falha se dois intervalos vigentes coexistem (dado vindo de fora da cadeia). */
export function incompatibleOverlaps<T extends Interval>(tl: readonly T[]): [T, T][] {
  const s = [...tl].sort((a, b) => a.from.localeCompare(b.from)); const bad: [T, T][] = [];
  for (let i = 1; i < s.length; i++) if (s[i - 1]!.to === null || s[i - 1]!.to! > s[i]!.from) bad.push([s[i - 1]!, s[i]!]);
  return bad;
}

export type TransferKind = "autorizacao" | "recusa" | "envio" | "recebimento" | "cancelamento";
export type TransferState = "solicitada" | "autorizada" | "em-transito" | "recebida" | "recusada" | "cancelada";
export interface TransferEvent { seq: number; kind: TransferKind; actorPerson: string; hasDoc?: boolean; note?: string }
const ST: Record<TransferKind, TransferState> = { autorizacao: "autorizada", envio: "em-transito", recebimento: "recebida", recusa: "recusada", cancelamento: "cancelada" };
export const transferState = (ev: readonly TransferEvent[]): TransferState => { const l = [...ev].sort((a, b) => b.seq - a.seq)[0]; return l ? ST[l.kind] : "solicitada"; };

/** Espelha `record_ops_asset_transfer_event`; o banco é a garantia. */
export function canTransfer(t: { requesterPerson: string; events: readonly TransferEvent[] }, kind: TransferKind, actor: string, d: { hasDoc?: boolean; note?: string } = {}) {
  const st = transferState(t.events);
  const ok = (kind === "autorizacao" || kind === "recusa") ? st === "solicitada" : kind === "envio" ? st === "autorizada"
    : kind === "recebimento" ? st === "em-transito" : st === "solicitada" || st === "autorizada";
  if (!ok) return { ok: false as const, reason: `Transição inválida a partir de ${st}.` };
  if ((kind === "autorizacao" || kind === "recusa" || kind === "recebimento") && actor === t.requesterPerson) return { ok: false as const, reason: "Solicitante não autoriza nem recebe a própria transferência." };
  if (kind === "recebimento" && !d.hasDoc) return { ok: false as const, reason: "Recebimento exige comprovante juntado." };
  if ((kind === "recusa" || kind === "cancelamento") && (d.note ?? "").trim().length < 10) return { ok: false as const, reason: "Justificativa obrigatória." };
  return { ok: true as const };
}
export const TRANSFER_WRITERS = ["request_ops_asset_transfer", "record_ops_asset_transfer_event"] as const;
