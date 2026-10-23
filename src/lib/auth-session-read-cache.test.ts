import { describe, expect, it, vi } from "vitest";
import { cachedSessionStorage } from "./auth-session-read-cache";

describe("cache curto da leitura da sessão", () => {
  it("lê o armazenamento real uma única vez para várias consultas seguidas", async () => {
    const getItem = vi.fn(async () => "sessao");
    const s = cachedSessionStorage({ getItem, setItem: vi.fn(), removeItem: vi.fn() }, 10_000);
    const reads = await Promise.all(Array.from({ length: 25 }, () => s.getItem("k")));
    expect(reads.every((r) => r === "sessao")).toBe(true);
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it("depois do prazo volta a ler o armazenamento real", async () => {
    let t = 0;
    const getItem = vi.fn(async () => "sessao");
    const s = cachedSessionStorage({ getItem, setItem: vi.fn(), removeItem: vi.fn() }, 10_000, () => t);
    await s.getItem("k");
    t = 10_001;
    await s.getItem("k");
    expect(getItem).toHaveBeenCalledTimes(2);
  });

  it("sair da conta vale na hora: remoção grava no real e a leitura seguinte vem vazia", async () => {
    const removeItem = vi.fn();
    const s = cachedSessionStorage({ getItem: async () => "sessao", setItem: vi.fn(), removeItem }, 10_000);
    await s.getItem("k");
    await s.removeItem("k");
    expect(removeItem).toHaveBeenCalledWith("k");
    expect(await s.getItem("k")).toBeNull();
  });

  it("token renovado vale na hora para a próxima consulta", async () => {
    const setItem = vi.fn();
    const s = cachedSessionStorage({ getItem: async () => "velha", setItem, removeItem: vi.fn() }, 10_000);
    await s.getItem("k");
    await s.setItem("k", "nova");
    expect(setItem).toHaveBeenCalledWith("k", "nova");
    expect(await s.getItem("k")).toBe("nova");
  });
});
