/**
 * B4.6.10 — Estado da leitura do calendário central para as telas originais. Uma leitura por repositório;
 * erro fica visível (sem fallback silencioso para a cópia local).
 */
import { useEffect, useSyncExternalStore } from "react";
import { readCentralCalendars, type CentralEntry, type CentralRead, type Rpc } from "./calendar-central";
import type { CalendarRepository } from "./calendar-store";

export type CentralState =
  | { status: "lendo" }
  | { status: "erro"; message: string }
  | { status: "lido"; read: CentralRead };

type Slot = { state: CentralState; listeners: Set<() => void>; started: boolean };
const slots = new WeakMap<CalendarRepository, Slot>();
const slotOf = (repo: CalendarRepository): Slot => {
  let s = slots.get(repo);
  if (!s) { s = { state: { status: "lendo" }, listeners: new Set(), started: false }; slots.set(repo, s); }
  return s;
};
const set = (repo: CalendarRepository, st: CentralState) => { const s = slotOf(repo); s.state = st; s.listeners.forEach((l) => l()); };

export async function loadCentral(repo: CalendarRepository, rpc?: Rpc): Promise<CentralState> {
  const s = slotOf(repo);
  s.started = true;
  try {
    const read = await readCentralCalendars(rpc);
    if (read.kind === "lido" && read.entries.length) repo.adoptCentral?.(read.entries.map((e) => e.calendar));
    set(repo, { status: "lido", read });
  } catch (e) {
    set(repo, { status: "erro", message: e instanceof Error ? e.message : "Leitura do banco falhou." });
  }
  return slotOf(repo).state;
}

export function centralEntryOf(state: CentralState, calendarId: string): CentralEntry | null {
  return state.status === "lido" && state.read.kind === "lido" ? state.read.entries.find((e) => e.sourceKey === calendarId) ?? null : null;
}

/** Lê o central uma vez (quando `enabled`) e acompanha o estado. */
export function useCentralState(repo: CalendarRepository, enabled: boolean): CentralState | null {
  useEffect(() => { if (enabled && !slotOf(repo).started) void loadCentral(repo); }, [repo, enabled]);
  const s = slotOf(repo);
  const snap = () => (enabled ? slotOf(repo).state : null);
  return useSyncExternalStore((fn) => { s.listeners.add(fn); return () => s.listeners.delete(fn); }, snap, snap);
}
