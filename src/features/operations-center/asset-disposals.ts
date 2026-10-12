/**
 * Centro de Operações — L12: conservação, manutenção, baixa e destinação (migration 0419).
 * Conservação = eventos 'estado' (L09); manutenção = vínculo bem ↔ ordem L05 da mesma escola.
 * Baixa só por processo formal: proposta (motivo, justificativa, processo administrativo do SIGEM Documentos e laudo/
 * avaliação juntado NESSE processo) → autorização/indeferimento por pessoa ≠ proponente com decisão → destinação com
 * comprovante no processo → efetivação (pessoa ≠ proponente, base do bem inalterada) que grava 'baixa' na cadeia.
 * Trigger no banco recusa qualquer 'baixa' sem processo destinado. Cadastro nunca é apagado (append-only + sem TRUNCATE).
 */
export type DisposalKind = "autorizacao" | "indeferimento" | "destinacao" | "efetivacao" | "arquivamento";
export type DisposalState = "proposta" | "autorizada" | "indeferida" | "destinada" | "efetivada" | "arquivada";
export interface DisposalEvent { seq: number; kind: DisposalKind; actorPerson: string; decisionRef?: string; destinationKind?: string; destinationParty?: string; hasDoc?: boolean; note?: string }
const ST: Record<DisposalKind, DisposalState> = { autorizacao: "autorizada", indeferimento: "indeferida", destinacao: "destinada", efetivacao: "efetivada", arquivamento: "arquivada" };
export const disposalState = (ev: readonly DisposalEvent[]): DisposalState => { const l = [...ev].sort((a, b) => b.seq - a.seq)[0]; return l ? ST[l.kind] : "proposta"; };

const FROM: Record<DisposalKind, DisposalState[]> = { autorizacao: ["proposta"], indeferimento: ["proposta"], destinacao: ["autorizada"], efetivacao: ["destinada"], arquivamento: ["proposta", "autorizada"] };

/** Espelha `record_ops_asset_disposal_event`; o banco é a garantia. */
export function canDispose(p: { proposerPerson: string; events: readonly DisposalEvent[] }, kind: DisposalKind, actor: string, d: Partial<DisposalEvent> = {}) {
  const st = disposalState(p.events);
  if (!FROM[kind].includes(st)) return { ok: false as const, reason: `Transição inválida a partir de ${st}.` };
  if ((kind === "autorizacao" || kind === "indeferimento" || kind === "efetivacao") && actor === p.proposerPerson) return { ok: false as const, reason: "Proponente não autoriza nem efetiva a própria baixa." };
  if ((kind === "autorizacao" || kind === "indeferimento") && (d.decisionRef ?? "").trim().length < 3) return { ok: false as const, reason: "Exige referência da decisão." };
  if (kind === "destinacao" && (!d.destinationKind || !d.hasDoc || (d.destinationKind !== "nao-aplicavel" && (d.destinationParty ?? "").trim().length < 3)))
    return { ok: false as const, reason: "Destinação exige tipo, destinatário e comprovante no processo." };
  if ((kind === "indeferimento" || kind === "arquivamento") && (d.note ?? "").trim().length < 10) return { ok: false as const, reason: "Justificativa obrigatória." };
  return { ok: true as const };
}

/** Bem baixado continua consultável: situação é projeção, nunca remoção. */
export const assetSituation = (writtenOff: boolean, openProcess: DisposalState | null) =>
  writtenOff ? "baixado (cadastro preservado)" : openProcess && ["proposta", "autorizada", "destinada"].includes(openProcess) ? `em processo de baixa (${openProcess})` : "ativo";
export const DISPOSAL_WRITERS = ["link_ops_asset_maintenance", "propose_ops_asset_disposal", "record_ops_asset_disposal_event"] as const;
