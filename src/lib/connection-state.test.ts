import { describe, expect, it, vi } from "vitest";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { QUERY_CLIENT_DEFAULTS, nextConnectionPhase } from "./connection-state";

describe("NRESILIENCE.1 — conexão instável", () => {
  it("queda e retorno são visíveis; retorno some depois", () => {
    expect(nextConnectionPhase("online", "offline")).toBe("offline");
    expect(nextConnectionPhase("offline", "online")).toBe("restored");
    expect(nextConnectionPhase("restored", "settle")).toBe("online");
    expect(nextConnectionPhase("online", "online")).toBe("online");
  });

  it("gravação offline falha na hora e NÃO dispara sozinha ao reconectar", async () => {
    const qc = new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS });
    const writer = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    onlineManager.setOnline(false);
    try {
      const m = qc.getMutationCache().build(qc, { mutationFn: writer });
      await expect(m.execute(undefined)).rejects.toThrow("Failed to fetch");
      expect(writer).toHaveBeenCalledTimes(1);
      onlineManager.setOnline(true);
      await new Promise((r) => setTimeout(r, 20));
      expect(writer).toHaveBeenCalledTimes(1); // sem reenvio silencioso
      expect(qc.getMutationCache().getAll().some((x) => x.state.isPaused)).toBe(false);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("gravação que falha por rede não é repetida", async () => {
    const qc = new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS });
    const writer = vi.fn().mockRejectedValue(new Error("network"));
    const m = qc.getMutationCache().build(qc, { mutationFn: writer });
    await expect(m.execute(undefined)).rejects.toThrow();
    expect(writer).toHaveBeenCalledTimes(1);
  });
});
