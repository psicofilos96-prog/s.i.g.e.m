import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ context: "a#1" as string | null, rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => state.rpc(...args) } }));
vi.mock("./session-read-context", () => ({ currentSessionReadKey: () => state.context }));
import { callRpc } from "./rpc-call";
import { LIST_TIMEOUT_MS, ListTimeoutError } from "./server-page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const result = (data: unknown) => ({ data, error: null });
beforeEach(() => { state.context = "a#1"; state.rpc.mockReset().mockResolvedValue(result(1)); });
afterEach(() => vi.useRealTimers());

describe("callRpc — leituras simultâneas no contexto da sessão", () => {
  it("leitura idêntica em andamento vira uma só pergunta", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    state.rpc.mockReturnValue(pending.promise);
    const reads = [callRpc("meal_kitchens_at", { _on: "2026-10-24" }), callRpc("meal_kitchens_at", { _on: "2026-10-24" })];
    await Promise.resolve();
    expect(state.rpc).toHaveBeenCalledTimes(1);
    pending.resolve(result(1));
    expect(await Promise.all(reads)).toEqual([1, 1]);
  });

  it("gravação nunca é compartilhada", async () => {
    await Promise.all([callRpc("record_meal_order", { x: 1 }), callRpc("record_meal_order", { x: 1 })]);
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });

  it("outra conta nunca recebe a resposta em andamento da anterior", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    state.rpc.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(result("dados-b"));
    const first = callRpc("family_student_summary", { _student: "s" });
    const firstOutcome = first.then(() => "resposta-antiga", (error: unknown) => error);
    await Promise.resolve();
    state.context = "b#2";
    const second = callRpc("family_student_summary", { _student: "s" });
    pending.resolve(result("dados-a"));
    expect(await second).toBe("dados-b");
    expect(await firstOutcome).toMatchObject({ name: "AbortError" });
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });

  it("novo login da mesma conta não compartilha a sessão anterior", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    state.rpc.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(result("novo"));
    const first = callRpc("meal_kitchens_at");
    const outcome = first.then(() => "resposta-antiga", (error: unknown) => error);
    await Promise.resolve();
    state.context = "a#3";
    const second = callRpc("meal_kitchens_at");
    pending.resolve(result("antigo"));
    expect(await second).toBe("novo");
    expect(await outcome).toMatchObject({ name: "AbortError" });
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });

  it("sem contexto confirmado, inclusive no SSR, não compartilha", async () => {
    state.context = null;
    await Promise.all([callRpc("meal_kitchens_at"), callRpc("meal_kitchens_at")]);
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });

  it("consulta que perdeu a sessão antes do envio não é iniciada", async () => {
    const read = callRpc("family_student_summary", { _student: "s" });
    state.context = null;
    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("tempo esgotado retira a pergunta travada e permite tentar novamente", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = new Promise<never>(() => {});
    const query = Object.assign(pending, { abortSignal: (value: AbortSignal) => { signal = value; return pending; } });
    state.rpc.mockReturnValueOnce(query).mockResolvedValueOnce(result("recuperado"));
    const read = callRpc("meal_kitchens_at");
    const failure = expect(read).rejects.toBeInstanceOf(ListTimeoutError);
    await vi.advanceTimersByTimeAsync(LIST_TIMEOUT_MS + 1);
    await failure;
    expect(signal?.aborted).toBe(true);
    expect(await callRpc("meal_kitchens_at")).toBe("recuperado");
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });
});
