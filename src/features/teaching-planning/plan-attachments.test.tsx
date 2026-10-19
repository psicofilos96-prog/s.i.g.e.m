import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanAttachments } from "./plan-attachments";
const state = vi.hoisted(() => ({ authority: { status: "signed-in", user: { id: "a" }, sessionRevision: 1 } as any, read: vi.fn(), url: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority }));
vi.mock("./attachment-read", () => ({ readPlanAttachments: state.read, readAttachmentUrl: state.url }));
vi.mock("./planning-source", () => ({ uploadAttachment: state.upload, revokeAttachment: state.remove }));
const row = { id: "att", label: "Arquivo privado", object_path: "a/plan/file", revoked: false, supersedes_id: null };
function mount(props = { planId: "plan", readOnly: false, isAuthor: true }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><PlanAttachments {...props} /></QueryClientProvider>;
  return { ...render(tree()), tree };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.values(state).forEach((v) => { if (typeof v === "function") v.mockReset(); }); state.authority = { status: "signed-in", user: { id: "a" }, sessionRevision: 1 }; });
describe("planning attachment states", () => {
  it.each(["loading", "signed-out"])("does not read without a confirmed session (%s)", (status) => {
    state.authority = { status }; mount(); expect(state.read).not.toHaveBeenCalled();
  });
  it("does not read another author's private attachments", () => {
    mount({ planId: "plan", readOnly: true, isAuthor: false }); expect(state.read).not.toHaveBeenCalled();
  });
  it("does not show a read failure as no attachments and disables upload until retry succeeds", async () => {
    state.read.mockRejectedValueOnce(new Error("private-path")).mockResolvedValue([]); mount();
    await screen.findByRole("alert"); expect(screen.queryByText("Nenhum anexo.")).toBeNull(); expect(screen.queryByText("private-path")).toBeNull();
    expect(screen.getByLabelText("Adicionar anexo")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Nenhum anexo."); expect(screen.getByLabelText("Adicionar anexo")).toHaveProperty("disabled", false);
  });
  it("discards previous account data before reading the next account", async () => {
    state.read.mockResolvedValueOnce([row]).mockReturnValue(new Promise(() => {})); const view = mount(); await screen.findByRole("button", { name: row.label });
    state.authority = { status: "signed-in", user: { id: "b" }, sessionRevision: 2 }; view.rerender(view.tree());
    expect(screen.queryByRole("button", { name: row.label })).toBeNull(); await waitFor(() => expect(state.read).toHaveBeenCalledTimes(2));
  });
  it("keeps an ended assignment read-only", async () => {
    state.read.mockResolvedValue([row]); mount({ planId: "plan", readOnly: true, isAuthor: true });
    await screen.findByRole("button", { name: row.label }); expect(screen.queryByLabelText("Adicionar anexo")).toBeNull(); expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
  });
  it("hides revoked and superseded attachments", async () => {
    state.read.mockResolvedValue([row, { ...row, id: "new", supersedes_id: row.id, revoked: true }]); mount(); await screen.findByText("Nenhum anexo.");
    expect(screen.queryByRole("button", { name: row.label })).toBeNull();
  });
  it("closes the blank tab and shows a safe error when private URL reading fails", async () => {
    state.read.mockResolvedValue([row]); state.url.mockRejectedValue(new Error("private-path"));
    const tab = { opener: {}, close: vi.fn(), location: { replace: vi.fn() } }; vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    mount(); fireEvent.click(await screen.findByRole("button", { name: row.label }));
    await screen.findByRole("alert"); expect(tab.close).toHaveBeenCalledOnce(); expect(tab.opener).toBeNull(); expect(tab.location.replace).not.toHaveBeenCalled(); expect(screen.queryByText("private-path")).toBeNull();
  });
});