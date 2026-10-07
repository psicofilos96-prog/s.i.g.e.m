import { describe, expect, it, vi } from "vitest";
import { createAutosave } from "./autosave-controller";
describe("N10.2 autosave", () => {
  it("debounce salva só a última versão", async () => {
    vi.useFakeTimers(); const saved: string[] = [];
    const a = createAutosave<string>({ save: async (v) => { saved.push(v); }, debounceMs: 100 });
    a.change("a"); a.change("ab"); a.change("abc"); expect(a.status).toBe("pendente");
    await vi.advanceTimersByTimeAsync(150); expect(saved).toEqual(["abc"]); expect(a.status).toBe("salvo"); vi.useRealTimers();
  });
  it("erro tenta de novo e não perde o valor", async () => {
    vi.useFakeTimers(); let n = 0; const saved: string[] = [];
    const a = createAutosave<string>({ save: async (v) => { if (n++ === 0) throw new Error("rede"); saved.push(v); }, debounceMs: 10, retryBaseMs: 50 });
    a.change("x"); await vi.advanceTimersByTimeAsync(20); expect(a.status).toBe("erro"); expect(a.hasUnsaved).toBe(true);
    await vi.advanceTimersByTimeAsync(60); expect(saved).toEqual(["x"]); expect(a.status).toBe("salvo"); vi.useRealTimers();
  });
  it("flush ao sair salva imediatamente; edição durante salvamento entra depois", async () => {
    let release!: () => void; const saved: string[] = [];
    const a = createAutosave<string>({ save: (v) => new Promise<void>((r) => { saved.push(v); release = r; }), debounceMs: 10_000 });
    a.change("1"); const f = a.flush(); a.change("2"); release(); await f; const g = a.flush(); release(); await g;
    expect(saved).toEqual(["1", "2"]); expect(a.hasUnsaved).toBe(false);
  });
});
