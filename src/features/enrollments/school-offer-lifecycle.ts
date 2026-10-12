/**
 * Rede/Matrículas/Vagas L02 — Oferta educacional por escola.
 * Oferta = escola × eixos abertos (etapa, modalidade, ano/fase, turno — IDs de valores
 * homologados, nunca enum) × período. Ciclo de vida é ledger append-only:
 * rascunho → proposta → análise → autorizada → publicada → funcionamento → encerrada.
 * Estado é projeção do último evento; correção é nova versão (retificação), nada é apagado.
 * Competência por etapa vem só de configuração; sem configuração ⇒ recusa (fail-closed).
 */
export type OfferState = "rascunho" | "proposta" | "analise" | "autorizada" | "publicada" | "funcionamento" | "encerrada";
export type OfferAction = "criar" | "propor" | "analisar" | "devolver" | "autorizar" | "indeferir" | "publicar" | "iniciar" | "encerrar" | "retificar";

export interface OfferIdentity { offerId: string; schoolId: string; axes: Readonly<Record<string, string>>; periodFrom: string; periodTo: string | null }
export interface OfferEvent {
  offerId: string; seq: number; action: OfferAction; to: OfferState;
  actorPersonId: string; reason: string; actRef: string | null; at: string;
  /** Na retificação: nova identidade substitui a anterior a partir deste evento. */
  identity?: OfferIdentity;
}
export interface Actor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; schoolIds: readonly string[] | "rede" }
/** Capacidade exigida por ação; vem de política homologada. Ausente ⇒ ação indisponível. */
export type OfferCompetenceConfig = Partial<Record<OfferAction, string>>;

const FLOW: Record<OfferAction, { from: readonly (OfferState | null)[]; to: OfferState | "same" }> = {
  criar: { from: [null], to: "rascunho" },
  propor: { from: ["rascunho"], to: "proposta" },
  analisar: { from: ["proposta"], to: "analise" },
  devolver: { from: ["analise"], to: "rascunho" },
  indeferir: { from: ["analise"], to: "encerrada" },
  autorizar: { from: ["analise"], to: "autorizada" },
  publicar: { from: ["autorizada"], to: "publicada" },
  iniciar: { from: ["publicada"], to: "funcionamento" },
  encerrar: { from: ["autorizada", "publicada", "funcionamento"], to: "encerrada" },
  retificar: { from: ["rascunho", "proposta", "analise", "autorizada", "publicada", "funcionamento"], to: "same" },
};
const NEEDS_ACT: readonly OfferAction[] = ["autorizar", "indeferir", "encerrar", "retificar"];

export const offerState = (events: readonly OfferEvent[]): OfferState | null => events.at(-1)?.to ?? null;

export function currentIdentity(base: OfferIdentity, events: readonly OfferEvent[]): OfferIdentity {
  return events.reduce((id, e) => e.identity ?? id, base);
}

export type Decision = { ok: true; event: OfferEvent } | { ok: false; reason: string };

export function applyOfferAction(
  base: OfferIdentity, events: readonly OfferEvent[], action: OfferAction, actor: Actor,
  input: { reason: string; actRef?: string | null | undefined; at: string; expectedSeq: number; identity?: OfferIdentity },
  config: OfferCompetenceConfig,
): Decision {
  if (!actor.isHuman || !actor.personId) return { ok: false, reason: "Ato exige pessoa natural; executor técnico não decide oferta." };
  if (actor.isTechnicalExecutor) return { ok: false, reason: "Executor técnico não registra ato de oferta." };
  const cap = config[action];
  if (!cap) return { ok: false, reason: `Competência para "${action}" não configurada em política homologada.` };
  if (!actor.capabilities.includes(cap)) return { ok: false, reason: `Falta a capacidade ${cap}.` };
  if (actor.schoolIds !== "rede" && !actor.schoolIds.includes(base.schoolId)) return { ok: false, reason: "Fora do escopo da escola." };
  const last = events.at(-1)?.seq ?? 0;
  if (input.expectedSeq !== last) return { ok: false, reason: "Base desatualizada: outra pessoa registrou antes." };
  const state = offerState(events);
  const rule = FLOW[action];
  if (!rule.from.includes(state)) return { ok: false, reason: `Ação "${action}" não admitida no estado ${state ?? "inexistente"}.` };
  if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  if (NEEDS_ACT.includes(action) && !input.actRef?.trim()) return { ok: false, reason: "Exige referência ao ato competente." };
  if (action === "autorizar" || action === "indeferir") {
    const proposers = events.filter((e) => e.action === "propor" || e.action === "criar").map((e) => e.actorPersonId);
    if (proposers.includes(actor.personId)) return { ok: false, reason: "Quem propôs não autoriza a própria oferta." };
  }
  if (action === "retificar") {
    const id = input.identity;
    if (!id || id.offerId !== base.offerId || id.schoolId !== base.schoolId) return { ok: false, reason: "Retificação mantém oferta e escola." };
    if (id.periodTo && id.periodTo < id.periodFrom) return { ok: false, reason: "Período inválido." };
  }
  if (action === "criar") {
    if (!base.schoolId || Object.keys(base.axes).length === 0) return { ok: false, reason: "Oferta exige escola e eixos declarados." };
    if (base.periodTo && base.periodTo < base.periodFrom) return { ok: false, reason: "Período inválido." };
  }
  return { ok: true, event: {
    offerId: base.offerId, seq: last + 1, action, to: rule.to === "same" ? (state as OfferState) : rule.to,
    actorPersonId: actor.personId, reason: input.reason.trim(), actRef: input.actRef?.trim() || null, at: input.at,
    ...(action === "retificar" ? { identity: input.identity } : {}),
  } };
}

/** Estado em data histórica: considera só eventos registrados até `knownAt`. */
export const offerStateKnownAt = (events: readonly OfferEvent[], knownAt: string) => offerState(events.filter((e) => e.at <= knownAt));

/** Oferta só recebe matrícula/turma quando publicada ou em funcionamento e vigente na data. */
export function offerAcceptsEnrollment(base: OfferIdentity, events: readonly OfferEvent[], on: string): boolean {
  const s = offerState(events);
  const id = currentIdentity(base, events);
  return (s === "publicada" || s === "funcionamento") && id.periodFrom <= on && (id.periodTo === null || on <= id.periodTo);
}

/** Duas ofertas não encerradas da mesma escola com eixos idênticos e períodos sobrepostos = conflito. */
export function offerConflicts(offers: readonly { base: OfferIdentity; events: readonly OfferEvent[] }[]): [string, string][] {
  const live = offers.filter((o) => { const s = offerState(o.events); return s && s !== "encerrada"; })
    .map((o) => currentIdentity(o.base, o.events));
  const key = (i: OfferIdentity) => i.schoolId + "|" + Object.entries(i.axes).sort().map(([k, v]) => `${k}=${v}`).join(",");
  const out: [string, string][] = [];
  for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
    const x = live[a]!, y = live[b]!;
    if (key(x) !== key(y)) continue;
    const overlap = x.periodFrom <= (y.periodTo ?? "9999") && y.periodFrom <= (x.periodTo ?? "9999");
    if (overlap) out.push([x.offerId, y.offerId]);
  }
  return out;
}
