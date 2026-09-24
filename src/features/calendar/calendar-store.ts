/**
 * Repositório temporário do calendário (estado da aba, sem persistência).
 * O contrato permite trocar por persistência real sem reconstruir a interface.
 */
import { useSyncExternalStore } from "react";
import type { IsoDate } from "@/lib/academic-date";
import { calendarEvents } from "./calendar-fixtures";
import type { CalendarEvent } from "./calendar-types";

export interface CalendarRepository {
  events(calendarId: string): CalendarEvent[];
  /** Ajuste de um único dia; `null` remove o ajuste local. */
  setDayCategory(calendarId: string, date: IsoDate, categoryId: string | null): void;
  subscribe(listener: () => void): () => void;
}

export function createInMemoryCalendarRepository(seed: CalendarEvent[] = calendarEvents) {
  let events = [...seed];
  const cache = new Map<string, CalendarEvent[]>();
  const listeners = new Set<() => void>();
  const emit = () => {
    cache.clear();
    listeners.forEach((l) => l());
  };
  const repository: CalendarRepository & { reset(): void } = {
    events(calendarId) {
      let list = cache.get(calendarId);
      if (!list) {
        list = events.filter((e) => e.calendarId === calendarId);
        cache.set(calendarId, list);
      }
      return list;
    },
    setDayCategory(calendarId, date, categoryId) {
      const id = `local-${calendarId}-${date}`;
      events = events.filter((e) => e.id !== id);
      if (categoryId)
        events.push({
          id,
          calendarId,
          categoryId,
          title: "Ajuste local (não salvo)",
          start: date,
          end: date,
          local: true,
        });
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      events = [...seed];
      emit();
    },
  };
  return repository;
}

export const calendarRepository = createInMemoryCalendarRepository();

export function useCalendarEvents(calendarId: string) {
  return useSyncExternalStore(
    calendarRepository.subscribe,
    () => calendarRepository.events(calendarId),
    () => calendarRepository.events(calendarId),
  );
}
