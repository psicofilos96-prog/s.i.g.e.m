/**
 * Lote 09 Supervisão — orientações, comunicações e encaminhamento à central de protocolos.
 * Ledger append-only por expediente. Recebimento/leitura/ciência são registrados SÓ pelo próprio
 * destinatário (nunca presumidos nem pelo remetente); entrega externa sem provedor = "sem-provedor".
 * Destinatário só por elegibilidade lida (escola/setor/conta existente). Encaminhamento a outro
 * setor gera pedido para a central única (demand-center), nunca protocolo paralelo.
 */
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

export const KINDS = ["orientacao-tecnica", "recomendacao", "pedido-esclarecimento", "comunicacao-normativa", "solicitacao-regularizacao"] as const;
export type Kind = (typeof KINDS)[number];
export const SECTORS = ["direcao", "secretaria", "orientacao", "nei", "estatistica", "avaliacao", "semed"] as const;
export type Sector = (typeof SECTORS)[number];

export interface Template { id: string; kind: Kind; homologated: boolean; requiresGrounding: boolean; requiresDeadline: boolean }
export interface Recipient { accountId: string; schoolId: string; sector: Sector }

export type EvKind = "emitir" | "lido" | "ciencia" | "responder" | "cancelar";
export interface ExpEvent {
  seq: number; expId: string; kind: EvKind; principalId: string; isHuman: boolean; at: string;
  // emitir:
  templateId?: string; schoolId?: string; grounding?: string | null; dueOn?: string | null; recipients?: Recipient[]; attachments?: string[]; level?: string;
  // responder/cancelar:
  text?: string | null;
}

export function appendExp(log: ExpEvent[], ev: Omit<ExpEvent, "seq">, expectedSeq: number, templates: Template[], eligible: (r: Recipient) => boolean): Res<ExpEvent[]> {
  if (!ev.isHuman) return { ok: false, code: "autor-nao-humano" };
  if (log.length !== expectedSeq) return { ok: false, code: "base-alterada" };
  const head = log[0];
  if (ev.kind === "emitir") {
    if (head) return { ok: false, code: "ja-emitido" };
    if (ev.level !== "registrar" && ev.level !== "conferir" && ev.level !== "coordenar") return { ok: false, code: "sem-competencia" };
    const t = templates.find((x) => x.id === ev.templateId);
    if (!t) return { ok: false, code: "modelo-inexistente" };
    if (t.requiresGrounding && !ev.grounding?.trim()) return { ok: false, code: "sem-fundamentacao" };
    if (t.requiresDeadline && !ev.dueOn) return { ok: false, code: "sem-prazo" };
    if (!ev.recipients?.length) return { ok: false, code: "sem-destinatario" };
    if (ev.recipients.some((r) => r.schoolId !== ev.schoolId || !eligible(r))) return { ok: false, code: "destinatario-inelegivel" };
    if ((ev.attachments ?? []).some((p) => !p.startsWith(`supervisao/${ev.schoolId}/expedientes/${ev.expId}/`))) return { ok: false, code: "anexo-fora-do-caminho-privado" };
    return { ok: true, value: [{ ...ev, seq: 0 }] };
  }
  if (!head) return { ok: false, code: "nao-emitido" };
  if (log.some((e) => e.kind === "cancelar")) return { ok: false, code: "cancelado" };
  if (ev.kind === "cancelar") {
    if (ev.principalId !== head.principalId || !ev.text?.trim()) return { ok: false, code: "cancelamento-so-do-autor-com-motivo" };
    return { ok: true, value: [...log, { ...ev, seq: log.length }] };
  }
  // lido / ciencia / responder: só o próprio destinatário
  if (!head.recipients!.some((r) => r.accountId === ev.principalId)) return { ok: false, code: "nao-e-destinatario" };
  if (ev.kind === "responder" && !ev.text?.trim()) return { ok: false, code: "resposta-vazia" };
  if (ev.kind !== "responder" && log.some((e) => e.kind === ev.kind && e.principalId === ev.principalId)) return { ok: false, code: "ja-registrado" };
  return { ok: true, value: [...log, { ...ev, seq: log.length }] };
}

export function receipts(log: ExpEvent[], today: string) {
  const head = log[0];
  if (!head) return null;
  const by = (k: EvKind, id: string) => log.find((e) => e.kind === k && e.principalId === id)?.at ?? null;
  const responded = log.some((e) => e.kind === "responder");
  return {
    cancelled: log.some((e) => e.kind === "cancelar"),
    overdue: !!head.dueOn && !responded && head.dueOn < today,
    perRecipient: head.recipients!.map((r) => ({ accountId: r.accountId, read: by("lido", r.accountId), acknowledged: by("ciencia", r.accountId) })),
    externalDelivery: "sem-provedor" as const,
  };
}

/** Encaminhamento: pedido à central única de protocolos; nunca abre protocolo próprio. */
export function forwardToProtocol(log: ExpEvent[], to: Sector, reason: string) {
  const head = log[0];
  if (!head) return { ok: false as const, code: "nao-emitido" };
  if (!reason.trim()) return { ok: false as const, code: "motivo-obrigatorio" };
  return { ok: true as const, value: { via: "demand-center", schoolId: head.schoolId!, sector: to, originRef: `supervisao:expediente:${head.expId}`, idempotencyKey: `sup-exp-${head.expId}-${to}`, reason } };
}
