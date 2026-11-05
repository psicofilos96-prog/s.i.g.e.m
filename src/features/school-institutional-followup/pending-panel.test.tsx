import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { InstitutionalPendingPanel } from "./pending-panel";
import { exportNetworkPending } from "./report";

vi.mock("./report", () => ({ exportNetworkPending: vi.fn() }));
import type { NetworkPendingAction } from "./model";

const pending: NetworkPendingAction[] = [
  {
    action_id: "measure-a", school_id: "school-a", school_name: "Escola das Águas", inep: "33000001",
    description: "Reorganizar biblioteca", responsible_label: "Direção", due_on: "2026-11-02",
    situation: "em andamento", last_update_on: "2026-11-03", created_at: "2026-10-01T12:00:00Z",
  },
  {
    action_id: "measure-b", school_id: "school-b", school_name: "Escola Serra", inep: null,
    description: "Revisar instalações", responsible_label: null, due_on: null,
    situation: "sem atualização", last_update_on: null, created_at: "2026-11-02T12:00:00Z",
  },
];

describe("quadro de providências — navegação contextual", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("abre a medida exata da escola autorizada, não apenas a página da escola", () => {
    const open = vi.fn();
    render(<InstitutionalPendingPanel rows={pending} loading={false} error={null}
      today="2026-11-04" onOpenAction={open} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "33000001" } });
    const button = screen.getByRole("button", { name: "Ver medida" });
    fireEvent.click(button);
    expect(open).toHaveBeenCalledExactlyOnceWith("school-a", "measure-a");
    expect(screen.queryByText("Revisar instalações")).toBeNull();
  });
  it("consulta vazia e erro não expõem dados de escolas que não vieram da RPC", () => {
    const open = vi.fn();
    const { rerender } = render(<InstitutionalPendingPanel rows={[]} loading={false}
      error={null} today="2026-11-04" onOpenAction={open} />);
    expect(screen.queryByRole("button", { name: "Ver medida" })).toBeNull();
    rerender(<InstitutionalPendingPanel rows={pending} loading={false}
      error={new Error("consulta indisponível")} today="2026-11-04" onOpenAction={open} />);
    expect(screen.queryByRole("button", { name: "Ver medida" })).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
  it("cancela a planilha antiga quando o leitor recebe pendências atualizadas", async () => {
    let finish!: () => void;
    const pendingExport = new Promise<void>((resolve) => { finish = resolve; });
    vi.mocked(exportNetworkPending).mockReturnValueOnce(pendingExport);
    const open = vi.fn();
    const { rerender } = render(<InstitutionalPendingPanel rows={pending} loading={false}
      error={null} today="2026-11-04" onOpenAction={open} selectedSchoolId="" />);
    const toolbar = within(screen.getByLabelText("Exportar quadro filtrado"));
    fireEvent.click(toolbar.getByRole("button", { name: "Excel" }));
    expect(exportNetworkPending).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(exportNetworkPending).mock.calls[0]?.[2] as AbortSignal;
    expect(signal.aborted).toBe(false);
    rerender(<InstitutionalPendingPanel rows={[pending[1]!]} loading={false}
      error={null} today="2026-11-04" onOpenAction={open} selectedSchoolId="" />);
    await waitFor(() => expect(signal.aborted).toBe(true));
    expect(screen.getByText(/download anterior foi cancelado/)).toBeTruthy();
    await act(async () => { finish(); await pendingExport; });
    expect(toolbar.getByRole("button", { name: "Excel" })).not.toBeDisabled();
    expect(vi.mocked(exportNetworkPending)).toHaveBeenCalledTimes(1);
  });

  it("filtro cancela exportação, mas resolução antiga não desbloqueia uma nova", async () => {
    let finishOld!: () => void;
    let finishNew!: () => void;
    const old = new Promise<void>((resolve) => { finishOld = resolve; });
    const next = new Promise<void>((resolve) => { finishNew = resolve; });
    vi.mocked(exportNetworkPending).mockReturnValueOnce(old).mockReturnValueOnce(next);
    render(<InstitutionalPendingPanel rows={pending} loading={false}
      error={null} today="2026-11-04" onOpenAction={vi.fn()} />);
    const toolbar = within(screen.getByLabelText("Exportar quadro filtrado"));
    fireEvent.click(toolbar.getByRole("button", { name: "PDF" }));
    expect(exportNetworkPending).toHaveBeenCalledTimes(1);
    const oldSignal = vi.mocked(exportNetworkPending).mock.calls[0]?.[2] as AbortSignal;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Serra" } });
    expect(oldSignal.aborted).toBe(true);
    fireEvent.click(toolbar.getByRole("button", { name: "Excel" }));
    expect(exportNetworkPending).toHaveBeenCalledTimes(2);
    const newSignal = vi.mocked(exportNetworkPending).mock.calls[1]?.[2] as AbortSignal;
    expect(newSignal.aborted).toBe(false);
    expect(toolbar.getByRole("button", { name: "Excel" })).toBeDisabled();
    await act(async () => { finishOld(); await old; });
    expect(toolbar.getByRole("button", { name: "Excel" })).toBeDisabled();
    expect(newSignal.aborted).toBe(false);
    await act(async () => { finishNew(); await next; });
    await waitFor(() => expect(toolbar.getByRole("button", { name: "Excel" })).not.toBeDisabled());
    expect(vi.mocked(exportNetworkPending).mock.calls[1]?.[0]).toEqual([pending[1]]);
  });

  it("cancela sincronamente ao abrir uma escola e aborta ao desmontar o quadro", async () => {
    let finish!: () => void;
    const pendingExport = new Promise<void>((resolve) => { finish = resolve; });
    vi.mocked(exportNetworkPending).mockReturnValueOnce(pendingExport);
    const open = vi.fn();
    const { unmount } = render(<InstitutionalPendingPanel rows={pending} loading={false}
      error={null} today="2026-11-04" onOpenAction={open} />);
    fireEvent.click(within(screen.getByLabelText("Exportar quadro filtrado"))
      .getByRole("button", { name: "PDF" }));
    const signal = vi.mocked(exportNetworkPending).mock.calls[0]?.[2] as AbortSignal;
    expect(signal.aborted).toBe(false);
    fireEvent.click(screen.getAllByRole("button", { name: "Ver medida" })[0]!);
    expect(signal.aborted).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { finish(); await pendingExport; });
  });

  it("cancela se o usuário mudar de escola enquanto o quadro continua visível", async () => {
    let finish!: () => void;
    const pendingExport = new Promise<void>((resolve) => { finish = resolve; });
    vi.mocked(exportNetworkPending).mockReturnValueOnce(pendingExport);
    const open = vi.fn();
    const { rerender } = render(<InstitutionalPendingPanel rows={pending} loading={false}
      error={null} today="2026-11-04" selectedSchoolId="school-a" onOpenAction={open} />);
    fireEvent.click(within(screen.getByLabelText("Exportar quadro filtrado"))
      .getByRole("button", { name: "Excel" }));
    const signal = vi.mocked(exportNetworkPending).mock.calls[0]?.[2] as AbortSignal;
    rerender(<InstitutionalPendingPanel rows={pending} loading={false}
      error={null} today="2026-11-04" selectedSchoolId="school-b" onOpenAction={open} />);
    await waitFor(() => expect(signal.aborted).toBe(true));
    await act(async () => { finish(); await pendingExport; });
  });

});
