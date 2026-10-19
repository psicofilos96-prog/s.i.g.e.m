import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeachingSupportNotice } from "./teaching-support-notice";

const state = vi.hoisted(() => ({ authority: { status: "loading" } as any, mode: "cloud", rpc: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority }));
vi.mock("@/features/diary/diary-persistence-mode", () => ({ useDiaryPersistenceMode: () => state.mode }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("@/features/students/institutional-roster", () => ({ rosterStudents: () => [{ id: "s1", personName: "Student One" }] }));

const signedIn = (id = "a", revision = 1) => ({ status: "signed-in", user: { id }, sessionRevision: revision, person: { id: "person" }, capabilities: [] });
const classes = [{ classId: "c1", className: "Class One" }];
const flags = [{ class_id: "c1", student_id: "s1", has_active_mediation: true }];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><TeachingSupportNotice date="2026-10-19" classes={classes} /></QueryClientProvider>;
  return { ...render(tree()), tree };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); state.authority = { status: "loading" }; state.mode = "cloud"; });

describe("teacher mediation read boundary", () => {
  it.each(["loading", "signed-out"])("does not consult before confirmed authority (%s)", (status) => {
    state.authority = { status }; mount(); expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each(["pendente", "laboratorio"])("does not consult before an accepted institutional mirror (%s)", (mode) => {
    state.authority = signedIn(); state.mode = mode; mount(); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("does not consult as an institutional account without a person", () => {
    state.authority = { ...signedIn(), person: null }; mount(); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("retries a rejected read without disclosing its internal error", async () => {
    state.authority = signedIn();
    state.rpc.mockRejectedValueOnce(new Error("private error")).mockResolvedValue({ data: flags, error: null });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Student One"); expect(state.rpc).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("private error")).toBeNull();
  });
  it("rejects malformed data rather than treating it as no mediation", async () => {
    state.authority = signedIn(); state.rpc.mockResolvedValue({ data: [{ class_id: "c1" }], error: null });
    mount(); await screen.findByRole("alert"); expect(screen.queryByText("Student One")).toBeNull();
  });
  it("discards a late response when the account changes", async () => {
    let resolve: (value: unknown) => void = () => {};
    state.authority = signedIn();
    state.rpc.mockReturnValueOnce(new Promise((r) => { resolve = r; })).mockResolvedValue({ data: [], error: null });
    const view = mount(); await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    state.authority = signedIn("b", 2); view.rerender(view.tree());
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    await act(async () => { resolve({ data: flags, error: null }); });
    expect(screen.queryByText("Student One")).toBeNull();
  });
  it("ends an unresolved read after 15 seconds without exposing students", async () => {
    vi.useFakeTimers(); state.authority = signedIn(); state.rpc.mockReturnValue(new Promise(() => {}));
    mount(); await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Student One")).toBeNull();
  });
});