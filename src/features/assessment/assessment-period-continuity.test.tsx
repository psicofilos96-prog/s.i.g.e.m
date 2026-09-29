/** 6D.3.3.4 — continuidade Avaliação do período ↔ Pauta ↔ Correção focal. */
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { vi, describe, expect, it } from "vitest";
vi.mock("@/features/authority/session-authority", () => ({
  useSessionUser: () => ({ user: null, loading: false }), useSessionAuthority: () => ({ status: "signed-out" }) }));
import { AssessmentPeriodPage } from "./assessment-period-page";
import { AssessmentEntryFieldPage } from "./assessment-entry-field-page";
import { FIELD_LAB_INSTRUMENT_ID } from "./assessment-entry-field-fixture";

function mount(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const passthrough = (s: Record<string, unknown>) => s as Record<string, string>;
  const make = (p: string, el: (r: { params: Record<string, string>; search: Record<string, string> }) => ReactNode) => {
    const route = createRoute({
      getParentRoute: () => root,
      path: p,
      validateSearch: passthrough,
      component: function R() {
        return <>{el({ params: route.useParams() as never, search: route.useSearch() as never })}</>;
      },
    });
    return route;
  };
  const router = createRouter({
    routeTree: root.addChildren([
      make("/diario/turmas/$turmaId/avaliacao/periodo", ({ params, search }) => (
        <AssessmentPeriodPage classId={params["turmaId"]!} search={search} />
      )),
      make("/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId", ({ params, search }) => (
        <AssessmentEntryFieldPage classId={params["turmaId"]!} instrumentId={params["instrumentoId"]!} search={search} />
      )),
      make("/diario/turmas/$turmaId/avaliacao", () => <p>stub avaliação</p>),
      make("/diario/turmas/$turmaId", () => <p>stub turma</p>),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router as never} />);
  return router;
}

const PERIOD = "/diario/turmas/tur-001/avaliacao/periodo";
const search = () => screen.getByTestId("period-search") as HTMLInputElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function openLabPauta() {
  const item = await screen.findByTestId(`period-instrument-${FIELD_LAB_INSTRUMENT_ID}`);
  fireEvent.click(within(item).getByRole("link", { name: "Abrir pauta" }));
  await screen.findAllByRole("link", { name: /Voltar à Avaliação do período/ });
}

describe("6D.3.3.4 — continuidade da Avaliação do período", () => {
  it("A/B. abrir pauta leva turma e período; voltar restaura período e busca", async () => {
    const router = mount(PERIOD);
    await screen.findByTestId("period-matrix");
    fireEvent.change(search(), { target: { value: "Ana" } });
    await settle();
    await openLabPauta();
    const s = router.state.location.search as Record<string, string>;
    expect(router.state.location.pathname).toContain(`/tur-001/avaliacao/pauta/${FIELD_LAB_INSTRUMENT_ID}`);
    expect(s["periodo"]).toBeTruthy();
    expect(s["turma"]).toBe("tur-001");
    fireEvent.click(screen.getAllByRole("link", { name: /Voltar à Avaliação do período/ })[0]!);
    await screen.findByTestId("period-matrix");
    expect(router.state.location.pathname).toBe(PERIOD);
    expect((router.state.location.search as Record<string, string>)["periodo"]).toBe(s["periodo"]);
    expect(search().value).toBe("Ana");
  });

  it("E. voltar do navegador não cria estado contraditório", async () => {
    const router = mount(PERIOD);
    await screen.findByTestId("period-matrix");
    fireEvent.change(search(), { target: { value: "Bia" } });
    await settle();
    await openLabPauta();
    await act(async () => router.history.back());
    await screen.findByTestId("period-matrix");
    expect(search().value).toBe("Bia");
  });

  it("F. período incompatível não restaura busca", async () => {
    mount(`${PERIOD}?periodo=periodo-inexistente&q=Ana`);
    await screen.findByTestId("period-matrix");
    expect(search().value).toBe("");
  });

  it("C/G. registrar na pauta → voltar mostra o fato novo; rascunho consumido não reaparece", async () => {
    mount(PERIOD);
    await screen.findByTestId("period-matrix");
    const before = screen.getByTestId("period-matrix").textContent!;
    await openLabPauta();
    const input = screen.getAllByTestId(/^assessment-numeric-/).find((el) => !(el as HTMLInputElement).value) as HTMLInputElement;
    const studentId = input.getAttribute("data-testid")!.replace("assessment-numeric-", "");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "73" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    fireEvent.click(screen.getByTestId("assessment-register"));
    const success = screen.getByTestId("assessment-registration-success");
    fireEvent.click(within(success).getByRole("link", { name: /Voltar à Avaliação do período/ }));
    await screen.findByTestId("period-matrix");
    const cell = within(screen.getByTestId("period-matrix")).getByTestId(`period-cell-${studentId}-${FIELD_LAB_INSTRUMENT_ID}`);
    expect(cell.getAttribute("data-state")).toBe("recorded");
    expect(cell.textContent).toContain("73");
    expect(screen.getByTestId("period-matrix").textContent).not.toBe(before);
    // Reabrir a pauta: o fato oficial está lá; nenhum rascunho local sobrevive.
    await openLabPauta();
    expect(screen.getByTestId(`assessment-row-${studentId}`).getAttribute("data-local-change")).toBe("nao");
  });

  it("D. corrigir na célula reprojeta só a célula e mantém o contexto", async () => {
    const router = mount(PERIOD);
    const matrix = await screen.findByTestId("period-matrix");
    const correct = within(matrix)
      .getAllByRole("button", { name: /^Corrigir resultado de/ })
      .find((b) => /^\d+/.test(b.closest("[data-testid^=period-cell-]")!.textContent!))!;
    const cellId = correct.closest("[data-testid^=period-cell-]")!.getAttribute("data-testid")!;
    const othersBefore = [...matrix.querySelectorAll("[data-testid^=period-cell-]")]
      .filter((c) => c.getAttribute("data-testid") !== cellId)
      .map((c) => c.textContent);
    fireEvent.click(correct);
    const panel = screen.getByTestId("period-correction");
    fireEvent.click(within(panel).getByRole("button", { name: "Corrigir resultado" }));
    fireEvent.change(within(panel).getAllByRole("textbox")[0]!, { target: { value: "91" } });
    const just = within(panel).queryByLabelText("Justificativa da correção");
    if (just) fireEvent.change(just, { target: { value: "Correção de digitação" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Conferir correção" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Registrar correção" }));
    await settle();
    const after = within(screen.getByTestId("period-matrix")).getByTestId(cellId);
    expect(after.textContent).toContain("91");
    expect(after.textContent).toContain("Resultado corrigido");
    const othersAfter = [...screen.getByTestId("period-matrix").querySelectorAll("[data-testid^=period-cell-]")]
      .filter((c) => c.getAttribute("data-testid") !== cellId)
      .map((c) => c.textContent);
    expect(othersAfter).toEqual(othersBefore);
    expect(router.state.location.pathname).toBe(PERIOD);
  });
});
