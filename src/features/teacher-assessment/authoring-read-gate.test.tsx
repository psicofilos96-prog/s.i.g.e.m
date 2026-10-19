import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ authority: { status: "loading" } as Record<string, unknown>, assignments: vi.fn(), items: vi.fn(), instruments: vi.fn(), schools: vi.fn(), catalog: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority, sessionContextKey: () => state.authority["key"] }));
vi.mock("@/features/teaching-planning/planning-source", () => ({ myAssignments: state.assignments }));
vi.mock("@/features/curricular-reference/reference-source", () => ({ readCatalog: state.catalog }));
vi.mock("./authoring-source", () => ({ visibleItems: state.items, visibleInstruments: state.instruments, schoolsOfAssignments: state.schools }));
vi.mock("./sia-print", () => ({ HeadersTab: () => null, SiaPrintView: () => null, RichText: () => null }));
import { AuthoringPage } from "./authoring-page";

beforeEach(() => { for (const reader of [state.assignments, state.items, state.instruments, state.schools, state.catalog]) reader.mockReset().mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const signedIn = (key: string) => ({ status: "signed-in", key, user: { id: key }, capabilities: [] });
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><AuthoringPage /></QueryClientProvider>);
  return { client, ...view, update: () => view.rerender(<QueryClientProvider client={client}><AuthoringPage /></QueryClientProvider>) };
};

describe("Authoring reads require confirmed effective authority", () => {
  it("loading, failed session and signed-out do not read domain", () => {
    state.authority = { status: "loading" };
    const view = setup();
    for (const authority of [{ status: "loading", error: "timeout" }, { status: "signed-out" }]) { state.authority = authority; view.update(); }
    for (const reader of [state.assignments, state.items, state.instruments, state.schools, state.catalog]) expect(reader).not.toHaveBeenCalled();
  });
  it("switching sessions does not reuse private item or assignment queries", async () => {
    state.authority = signedIn("account-a#1");
    const view = setup();
    await waitFor(() => expect(state.items).toHaveBeenCalledTimes(1));
    state.authority = signedIn("account-b#2"); view.update();
    await waitFor(() => expect(state.items).toHaveBeenCalledTimes(2));
    expect(state.assignments).toHaveBeenCalledTimes(2);
    expect(view.client.getQueryData(["ta-items", "account-b#2"])).toEqual([]);
  });
  it("a stalled item query fails after 15 seconds instead of remaining pending", async () => {
    vi.useFakeTimers();
    state.authority = signedIn("account-a#3");
    state.items.mockReturnValue(new Promise(() => {}));
    const { client } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
    expect(client.getQueryState(["ta-items", "account-a#3"])?.status).toBe("error");
    expect(client.getQueryState(["ta-items", "account-a#3"])?.data).toBeUndefined();
    expect(state.items).toHaveBeenCalledTimes(1);
  });
});