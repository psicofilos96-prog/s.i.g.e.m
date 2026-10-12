/**
 * Rede/Matrículas/Vagas L08 — Solicitações de vaga.
 * Pedido (vindo da inscrição L07, pelo protocolo) é ledger append-only:
 * recebido → conferência → análise → distribuição → contemplado → confirmado → encerrado,
 * com espera (análise/distribuição → espera → distribuição) e encerramento justificado de qualquer etapa aberta.
 * Responsável é atuação (engagement), prazo só se declarado por política, anexos só por referência
 * protegida e comunicação individual é evento próprio (enviado ≠ lido). Contemplar exige vaga disponível
 * na linha do Quadro (L05) relida no ato; confirmação nunca vira matrícula (segue para a matrícula guiada).
 */
export type RequestState = "recebido" | "conferencia" | "analise" | "distribuicao" | "espera" | "contemplado" | "confirmado" | "encerrado";
export type RequestAction = "receber" | "conferir" | "analisar" | "distribuir" | "colocar-em-espera" | "contemplar" | "confirmar" | "encerrar" | "atribuir-responsavel";

export interface RequestEvent {
  protocol: string; seq: number; action: RequestAction; to: RequestState; personId: string; reason: string; at: string;
  responsibleEngagementId?: string; dueOn?: string | null; cellKey?: string; attachmentRefs?: readonly string[]; closureKind?: string;
}
export interface MessageEvent { protocol: string; seq: number; channel: string; templateId: string; sentAt: string; sentBy: string; status: "enviado" | "sem-provedor" | "lido"; readAt?: string }
export interface RActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; schoolIds: readonly string[] | "rede"; engagementIds: readonly string[] }
export interface RequestPolicy {
  competence: Partial<Record<RequestAction, string>>;
  /** Prazo em dias corridos por etapa, só se homologado; ausente ⇒ sem prazo. */ dueDaysByState: Partial<Record<RequestState, number>>;
  closureKinds: readonly string[]; // motivos de encerramento homologados (desistência, não comparecimento…)
  confirmationWindowDays: number | null;
}

const FLOW: Record<RequestAction, { from: (RequestState | null)[]; to: RequestState | "same" }> = {
  receber: { from: [null], to: "recebido" }, conferir: { from: ["recebido"], to: "conferencia" },
  analisar: { from: ["conferencia"], to: "analise" }, distribuir: { from: ["analise", "espera"], to: "distribuicao" },
  "colocar-em-espera": { from: ["analise", "distribuicao"], to: "espera" }, contemplar: { from: ["distribuicao"], to: "contemplado" },
  confirmar: { from: ["contemplado"], to: "confirmado" },
  encerrar: { from: ["recebido", "conferencia", "analise", "distribuicao", "espera", "contemplado", "confirmado"], to: "encerrado" },
  "atribuir-responsavel": { from: ["recebido", "conferencia", "analise", "distribuicao", "espera", "contemplado"], to: "same" },
};
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const requestState = (ev: readonly RequestEvent[]): RequestState | null => ev.at(-1)?.to ?? null;

