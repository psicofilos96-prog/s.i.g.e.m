import { describe, expect, it, vi } from "vitest";
import { readCalendarListNow } from "./institutional-calendar-readers";

describe("Instante da apresentação institucional", () => {
  it("consulta versões com o instante do servidor, mesmo com navegador adiantado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const knownAt = "2026-10-20T13:00:00.123456Z";
    const rpc = vi.fn(async (fn: string) => ({ error: null, data: fn === "calendar_network_sources_at"
      ? { contract: "b4.6.10/1", state: "lido", audience: "construcao", knownAt, sources: [] }
      : { contract: "b4.6.6/1", state: "lido", audience: "construcao", knownAt, versions: [] } }));
    try {
      const result = await readCalendarListNow(rpc);
      expect(result.kind).toBe("lido");
      expect(rpc).toHaveBeenNthCalledWith(2, "calendar_list_at", { _known_at: knownAt });
    } finally { vi.useRealTimers(); }
  });
  it("preserva recusa e não consulta versões sem acesso", async () => {
    const rpc = vi.fn(async () => ({ error: null, data: { contract: "b4.6.10/1", state: "access-denied" } }));
    expect(await readCalendarListNow(rpc)).toEqual({ kind: "access-denied" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("não converte resposta malformada em recusa", async () => {
    const rpc = async () => ({ error: null, data: { contract: "b4.6.10/1", state: "lido", knownAt: "inválido" } });
    await expect(readCalendarListNow(rpc)).rejects.toThrow();
  });
});