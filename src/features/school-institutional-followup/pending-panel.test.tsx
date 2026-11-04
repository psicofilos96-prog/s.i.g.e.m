import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InstitutionalPendingPanel } from "./pending-panel";
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
});
