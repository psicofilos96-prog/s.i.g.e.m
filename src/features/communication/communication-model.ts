// AJ — modelo puro da comunicação escola ↔ família. Estado é derivado no banco; aqui só apresentação.
export type CommState = "rascunho" | "publicado" | "retificacao-em-rascunho" | "cancelado";
export type Audience = "familias-da-escola" | "familias-da-turma" | "equipe-da-escola";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  "familias-da-escola": "Famílias autorizadas da escola",
  "familias-da-turma": "Famílias autorizadas de uma turma",
  "equipe-da-escola": "Equipe da escola",
};

export const STATE_LABEL: Record<CommState, string> = {
  rascunho: "Rascunho — ninguém vê ainda",
  publicado: "Publicado",
  "retificacao-em-rascunho": "Correção em rascunho — as famílias ainda veem a versão publicada",
  cancelado: "Cancelado",
};

export const EXTERNAL_DELIVERY_PROVIDER_PENDING =
  "Envio por e-mail, SMS, WhatsApp ou push não está ativo: nenhum provedor foi configurado. O comunicado fica disponível dentro do SIGEM.";
export const ATTACHMENTS_PENDING = "Anexos ainda não são aceitos: falta armazenamento com acesso controlado.";

/** O que a escola pode fazer agora, sem presumir nada além do estado derivado. */
export function allowedActions(state: CommState): { edit: boolean; publish: boolean; cancel: boolean } {
  return {
    edit: state !== "cancelado",
    publish: state === "rascunho" || state === "retificacao-em-rascunho",
    cancel: state === "publicado" || state === "retificacao-em-rascunho",
  };
}

/** "Disponível" é fato interno do SIGEM; nunca afirmamos recebimento externo. */
export function availabilityLine(publishedAt: string | null, reads: number | null, acks: number | null, requiresAck: boolean) {
  if (!publishedAt) return "Ainda não disponível para ninguém.";
  const base = `Disponível no SIGEM desde ${new Date(publishedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Leituras registradas: ${reads ?? 0}.`;
  return requiresAck ? `${base} Ciências registradas: ${acks ?? 0}.` : base;
}

export function commMessage(code: string): string {
  const map: Record<string, string> = {
    "comm:stale": "Alguém alterou este comunicado ao mesmo tempo. Recarregue e tente de novo.",
    "comm:cancelled": "Comunicado cancelado não pode ser alterado.",
    "comm:already-published": "Esta versão já está publicada.",
    "comm:not-published": "Só é possível cancelar o que já foi publicado.",
    "comm:class-outside-school": "Escolha uma turma desta escola.",
    "comm:not-available": "Comunicado indisponível.",
    "comm:acknowledgement-not-requested": "Este comunicado não pede ciência.",
    "family:not-authorized": "Você não tem autorização vigente para ver os comunicados deste educando.",
    "session-required": "Entre novamente.",
  };
  if (code.startsWith("capability:")) return "Sua atuação não tem permissão para esta ação nesta escola ou turma.";
  return map[code] ?? "Não foi possível concluir a ação.";
}
