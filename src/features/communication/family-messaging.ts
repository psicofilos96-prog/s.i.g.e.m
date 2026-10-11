/**
 * Lote 08 (Expansão) — Comunicação Escola–Família: núcleo puro sobre o módulo AJ.
 * Audiência por educando a partir de autorização vigente (seção) — nunca por sobrenome/escola;
 * guarda restrita e revogação excluem; resumo externo sem dado sensível; nada grava.
 */

export type Authorization = Readonly<{ guardianId: string; studentId: string; sections: readonly string[]; validFrom: string; validUntil: string | null; revokedOn: string | null; restricted: boolean }>;

export const activeOn = (a: Authorization, on: string, section: string) =>
  !a.restricted && a.sections.includes(section) && a.validFrom <= on && (a.validUntil == null || on <= a.validUntil) && (a.revokedOn == null || on < a.revokedOn);

/** Destinatários de um comunicado sobre um educando: só responsáveis com autorização vigente na seção. */
export function recipientsFor(studentId: string, auths: readonly Authorization[], on: string, section = "comunicados") {
  return [...new Set(auths.filter((a) => a.studentId === studentId && activeOn(a, on, section)).map((a) => a.guardianId))].sort();
}

/** Responsável com vários filhos vê só os educandos autorizados — nunca os de outro responsável. */
export function visibleStudents(guardianId: string, auths: readonly Authorization[], on: string, section = "comunicados") {
  return [...new Set(auths.filter((a) => a.guardianId === guardianId && activeOn(a, on, section)).map((a) => a.studentId))].sort();
}

/** Mensagem automática nunca acusa: linguagem de culpa/sanção é recusada antes do envio. */
const ACCUSATORY = /\b(culpa|neglig[eê]nc|irrespons|abandono|puni[cç]|sancion|reprovad[oa] por falta|den[uú]ncia|conselho tutelar)/i;
export function automaticMessageAllowed(text: string) {
  return ACCUSATORY.test(text) ? { ok: false as const, reason: "linguagem-acusatoria" } : { ok: true as const };
}

/** Resumo para canal externo (push/e-mail): só título genérico e link autenticado, nunca nome, nota, frequência ou saúde. */
export function externalSummary(kind: "comunicado" | "reuniao" | "aviso" | "frequencia" | "solicitacao") {
  return { text: "Há uma nova mensagem da escola no SIGEM.", category: kind, requiresLogin: true };
}

/** Tentativas: cada canal registra tentativa; nenhum provedor configurado ⇒ "sem-provedor", nunca "entregue". */
export type Attempt = Readonly<{ channel: "app" | "email" | "sms"; status: "registrada" | "sem-provedor" | "falha" | "entregue"; at: string }>;
export function attemptFor(channel: Attempt["channel"], providerConfigured: boolean, at: string): Attempt {
  if (channel === "app") return { channel, status: "registrada", at };
  return { channel, status: providerConfigured ? "registrada" : "sem-provedor", at };
}

/** Leitura ≠ ciência: só conta ciência explícita do responsável destinatário. */
export function acknowledgement(recipients: readonly string[], acks: readonly { guardianId: string; kind: "leitura" | "ciencia" }[]) {
  const set = new Set(recipients);
  const lidos = new Set(acks.filter((a) => set.has(a.guardianId) && a.kind === "leitura").map((a) => a.guardianId));
  const cientes = new Set(acks.filter((a) => set.has(a.guardianId) && a.kind === "ciencia").map((a) => a.guardianId));
  return { destinatarios: set.size, lidos: lidos.size, cientes: cientes.size };
}
