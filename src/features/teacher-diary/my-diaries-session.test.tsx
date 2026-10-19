import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyDiariesPage } from "./my-diaries-page";
const state = vi.hoisted(() => ({ authority: { status: "loading" } as any, diaries: vi.fn(), slots: vi.fn(), lessons: vi.fn(), roster: vi.fn(), catalog: vi.fn(), recordLesson: vi.fn() }));
vi.mock("./diary-w-source", async (importOriginal) => ({ ...await importOriginal<typeof import("./diary-w-source")>(), recordLesson: state.recordLesson }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority }));
vi.mock("./diary-read", () => ({ readDiariesSafely: state.diaries, readSlotsSafely: state.slots, readLessonsSafely: state.lessons, readRosterSafely: state.roster, readDiaryWithDeadline: (read: () => Promise<unknown>) => read() }));
vi.mock("@/features/curricular-reference/reference-source", () => ({ readCatalog: state.catalog }));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><MyDiariesPage /></QueryClientProvider>;
  return { ...render(tree()), tree };
}
const signedIn = (id = "a", revision = 1) => ({ status: "signed-in", user: { id }, sessionRevision: revision, person: { id: "person" }, capabilities: [] });
const diary = { role: "titular", assignment_id: "assignment", substitution_id: null, class_id: "class", school_id: "school", academic_year_id: "year", year_state: "encerrado", engagement_id: "e", matrix_id: null, item_key: null, component_id: null, component_label: "Matemática", effective_from: "2026-01-01", effective_until: null, assignment_state: "vigente" };
afterEach(() => { cleanup(); vi.resetAllMocks(); state.authority = { status: "loading" }; });
describe("teacher diary authority boundary", () => {
  it("reuses the existing authorized reads for the selected date summary", async () => {
    state.authority = signedIn(); state.diaries.mockResolvedValue([diary]); state.catalog.mockResolvedValue(null);
    state.slots.mockResolvedValue([{ block_id: "block", block_key: "one", starts_at: "08:00", ends_at: "09:00", block_state: "utilizavel" }]);
    state.lessons.mockResolvedValue([]);
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Matemática/ }));
    const summary = await screen.findByLabelText("Resumo das aulas do dia");
    await waitFor(() => expect(within(summary).queryByText("Não disponível")).toBeNull());
    const values = [...summary.querySelectorAll("dd")].map((element) => element.textContent);
    expect(values).toEqual(["0", "1", "0"]);
    expect(state.lessons).toHaveBeenCalledTimes(1); expect(state.slots).toHaveBeenCalledTimes(1); expect(state.roster).not.toHaveBeenCalled();
  });
  it("keeps failed summary counts unknown rather than zero", async () => {
    state.authority = signedIn(); state.diaries.mockResolvedValue([diary]); state.catalog.mockResolvedValue(null);
    state.slots.mockResolvedValue([]); state.lessons.mockRejectedValue(new Error("denied"));
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Matemática/ }));
    await screen.findByRole("button", { name: "Tentar novamente" });
    const summary = screen.getByLabelText("Resumo das aulas do dia");
    expect([...summary.querySelectorAll("dd")].map((element) => element.textContent)).toEqual(["Não disponível", "0", "Não disponível"]);
  });
  it.each(["loading", "signed-out"])("does not read before authority (%s)", (status) => {
    state.authority = { status }; mount();
    for (const read of [state.diaries, state.catalog, state.slots, state.lessons, state.roster]) expect(read).not.toHaveBeenCalled();
  });
  it("does not read for a sector account without a natural person", () => {
    state.authority = { ...signedIn(), person: null }; mount(); expect(state.diaries).not.toHaveBeenCalled(); expect(state.catalog).not.toHaveBeenCalled();
  });
  it("retries a failed primary read without exposing internal errors", async () => {
    state.authority = signedIn(); state.diaries.mockRejectedValueOnce(new Error("secret detail")).mockResolvedValueOnce([]); state.catalog.mockResolvedValue(null);
    mount(); await screen.findByRole("button", { name: "Tentar novamente" });
    expect(screen.queryByText("secret detail")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(state.diaries).toHaveBeenCalledTimes(2));
  });
  it("discards a late response after account changes", async () => {
    let resolve: (rows: unknown[]) => void = () => {};
    state.authority = signedIn(); state.diaries.mockReturnValueOnce(new Promise((r) => { resolve = r; })).mockResolvedValueOnce([]); state.catalog.mockResolvedValue(null);
    const view = mount(); await waitFor(() => expect(state.diaries).toHaveBeenCalledTimes(1));
    state.authority = signedIn("b", 2); view.rerender(view.tree());
    await waitFor(() => expect(state.diaries).toHaveBeenCalledTimes(2)); resolve([diary]);
    await waitFor(() => expect(screen.queryByText("Matemática")).toBeNull());
  });
  it("a lesson failure stops loading and exposes a retry instead of an empty list", async () => {
    state.authority = signedIn(); state.diaries.mockResolvedValue([diary]); state.catalog.mockResolvedValue(null); state.slots.mockResolvedValue([]); state.lessons.mockRejectedValue(new Error("denied"));
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Matemática/ }));
    await waitFor(() => expect(state.lessons).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: "Tentar novamente" }); expect(screen.queryByText("Nenhuma aula registrada.")).toBeNull();
  });
  it("keeps the entered lesson on server rejection and does not announce success", async () => {
    state.authority = signedIn(); state.diaries.mockResolvedValue([{ ...diary, year_state: "operacional" }]);
    state.catalog.mockResolvedValue(null); state.slots.mockResolvedValue([]); state.lessons.mockResolvedValue([]);
    state.recordLesson.mockRejectedValue(new Error("diary:calendar-missing"));
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Matemática/ }));
    const content = await screen.findByRole("textbox", { name: "Conteúdo ministrado" });
    fireEvent.change(content, { target: { value: "Frações equivalentes" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar aula" }));
    await screen.findByRole("alert");
    expect(content).toHaveValue("Frações equivalentes"); expect(content).not.toBeDisabled();
    expect(state.recordLesson).toHaveBeenCalledTimes(1); expect(screen.queryByRole("status")).toBeNull();
  });
  it("retries an uncertain lesson with the same logical identity and frozen content", async () => {
    state.authority = signedIn(); state.diaries.mockResolvedValue([{ ...diary, year_state: "operacional" }]);
    state.catalog.mockResolvedValue(null); state.slots.mockResolvedValue([]); state.lessons.mockResolvedValue([]);
    state.recordLesson.mockRejectedValue(new Error("network"));
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Matemática/ }));
    const content = await screen.findByRole("textbox", { name: "Conteúdo ministrado" });
    fireEvent.change(content, { target: { value: "Frações equivalentes" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar aula" }));
    const retry = await screen.findByRole("button", { name: "Conferir envio novamente" });
    expect(content).toBeDisabled(); fireEvent.click(retry);
    await waitFor(() => expect(state.recordLesson).toHaveBeenCalledTimes(2));
    expect(state.recordLesson.mock.calls[0]?.[0]).toEqual(state.recordLesson.mock.calls[1]?.[0]);
    expect(state.recordLesson.mock.calls[0]?.[0].content).toBe("Frações equivalentes");
  });
});
