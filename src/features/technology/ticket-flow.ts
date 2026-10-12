// Tecnologia L05 — fluxo do chamado (migration 0479). Etapa é PROJEÇÃO de dois ledgers append-only:
// ops_request_events (atribuição, atendimento, espera, conclusão, cancelamento, reabertura) e tech_ticket_reviews
// (triagem, verificação aceita/recusada). Verificação só após conclusão e por pessoa ≠ quem concluiu; recusa
// devolve à reabertura, nunca "desconclui" em silêncio.
import { projectRequest, type OpsEvent } from "@/features/operations-center/shared-requests";

export type ReviewKind = "triagem" | "verificacao-aceita" | "verificacao-recusada";
export interface Review { seq: number; kind: ReviewKind; conclusionSeq: number | null; personId: string; at: string; note: string }
export type Stage = "aguardando-triagem" | "triado" | "atribuido" | "em-atendimento" | "em-espera"
  | "aguardando-verificacao" | "verificacao-recusada" | "concluido-verificado" | "cancelado";

const lifecycle = (es: readonly OpsEvent[]) => [...es].filter((e) => ["atribuicao", "inicio", "espera", "conclusao", "cancelamento", "reabertura"].includes(e.kind)).sort((a, b) => a.seq - b.seq);

export function ticketStage(events: readonly OpsEvent[], reviews: readonly Review[]): Stage {
  const p = projectRequest(events);
  const last = lifecycle(events).at(-1);
  if (p.state === "cancelada") return "cancelado";
  if (p.state === "concluida" && last) {
    const v = reviews.find((r) => r.kind !== "triagem" && r.conclusionSeq === last.seq);
    return !v ? "aguardando-verificacao" : v.kind === "verificacao-aceita" ? "concluido-verificado" : "verificacao-recusada";
  }
  if (p.state === "em-atendimento") return "em-atendimento";
  if (p.state === "em-espera") return "em-espera";
  if (p.state === "atribuida") return "atribuido";
  const since = last?.kind === "reabertura" ? last.at : "";
  return reviews.some((r) => r.kind === "triagem" && r.at >= since) ? "triado" : "aguardando-triagem";
}

export function reviewProblem(i: { kind: ReviewKind; events: readonly OpsEvent[]; actor: string }): string | null {
  const last = lifecycle(i.events).at(-1);
  if (i.kind === "triagem") return last && last.kind !== "reabertura" ? "triagem-fora-de-hora" : null;
  if (last?.kind !== "conclusao") return "nao-concluido";
  return last.actorPerson === i.actor ? "verificador-igual-executor" : null;
}

/** Histórico único em ordem temporal, sem fundir nem reescrever os ledgers. */
export function ticketHistory(events: readonly OpsEvent[], reviews: readonly Review[]) {
  return [
    ...events.map((e) => ({ at: e.at, source: "atendimento" as const, kind: e.kind, person: e.actorPerson, note: e.note ?? null })),
    ...reviews.map((r) => ({ at: r.at, source: "revisao" as const, kind: r.kind, person: r.personId, note: r.note })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
