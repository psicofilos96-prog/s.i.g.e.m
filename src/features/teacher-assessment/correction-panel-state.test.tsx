import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CorrectionPanel } from "./correction-panel";
const state = vi.hoisted(() => ({ authority: { status: "signed-in", user: { id: "a" }, sessionRevision: 1, person: { id: "p" }, principal: null } as any, instruments: vi.fn(), items: vi.fn(), reviews: vi.fn(), students: vi.fn(), corrections: vi.fn(), key: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority }));
vi.mock("@/features/teacher-review/teacher-work-review", () => ({ reviewsOf: state.reviews, reviewState: (rows: string[]) => rows[0] }));
vi.mock("./authoring-source", () => ({ visibleInstruments: state.instruments, visibleItems: state.items, classStudents: state.students, correctionsOf: state.corrections, itemKey: state.key, recordCorrectionV2: vi.fn(), uploadCardImage: vi.fn(), siaCorrectionMessage: () => "Não gravado." }));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><CorrectionPanel /></QueryClientProvider>;
  return { ...render(tree()), tree };
}
const instrument = { id: "v1", instrument_id: "i1", author_user_id: "a", status: "publicado", supersedes_id: null, title: "Prova própria", version: 1, class_id: "c1", items: [], randomization: null };
afterEach(() => { cleanup(); Object.values(state).forEach((v) => { if (typeof v === "function") v.mockReset(); }); state.authority = { status: "signed-in", user: { id: "a" }, sessionRevision: 1, person: { id: "p" }, principal: null }; });
describe("correction account and failure states", () => {
  it.each(["loading", "signed-out"])("does not read domain data while %s", (status) => {
    state.authority = { status }; mount(); expect(state.instruments).not.toHaveBeenCalled(); expect(state.items).not.toHaveBeenCalled();
  });
  it("does not read correction data for a sector account", () => {
    state.authority.principal = { station: "supervisao" }; mount(); expect(state.instruments).not.toHaveBeenCalled();
  });
  it("retries a failed instrument read without rereading successful items or exposing details", async () => {
    state.instruments.mockRejectedValueOnce(new Error("private details")).mockResolvedValue([]); state.items.mockResolvedValue([]); mount();
    await screen.findByRole("alert"); expect(screen.queryByText("private details")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Nenhuma prova publicada."); expect(state.instruments).toHaveBeenCalledTimes(2); expect(state.items).toHaveBeenCalledTimes(1);
  });
  it("discards the previous account's proofs when the account changes", async () => {
    state.instruments.mockResolvedValueOnce([instrument]).mockReturnValue(new Promise(() => {})); state.items.mockResolvedValue([]);
    const view = mount(); await screen.findByRole("option", { name: "Prova própria (v1)" });
    state.authority = { ...state.authority, user: { id: "b" }, sessionRevision: 2 }; view.rerender(view.tree());
    expect(screen.queryByRole("option", { name: "Prova própria (v1)" })).toBeNull();
    await waitFor(() => expect(state.instruments).toHaveBeenCalledTimes(2));
  });
  it("blocks student/correction/key reads before approval and shows approval failure", async () => {
    state.instruments.mockResolvedValue([instrument]); state.items.mockResolvedValue([]); state.reviews.mockRejectedValue(new Error("private")); mount();
    await screen.findByRole("option", { name: "Prova própria (v1)" }); fireEvent.change(screen.getByLabelText("Prova"), { target: { value: "v1" } });
    await screen.findByRole("alert"); expect(state.students).not.toHaveBeenCalled(); expect(state.corrections).not.toHaveBeenCalled(); expect(state.key).not.toHaveBeenCalled();
  });
  it("does not treat failed correction history as an empty first correction", async () => {
    state.instruments.mockResolvedValue([instrument]); state.items.mockResolvedValue([]); state.reviews.mockResolvedValue(["aprovado"]); state.students.mockResolvedValue([{ student_id: "s" }]); state.corrections.mockRejectedValue(new Error("private")); mount();
    await screen.findByRole("option", { name: "Prova própria (v1)" }); fireEvent.change(screen.getByLabelText("Prova"), { target: { value: "v1" } });
    await screen.findByText("Não foi possível ler as correções gravadas.");
    expect(screen.getByLabelText("Imagem do cartão")).toHaveProperty("disabled", true);
  });
});