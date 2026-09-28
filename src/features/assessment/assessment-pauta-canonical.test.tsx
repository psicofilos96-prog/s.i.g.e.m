/** 6D.3.3.5 — canonização da pauta de lançamento. */
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { AssessmentPeriodPage } from "./assessment-period-page";
import { AssessmentEntryFieldPage } from "./assessment-entry-field-page";
import { InstrumentPage, InstrumentsSection } from "./assessment-instrument-pages";
import { FIELD_LAB_INSTRUMENT_ID } from "./assessment-entry-field-fixture";
import { instrumentStore } from "./assessment-instrument-store";
import { assessmentVersionsFromLegacyEntry } from "./assessment-entry-adapter";
import type { AssessmentEntry } from "./assessment-types";

const PAUTA = "/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId";

function mount(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const make = (p: string, el: (r: { params: Record<string, string>; search: Record<string, string> }) => ReactNode) => {
    const route = createRoute({
      getParentRoute: () => root,
      path: p,
      validateSearch: (s: Record<string, unknown>) => s as Record<string, string>,
      component: function R() {
        return <>{el({ params: route.useParams() as never, search: route.useSearch() as never })}</>;
      },
    });
    return route;
  };
  const router = createRouter({
    routeTree: root.addChildren([
      make("/diario/turmas/$turmaId/avaliacao", ({ params, search }) => (
        <InstrumentsSection classId={params["turmaId"]!} search={search} />
      )),
      make("/diario/turmas/$turmaId/avaliacao/periodo", ({ params, search }) => (
        <AssessmentPeriodPage classId={params["turmaId"]!} search={search} />
      )),
      make(PAUTA, ({ params, search }) => (
        <div data-testid="canonical-pauta">
          <AssessmentEntryFieldPage classId={params["turmaId"]!} instrumentId={params["instrumentoId"]!} search={search} />
        </div>
      )),
      make("/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId", ({ params, search }) => (
        <InstrumentPage classId={params["turmaId"]!} instrumentId={params["instrumentoId"]!} search={search} />
      )),
      make("/diario/turmas/$turmaId", () => <p>turma</p>),
      make("/diario/turmas/$turmaId/projecao", () => <p>projeção</p>),
      make("/diario/turmas/$turmaId/avaliacao/instrumentos/novo", () => <p>novo</p>),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router as never} />);
  return router;
}

const lab = `/diario/turmas/tur-001/avaliacao/pauta/${FIELD_LAB_INSTRUMENT_ID}`;

describe("6D.3.3.5 — pauta canônica", () => {
  it("A. Avaliação da turma → Abrir pauta chega à pauta canônica", async () => {
    const router = mount("/diario/turmas/tur-001/avaliacao");
    fireEvent.click(await screen.findByTestId(`instrument-open-${FIELD_LAB_INSTRUMENT_ID}`));
    await screen.findByTestId("canonical-pauta");
    expect(router.state.location.pathname).toBe(lab);
  });

  it("B/C/D. Avaliação do período → mesma pauta; registro chega à matriz; store legada intocada", async () => {
    const legacyBefore = instrumentStore.snapshot().entries.length;
    const router = mount("/diario/turmas/tur-001/avaliacao/periodo");
    const item = await screen.findByTestId(`period-instrument-${FIELD_LAB_INSTRUMENT_ID}`);
    fireEvent.click(within(item).getByRole("link", { name: "Abrir pauta" }));
    await screen.findByTestId("canonical-pauta");
    expect(router.state.location.pathname).toBe(lab);
    const input = screen.getAllByTestId(/^assessment-numeric-/).find((el) => !(el as HTMLInputElement).value) as HTMLInputElement;
    const studentId = input.getAttribute("data-testid")!.replace("assessment-numeric-", "");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "64" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    fireEvent.click(screen.getByTestId("assessment-register"));
    fireEvent.click(within(screen.getByTestId("assessment-registration-success")).getByRole("link", { name: /Voltar à Avaliação do período/ }));
    const matrix = await screen.findByTestId("period-matrix");
    expect(within(matrix).getByTestId(`period-cell-${studentId}-${FIELD_LAB_INSTRUMENT_ID}`).textContent).toContain("64");
    expect(instrumentStore.snapshot().entries.length).toBe(legacyBefore);
  });

  it("E. lançamento legado continua conversível para versões oficiais", () => {
    const legacy = {
      id: "ent-x", instrumentId: "ins-x", studentId: "est-x", status: "registrado",
      value: { kind: "nao-registrado", reason: "Não realizou" },
      createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z", registeredAt: "2026-03-01T00:00:00Z",
    } as unknown as AssessmentEntry;
    const versions = assessmentVersionsFromLegacyEntry(legacy);
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.at(-1)!.value.kind).toBe("nao-registrado");
  });

  it("F. rota antiga não oferece lançamento, só Abrir pauta", async () => {
    mount(`/diario/turmas/tur-001/avaliacao/instrumentos/${FIELD_LAB_INSTRUMENT_ID}`);
    await screen.findByTestId("legacy-open-pauta");
    expect(screen.queryByRole("button", { name: /Salvar rascunhos|Registrar rascunhos/ })).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("G. nenhuma linguagem de laboratório na pauta oficial", async () => {
    mount(lab);
    const page = await screen.findByTestId("canonical-pauta");
    expect(page.textContent).not.toMatch(/laborat|2\.0|simula|fictíc|outra sessão/i);
  });
});
