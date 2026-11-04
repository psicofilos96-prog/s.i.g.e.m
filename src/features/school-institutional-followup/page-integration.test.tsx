import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InstitutionalSchoolFollowupPage } from "./page";

const mocks = vi.hoisted(() => ({
  session: { status: "signed-out" } as Record<string, unknown>,
  networkFollowup: vi.fn(),
  monthlyFollowup: vi.fn(),
  networkPendingFollowup: vi.fn(),
  followupStatuses: vi.fn(),
  schoolFollowup: vi.fn(),
  recordVisitBundle: vi.fn(),
  recordVisit: vi.fn(),
  recordAction: vi.fn(),
  recordUpdate: vi.fn(),
}));

vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => mocks.session,
  sessionContextKey: (a: { status: string }) => a.status === "signed-in" ? "test-session#1" : null,
}));
vi.mock("@/features/authority/nav-capabilities", () => ({
  pathAllowed: (_authority: unknown, path: string) => path === "/acompanhamento-unidades",
}));
vi.mock("@/lib/academic-date", async (original) => ({
  ...(await original<typeof import("@/lib/academic-date")>()),
  operationalToday: () => "2026-11-04",
}));
vi.mock("./source", () => ({
  networkFollowup: mocks.networkFollowup,
  monthlyFollowup: mocks.monthlyFollowup,
  networkPendingFollowup: mocks.networkPendingFollowup,
  followupStatuses: mocks.followupStatuses,
  schoolFollowup: mocks.schoolFollowup,
  recordVisitBundle: mocks.recordVisitBundle,
  recordVisit: mocks.recordVisit,
  recordAction: mocks.recordAction,
  recordUpdate: mocks.recordUpdate,
}));
vi.mock("./analytics", () => ({
  InstitutionalFollowupAnalytics: () => <div data-testid="network-analytics">Resumo da rede</div>,
}));
vi.mock("./use-unsaved-warning", () => ({ useUnsavedFollowupWarning: () => undefined }));
vi.mock("./use-route-guard", () => ({ useFollowupRouteGuard: () => undefined }));
vi.mock("./report", () => ({
  exportFollowupNetwork: vi.fn(), exportFollowupSchool: vi.fn(), exportFollowupVisit: vi.fn(),
}));
vi.mock("./preparation-report", () => ({ exportFollowupPreparation: vi.fn() }));

const schools = [
  { school_id: "school-a", school_name: "Escola Centro", inep: "33000001",
    visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null },
  { school_id: "school-b", school_name: "Escola Serra", inep: "33000002",
    visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null },
];
const blankSchool = { visits: [], visit_history: [], actions: [], updates: [] };

function setSession(writable: boolean) {
  mocks.session = {
    status: "signed-in", sessionRevision: 1, user: { id: "test-user" },
    person: writable ? { id: "staff-person", displayName: "Servidor" } : null,
    capabilities: [
      { capabilityId: "consultar-acompanhamento-institucional", schoolId: null },
      ...(writable ? [{ capabilityId: "registrar-acompanhamento-institucional", schoolId: null }] : []),
    ],
  };
}
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const rendered = render(<QueryClientProvider client={client}>
    <InstitutionalSchoolFollowupPage />
  </QueryClientProvider>);
  return { ...rendered, client };
}
async function openSchool(name: string) {
  const button = await screen.findByRole("button", { name });
  fireEvent.click(button);
  return screen.findByRole("heading", { name });
}

