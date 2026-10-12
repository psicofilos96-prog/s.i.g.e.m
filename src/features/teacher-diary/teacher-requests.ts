/**
 * Docente LOTE 15 — Comunicação e solicitações do professor (núcleo puro).
 *
 * Reaproveita: notificações (`emit_notification_event`/`notification_reads`),
 * comunicados família (`communication/`, audiência derivada por autorização), protocolos
 * e tramitação (`workflows/`). Aqui: solicitação do docente a setor competente como
 * ledger com seq esperado, estados enviado→recebido→em análise→respondido→encerrado,
 * recebimento confirmado só pelo setor destinatário, e mensagem à família só com
 * autorização vigente e sem dado de outros estudantes.
 */
export type Sector = "direcao" | "orientacao" | "secretaria" | "nei" | "supervisao" | string;
export type ReqEventKind = "aberta" | "recebida" | "em-analise" | "respondida" | "complemento" | "encerrada";
export type ReqEvent = { seq: number; kind: ReqEventKind; actorId: string; actorSector: Sector | "docente"; at: string; text?: string; protocolRef?: string };

export type TeacherRequest = { requestId: string; idempotencyKey: string; authorId: string; to: Sector; subject: string; events: ReqEvent[] };

const NEXT: Record<ReqEventKind, readonly ReqEventKind[]> = {
  aberta: ["recebida"],
  recebida: ["em-analise", "respondida"],
  "em-analise": ["respondida", "complemento"],
  complemento: ["em-analise", "respondida"],
  respondida: ["complemento", "encerrada"],
  encerrada: [],
};
const SECTOR_ACTS: readonly ReqEventKind[] = ["recebida", "em-analise", "respondida"];

export function openRequest(input: { requestId: string; authorId: string; to: Sector; subject: string; text: string; at: string; knownSectors: readonly Sector[] }): TeacherRequest {
  if (!input.knownSectors.includes(input.to)) throw new Error("Setor de destino não reconhecido.");
  if (!input.subject.trim() || !input.text.trim()) throw new Error("Informe assunto e descrição.");
  const idempotencyKey = `req:${input.authorId}:${input.requestId}`;
  return { requestId: input.requestId, idempotencyKey, authorId: input.authorId, to: input.to, subject: input.subject,
    events: [{ seq: 1, kind: "aberta", actorId: input.authorId, actorSector: "docente", at: input.at, text: input.text }] };
}

export function appendRequestEvent(r: TeacherRequest, e: Omit<ReqEvent, "seq">, expectedSeq: number): TeacherRequest {
  const head = r.events[r.events.length - 1]!;
  if (head.seq !== expectedSeq) throw new Error("A solicitação mudou; recarregue o histórico.");
  if (!NEXT[head.kind].includes(e.kind)) throw new Error(`Passo "${e.kind}" não é permitido depois de "${head.kind}".`);
  if (SECTOR_ACTS.includes(e.kind) && e.actorSector !== r.to) throw new Error("Só o setor destinatário confirma recebimento, análise ou resposta.");
  if ((e.kind === "complemento" || e.kind === "encerrada") && e.actorId !== r.authorId) throw new Error("Só quem abriu complementa ou encerra.");
  if ((e.kind === "respondida" || e.kind === "complemento") && !e.text?.trim()) throw new Error("Escreva o conteúdo.");
  return { ...r, events: [...r.events, { ...e, seq: head.seq + 1 }] };
}

export const requestStatus = (r: TeacherRequest): ReqEventKind => r.events[r.events.length - 1]!.kind;
export const protocolOf = (r: TeacherRequest): string | null => r.events.find((e) => e.protocolRef)?.protocolRef ?? null;

// ---------- Canal família ----------
export type GuardianAuth = { guardianAccountId: string; studentId: string; sections: readonly string[]; validUntil?: string | null; revoked?: boolean };

export function familyRecipients(studentId: string, auths: readonly GuardianAuth[], date: string): string[] {
  return auths
    .filter((a) => a.studentId === studentId && !a.revoked && a.sections.includes("comunicados") && (!a.validUntil || a.validUntil >= date))
    .map((a) => a.guardianAccountId);
}

/** Mensagem individual à família: um estudante só, das turmas do docente, sem nome de outros estudantes. */
export function validateFamilyMessage(m: { studentId: string; text: string }, ctx: { myStudents: readonly string[]; otherStudentNames: readonly string[]; recipients: readonly string[] }): string[] {
  const e: string[] = [];
  if (!ctx.myStudents.includes(m.studentId)) e.push("Só estudantes das suas turmas.");
  if (!ctx.recipients.length) e.push("Não há responsável com autorização vigente para comunicados.");
  if (!m.text.trim()) e.push("Escreva a mensagem.");
  const lower = m.text.toLowerCase();
  if (ctx.otherStudentNames.some((n) => n.trim() && lower.includes(n.toLowerCase()))) e.push("A mensagem cita outro estudante; retire o nome antes de enviar.");
  if (/\b(CID|laudo|diagn[oó]stic)/i.test(m.text)) e.push("Não envie informação clínica pela mensagem.");
  return e;
}

/** Recibo: entregue ≠ lido; lido só pelo próprio destinatário. */
export function markRead(reads: ReadonlyMap<string, string>, messageId: string, recipientId: string, actorId: string, at: string): Map<string, string> {
  if (recipientId !== actorId) throw new Error("Só o destinatário marca como lido.");
  const out = new Map(reads);
  if (!out.has(`${messageId}:${recipientId}`)) out.set(`${messageId}:${recipientId}`, at);
  return out;
}
