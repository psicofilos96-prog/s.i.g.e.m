// L19 — Agenda do caso. Projeção pura dos fatos já gravados: contatos (L10,
// próximo acompanhamento), visitas planejadas (L11), ações/reavaliação do
// plano (L12) e encaminhamentos aguardando retorno (L13). Nenhum compromisso
// é criado pela agenda; prazo só existe se declarado na origem.
// Notificação sai só pela camada única (`emit_notification_event`, chave idempotente);
// protocolo e anexo são do SIGEM Documentos (L06 / `read_sensitive_case_document`).

export type AgendaKind = "contato" | "visita" | "acao-do-plano" | "reavaliacao" | "retorno-de-encaminhamento";
export interface AgendaSource {
  kind: AgendaKind; caseId: string; sourceRef: string; // id do fato canônico
  due: string | null; responsibleEngagement: string | null;
  done: boolean; protocolRef: string | null; sensitiveAttachment: boolean;
}
export interface AgendaItem extends AgendaSource { state: "sem-prazo" | "a-vencer" | "vencido"; orphan: boolean; attachmentAccess: "nenhum" | "via-documentos" }

export function buildAgenda(src: readonly AgendaSource[], today: string, activeEngagements: ReadonlySet<string>): AgendaItem[] {
  return src.filter((s) => !s.done).map((s): AgendaItem => ({
    ...s,
    state: s.due === null ? "sem-prazo" : s.due < today ? "vencido" : "a-vencer",
    orphan: !s.responsibleEngagement || !activeEngagements.has(s.responsibleEngagement),
    attachmentAccess: s.sensitiveAttachment ? "via-documentos" : "nenhum",
  }))
  // ordem cronológica de prazo declarado; sem prazo ao fim; nunca ranking de gravidade
  .sort((a, b) => (a.due ?? "9999") < (b.due ?? "9999") ? -1 : (a.due ?? "9999") > (b.due ?? "9999") ? 1 : a.sourceRef.localeCompare(b.sourceRef));
}

/** Evento de notificação: só ids e tipo, sem nome, motivo ou conteúdo do caso. */
export function notificationEvent(item: AgendaItem, today: string) {
  if (item.state !== "vencido" && item.due !== today) return null;
  if (item.orphan) return null; // sem responsável vigente ninguém é notificado por suposição
  return {
    event_kind: `permanencia.agenda.${item.state === "vencido" ? "vencido" : "hoje"}`,
    idempotency_key: `perm-agenda|${item.kind}|${item.sourceRef}|${item.due}|${item.state}`,
    payload: { case_id: item.caseId, kind: item.kind, source_ref: item.sourceRef },
  };
}

/** Anexo restrito nunca é link direto: sempre pelo leitor de Documentos com finalidade. */
export function attachmentRequest(item: AgendaItem, purpose: string) {
  if (item.attachmentAccess !== "via-documentos") return null;
  if (purpose.trim().length < 10) return { error: "sem-finalidade" as const };
  return { rpc: "read_sensitive_case_document" as const, purpose: purpose.trim(), sourceRef: item.sourceRef };
}

/** Histórico = os próprios fatos de origem; a agenda não grava nada. */
export const AGENDA_WRITES: readonly string[] = [];
