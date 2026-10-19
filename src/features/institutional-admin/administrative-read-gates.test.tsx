import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ authority: { status: "loading" } as Record<string, unknown>, from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: state.from, rpc: state.rpc } }));
vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => state.authority,
  sessionContextKey: () => "test-session",
}));
import { AccessCenterPage } from "./access-center-page";
import { GovernanceStationPage } from "./governance-station-page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("Administrative readers mount only after effective authority", () => {
  for (const [name, Page] of [["Central de acessos", AccessCenterPage], ["Estação administrativa", GovernanceStationPage]] as const) {
    it(`${name}: docente não consulta cadastros administrativos`, () => {
      state.authority = { status: "signed-in", capabilities: [{ capabilityId: "registrar-aula" }, { capabilityId: "consultar-estudantes-da-turma" }] };
      render(<Page />);
      expect(state.from).not.toHaveBeenCalled();
      expect(state.rpc).not.toHaveBeenCalled();
    });
    it(`${name}: sessão não confirmada não dispara leitores`, () => {
      for (const status of ["loading", "signed-out"]) {
        state.authority = { status };
        render(<Page />);
        expect(state.from).not.toHaveBeenCalled();
        expect(state.rpc).not.toHaveBeenCalled();
        cleanup();
      }
    });
  }
});