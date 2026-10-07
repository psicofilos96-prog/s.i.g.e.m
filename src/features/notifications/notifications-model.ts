/**
 * Comunicação e notificações — contratos de cliente (puro).
 * Evento de domínio (outbox, `emit_notification_event`) ≠ notificação (entrega por destinatário).
 * Destinatário é resolvido no banco por regra (capability na escola ou responsável autorizado), nunca por consulta ampla.
 * Canal real: só in-app. Canais externos são interfaces sem implementação até existir provedor configurado.
 */

export type MyNotification = Readonly<{
  delivery_id: string; event_kind: string; title: string; body: string; mandatory: boolean;
  has_link: boolean; read_at: string | null; recorded_at: string; still_authorized: boolean;
}>;

export type OpenResult = Readonly<{ status: "ok"; link: string | null } | { status: "cancelada" | "expirada" | "acesso-revogado" }>;

/** Canal externo: recebe SÓ o resumo sem variáveis do modelo (`external_summary`). Nenhum dado do evento atravessa. */
export interface ExternalChannelAdapter {
  readonly id: "email" | "push" | "sms";
  readonly configured: false | true;
  send(input: Readonly<{ recipientUserId: string; externalSummary: string; deliveryId: string }>): Promise<{ accepted: boolean; providerRef: string | null }>;
}

/** Nenhum provedor configurado: os adaptadores existem como contrato e recusam envio. */
export const EXTERNAL_CHANNELS: readonly ExternalChannelAdapter[] = (["email", "push", "sms"] as const).map((id) => ({
  id, configured: false as const,
  async send() { throw new Error(`Canal ${id} sem provedor configurado; nenhuma mensagem é enviada.`); },
}));

/** Link profundo aceito só como caminho interno relativo; nunca URL externa. Revalidado no banco ao abrir. */
export const safeInternalLink = (link: string | null): string | null =>
  link && /^\/[A-Za-z0-9/_\-?=&.%]*$/.test(link) && !link.startsWith("//") ? link : null;

/** Chave idempotente determinística: mesmo fato de domínio ⇒ mesmo evento, nunca duplicado em retry. */
export const eventKey = (kind: string, sourceRef: string) => `${kind}:${sourceRef}`.slice(0, 200);

export const OPEN_MESSAGE: Record<Exclude<OpenResult["status"], "ok">, string> = {
  cancelada: "Este aviso foi cancelado por quem o emitiu.",
  expirada: "Este aviso expirou.",
  "acesso-revogado": "Você não tem mais acesso a este conteúdo. O aviso continua no histórico, mas o link foi bloqueado.",
};

export function notifMessage(raw: string): string {
  if (raw.includes("session-required")) return "Entre com sua conta institucional.";
  if (raw.includes("notif:not-found")) return "Aviso não encontrado.";
  if (raw.includes("capability:")) return "Sua atuação não tem permissão vigente para esta ação.";
  return "Não foi possível concluir. Tente de novo.";
}

/** NSEARCH.2 — agrupamento de apresentação pelo tipo do evento já emitido; não cria evento nem muda destinatário. */
export type NoticeCategory = "devolucao" | "aprovacao" | "prazo" | "pendencia" | "documento" | "outros";
export const NOTICE_CATEGORY_LABEL: Record<NoticeCategory, string> = {
  devolucao: "Devoluções", aprovacao: "Aprovações", prazo: "Prazos", pendencia: "Pendências", documento: "Documentos", outros: "Outros",
};
const PATTERNS: [NoticeCategory, RegExp][] = [
  ["devolucao", /devol|retorn|reprov/], ["aprovacao", /aprov|homolog|deferi/], ["prazo", /prazo|venc|agenda/],
  ["documento", /document|emiss|certid|declara/], ["pendencia", /pend|tarefa|atribu|revis/],
];
export const noticeCategory = (kind: string): NoticeCategory => PATTERNS.find(([, r]) => r.test(kind.toLowerCase()))?.[0] ?? "outros";
export type NoticeFilter = Readonly<{ category: NoticeCategory | null; read: "todos" | "nao-lidos" | "lidos" }>;
export const filterNotices = <T extends Pick<MyNotification, "event_kind" | "read_at">>(items: readonly T[], f: NoticeFilter) =>
  items.filter((n) => (!f.category || noticeCategory(n.event_kind) === f.category)
    && (f.read === "todos" || (f.read === "nao-lidos" ? !n.read_at : !!n.read_at)));
