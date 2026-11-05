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

function setSession(writable: boolean, writableSchoolId: string | null = null) {
  mocks.session = {
    status: "signed-in", sessionRevision: 1, user: { id: "test-user" },
    person: writable ? { id: "staff-person", displayName: "Servidor" } : null,
    capabilities: [
      { capabilityId: "consultar-acompanhamento-institucional", schoolId: null },
      ...(writable ? [{ capabilityId: "registrar-acompanhamento-institucional", schoolId: writableSchoolId }] : []),
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
    expect(screen.getAllByText("INEP: 33000001").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("heading", { name: "Registrar nova visita" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar visita e plano" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar evolução" })).toBeNull();
    expect(mocks.recordVisitBundle).not.toHaveBeenCalled();
    expect(mocks.recordAction).not.toHaveBeenCalled();
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });

  it("limita formulário de escrita à escola explicitamente autorizada, mantendo leitura nas demais", async () => {
    setSession(true, "school-a");
    renderPage();
    await openSchool("Escola Serra");
    expect(await screen.findByText("Nenhuma medida cadastrada para esta unidade.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Registrar nova visita" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar visita e plano" })).toBeNull();
    expect(mocks.recordVisitBundle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Escola Centro" }));
    await screen.findByRole("heading", { name: "Escola Centro" });
    expect(screen.getByRole("heading", { name: "Registrar nova visita" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar visita e plano" })).toBeDisabled();
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

  it("remove a medida intermediária sem apagar descrição ou responsável das demais", async () => {
    setSession(true);
    renderPage();
    await openSchool("Escola Centro");
    const form = screen.getByRole("heading", { name: "Registrar nova visita" }).closest("form")!;
    const fields = within(form);

    fireEvent.change(fields.getByRole("textbox", { name: "Diagnóstico da realidade" }),
      { target: { value: "Acompanhamento da infraestrutura" } });
    fireEvent.click(fields.getByRole("button", { name: "Adicionar medida" }));
    fireEvent.click(fields.getByRole("button", { name: "Adicionar medida" }));

    const descriptions = fields.getAllByRole("textbox", { name: "O que precisa ser feito" });
    const responsibles = fields.getAllByRole("textbox", { name: "Responsável declarado" });
    expect(descriptions).toHaveLength(3);
    fireEvent.change(descriptions[0]!, { target: { value: "Providência A" } });
    fireEvent.change(descriptions[1]!, { target: { value: "Providência B" } });
    fireEvent.change(descriptions[2]!, { target: { value: "Providência C" } });
    fireEvent.change(responsibles[0]!, { target: { value: "Direção" } });
    fireEvent.change(responsibles[1]!, { target: { value: "Equipe intermediária" } });
    fireEvent.change(responsibles[2]!, { target: { value: "Coordenação" } });

    fireEvent.click(fields.getByRole("button", { name: "Remover medida 2" }));
    const remainingDescriptions = fields.getAllByRole("textbox", { name: "O que precisa ser feito" });
    const remainingResponsibles = fields.getAllByRole("textbox", { name: "Responsável declarado" });
    expect(remainingDescriptions).toHaveLength(2);
    expect(remainingDescriptions[0]).toHaveValue("Providência A");
    expect(remainingDescriptions[1]).toHaveValue("Providência C");
    expect(remainingResponsibles[0]).toHaveValue("Direção");
    expect(remainingResponsibles[1]).toHaveValue("Coordenação");

    fireEvent.click(fields.getByRole("button", { name: "Salvar visita e plano" }));
    await waitFor(() => expect(mocks.recordVisitBundle).toHaveBeenCalledTimes(1));
    const sent = mocks.recordVisitBundle.mock.calls[0]?.[0] as { actions: { description: string; responsible: string }[] };
    expect(sent.actions.map((item) => [item.description, item.responsible])).toEqual([
      ["Providência A", "Direção"], ["Providência C", "Coordenação"],
    ]);
  });

  it("permite ordenar três medidas propostas sem misturar responsáveis no envio", async () => {
    setSession(true);
    renderPage();
    await openSchool("Escola Centro");
    const form = screen.getByRole("heading", { name: "Registrar nova visita" }).closest("form")!;
    const fields = within(form);

    fireEvent.change(fields.getByRole("textbox", { name: "Diagnóstico da realidade" }),
      { target: { value: "Acompanhamento em andamento" } });
    fireEvent.click(fields.getByRole("button", { name: "Adicionar medida" }));
    fireEvent.click(fields.getByRole("button", { name: "Adicionar medida" }));

    const descriptions = fields.getAllByRole("textbox", { name: "O que precisa ser feito" });
    const responsibles = fields.getAllByRole("textbox", { name: "Responsável declarado" });
    for (const [i, name, responsible] of [
      [0, "Ajustar biblioteca", "Direção"],
      [1, "Organizar transporte", "Equipe"],
      [2, "Revisar equipamentos", "Coordenação"],
    ] as const) {
      fireEvent.change(descriptions[i]!, { target: { value: name } });
      fireEvent.change(responsibles[i]!, { target: { value: responsible } });
    }
    expect(fields.getByRole("button", { name: "Subir medida 1" })).toBeDisabled();
    expect(fields.getByRole("button", { name: "Descer medida 3" })).toBeDisabled();

    fireEvent.click(fields.getByRole("button", { name: "Subir medida 3" }));
    const moved = fields.getAllByRole("textbox", { name: "O que precisa ser feito" });
    expect(moved.map((input) => (input as HTMLTextAreaElement).value))
      .toEqual(["Ajustar biblioteca", "Revisar equipamentos", "Organizar transporte"]);
    expect(fields.getAllByRole("textbox", { name: "Responsável declarado" })
      .map((input) => (input as HTMLInputElement).value))
      .toEqual(["Direção", "Coordenação", "Equipe"]);

    fireEvent.click(fields.getByRole("button", { name: "Salvar visita e plano" }));
    await waitFor(() => expect(mocks.recordVisitBundle).toHaveBeenCalledTimes(1));
    const sent = mocks.recordVisitBundle.mock.calls[0]?.[0] as {
      actions: { description: string; responsible: string }[];
    };
    expect(sent.actions.map((a) => [a.description, a.responsible])).toEqual([
      ["Ajustar biblioteca", "Direção"],
      ["Revisar equipamentos", "Coordenação"],
      ["Organizar transporte", "Equipe"],
    ]);
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
