import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyPendingWorkCard } from "./my-pending-card";
const state = vi.hoisted(() => ({ authority: { status: "signed-in", user: { id: "a" }, sessionRevision: 1, person: { id: "p" }, principal: null } as any, work: vi.fn(), attendance: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority }));
vi.mock("./my-pending-source", () => ({ readMyWorkPending: state.work, readMyMissingAttendance: state.attendance }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><MyPendingWorkCard /></QueryClientProvider>;
  return { ...render(tree()), tree };
}
afterEach(() => { cleanup(); state.work.mockReset(); state.attendance.mockReset(); state.authority = { status: "signed-in", user: { id: "a" }, sessionRevision: 1, person: { id: "p" }, principal: null }; });
describe("pending card read states", () => {
  it.each(["loading", "signed-out"])("makes no domain reads without confirmed authority (%s)", (status) => {
    state.authority = { status }; mount();
    expect(state.work).not.toHaveBeenCalled(); expect(state.attendance).not.toHaveBeenCalled();
  });
  it("keeps a failed source visible and retries only that source", async () => {
    state.work.mockRejectedValueOnce(new Error("private detail")).mockResolvedValue([]);
    state.attendance.mockResolvedValue(3); mount();
    await screen.findByRole("alert");
    expect(screen.queryByText("private detail")).toBeNull();
    await screen.findByText("3 aulas registradas nos últimos 14 dias sem chamada");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await vi.waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(state.work).toHaveBeenCalledTimes(2); expect(state.attendance).toHaveBeenCalledTimes(1);
  });
  it("does not keep the previous account's results during a new read", async () => {
    state.work.mockResolvedValueOnce([{ subject_kind: "plano", em_analise: 9, ajuste_solicitado: 0 }]).mockReturnValue(new Promise(() => {}));
    state.attendance.mockResolvedValue(0);
    const view = mount(); await screen.findByText("9 planos aguardando a Orientação");
    state.authority = { ...state.authority, user: { id: "b" }, sessionRevision: 2 };
    view.rerender(view.tree()); expect(screen.queryByText("9 planos aguardando a Orientação")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});