// Matrículas L16 — estados da reserva são projeção (migration 0469: enr_seat_holds); nunca gravados.
// Prazo só por regra aprovada (maior versão aprovada da campanha; aprovador ≠ autor); sem regra ⇒ nenhuma reserva.
// Ocupação canônica é única: `occupancy` de seat-concurrency.ts (espelho de enr_seat_occupancy).
import { occupancy, type SeatPool } from "./seat-concurrency";

export type HoldState = "ativa" | "confirmada" | "expirada" | "cancelada";
export type HoldOrigin = "distribuicao" | "lista-de-espera" | "transferencia";

export interface HoldRule { version: number; holdMinutes: number; authorPerson: string; approverPerson: string | null }

export function currentRule(rules: HoldRule[]): HoldRule | null {
  return [...rules].filter((r) => r.approverPerson && r.approverPerson !== r.authorPerson)
    .sort((a, b) => b.version - a.version)[0] ?? null;
}

export function holdState(p: SeatPool, holdId: string, now: number): HoldState | null {
  const r = p.events.find((e) => e.kind === "reservar" && e.holdId === holdId);
  if (!r || r.kind !== "reservar") return null;
  const c = p.events.find((e) => e.holdId === holdId && e.kind !== "reservar");
  if (c?.kind === "confirmar") return "confirmada";
  if (c?.kind === "liberar") return "cancelada";
  return r.expiresAt <= now ? "expirada" : "ativa";
}

/** Ocupação = ativas + confirmadas; expiradas e canceladas nunca contam. Reusa a contagem canônica. */
export function occupiedByStates(p: SeatPool, now: number): number {
  return occupancy(p, now);
}

/** Liberação controlada: só de reserva ativa, com motivo ≥10 chars (banco exige o mesmo + capability). */
export function canRelease(state: HoldState | null, reason: string): string | null {
  if (state !== "ativa") return "so-reserva-ativa-pode-ser-liberada";
  if (reason.trim().length < 10) return "motivo-obrigatorio";
  return null;
}

export const HOLD_STATE_PT: Record<HoldState, string> = {
  ativa: "Reservada — aguardando confirmação no prazo",
  confirmada: "Confirmada",
  expirada: "Prazo vencido — vaga liberada",
  cancelada: "Liberada por decisão registrada",
};
