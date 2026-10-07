// Ciclo da avaliação (N6.2.1). Espelho puro da regra gravada no banco
// (record_assessment_edition_cycle_event): a tela só projeta; o banco decide.
export const CYCLE_STATES = ["planejada", "preparada", "em-aplicacao", "recebida", "validada", "publicada", "arquivada"] as const;
export type CycleState = (typeof CYCLE_STATES)[number];

export const CYCLE_LABEL: Record<CycleState, string> = {
  planejada: "Planejada", preparada: "Preparada", "em-aplicacao": "Em aplicação",
  recebida: "Recebida", validada: "Validada", publicada: "Publicada", arquivada: "Arquivada",
};

export interface CycleEvent { seq: number; from_state: string | null; to_state: string; note: string | null; recorded_at: string }

/** Estado vigente = último evento; sem evento não há estado (nunca "planejada" presumida). */
export function currentCycleState(events: readonly CycleEvent[]): CycleState | null {
  const last = [...events].sort((a, b) => a.seq - b.seq).at(-1);
  return last ? (last.to_state as CycleState) : null;
}

export function nextCycleState(current: CycleState | null): CycleState | null {
  if (current === null) return "planejada";
  const i = CYCLE_STATES.indexOf(current);
  return i < CYCLE_STATES.length - 1 ? CYCLE_STATES[i + 1]! : null;
}

export function expectedHead(events: readonly CycleEvent[]): number {
  return events.reduce((m, e) => Math.max(m, e.seq), 0);
}
