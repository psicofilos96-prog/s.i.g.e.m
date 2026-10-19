import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordChangeGate } from "./password-change-gate";

const state = vi.hoisted(() => ({ uid: "a", rpc: vi.fn() }));
vi.mock("./session-authority", () => ({ useSessionAuthority: () => ({ status: "signed-in", user: { id: state.uid } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
const read = vi.fn();
function Child() { read(); return <div>Workspace</div>; }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><PasswordChangeGate><Child /></PasswordChangeGate></QueryClientProvider>;
  return { ...render(tree()), tree };
}
afterEach(() => { cleanup(); vi.useRealTimers(); state.rpc.mockReset(); read.mockClear(); state.uid = "a"; });
describe("password gate blocks domain reads", () => {
  it("blocks unresolved checks", () => {
    state.rpc.mockReturnValue({ abortSignal: () => new Promise(() => {}) });
    mount(); expect(read).not.toHaveBeenCalled();
  });
  it.each([true, null, "false"])("blocks anything except explicit false: %s", async (data) => {
    state.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data, error: null }) });
    mount();
    if (data === true) await screen.findByRole("heading"); else await screen.findByRole("alert");
    expect(read).not.toHaveBeenCalled();
  });
  it("blocks errors", async () => {
    state.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: false, error: { message: "denied" } }) });
    mount(); await screen.findByRole("alert"); expect(read).not.toHaveBeenCalled();
  });
  it("permits confirmed clearance but not another account", async () => {
    state.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: false, error: null }) })
      .mockReturnValue({ abortSignal: () => new Promise(() => {}) });
    const view = mount(); await screen.findByText("Workspace"); expect(read).toHaveBeenCalled();
    read.mockClear(); state.uid = "b"; view.rerender(view.tree());
    expect(screen.queryByText("Workspace")).toBeNull(); expect(read).not.toHaveBeenCalled();
  });
  it("ends stalled checks after 15 seconds without clearance", async () => {
    vi.useFakeTimers(); state.rpc.mockReturnValue({ abortSignal: () => new Promise(() => {}) });
    mount(); await act(async () => { await vi.advanceTimersByTimeAsync(15_100); });
    vi.useRealTimers(); await screen.findByRole("alert"); expect(read).not.toHaveBeenCalled();
  });
});