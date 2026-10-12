import { describe, it, expect } from "vitest";
import { saveReducer, saveLabel, canSubmit, retryKey, recoverDraft, renderWindow, screenState, type SaveStatus } from "./teacher-ux-robustness";

describe("L18 UX e robustez", () => {
  it("só mostra Salvo após confirmação do servidor com versão", () => {
    let s: SaveStatus = saveReducer({ kind: "idle" }, { type: "edit" });
    s = saveReducer(s, { type: "send", key: "k1" });
    expect(saveLabel(s)).toBe("Enviando…");
    expect(saveReducer(s, { type: "timeout", key: "k1" }).kind).toBe("unknown");
    expect(saveReducer(s, { type: "confirmed", key: "k1", version: 0, at: "x" }).kind).toBe("unknown");
    expect(saveReducer(s, { type: "confirmed", key: "outra", version: 3, at: "x" })).toEqual(s);
    expect(saveLabel(saveReducer(s, { type: "confirmed", key: "k1", version: 3, at: "t" }))).toBe("Salvo (versão 3)");
  });
  it("não duplica envio e reenvio após incerteza usa a mesma chave", () => {
    const sending: SaveStatus = { kind: "sending", key: "k1" };
    expect(canSubmit(sending)).toBe(false);
    expect(saveReducer(sending, { type: "send", key: "k2" })).toEqual(sending);
    expect(retryKey({ kind: "unknown", key: "k1" }, () => "nova")).toBe("k1");
    expect(saveReducer(sending, { type: "conflict", key: "k1", serverVersion: 4 }).kind).toBe("conflict");
  });
  it("rascunho só volta para a mesma conta, contexto e base", () => {
    const raw = JSON.stringify({ accountId: "u1", contextKey: "aula:1", baseVersion: 2, savedAt: "t", payload: { a: 1 } });
    expect(recoverDraft(raw, "u1", "aula:1", 2).draft).not.toBeNull();
    expect(recoverDraft(raw, "u2", "aula:1", 2).draft).toBeNull();
    expect(recoverDraft(raw, "u1", "aula:1", 3)).toEqual({ draft: null, stale: true });
    expect(recoverDraft("{lixo", "u1", "aula:1", 2).draft).toBeNull();
  });
  it("turma grande renderiza só a janela visível", () => {
    const w = renderWindow(2000, 4400, 44, 880);
    expect(w.end - w.start).toBeLessThan(40);
    expect(w.padTop + (w.end - w.start) * 44 + w.padBottom).toBe(2000 * 44);
  });
  it("permissão antes de dado; não lido nunca é vazio", () => {
    expect(screenState({ allowed: false, error: true, loading: true, rows: 0 })).toBe("sem-permissao");
    expect(screenState({ allowed: true, error: false, loading: false, rows: null })).toBe("carregando");
    expect(screenState({ allowed: true, error: false, loading: false, rows: 0 })).toBe("vazio");
  });
});
