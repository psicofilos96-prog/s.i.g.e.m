import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ authority: { status: "loading" } as Record<string, unknown>, rpc: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority, sessionContextKey: () => state.authority["key"] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("./integration.functions", () => ({ processWebhookQueue: vi.fn() }));
import { IntegrationPage } from "./integration-page";

const empty = { clients: [], keys: [], subscriptions: [], deliveries: [], requests: [] };
const authorized = (key: string) => ({ status: "signed-in", key, capabilities: [{ capabilityId: "administrar-integracoes", schoolId: null, classId: null }] });
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><IntegrationPage /></QueryClientProvider>);
  return { client, update: () => view.rerender(<QueryClientProvider client={client}><IntegrationPage /></QueryClientProvider>) };
};
beforeEach(() => { state.rpc.mockReset().mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: empty, error: null }) })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Integration overview access and bounded reads", () => {
  it("does not read before session/principal/capability confirmation", () => {
    state.authority = { status: "loading" }; const view = setup();
    for (const authority of [{ status: "loading", error: "timeout" }, { status: "signed-out" }, { status: "signed-in", capabilities: [] }, { status: "signed-in", capabilities: [{ capabilityId: "administrar-integracoes", schoolId: "school-a", classId: null }] }]) {
      state.authority = authority; view.update();
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("uses independent private queries after a session change", async () => {
    state.authority = authorized("a#1"); const view = setup();
    await waitFor(() => expect(view.client.getQueryData(["integration-overview", "a#1"])).toEqual(empty));
    state.authority = authorized("b#2"); view.update();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    expect(view.client.getQueryData(["integration-overview", "b#2"])).toEqual(empty);
  });
  it("aborts a stalled overview at 15 seconds and can recover", async () => {
    vi.useFakeTimers(); let signal: AbortSignal | undefined;
    state.rpc.mockImplementation(() => ({ abortSignal: (s: AbortSignal) => { signal = s; return new Promise(() => {}); } }));
    state.authority = authorized("a#3"); const { client } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
    expect(signal?.aborted).toBe(true);
    expect(client.getQueryState(["integration-overview", "a#3"])?.status).toBe("error");
    expect(client.getQueryData(["integration-overview", "a#3"])).toBeUndefined();
    state.rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: empty, error: null }) }));
    await act(async () => { await client.refetchQueries({ queryKey: ["integration-overview", "a#3"] }); });
    expect(client.getQueryData(["integration-overview", "a#3"])).toEqual(empty);
  });
  it("rejects malformed results instead of reporting empty success", async () => {
    state.rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: { clients: [] }, error: null }) }));
    state.authority = authorized("a#4"); const { client } = setup();
    await waitFor(() => expect(client.getQueryState(["integration-overview", "a#4"])?.status).toBe("error"));
    expect(client.getQueryData(["integration-overview", "a#4"])).toBeUndefined();
  });
});