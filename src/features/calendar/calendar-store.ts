/**
 * Repositório em memória do calendário da rede (estado temporário da aba).
 * Contrato pensado para ser trocado por persistência sem refazer a interface.
 * Não existe operação por escola: a unidade apenas resolve o calendário
 * central de (ano letivo, modalidade).
 */
import { useEffect, useSyncExternalStore } from "react";
import { createCalendarFixtures } from "./calendar-fixtures";
import {
  deleteCalendar,
  duplicateCalendar,
  mutateCalendar,
  transitionCalendar,
  type CalendarMutation,
  type MutationResult,
  type Transition,
} from "./calendar-governance";
import type { CalendarActor, CalendarModality, NetworkCalendar } from "./calendar-types";

export type CalendarRepository = {
  list(): NetworkCalendar[];
  get(id: string): NetworkCalendar | undefined;
  forYear(academicYearId: string, modality: CalendarModality): NetworkCalendar | undefined;
  mutate(id: string, actor: CalendarActor, m: CalendarMutation): MutationResult;
  transition(
    id: string,
    actor: CalendarActor,
    t: Transition,
    opts?: { confirmCritical?: boolean },
  ): MutationResult;
  duplicate(id: string, targetYear: number, actor: CalendarActor): MutationResult;
  /** Exclui definitivamente um calendário em rascunho (ex.: cópia por engano). */
  remove(id: string, actor: CalendarActor): MutationResult;
  /** Há alterações do rascunho ainda não salvas? */
  hasUnsavedChanges(id: string): boolean;
  /** Confirma as alterações em edição como a versão salva do rascunho. */
  save(id: string): MutationResult;
  /** Descarta as alterações em edição, voltando à última versão salva. */
  discard(id: string): MutationResult;
  subscribe(fn: () => void): () => void;
  /** Carrega as versões salvas do armazenamento do navegador (uma vez). */
  hydrate(): void;
};

/** Armazenamento das versões salvas (no navegador: localStorage). */
export type CalendarStorage = {
  load(): NetworkCalendar[] | null;
  store(calendars: NetworkCalendar[]): void;
};

const STORAGE_KEY = "sigem.calendarios.v1";
export const browserCalendarStorage: CalendarStorage = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as NetworkCalendar[]) : null;
    } catch {
      return null;
    }
  },
  store(calendars) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(calendars));
    } catch {
      /* armazenamento indisponível: mantém em memória */
    }
  },
};

export function createInMemoryCalendarRepository(
  seed: NetworkCalendar[] = createCalendarFixtures(),
  storage?: CalendarStorage,
): CalendarRepository {
  let hydrated = !storage;
  const persist = () => storage?.store([...saved.values()]);
  let items = [...seed];
  // Última versão salva de cada calendário; `items` é a cópia em edição.
  const saved = new Map(seed.map((c) => [c.id, c]));
  const dirty = (id: string) => {
    const cur = items.find((c) => c.id === id);
    return !!cur && saved.get(id) !== cur;
  };
  const unsaved: MutationResult = {
    ok: false,
    reason: "Há alterações não salvas. Salve ou descarte antes de continuar.",
  };
  const commit = (res: MutationResult) => {
    if (res.ok) {
      saved.set(res.calendar.id, res.calendar);
      persist();
    }
    return replace(res);
  };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const replace = (res: MutationResult) => {
    if (res.ok) {
      const exists = items.some((c) => c.id === res.calendar.id);
      items = exists
        ? items.map((c) => (c.id === res.calendar.id ? res.calendar : c))
        : [...items, res.calendar];
      emit();
    }
    return res;
  };
  const missing: MutationResult = { ok: false, reason: "Calendário não encontrado." };
  return {
    list: () => items,
    get: (id) => items.find((c) => c.id === id),
    forYear: (y, m) => items.find((c) => c.academicYearId === y && c.modality === m),
    mutate: (id, actor, m) => {
      const cal = items.find((c) => c.id === id);
      return cal ? replace(mutateCalendar(cal, actor, m)) : missing;
    },
    transition: (id, actor, t, opts) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      if (dirty(id)) return unsaved;
      return commit(transitionCalendar(cal, actor, t, opts));
    },
    duplicate: (id, year, actor) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      if (dirty(id)) return unsaved;
      return commit(duplicateCalendar(cal, year, actor, items));
    },
    remove: (id, actor) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      const check = deleteCalendar(cal, actor);
      if (!check.ok) return check;
      items = items.filter((c) => c.id !== id);
      saved.delete(id);
      persist();
      emit();
      return { ok: true, calendar: cal } as MutationResult;
    },
    hasUnsavedChanges: dirty,
    save: (id) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      saved.set(id, cal);
      persist();
      emit();
      return { ok: true, calendar: cal } as MutationResult;
    },
    discard: (id) => {
      const prev = saved.get(id);
      if (!prev) return missing;
      return replace({ ok: true, calendar: prev } as MutationResult);
    },
    hydrate: () => {
      if (hydrated) return;
      hydrated = true;
      const stored = storage?.load();
      if (!stored?.length) return;
      for (const c of stored) saved.set(c.id, c);
      const ids = new Set(items.map((c) => c.id));
      items = [
        ...items.map((c) => saved.get(c.id) ?? c),
        ...stored.filter((c) => !ids.has(c.id)),
      ];
      emit();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const calendarRepository = createInMemoryCalendarRepository(
  createCalendarFixtures(),
  browserCalendarStorage,
);

export function useNetworkCalendars(repo: CalendarRepository = calendarRepository) {
  useEffect(() => repo.hydrate(), [repo]);
  return useSyncExternalStore(repo.subscribe, repo.list, repo.list);
}

export function useUnsavedChanges(id: string, repo: CalendarRepository = calendarRepository) {
  const snap = () => repo.hasUnsavedChanges(id);
  return useSyncExternalStore(repo.subscribe, snap, snap);
}
