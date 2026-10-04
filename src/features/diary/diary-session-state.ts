/**
 * B4.10.0c — estado compartilhado do contexto de sessão do Diário (sem dependências).
 *
 * Um único controlador por aba (diary-session.ts) escreve aqui; leitura e escrita do Diário consultam
 * o contexto aceito. `generation` cresce a cada troca de contexto ou releitura: resposta de geração
 * antiga é descartada antes de QUALQUER mutação de espelho global.
 */
export type DiarySessionPhase = "sem-fronteira" | "incerto" | "laboratorio" | "carregando" | "pronto" | "erro";

export type DiarySessionState = {
  phase: DiarySessionPhase;
  /** `userId#sessionRevision` (chave de contexto; nunca filtro de banco), "laboratorio", "incerto" ou null. */
  key: string | null;
  userId: string | null;
  error?: string;
  /** B4.10.0d — referência de consulta do lote aceito/pedido (data civil + instante único). */
  reference?: DiaryReference;
};

/** B4.10.0d — data de consulta e instante de conhecimento capturados UMA vez por lote. */
export type DiaryReference = { validOn: string; knownAt: string; source: "informada" | "hoje-operacional"; operationalToday: string };

let state: DiarySessionState = { phase: "sem-fronteira", key: null, userId: null };
let generation = 0;
const listeners = new Set<() => void>();

export function diarySessionState(): DiarySessionState {
  return state;
}
export function setDiarySessionState(next: DiarySessionState) {
  state = next;
  for (const l of [...listeners]) l();
}
export function subscribeDiarySession(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function diaryGeneration() {
  return generation;
}
export function nextDiaryGeneration() {
  return ++generation;
}

/** Contexto de escrita institucional: só com espelho aceito para a sessão corrente. */
export type DiaryWriteContext = { key: string; userId: string };
export function diaryWriteContext(): DiaryWriteContext | null {
  return state.phase === "pronto" && state.key && state.userId ? { key: state.key, userId: state.userId } : null;
}
export function isCurrentDiaryContext(ctx: DiaryWriteContext) {
  return state.phase === "pronto" && state.key === ctx.key;
}

/** B4.10.0d — referência do contexto institucional corrente (carregando/pronto); laboratório ⇒ null. */
export function diaryReference(): DiaryReference | null {
  return state.reference ?? null;
}
