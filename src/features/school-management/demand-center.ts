// SIGEM 2.0 — Direção, Lote 08: central de demandas escola→SEMED e comunicação institucional (núcleo puro).
// Estado é projeção de eventos append-only com seq; prazo só por SLA homologado (operations-overview.slaStatus);
// notificação só via emit_notification_event; anexos só em pasta privada; leitura nunca presumida.

export const AREAS = ["rh", "turmas", "infraestrutura", "transporte", "alimentacao", "nei", "materiais", "ti", "documentacao", "orientacao"] as const;
export type Area = (typeof AREAS)[number];
export const FLOW = ["abertura", "triagem", "encaminhamento", "execucao", "devolutiva", "confirmacao", "encerramento"] as const;
export type Step = (typeof FLOW)[number] | "devolucao";

export interface DemandEvent { seq: number; step: Step; by: string; isNaturalPerson: boolean; on: string; note?: string; assignee?: string; attachments?: string[] }
export interface Demand { id: string; schoolId: string; area: Area; urgent: boolean; urgencyReason: string | null; events: DemandEvent[] }

const NEXT: Record<Step, Step[]> = {
  abertura: ["triagem"], triagem: ["encaminhamento", "devolucao"], encaminhamento: ["execucao", "devolucao"],
  execucao: ["devolutiva"], devolutiva: ["confirmacao", "execucao"], confirmacao: ["encerramento"], encerramento: [],
  devolucao: ["abertura"], // escola complementa e reabre
};
const SCHOOL_STEPS: Step[] = ["abertura", "confirmacao"];

export function openDemand(d: Omit<Demand, "events">, by: string, isNaturalPerson: boolean, on: string, attachments: string[] = []) {
  if (!isNaturalPerson) return { ok: false as const, code: "demanda:autor-humano-obrigatorio" };
  if (!AREAS.includes(d.area)) return { ok: false as const, code: "demanda:area-desconhecida" };
  if (d.urgent && !d.urgencyReason?.trim()) return { ok: false as const, code: "demanda:urgencia-sem-justificativa" };
  const bad = attachments.find((a) => !a.startsWith(`demandas/${d.schoolId}/${d.id}/`));
  if (bad) return { ok: false as const, code: "demanda:anexo-fora-da-pasta-privada" };
  return { ok: true as const, demand: { ...d, events: [{ seq: 1, step: "abertura", by, isNaturalPerson, on, attachments }] } as Demand };
}

/** Avanço com seq esperado (concorrência), papel do lado certo (escola × SEMED), responsável no encaminhamento, motivo na devolução. */
export function advanceDemand(d: Demand, ev: Omit<DemandEvent, "seq">, expectedSeq: number, actor: { schoolId: string | null; semedArea: Area | null }) {
  const last = d.events.at(-1)!;
  if (last.seq !== expectedSeq) return { ok: false as const, code: "demanda:base-desatualizada" };
  if (!ev.isNaturalPerson) return { ok: false as const, code: "demanda:autor-humano-obrigatorio" };
  if (!NEXT[last.step].includes(ev.step)) return { ok: false as const, code: "demanda:transicao-invalida" };
  const schoolSide = SCHOOL_STEPS.includes(ev.step);
  if (schoolSide ? actor.schoolId !== d.schoolId : actor.semedArea !== d.area && !(ev.step === "triagem" && actor.semedArea))
    return { ok: false as const, code: "demanda:ator-nao-competente" };
  if (ev.step === "encaminhamento" && !ev.assignee) return { ok: false as const, code: "demanda:responsavel-obrigatorio" };
  if ((ev.step === "devolucao" || ev.step === "devolutiva") && !ev.note?.trim()) return { ok: false as const, code: "demanda:motivo-obrigatorio" };
  return { ok: true as const, demand: { ...d, events: [...d.events, { ...ev, seq: last.seq + 1 }] } as Demand,
    notify: { event_kind: `demanda.${ev.step}`, idempotency_key: `${d.id}:${last.seq + 1}` } };
}

export const currentStep = (d: Demand) => d.events.at(-1)!.step;

// ── Comunicação institucional ──
export const AUDIENCES = ["secretaria", "orientacao", "docente", "supervisao", "estatistica", "acompanhamento-avaliacao", "familia"] as const;
export type Audience = (typeof AUDIENCES)[number];
export interface Delivery { recipientId: string; sentAt: string | null; deliveredAt: string | null; readAt: string | null }

/** Família só com autorização vigente na seção comunicados; demais só com atuação vigente na escola. */
export function resolveRecipients(audience: Audience, candidates: { id: string; engagementActive?: boolean; guardianAuthorizedComunicados?: boolean }[]) {
  return candidates.filter((c) => (audience === "familia" ? c.guardianAuthorizedComunicados === true : c.engagementActive === true)).map((c) => c.id);
}

/** Estado por destinatário: lido só com confirmação explícita; entregue só com recibo do canal. */
export function deliveryState(d: Delivery) {
  if (d.readAt) return "lido" as const;
  if (d.deliveredAt) return "entregue" as const;
  if (d.sentAt) return "enviado" as const;
  return "pendente" as const;
}
export function recordRead(d: Delivery, by: string, at: string) {
  if (by !== d.recipientId) return { ok: false as const, code: "comunicacao:leitura-so-do-destinatario" };
  return { ok: true as const, delivery: { ...d, readAt: d.readAt ?? at } };
}
