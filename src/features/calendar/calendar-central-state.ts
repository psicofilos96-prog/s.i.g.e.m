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

type Slot = { state: CentralState; listeners: Set<() => void>; started: boolean; request: number; lastRead: CentralRead | null };
const slots = new WeakMap<CalendarRepository, Slot>();
const slotOf = (repo: CalendarRepository): Slot => {
  let s = slots.get(repo);
  if (!s) { s = { state: { status: "lendo" }, listeners: new Set(), started: false, request: 0, lastRead: null }; slots.set(repo, s); }
  return s;
};
const set = (repo: CalendarRepository, st: CentralState) => { const s = slotOf(repo); s.state = st; s.listeners.forEach((l) => l()); };

export async function loadCentral(repo: CalendarRepository, rpc?: Rpc): Promise<CentralState> {
  const s = slotOf(repo);
  s.started = true;
  const request = ++s.request;
  try {
    let read = await readCentralCalendars(rpc);
    if (request !== s.request) return s.state;
    if (read.kind === "lido") {
      const incoming = read.entries;
      const previous = s.lastRead?.kind === "lido" ? s.lastRead.entries : [];
      // Recarregar após salvar outro calendário não pode apagar uma edição aberta nem atualizar
      // silenciosamente sua base esperada. Uma base antiga continua sendo recusada pelo servidor.
      const editable = read.audience === "construcao";
      const pristine = incoming.filter((e) => !editable || !repo.hasUnsavedChanges(e.calendar.id));
      repo.adoptCentral?.(pristine.map((e) => e.calendar), !editable);
      // Rascunho do navegador sem leitura anterior nesta sessão (ex.: após recarregar): a entrada do
      // banco é mantida (base = última versão salva), só o conteúdo da tela não é substituído. Descartar a
      // entrada fazia o salvamento ir sem base e sem os IDs de período do banco, e o servidor recusava.
      read = { ...read, entries: incoming.map((e) => {
        if (!editable || !repo.hasUnsavedChanges(e.calendar.id)) return e;
        return previous.find((p) => p.sourceKey === e.sourceKey) ?? e;
      }) };
    }
    s.lastRead = read;
    set(repo, { status: "lido", read });
  } catch (e) {
    if (request !== s.request) return s.state;
    set(repo, { status: "erro", message: e instanceof Error ? e.message : "Leitura do banco falhou." });
  }
  return slotOf(repo).state;
}

export function centralEntryOf(state: CentralState, calendarId: string): CentralEntry | null {
  return state.status === "lido" && state.read.kind === "lido" ? state.read.entries.find((e) => e.sourceKey === calendarId) ?? null : null;
}

/** Lê o central uma vez (quando `enabled`) e acompanha o estado. */
export function useCentralState(repo: CalendarRepository, enabled: boolean): CentralState | null {
  useEffect(() => {
    if (!enabled) return;
    if (!slotOf(repo).started) void loadCentral(repo);
    const refresh = () => { if (document.visibilityState === "visible") void loadCentral(repo); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [repo, enabled]);
  const s = slotOf(repo);
  const snap = () => (enabled ? slotOf(repo).state : null);
  return useSyncExternalStore((fn) => { s.listeners.add(fn); return () => s.listeners.delete(fn); }, snap, snap);
}
