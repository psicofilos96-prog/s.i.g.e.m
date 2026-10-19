import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanningPage } from "./planning-page";
const state = vi.hoisted(() => ({ authority: { status: "loading" } as any, assignments: vi.fn(), plans: vi.fn(), catalog: vi.fn(), shared: vi.fn(), templates: vi.fn() }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => state.authority }));
vi.mock("./planning-source", () => ({ myAssignments: state.assignments, visiblePlans: state.plans, classPositions: vi.fn(), planPeriods: vi.fn(), itemsOfMatrix: vi.fn(), matrixItemKeys: vi.fn(), savePlan: vi.fn() }));
vi.mock("./sipe-extras", () => ({ sharedWithMe: state.shared, planTemplates: state.templates, PlanPrint: () => null, SharePanel: () => null, TemplatesAdmin: () => null, recordSharedCopy: vi.fn() }));
vi.mock("@/features/curricular-reference/reference-source", () => ({ readCatalog: state.catalog }));
vi.mock("./attachment-read", () => ({ readAttachmentWithDeadline: (read: () => Promise<unknown>) => read() }));
vi.mock("./plan-attachments", () => ({ PlanAttachments: () => null }));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><PlanningPage /></QueryClientProvider>;
  return { ...render(tree()), tree };
}
afterEach(() => { cleanup(); vi.clearAllMocks(); state.authority = { status: "loading" }; });
describe("planning session boundary", () => {
  it.each(["loading", "signed-out"])("does not read domain before confirmed authority (%s)", (status) => {
    state.authority = { status }; mount();
    for (const read of [state.assignments, state.plans, state.catalog, state.shared, state.templates]) expect(read).not.toHaveBeenCalled();
  });
  it("shows a primary source failure instead of waiting indefinitely", async () => {
    state.authority = { status: "signed-in", user: { id: "a" }, sessionRevision: 1 };
    state.assignments.mockRejectedValue(new Error("private")); state.plans.mockResolvedValue([]); state.catalog.mockResolvedValue(null); state.shared.mockResolvedValue([]); state.templates.mockResolvedValue([]);
    mount(); await screen.findByText("Não foi possível abrir o planejamento"); expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy(); expect(screen.queryByText("private")).toBeNull();
  });
});