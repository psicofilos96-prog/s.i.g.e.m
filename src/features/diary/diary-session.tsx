/**
 * B4.10.0c — fronteira de sessão do Diário (um controlador compartilhado por aba).
 *
 * - Sessão incerta (bootstrap, erro do SDK) ⇒ "incerto": nenhuma fixture, nenhum dado institucional.
 * - Sessão CONFIRMADAMENTE ausente ⇒ laboratório (único caminho até as fixtures).
 * - Conta ⇒ contexto `userId#sessionRevision`: estudantes, atuações e fatos do Diário são lidos em lote
 *   (inclusive capacidades) e aplicados juntos só se a geração que os pediu ainda for a corrente.
 * - Troca de contexto (A→B, logout, nova sessão da mesma conta) ou desmontagem da última fronteira
 *   descarta respostas pendentes, esquece meta/bases/capacidades e troca a partição de rascunhos.
 *
 * Montagens simultâneas compartilham o mesmo controlador: o mesmo contexto não recarrega nem invalida
 * o pedido em curso. Os espelhos continuam singletons globais (um contexto por vez).
 */
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useSessionUser } from "@/features/authority/session-authority";
import {
  applyInstitutionalRoster,
  markInstitutionalRosterUnavailable,
  readInstitutionalRoster,
  resetInstitutionalRoster,
} from "@/features/students/institutional-roster";
import {
  applyInstitutionalTeaching,
  readInstitutionalTeaching,
  resetInstitutionalTeaching,
} from "./institutional-teaching";
import { applyDiaryMirror, readDiaryFromCloud, resetDiaryMirror } from "./diary-cloud";
import { setDiaryPersistenceMode } from "./diary-persistence-mode";
import {
  diaryGeneration,
  diarySessionState,
  nextDiaryGeneration,
  setDiarySessionState,
  subscribeDiarySession,
  type DiarySessionState,
} from "./diary-session-state";
import { localLessonStore } from "./lesson-records";
import { attendanceStore } from "./attendance";
import { infantExperienceStore } from "./infant-experiences";
import { lessonVersionStore } from "./lesson-correction-config";
import { attendanceClosingStore } from "./attendance-closing-store";

export type DiarySessionTarget =
  | { kind: "incerto"; key: "incerto"; error?: string | undefined }
  | { kind: "laboratorio"; key: "laboratorio" }
  | { kind: "conta"; key: string; userId: string };

export function diarySessionTarget(s: {
  loading: boolean;
  user: { id: string } | null;
  revision: number;
  error?: string | undefined;
}): DiarySessionTarget {
  if (s.loading) return { kind: "incerto", key: "incerto", error: s.error };
  if (!s.user) return { kind: "laboratorio", key: "laboratorio" };
  return { kind: "conta", key: `${s.user.id}#${s.revision}`, userId: s.user.id };
}

// ---------------------------------------------------------------- partição de rascunhos

let closingPartition: string | null = "laboratorio";
let labClosing = attendanceClosingStore.snapshot();

function switchDraftPartition(next: string | null) {
  localLessonStore.switchDraftPartition(next);
  attendanceStore.switchDraftPartition(next);
  infantExperienceStore.switchDraftPartition(next);
  lessonVersionStore.switchDraftPartition(next);
  if (next !== closingPartition) {
    if (closingPartition === "laboratorio") labClosing = attendanceClosingStore.snapshot();
    attendanceClosingStore.hydrate(next === "laboratorio" ? labClosing : { workflows: {}, records: [] });
    closingPartition = next;
  }
}

function forgetInstitutionalMirrors() {
  resetDiaryMirror();
  resetInstitutionalRoster();
  resetInstitutionalTeaching();
}

// ---------------------------------------------------------------- controlador

