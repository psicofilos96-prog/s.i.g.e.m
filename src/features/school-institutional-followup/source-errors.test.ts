import { beforeEach, describe, expect, it, vi } from "vitest";
import { networkFollowup } from "./source";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

describe("acompanhamento: mensagens seguras quando uma RPC recusa o acesso", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it.each([
    ["followup:recording-denied", "não está mais autorizado"],
    ["followup:read-denied", "não está mais autorizado"],
    ["followup:session-required", "sessão não está mais válida"],
    ["followup:natural-person-required", "responsável autorizado"],
  ])("traduz %s em orientação compreensível", async (backendCode, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: backendCode } });
    await expect(networkFollowup("2026-11-01", "2026-11-06"))
      .rejects.toThrow(expected);
    expect(mocks.rpc).toHaveBeenCalledWith("school_institutional_followup_network", {
      _from: "2026-11-01", _to: "2026-11-06",
    });
  });

  it("não transforma um erro desconhecido em mensagem enganosa de permissão", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "failure:connection-reset" } });
    await expect(networkFollowup("2026-11-01", "2026-11-06"))
      .rejects.toThrow("failure:connection-reset");
  });
});
