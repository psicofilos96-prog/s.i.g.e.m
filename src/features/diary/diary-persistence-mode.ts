/**
 * Modo de persistência do Diário.
 *
 * - "laboratorio": sem sessão. Fixtures demonstrativas + memória da aba.
 * - "cloud": com sessão. Fatos oficiais vêm SOMENTE do banco (espelho
 *   hidratado); fixtures ficam invisíveis e nada de laboratório é gravado.
 *   Rascunhos continuam só na aba, porque rascunho não é fato oficial.
 */
import { useSyncExternalStore } from "react";

export type DiaryPersistenceMode = "laboratorio" | "cloud";

let mode: DiaryPersistenceMode = "laboratorio";
const listeners = new Set<() => void>();

export function diaryPersistenceMode(): DiaryPersistenceMode {
  return mode;
}

export function isDiaryCloud() {
  return mode === "cloud";
}

export function setDiaryPersistenceMode(next: DiaryPersistenceMode) {
  if (next === mode) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

export function subscribeDiaryPersistenceMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDiaryPersistenceMode(): DiaryPersistenceMode {
  return useSyncExternalStore(subscribeDiaryPersistenceMode, diaryPersistenceMode, () => "laboratorio");
}
