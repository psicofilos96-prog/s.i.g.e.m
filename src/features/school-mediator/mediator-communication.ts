/**
 * PERFIL MEDIADOR — LOTE 12 Comunicação com Docente, NEI, OP e Direção (núcleo puro).
 * Não há canal novo: cada mensagem é proposta ao canal existente (protocolos NEI
 * `/inclusao/nei/protocolos`, solicitações da escola) e só a contas elegíveis já
 * verificadas pelo canal (`nei_recipient_eligible`). Fio = ledger com seq esperado.
 * Competências: aula (planejar/conduzir/avaliar) é do docente; decisão especializada
 * é da equipe competente. Mediador compartilha, pergunta, registra o que foi acordado
 * (só vale com confirmação da contraparte) e dá devolutiva.
 */
export type Party = "mediador" | "docente" | "nei" | "orientacao" | "direcao";
export type Kind = "observacao" | "esclarecimento" | "orientacao" | "resposta" | "estrategia-proposta" | "estrategia-confirmada" | "devolutiva";
export interface Msg { seq: number; threadId: string; kind: Kind; from: Party; by: string; to: Party[]; studentId: string; text: string; refSeq: number | null; at: string; idem: string; channel: "protocolo-nei" | "solicitacao-escola" }
export interface Thread { id: string; studentId: string; schoolId: string; participants: { personId: string; party: Party }[] }

const ALLOWED: Record<Party, Kind[]> = {
  mediador: ["observacao", "esclarecimento", "estrategia-proposta", "devolutiva", "resposta"],
  docente: ["orientacao", "resposta", "estrategia-proposta", "estrategia-confirmada", "esclarecimento"],
  nei: ["orientacao", "resposta", "estrategia-proposta", "estrategia-confirmada", "esclarecimento"],
  orientacao: ["orientacao", "resposta", "estrategia-confirmada", "esclarecimento"],
  direcao: ["resposta", "estrategia-confirmada", "esclarecimento"],
};
const CLINICAL = /\b(cid|laudo|diagn[oó]stic|transtorno|psiqui|neurol|medica[cç])/i;
/** Texto do mediador que decide o que é do docente ou da equipe especializada. */
const OVERREACH = /\b(alterei (o|a) (plano|aula|avalia)|apliquei (a |uma )?prova|dei (a )?nota|atribu[ií] nota|decidi (o |a )?(encaminhamento|atendimento|plano)|defini (o |a )?(plano|pei|paee))/i;

export function channelFor(to: Party[]): Msg["channel"] { return to.some((p) => p === "nei") ? "protocolo-nei" : "solicitacao-escola"; }

export function send(thread: Thread, log: Msg[], m: { kind: Kind; to: Party[]; text: string; refSeq?: number; expectedSeq: number; at: string },
  actor: { personId: string | null; technical: boolean; designationActive: boolean; eligibleRecipients: Party[] | null }) {
  if (actor.technical || !actor.personId) return { ok: false as const, reasons: ["Mensagem exige pessoa natural."] };
  const me = thread.participants.find((p) => p.personId === actor.personId);
  const r: string[] = [];
  if (!me) return { ok: false as const, reasons: ["Você não participa deste assunto."] };
  if (me.party === "mediador" && !actor.designationActive) r.push("Sem designação vigente para este estudante.");
  const mine = log.filter((x) => x.threadId === thread.id);
  const head = Math.max(0, ...mine.map((x) => x.seq));
  if (m.expectedSeq !== head) r.push("Há mensagens novas: releia antes de enviar.");
  if (!ALLOWED[me.party].includes(m.kind)) r.push(m.kind === "estrategia-confirmada" ? "Estratégia só é confirmada pelo docente ou pela equipe competente." : "Este tipo de mensagem não cabe ao seu papel.");
  if (actor.eligibleRecipients === null) r.push("Destinatários não verificados pelo canal: envio indisponível.");
  else if (!m.to.length || m.to.some((t) => !actor.eligibleRecipients!.includes(t) || !thread.participants.some((p) => p.party === t))) r.push("Destinatário não elegível neste assunto.");
  const t = m.text.trim();
  if (t.length < 5 || t.length > 1500) r.push("Mensagem entre 5 e 1500 caracteres.");
  if (CLINICAL.test(t)) r.push("Sem diagnóstico, CID ou termo clínico: o canal não carrega dado clínico.");
  if (me.party === "mediador" && OVERREACH.test(t)) r.push("Planejar, conduzir e avaliar a aula é do docente; decisão especializada é da equipe competente.");
  const ref = m.refSeq != null ? mine.find((x) => x.seq === m.refSeq) : undefined;
  if (["resposta", "estrategia-confirmada", "devolutiva"].includes(m.kind) && !ref) r.push("Indique a mensagem a que se refere.");
  if (m.kind === "estrategia-confirmada" && ref && (ref.kind !== "estrategia-proposta" || ref.by === actor.personId)) r.push("Confirmação só de estratégia proposta por outra pessoa.");
  if (m.kind === "devolutiva" && ref && ref.kind !== "estrategia-confirmada" && ref.kind !== "orientacao") r.push("Devolutiva refere-se a orientação ou estratégia acordada.");
  if (r.length) return { ok: false as const, reasons: r };
  return { ok: true as const, message: { seq: head + 1, threadId: thread.id, kind: m.kind, from: me.party, by: actor.personId, to: [...m.to].sort(), studentId: thread.studentId,
    text: t, refSeq: ref?.seq ?? null, at: m.at, channel: channelFor(m.to), idem: `msg:${thread.id}:${head}:${actor.personId}:${m.kind}` } satisfies Msg };
}

/** Estratégias acordadas = propostas confirmadas pela contraparte competente; proposta sozinha não é acordo. */
export function agreedStrategies(log: Msg[], threadId: string) {
  const t = log.filter((m) => m.threadId === threadId);
  return t.filter((m) => m.kind === "estrategia-proposta").map((p) => {
    const c = t.find((m) => m.kind === "estrategia-confirmada" && m.refSeq === p.seq);
    const fb = c ? t.filter((m) => m.kind === "devolutiva" && m.refSeq === c.seq).map((m) => ({ by: m.by, at: m.at, text: m.text })) : [];
    return { proposalSeq: p.seq, text: p.text, proposedBy: p.by, state: c ? "acordada" as const : "proposta" as const, confirmedBy: c?.by ?? null, confirmedByParty: c?.from ?? null, feedback: fb };
  });
}

/** Pendências do mediador: esclarecimentos sem resposta e orientações sem devolutiva. */
export function mediatorPending(log: Msg[], threadId: string, personId: string) {
  const t = log.filter((m) => m.threadId === threadId);
  return {
    awaitingAnswer: t.filter((m) => m.kind === "esclarecimento" && m.by === personId && !t.some((x) => x.kind === "resposta" && x.refSeq === m.seq)).map((m) => m.seq),
    awaitingFeedback: t.filter((m) => m.kind === "orientacao" && m.to.includes("mediador") && !t.some((x) => x.kind === "devolutiva" && x.refSeq === m.seq && x.by === personId)).map((m) => m.seq),
  };
}
