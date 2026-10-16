import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => { await new Promise((r) => setTimeout(r, 5)); return { data: 1, error: null }; });
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("callRpc — leituras simultâneas iguais", () => {
  it("leitura idêntica em andamento vira uma só pergunta", async () => {
    const { callRpc } = await import("./rpc-call");
    rpc.mockClear();
    await Promise.all([callRpc("meal_kitchens_at", { _on: "2026-10-16" }), callRpc("meal_kitchens_at", { _on: "2026-10-16" })]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("gravação nunca é compartilhada", async () => {
    const { callRpc } = await import("./rpc-call");
    rpc.mockClear();
    await Promise.all([callRpc("record_meal_order", { x: 1 }), callRpc("record_meal_order", { x: 1 })]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
