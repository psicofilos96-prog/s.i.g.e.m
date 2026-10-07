import { describe, it, expect } from "vitest";
import { createAutosave, type AutosaveStatus } from "./autosave-controller";

const timers = () => { const q: (() => void)[] = []; return { q, t: { set: (f: () => void) => q.push(f), clear: () => {} }, flush: async () => { while (q.length) { q.shift()!(); await Promise.resolve(); await Promise.resolve(); } } }; };

describe("NFORM.1 — salvamento sem conexão", () => {
  it("sem conexão não tenta salvar e não perde a edição; ao voltar, salva a última versão", async () => {
    let online = false; const saved: string[] = []; const st: AutosaveStatus[] = []; const k = timers();
    const a = createAutosave<string>({ save: async (v) => { saved.push(v); }, isOnline: () => online, onStatus: (s) => st.push(s), timers: k.t });
    a.change("a"); a.change("b"); await k.flush();
    expect(saved).toEqual([]); expect(a.status).toBe("sem-conexao"); expect(a.hasUnsaved).toBe(true);
    online = true; a.online(); await k.flush();
    expect(saved).toEqual(["b"]); expect(a.status).toBe("salvo");
  });
  it("falha de salvamento fica em erro e retry refaz", async () => {
    let fail = true; const saved: string[] = []; const k = timers();
    const a = createAutosave<string>({ save: async (v) => { if (fail) throw new Error("x"); saved.push(v); }, maxRetries: 0, timers: k.t });
    a.change("a"); await k.flush(); expect(a.status).toBe("erro");
    fail = false; a.retry(); await k.flush(); expect(saved).toEqual(["a"]);
  });
});