describe("acompanhamento institucional — integração da página e capacidades", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session = { status: "signed-out" };
    mocks.networkFollowup.mockResolvedValue(schools);
    mocks.monthlyFollowup.mockResolvedValue([]);
    mocks.networkPendingFollowup.mockResolvedValue([]);
    mocks.followupStatuses.mockResolvedValue([]);
    mocks.schoolFollowup.mockResolvedValue(blankSchool);
    mocks.recordVisitBundle.mockResolvedValue("visit-created");
    mocks.recordVisit.mockResolvedValue("visit-corrected");
    mocks.recordAction.mockResolvedValue("action-created");
    mocks.recordUpdate.mockResolvedValue("update-created");
  });

  it("nega acesso à página sem sessão e não consulta os dados institucionais", () => {
    renderPage();
    expect(screen.getByText("Acesso não disponível")).toBeTruthy();
    expect(mocks.networkFollowup).not.toHaveBeenCalled();
    expect(mocks.schoolFollowup).not.toHaveBeenCalled();
  });

  it("Gabinete consulta unidades, mas não pode registrar visita ou medida", async () => {
    setSession(false);
    renderPage();
    await openSchool("Escola Centro");
    expect(await screen.findByText("Nenhuma medida cadastrada para esta unidade.")).toBeTruthy();
    expect(screen.getByText("INEP: 33000001")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Registrar nova visita" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar visita e plano" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar evolução" })).toBeNull();
    expect(mocks.recordVisitBundle).not.toHaveBeenCalled();
    expect(mocks.recordAction).not.toHaveBeenCalled();
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });

  it("servidor registra visita e plano com autoria vinculada à sessão e sem gravar campos incompletos", async () => {
    setSession(true);
    renderPage();
    await openSchool("Escola Centro");
    const form = await screen.findByRole("heading", { name: "Registrar nova visita" });
    const visitForm = form.closest("form");
    expect(visitForm).not.toBeNull();
    const visit = within(visitForm!);
    fireEvent.change(visit.getByRole("textbox", { name: "Objetivo da visita (opcional)" }),
      { target: { value: "Acompanhar o planejamento" } });
    fireEvent.change(visit.getByRole("textbox", { name: "Demais participantes informados (opcional)" }),
      { target: { value: "Outro servidor" } });
    fireEvent.change(visit.getByRole("textbox", { name: "Diagnóstico da realidade" }),
      { target: { value: "Organização pedagógica em revisão" } });
    fireEvent.change(visit.getByRole("textbox", { name: "O que precisa ser feito" }),
      { target: { value: "Revisar o acervo" } });
    fireEvent.change(visit.getByRole("textbox", { name: "Responsável declarado" }),
      { target: { value: "Direção" } });
    fireEvent.click(visit.getByRole("button", { name: "Salvar visita e plano" }));
    await waitFor(() => expect(mocks.recordVisitBundle).toHaveBeenCalledTimes(1));
    expect(mocks.recordVisitBundle).toHaveBeenCalledWith(expect.objectContaining({
      school: "school-a",
      day: "2026-11-04",
      purpose: "Acompanhar o planejamento",
      participants: "Outro servidor",
      diagnosis: "Organização pedagógica em revisão",
      actions: [expect.objectContaining({
        description: "Revisar o acervo",
        responsible: "Direção",
        due: null,
        request: expect.any(String),
      })],
      request: expect.any(String),
    }));
    expect(mocks.recordVisit).not.toHaveBeenCalled();
    expect(mocks.recordAction).not.toHaveBeenCalled();
  });

  it("impede troca de escola com diagnóstico pendente até descarte explícito", async () => {
    setSession(true);
    renderPage();
    await openSchool("Escola Centro");
    const form = screen.getByRole("heading", { name: "Registrar nova visita" }).closest("form")!;
    fireEvent.change(within(form).getByRole("textbox", { name: "Diagnóstico da realidade" }),
      { target: { value: "Diagnóstico ainda não registrado" } });

    fireEvent.click(screen.getByRole("button", { name: "Escola Serra" }));
    expect(screen.getByRole("heading", { name: "Escola Centro" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Escola Serra" })).toBeNull();
    expect(screen.getByText(/Há dados de visita ainda não registrados/)).toBeTruthy();
    expect(within(form).getByRole("textbox", { name: "Diagnóstico da realidade" }))
      .toHaveValue("Diagnóstico ainda não registrado");

    fireEvent.click(within(form).getByRole("button", { name: "Descartar preenchimento" }));
    expect(within(form).getByRole("textbox", { name: "Diagnóstico da realidade" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Escola Serra" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Escola Serra" })).toBeTruthy());
    expect(mocks.recordVisitBundle).not.toHaveBeenCalled();
  });
});