export type RResult = { ok: true; event: RequestEvent } | { ok: false; reason: string };
export function actOnRequest(protocol: string, schoolId: string, events: readonly RequestEvent[], action: RequestAction, actor: RActor,
  input: { reason: string; at: string; expectedSeq: number; responsibleEngagementId?: string; cellKey?: string; availableInCell?: number | null; attachmentRefs?: readonly string[]; closureKind?: string; confirmedByGuardianChannel?: boolean },
  pol: RequestPolicy): RResult {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não decide pedido." };
  const cap = pol.competence[action];
  if (!cap) return { ok: false, reason: `Competência para "${action}" não configurada.` };
  if (!actor.capabilities.includes(cap)) return { ok: false, reason: `Falta a capacidade ${cap}.` };
  if (actor.schoolIds !== "rede" && !actor.schoolIds.includes(schoolId)) return { ok: false, reason: "Fora do escopo da escola." };
  const last = events.at(-1)?.seq ?? 0;
  if (input.expectedSeq !== last) return { ok: false, reason: "Base desatualizada." };
  const st = requestState(events);
  if (!FLOW[action].from.includes(st)) return { ok: false, reason: `"${action}" não admitida em ${st ?? "inexistente"}.` };
  if (!input.reason.trim()) return { ok: false, reason: "Justificativa obrigatória." };
  // Responsável atual: só quem detém a atuação responsável age nas etapas operacionais (salvo atribuir).
  const resp = [...events].reverse().find((e) => e.responsibleEngagementId)?.responsibleEngagementId;
  if (resp && action !== "atribuir-responsavel" && action !== "receber" && !actor.engagementIds.includes(resp)) return { ok: false, reason: "Pedido sob responsabilidade de outra atuação." };
  if (action === "atribuir-responsavel" && !input.responsibleEngagementId) return { ok: false, reason: "Informe a atuação responsável." };
  for (const a of input.attachmentRefs ?? []) if (!new RegExp(`^solicitacoes/${schoolId}/${protocol}/[\\w.-]+$`).test(a)) return { ok: false, reason: `Anexo fora do armazenamento protegido: ${a}.` };
  if (action === "distribuir" || action === "contemplar") {
    if (!input.cellKey) return { ok: false, reason: "Informe a linha do quadro de vagas." };
    if (action === "contemplar") {
      const distributed = [...events].reverse().find((e) => e.action === "distribuir")?.cellKey;
      if (distributed !== input.cellKey) return { ok: false, reason: "Contemplação difere da distribuição." };
      if (input.availableInCell === null || input.availableInCell === undefined) return { ok: false, reason: "Vaga disponível não lida no ato." };
      if (input.availableInCell <= 0) return { ok: false, reason: "Sem vaga disponível: colocar em espera." };
      const distributor = [...events].reverse().find((e) => e.action === "distribuir")?.personId;
      if (distributor === actor.personId) return { ok: false, reason: "Quem distribuiu não contempla." };
    }
  }
  if (action === "confirmar") {
    if (!input.confirmedByGuardianChannel) return { ok: false, reason: "Confirmação exige manifestação registrada do responsável." };
    const c = [...events].reverse().find((e) => e.action === "contemplar")!;
    if (pol.confirmationWindowDays === null) return { ok: false, reason: "Prazo de confirmação não homologado." };
    if (input.at.slice(0, 10) > addDays(c.at.slice(0, 10), pol.confirmationWindowDays)) return { ok: false, reason: "Prazo de confirmação vencido: encerrar por não confirmação." };
  }
  if (action === "encerrar" && (!input.closureKind || !pol.closureKinds.includes(input.closureKind))) return { ok: false, reason: "Motivo de encerramento fora do catálogo homologado." };
  const to = FLOW[action].to === "same" ? (st as RequestState) : (FLOW[action].to as RequestState);
  const days = pol.dueDaysByState[to];
  return { ok: true, event: {
    protocol, seq: last + 1, action, to, personId: actor.personId, reason: input.reason.trim(), at: input.at,
    dueOn: days === undefined ? null : addDays(input.at.slice(0, 10), days),
    ...(input.responsibleEngagementId ? { responsibleEngagementId: input.responsibleEngagementId } : {}),
    ...(input.cellKey ? { cellKey: input.cellKey } : {}), ...(input.attachmentRefs?.length ? { attachmentRefs: input.attachmentRefs } : {}),
    ...(input.closureKind ? { closureKind: input.closureKind } : {}),
  } };
}

/** Atraso só quando o prazo foi declarado; sem prazo nunca é "atrasado". */
export function overdue(events: readonly RequestEvent[], today: string): boolean | null {
  const e = events.at(-1); if (!e || e.to === "encerrado" || e.to === "confirmado") return false;
  const due = [...events].reverse().find((x) => x.to === e.to && x.dueOn !== undefined)?.dueOn ?? null;
  return due === null ? null : today > due;
}

const ACCUSATORY = /\b(culpa|neglig|irregular|mentir|fraude)\w*/i;
export function sendMessage(protocol: string, msgs: readonly MessageEvent[], actor: RActor, input: { channel: string; templateId: string; templateText: string; at: string; providerConfigured: boolean; allowedTemplates: readonly string[] }):
  { ok: true; event: MessageEvent } | { ok: false; reason: string } {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Envio exige pessoa natural." };
  if (!input.allowedTemplates.includes(input.templateId)) return { ok: false, reason: "Modelo de mensagem não homologado." };
  if (ACCUSATORY.test(input.templateText)) return { ok: false, reason: "Linguagem acusatória recusada." };
  if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|laudo|cid\b/i.test(input.templateText)) return { ok: false, reason: "Mensagem não pode conter dado sensível." };
  const seq = (msgs.filter((m) => m.protocol === protocol).at(-1)?.seq ?? 0) + 1;
  return { ok: true, event: { protocol, seq, channel: input.channel, templateId: input.templateId, sentAt: input.at, sentBy: actor.personId, status: input.providerConfigured ? "enviado" : "sem-provedor" } };
}

/** Trilha para o próprio protocolo: etapas e datas, sem justificativa interna nem responsável. */
export const requesterTrail = (events: readonly RequestEvent[]) => events.map((e) => ({ seq: e.seq, to: e.to, at: e.at, dueOn: e.dueOn ?? null }));
