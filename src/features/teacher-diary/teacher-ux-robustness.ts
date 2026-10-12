/**
 * LOTE 18 — UX e robustez da operação diária (núcleo puro).
 * - Estado de gravação: "Salvo" só após confirmação do servidor com versão; timeout/erro
 *   nunca vira salvo; conflito é explícito.
 * - Guarda de envio: uma chave idempotente por tentativa; clique repetido não duplica.
 * - Rascunho: recuperação só se pertence à mesma conta, ao mesmo contexto e à mesma base.
 * - Turmas grandes: janela de renderização fixa (sem carregar tudo no DOM).
 * - Estados de tela: permissão → erro → carregando → vazio → pronto, nessa precedência.
 */

export type SaveStatus =
  | { kind: "idle" } | { kind: "dirty" } | { kind: "sending"; key: string }
  | { kind: "saved"; version: number; confirmedAt: string }
  | { kind: "conflict"; serverVersion: number } | { kind: "failed"; message: string }
  | { kind: "unknown"; key: string };

export type SaveEvent =
  | { type: "edit" } | { type: "send"; key: string }
  | { type: "confirmed"; key: string; version: number; at: string }
  | { type: "conflict"; key: string; serverVersion: number }
  | { type: "error"; key: string; message: string } | { type: "timeout"; key: string };

export function saveReducer(s: SaveStatus, e: SaveEvent): SaveStatus {
  if (e.type === "edit") return s.kind === "sending" ? s : { kind: "dirty" };
  if (e.type === "send") return s.kind === "sending" ? s : { kind: "sending", key: e.key };
  // respostas de outra tentativa são ignoradas
  const k = s.kind === "sending" || s.kind === "unknown" ? s.key : null;
  if (k !== e.key) return s;
  if (e.type === "confirmed") {
    if (!Number.isInteger(e.version) || e.version < 1 || !e.at) return { kind: "unknown", key: e.key };
    return { kind: "saved", version: e.version, confirmedAt: e.at };
  }
  if (e.type === "conflict") return { kind: "conflict", serverVersion: e.serverVersion };
  if (e.type === "error") return { kind: "failed", message: e.message };
  return { kind: "unknown", key: e.key };
}

export function saveLabel(s: SaveStatus): string {
  switch (s.kind) {
    case "idle": return "Nenhuma alteração";
    case "dirty": return "Alterações ainda não enviadas";
    case "sending": return "Enviando…";
    case "saved": return `Salvo (versão ${s.version})`;
    case "conflict": return "Outra pessoa alterou antes: recarregue para conferir";
    case "failed": return `Não foi salvo: ${s.message}`;
    case "unknown": return "Sem confirmação do servidor: confira antes de reenviar";
  }
}

export const canSubmit = (s: SaveStatus) => s.kind === "dirty" || s.kind === "failed";
/** Reenvio após resultado desconhecido reutiliza a MESMA chave, para o servidor deduplicar. */
export const retryKey = (s: SaveStatus, fresh: () => string) => (s.kind === "unknown" ? s.key : fresh());

export interface DraftEnvelope<T> { accountId: string; contextKey: string; baseVersion: number | null; savedAt: string; payload: T }
export function recoverDraft<T>(raw: string | null, accountId: string, contextKey: string, currentBase: number | null):
  { draft: DraftEnvelope<T> | null; stale: boolean } {
  if (!raw) return { draft: null, stale: false };
  let d: DraftEnvelope<T>;
  try { d = JSON.parse(raw); } catch { return { draft: null, stale: false }; }
  if (!d || d.accountId !== accountId || d.contextKey !== contextKey) return { draft: null, stale: false };
  return d.baseVersion === currentBase ? { draft: d, stale: false } : { draft: null, stale: true };
}

export function renderWindow(total: number, scrollTop: number, rowHeight: number, viewport: number, overscan = 5) {
  if (total <= 0 || rowHeight <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(total, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return { start, end, padTop: start * rowHeight, padBottom: (total - end) * rowHeight };
}

export type ScreenState = "sem-permissao" | "erro" | "carregando" | "vazio" | "pronto";
export function screenState(p: { allowed: boolean | null; error: boolean; loading: boolean; rows: number | null }): ScreenState {
  if (p.allowed === false) return "sem-permissao";
  if (p.error) return "erro";
  if (p.loading || p.allowed === null || p.rows === null) return "carregando";
  return p.rows === 0 ? "vazio" : "pronto";
}

/** Alvo de toque mínimo por dispositivo (px). */
export const touchTarget = (device: "desktop" | "tablet" | "celular") => (device === "desktop" ? 32 : 44);
