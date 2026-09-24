/**
 * Repositório em memória do calendário da rede (estado temporário da aba).
 * Contrato pensado para ser trocado por persistência sem refazer a interface.
 * Não existe operação por escola: a unidade apenas resolve o calendário
 * central de (ano letivo, modalidade).
 */
import { useSyncExternalStore } from "react";
import { createCalendarFixtures } from "./calendar-fixtures";
import {
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
  subscribe(fn: () => void): () => void;
};

export function createInMemoryCalendarRepository(
  seed: NetworkCalendar[] = createCalendarFixtures(),
): CalendarRepository {
  let items = [...seed];
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
      return cal ? replace(transitionCalendar(cal, actor, t, opts)) : missing;
    },
    duplicate: (id, year, actor) => {
      const cal = items.find((c) => c.id === id);
      return cal ? replace(duplicateCalendar(cal, year, actor, items)) : missing;
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const calendarRepository = createInMemoryCalendarRepository();

export function useNetworkCalendars(repo: CalendarRepository = calendarRepository) {
  return useSyncExternalStore(repo.subscribe, repo.list, repo.list);
}
