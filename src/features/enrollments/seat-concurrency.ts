// Matrículas L15 — espelho puro do contrato de concorrência das vagas (migration 0468).
// O banco é a garantia: toda escrita trava a linha do quadro (FOR UPDATE), reconta a ocupação no ato e é idempotente por chave.
// Este núcleo reproduz a mesma regra para a tela e para testes; nunca grava nada.

export type SeatEvent =
  | { kind: "reservar"; holdId: string; applicationId: string; expiresAt: number; personId: string; key: string }
  | { kind: "confirmar" | "liberar"; holdId: string; personId: string; key: string };

export interface SeatPool { authorized: number | null; events: SeatEvent[] }

export type SeatResult = { ok: true; pool: SeatPool; holdId?: string; replay?: boolean } | { ok: false; reason: string };

const closed = (p: SeatPool, h: string, k: "confirmar" | "liberar" | "any") =>
  p.events.some((e) => e.holdId === h && (k === "any" ? e.kind !== "reservar" : e.kind === k));

export function occupancy(p: SeatPool, now: number): number {
  return p.events.filter((e): e is Extract<SeatEvent, { kind: "reservar" }> => e.kind === "reservar")
    .filter((r) => !closed(p, r.holdId, "liberar") && (closed(p, r.holdId, "confirmar") || r.expiresAt > now)).length;
}

export function reserve(p: SeatPool, a: { holdId: string; applicationId: string; minutes: number; personId: string; key: string }, now: number): SeatResult {
  const prev = p.events.find((e) => e.key === a.key);
  if (prev) return { ok: true, pool: p, holdId: prev.holdId, replay: true };
  if (a.minutes < 1 || a.minutes > 43200) return { ok: false, reason: "prazo-invalido" };
  if (p.authorized === null) return { ok: false, reason: "capacidade-nao-autorizada" };
  const active = p.events.some((e) => e.kind === "reservar" && e.applicationId === a.applicationId
    && !closed(p, e.holdId, "liberar") && (closed(p, e.holdId, "confirmar") || e.expiresAt > now));
  if (active) return { ok: false, reason: "pedido-ja-tem-vaga" };
  if (occupancy(p, now) >= p.authorized) return { ok: false, reason: "sem-vaga" };
  const ev: SeatEvent = { kind: "reservar", holdId: a.holdId, applicationId: a.applicationId, expiresAt: now + a.minutes * 60_000, personId: a.personId, key: a.key };
  return { ok: true, pool: { ...p, events: [...p.events, ev] }, holdId: a.holdId };
}

export function close(p: SeatPool, a: { holdId: string; kind: "confirmar" | "liberar"; personId: string; key: string }, now: number): SeatResult {
  if (p.events.some((e) => e.key === a.key)) return { ok: true, pool: p, replay: true };
  const r = p.events.find((e) => e.kind === "reservar" && e.holdId === a.holdId);
  if (!r || r.kind !== "reservar") return { ok: false, reason: "reserva-inexistente" };
  if (closed(p, a.holdId, "any")) return { ok: false, reason: "reserva-encerrada" };
  if (a.kind === "confirmar") {
    if (r.expiresAt <= now) return { ok: false, reason: "reserva-vencida" };
    if (r.personId === a.personId) return { ok: false, reason: "confirmador-igual-reservante" };
    if (p.authorized === null || occupancy(p, now) > p.authorized) return { ok: false, reason: "sem-vaga" };
  }
  return { ok: true, pool: { ...p, events: [...p.events, { kind: a.kind, holdId: a.holdId, personId: a.personId, key: a.key }] } };
}

export function changeCapacity(p: SeatPool, authorized: number, now: number): SeatResult {
  if (authorized < 0) return { ok: false, reason: "capacidade-invalida" };
  if (authorized < occupancy(p, now)) return { ok: false, reason: "capacidade-abaixo-da-ocupacao" };
  return { ok: true, pool: { ...p, authorized } };
}

export const SEAT_REASON_PT: Record<string, string> = {
  "sem-vaga": "Não há vaga livre nesta escola, etapa e modalidade agora.",
  "pedido-ja-tem-vaga": "Este pedido já tem uma vaga reservada ou confirmada.",
  "reserva-vencida": "O prazo da reserva acabou; a vaga voltou a ficar livre.",
  "reserva-encerrada": "Esta reserva já foi confirmada ou liberada.",
  "confirmador-igual-reservante": "Quem reservou não pode confirmar a mesma reserva.",
  "capacidade-abaixo-da-ocupacao": "A nova capacidade é menor que as vagas já ocupadas.",
  "capacidade-nao-autorizada": "Esta célula ainda não tem capacidade autorizada por ato.",
  "distribuicao-nao-publicada": "A distribuição desta campanha ainda não foi publicada.",
  "versao-desatualizada": "Outra pessoa alterou o quadro antes; recarregue e tente de novo.",
};