export function enterDiaryContext(target: DiarySessionTarget) {
  const cur = diarySessionState();
  if (cur.phase !== "sem-fronteira" && cur.key === target.key) {
    if (target.kind === "incerto" && cur.error !== target.error)
      setDiarySessionState({ phase: cur.phase, key: cur.key, userId: cur.userId, ...(target.error ? { error: target.error } : {}) });
    return;
  }
  const mine = nextDiaryGeneration();
  // Ordem: modo pendente ⇒ nada visível; esquece espelhos; troca rascunhos; só então decide.
  setDiaryPersistenceMode("pendente");
  forgetInstitutionalMirrors();
  if (target.kind === "laboratorio") {
    switchDraftPartition("laboratorio");
    setDiaryPersistenceMode("laboratorio");
    setDiarySessionState({ phase: "laboratorio", key: target.key, userId: null });
    return;
  }
  if (target.kind === "incerto") {
    switchDraftPartition(null);
    setDiarySessionState({ phase: "incerto", key: target.key, userId: null, ...(target.error ? { error: target.error } : {}) });
    return;
  }
  switchDraftPartition(`conta:${target.userId}`);
  setDiarySessionState({ phase: "carregando", key: target.key, userId: target.userId });
  void loadContext(mine, target);
}

async function loadContext(mine: number, target: Extract<DiarySessionTarget, { kind: "conta" }>) {
  try {
    const [roster, teaching, diary] = await Promise.all([
      readInstitutionalRoster(),
      readInstitutionalTeaching(target.userId),
      readDiaryFromCloud(),
    ]);
    if (diaryGeneration() !== mine) return; // contexto trocado/desmontado: descarta antes de qualquer mutação
    applyInstitutionalRoster(roster);
    applyInstitutionalTeaching(teaching);
    applyDiaryMirror(diary);
    setDiarySessionState({ phase: "pronto", key: target.key, userId: target.userId });
    setDiaryPersistenceMode("cloud");
  } catch (e) {
    if (diaryGeneration() !== mine) return;
    markInstitutionalRosterUnavailable();
    setDiarySessionState({
      phase: "erro",
      key: target.key,
      userId: target.userId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Última fronteira desmontada: descarta pendências e esconde tudo (rascunhos ficam guardados). */
export function leaveDiaryContext() {
  nextDiaryGeneration();
  setDiaryPersistenceMode("pendente");
  forgetInstitutionalMirrors();
  switchDraftPartition(null);
  setDiarySessionState({ phase: "sem-fronteira", key: null, userId: null });
}

let mounted = 0;

export function useDiarySession(): DiarySessionState {
  return useSyncExternalStore(subscribeDiarySession, diarySessionState, diarySessionState);
}

/** Liga o controlador ao snapshot de sessão; compartilhado entre montagens. */
export function useDiarySessionBoundary(): { state: DiarySessionState; target: DiarySessionTarget } {
  const session = useSessionUser();
  const target = diarySessionTarget(session);
  const state = useDiarySession();
  useEffect(() => {
    mounted += 1;
    return () => {
      mounted -= 1;
      if (mounted === 0) leaveDiaryContext();
    };
  }, []);
  const error = target.kind === "incerto" ? target.error : undefined;
  useEffect(() => {
    enterDiaryContext(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.key, error]);
  return { state, target };
}

/**
 * Inicializada ANTES dos consumidores: filhos só renderizam quando o controlador já está no contexto da
 * sessão corrente e a sessão não é incerta. Incerteza nunca abre o laboratório.
 */
export function DiarySessionBoundary({ children }: { children: ReactNode }) {
  const { state, target } = useDiarySessionBoundary();
  if (state.key !== target.key || state.phase === "incerto" || state.phase === "sem-fronteira") {
    return (
      <div role="status" className="p-6 text-sm text-muted-foreground">
        {target.kind === "incerto" && target.error
          ? "Não foi possível confirmar a sua sessão. O Diário não abre o ambiente demonstrativo nem a base institucional enquanto isso não for resolvido."
          : "Conferindo a sessão…"}
      </div>
    );
  }
  return <>{children}</>;
}
