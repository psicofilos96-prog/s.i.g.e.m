import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { RequestCard } from "./vacancy-request-page";
import { VacancyCard } from "./vacancies-book-pages";
import { MovementSection, InstitutionalEnrollmentWorkspace } from "@/features/student-life/institutional-enrollment-workspace";
import { Route as AllocationsRoute } from "@/routes/enturmacoes.index";
import { ALLOWED, type VacancyRequestRow } from "./vacancy-request-bank";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), movement: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/rpc-call", () => ({ callRpc: (...args: unknown[]) => mocks.rpc(...args) }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...await original<typeof import("@tanstack/react-router")>(),
  Link: ({ to, search, children, ...props }: { to: string; search?: Record<string, string>; children: ReactNode }) => <a {...props} href={to} onClick={(e) => { e.preventDefault(); mocks.navigate(to, search); }}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: async () => ({ data: [{ student_id: "student", display_name: "Aluno existente", census_inep: null }], error: null }),
} }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => ({ status: "signed-in", capabilities: [{ capabilityId: "consultar-matricula-e-movimentacao", schoolId: "school-internal" }] }) }));
vi.mock("@/features/units/current-school-names", () => ({ readCurrentSchoolNames: async () => new Map([["school-internal", "Escola Municipal Cadastrada"]]) }));
vi.mock("@/features/student-life/cycle-enrollment-source", async (original) => ({
  ...await original<typeof import("@/features/student-life/cycle-enrollment-source")>(),
  recordStudentMovement: (...args: unknown[]) => mocks.movement(...args),
}));

