/**
 * L10 Permanência — contatos e tentativas com a família (migration 0398).
 * Destinatário é sempre um vínculo canônico (`guardian_authorizations`, cabeça vigente na
 * data, mesmo estudante, seção `comunicados`, sem restrição `contato-vedado`); o banco
 * revalida e grava a versão usada. Profissional = pessoa da sessão. Tentativa futura é
 * recusada (nunca registrar contato não ocorrido). "Sem resposta" é só fato da tentativa:
 * nenhuma projeção conclui negligência, desinteresse ou abandono.
 */
export type Channel = "presencial" | "telefone" | "mensagem" | "carta" | "visita" | "outro-autorizado";
export type Result = "contato-realizado" | "sem-resposta" | "canal-indisponivel" | "recusa-de-contato" | "retorno-agendado";
export interface Attempt { id: string; caseId: string; authorizationLogicalId: string; channel: Channel; attemptedOn: string; professionalPerson: string; result: Result; providence: string | null; nextFollowUp: string | null }
export interface AuthorizationHead { logicalId: string; version: number; studentId: string; eventKind: "constituicao" | "substituicao" | "revogacao"; validFrom: string; validUntil: string | null; sections: readonly string[]; restrictions: readonly string[] }

export function contactAllowed(a: AuthorizationHead | null, studentId: string, on: string): { ok: true } | { ok: false; reason: string } {
  // negação uniforme: inexistente, revogado, outro estudante e vedado respondem igual
  const no = { ok: false as const, reason: "Responsável sem autorização de contato vigente nesta data." };
  if (!a || a.studentId !== studentId || a.eventKind === "revogacao") return no;
  if (a.validFrom > on || (a.validUntil !== null && a.validUntil < on)) return no;
  if (!a.sections.includes("comunicados") || a.restrictions.includes("contato-vedado")) return no;
  return { ok: true };
}

const JUDGMENT = /(neglig|desinteress|omiss|irrespons|abandon|culpa)/i;
export function validateAttempt(d: Omit<Attempt, "id" | "professionalPerson">, today: string): string | null {
  if (d.attemptedOn > today) return "Tentativa não pode ter data futura.";
  if (d.nextFollowUp !== null && d.nextFollowUp < d.attemptedOn) return "Próximo acompanhamento antes da tentativa.";
  if (d.providence !== null && JUDGMENT.test(d.providence)) return "Texto com julgamento sobre a família não é aceito.";
  return null;
}

export const RESULT_LABEL: Record<Result, string> = {
  "contato-realizado": "Contato realizado", "sem-resposta": "Sem resposta nesta tentativa", "canal-indisponivel": "Canal indisponível",
  "recusa-de-contato": "Contato não aceito nesta tentativa", "retorno-agendado": "Retorno agendado",
};

export interface ContactSummary { attempts: number; byChannel: Partial<Record<Channel, number>>; lastAttemptOn: string | null; lastSuccessOn: string | null;
  nextFollowUp: string | null; followUpOverdue: boolean; note: string }

/** Resumo factual: conta tentativas, nunca rotula a família. */
export function summarizeContacts(xs: readonly Attempt[], today: string): ContactSummary {
  const s = [...xs].sort((a, b) => a.attemptedOn.localeCompare(b.attemptedOn) || a.id.localeCompare(b.id));
  const byChannel: Partial<Record<Channel, number>> = {};
  for (const a of s) byChannel[a.channel] = (byChannel[a.channel] ?? 0) + 1;
  const last = s.at(-1) ?? null;
  const success = [...s].reverse().find((a) => a.result === "contato-realizado" || a.result === "retorno-agendado") ?? null;
  const next = last?.nextFollowUp ?? null;
  const noSuccess = s.length > 0 && !success;
  return { attempts: s.length, byChannel, lastAttemptOn: last?.attemptedOn ?? null, lastSuccessOn: success?.attemptedOn ?? null, nextFollowUp: next,
    followUpOverdue: next !== null && today > next,
    note: s.length === 0 ? "Nenhuma tentativa registrada." : noSuccess
      ? "Tentativas sem retorno até agora; ausência de resposta não indica negligência — considerar outro canal autorizado ou a rede de proteção conforme o fluxo."
      : "Há contato realizado registrado." };
}
