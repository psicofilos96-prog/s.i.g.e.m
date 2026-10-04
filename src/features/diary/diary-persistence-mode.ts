/**
 * Modo de persistência do Diário.
 *
 * - "laboratorio": sessão CONFIRMADAMENTE ausente. Fixtures demonstrativas + memória da aba.
 * - "pendente": B4.10.0c — sessão incerta, espelho institucional carregando ou com erro. Nenhuma
 *   fixture e nenhum dado institucional aparecem; escritas institucionais são recusadas.
 * - "cloud": espelho institucional ACEITO para o contexto de sessão corrente (diary-session.ts).
 *   Fatos oficiais vêm SOMENTE do banco; rascunhos continuam só na memória da aba.
 *
 * O valor inicial do módulo é "laboratorio" apenas para testes de unidade sem fronteira; no app,
 * `DiarySessionBoundary` (rota /diario) define o modo antes de renderizar qualquer consumidor.
 */
import { useSyncExternalStore } from "react";

export type DiaryPersistenceMode = "laboratorio" | "pendente" | "cloud";

let mode: DiaryPersistenceMode = "laboratorio";
const listeners = new Set<() => void>();

export function diaryPersistenceMode(): DiaryPersistenceMode {
  return mode;
}

/** Fora do laboratório (pendente ou institucional): fixtures nunca aparecem. */
export function isDiaryCloud() {
  return mode !== "laboratorio";
}

/** Espelho institucional aceito para o contexto corrente. */
export function isDiaryMirrorReady() {
  return mode === "cloud";
}

export function setDiaryPersistenceMode(next: DiaryPersistenceMode) {
  if (next === mode) return;
  mode = next;
  [...listeners].forEach((listener) => listener());
}

export function subscribeDiaryPersistenceMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDiaryPersistenceMode(): DiaryPersistenceMode {
  return useSyncExternalStore(subscribeDiaryPersistenceMode, diaryPersistenceMode, () => "pendente");
}
