import { beforeEach, describe, expect, it, vi } from "vitest";

let user = "u1";
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { getSession: async () => ({ data: { session: user ? { user: { id: user } } : null } }), onAuthStateChange: () => ({}) },
  },
}));
import { clearSharedCapabilities, readEffectiveCapabilitiesShared, CAPABILITIES_TTL_MS } from "./capabilities-cache";

describe("NPERF.4 — permissões compartilhadas", () => {
  beforeEach(() => { rpc.mockReset(); clearSharedCapabilities(); user = "u1"; rpc.mockResolvedValue({ data: [{ capability_id: "c" }], error: null }); });
  it("três leitores simultâneos da mesma conta fazem uma chamada", async () => {
    await Promise.all([readEffectiveCapabilitiesShared(), readEffectiveCapabilitiesShared(), readEffectiveCapabilitiesShared()]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("outra conta nunca recebe as permissões da anterior", async () => {
    await readEffectiveCapabilitiesShared(); user = "u2"; await readEffectiveCapabilitiesShared();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("vence em 60 s e erro não fica guardado", async () => {
    let t = 0; const now = () => t;
    await readEffectiveCapabilitiesShared(now); t = CAPABILITIES_TTL_MS; await readEffectiveCapabilitiesShared(now);
    expect(rpc).toHaveBeenCalledTimes(2);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } }); clearSharedCapabilities();
    await readEffectiveCapabilitiesShared(now); await readEffectiveCapabilitiesShared(now);
    expect(rpc).toHaveBeenCalledTimes(4);
  });
  it("sem sessão não guarda nada", async () => {
    user = ""; await readEffectiveCapabilitiesShared(); await readEffectiveCapabilitiesShared();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