const request = (last_action: VacancyRequestRow["last_action"] = "convocar"): VacancyRequestRow => ({
  id: "request", protocol_code: "SV-2026-1", protocol_seq: 1, desired_stage: "1º ano", desired_shift: null,
  student_name: "Aluno existente", student_birth_date: "2020-01-01", guardian_name: "Responsável existente", guardian_phone: null,
  note: null, recorded_at: "2026-02-01T10:00:00Z", last_seq: 7, last_action, due_on: "2026-02-06", last_note: null, last_at: null,
});
const d: ComponentProps<typeof MovementSection>["d"] = {
  enrollments: [], participations: [], allocations: [], natures: [], bondStatuses: [], years: [], classes: [],
  movementTypes: [{ valueId: "transferencia", label: "Transferência (Transferido) v1", version: 1 }],
  history: { enrollments: [], participations: [], allocations: [], movements: [{
    id: "movement-version", logical_id: "movement", version: 2, supersedes_id: "previous", student_id: "student", enrollment_id: "enrollment",
    movement_type_id: "transferencia", movement_type_version: 1, effective_on: "2026-02-10", origin: { schoolId: "school" }, destination: { schoolId: "other" },
    reason_code: null, reason_text: "Motivo existente", originating_act_ref: null, correction_reason: null, created_at: "2026-02-10T10:00:00Z",
  }] },
};
async function openMenu(button = screen.getByRole("button", { name: "Mais ações" })) {
  button.focus(); await userEvent.keyboard("{Enter}");
  await screen.findByRole("menu");
}
const clients: QueryClient[] = [];
function mount(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
beforeEach(() => { mocks.rpc.mockReset().mockResolvedValue([]); mocks.movement.mockReset().mockResolvedValue("saved"); mocks.navigate.mockReset(); });
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe("fila — os controles preservam os escritores e as transições", () => {
  it("Fazer a matrícula abre o fluxo existente sem marcar o pedido", async () => {
    mount(<RequestCard r={request()} position={1} onChanged={vi.fn()} schoolName="Escola" />);
    await userEvent.click(screen.getByRole("link", { name: "Fazer a matrícula" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/matriculas/nova", undefined);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["matriculado", "nao-compareceu", "voltar-a-fila", "desistiu", "cancelar"] as const)("menu confirma a mesma transição %s e base esperada", async (action) => {
    const changed = vi.fn();
    mount(<RequestCard r={request()} position={1} onChanged={changed} schoolName="Escola" />);
    const user = userEvent.setup(); await openMenu();
    const index = ["matriculado", "nao-compareceu", "voltar-a-fila", "desistiu", "cancelar"].indexOf(action);
    const item = screen.getAllByRole("menuitem")[index]; if (!item) throw new Error("Ação ausente");
    await user.click(item);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Motivo preservado" } });
    expect(mocks.rpc).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^Confirmar:/ }));
    expect(mocks.rpc).toHaveBeenCalledWith("secretariat_vacancy_request_act", { _request: "request", _action: action, _due: null, _note: "Motivo preservado", _expected_seq: 7 });
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });
  it.each([null, "convocar", "nao-compareceu", "matriculado", "desistiu", "cancelar"] as const)("não amplia ações para estado %s", async (last) => {
    mount(<RequestCard r={request(last)} position={undefined} onChanged={vi.fn()} schoolName="Escola" />);
    await openMenu();
    const st = last === null ? "aguardando" : last === "convocar" ? "convocada" : last === "matriculado" ? "matriculada" : last === "cancelar" ? "cancelada" : last;
    const actions = ["matriculado", "nao-compareceu", "voltar-a-fila", "desistiu", "cancelar"] as const;
    screen.getAllByRole("menuitem").forEach((item, i) => {
      const action = actions[i]; if (!action) throw new Error("Ação inesperada");
      expect(item.getAttribute("data-disabled") !== null).toBe(!ALLOWED[st].includes(action));
    });
  });
  it("mantém convocação com prazo e confirmação separados da matrícula", async () => {
    mount(<RequestCard r={request(null)} position={1} onChanged={vi.fn()} schoolName="Escola" />);
    const user = userEvent.setup(); await user.click(screen.getByText("Convocação")); await user.click(screen.getByRole("button", { name: "Convocar" }));
    fireEvent.change(screen.getByLabelText(/Prazo para comparecer/), { target: { value: "2026-02-08" } });
    await user.click(screen.getByRole("button", { name: "Confirmar: Convocar" }));
    expect(mocks.rpc).toHaveBeenCalledWith("secretariat_vacancy_request_act", expect.objectContaining({ _action: "convocar", _due: "2026-02-08", _expected_seq: 7 }));
  });
  it("falha não chama atualização e permite tentar a mesma confirmação", async () => {
    const changed = vi.fn(); mocks.rpc.mockRejectedValueOnce(new Error("unavailable"));
    mount(<RequestCard r={request()} position={1} onChanged={changed} schoolName="Escola" />);
    const user = userEvent.setup(); await openMenu(); await user.click(screen.getByRole("menuitem", { name: "Matriculado" }));
    await user.click(screen.getByRole("button", { name: "Confirmar: Matriculado" }));
    await screen.findByRole("alert"); expect(changed).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar: Matriculado" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce()); expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});

describe("atalhos escolares reutilizam fluxos existentes", () => {
  it("vagas conhecidas preservam o valor recebido, sem recalcular pela ocupação", () => {
    mount(<VacancyCard yearLabel="2026" r={{ class_id: "existing-class", name: "Turma A", shift_label: "Manhã", capacity: 20, occupancy: 18, available: 1, vacancy_state: "ha-vaga" }} />);
    const values = screen.getAllByRole("definition").map((node) => node.textContent);
    expect(values).toEqual(["20", "18", "1"]);
    expect(screen.queryByRole("link", { name: "Definir capacidade" })).toBeNull();
  });
  it("capacidade ausente abre enturmação com o ID interno da turma", async () => {
    mount(<VacancyCard yearLabel="2026" r={{ class_id: "existing-class", name: "Turma A", shift_label: "Manhã", capacity: null, occupancy: 12, available: null, vacancy_state: "capacidade-nao-informada" }} />);
    await userEvent.click(screen.getByRole("link", { name: "Definir capacidade" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/enturmacoes/nova", { turma: "existing-class" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["/enturmacoes/nova", "/enturmacoes/movimentar"])("card inteiro abre %s", async (path) => {
    const Component = AllocationsRoute.options.component; if (!Component) throw new Error("Página ausente");
    mount(<Component />);
    const link = screen.getAllByRole("link").find((item) => item.getAttribute("href") === path); if (!link) throw new Error("Fluxo ausente");
    link.focus(); await userEvent.keyboard("{Enter}");
    expect(mocks.navigate).toHaveBeenCalledWith(path, undefined);
  });
  it("o seletor mantém o ID interno ao selecionar pelo nome oficial", async () => {
    mount(<InstitutionalEnrollmentWorkspace focus="movimentacoes" />);
    const option = await screen.findByRole("option", { name: "Escola Municipal Cadastrada" });
    const select = screen.getByLabelText("Escola");
    await userEvent.selectOptions(select, option);
    expect((select as HTMLSelectElement).value).toBe("school-internal");
  });
});

describe("movimentações — retificação permanece na linha autorizada", () => {
  it("menu abre a mesma retificação e grava a mesma identidade/versionamento", async () => {
    const run = vi.fn(async (fn: () => Promise<unknown>) => { await fn(); });
    mount(<MovementSection d={d} school="school" validOn="2026-02-10" canRegister run={run} />);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Mais ações de Aluno existente" });
    const table = screen.getByRole("table");
    await openMenu(within(table).getByRole("button", { name: /Mais ações/ }));
    await user.click(screen.getByRole("menuitem", { name: "Retificar data" }));
    fireEvent.change(screen.getByLabelText("Nova data de efeito"), { target: { value: "2026-02-11" } });
    fireEvent.change(screen.getByLabelText("Motivo da retificação"), { target: { value: "Data conferida" } });
    expect(mocks.movement).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Gravar retificação" }));
    expect(mocks.movement).toHaveBeenCalledWith(expect.objectContaining({ logicalId: "movement", baseVersionId: "movement-version", studentId: "student", enrollmentId: "enrollment", effectiveOn: "2026-02-11", correctionReason: "Data conferida", type: d.movementTypes[0] }));
  });
  it("consulta sem autorização não expõe retificação", async () => {
    mount(<MovementSection d={d} school="school" validOn="2026-02-10" canRegister={false} run={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Mais ações/ })).toBeNull();
    expect(mocks.movement).not.toHaveBeenCalled();
  });
});