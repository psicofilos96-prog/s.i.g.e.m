import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditUnitSheet } from "./unit-detail-page";
import { renderWithRouter } from "@/test/router-harness";

const unitName = "Instituição Educacional Demonstrativa Horizonte";

describe("EditUnitSheet (edição contextual)", () => {
  it("abre e fecha o painel de edição", async () => {
    renderWithRouter(<EditUnitSheet name={unitName} />);
    await userEvent.click(await screen.findByRole("button", { name: /editar dados/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sinaliza alterações não salvas ao editar um campo", async () => {
    renderWithRouter(<EditUnitSheet name={unitName} />);
    await userEvent.click(await screen.findByRole("button", { name: /editar dados/i }));

    const field = await screen.findByLabelText("Nome demonstrativo");
    expect(screen.queryByText(/alterações não salvas/i)).not.toBeInTheDocument();

    await userEvent.type(field, " revisada");
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();
  });

  it("limpa o estado de alterações após simular o salvamento", async () => {
    renderWithRouter(<EditUnitSheet name={unitName} />);
    await userEvent.click(await screen.findByRole("button", { name: /editar dados/i }));
    await userEvent.type(await screen.findByLabelText("Nome demonstrativo"), "x");
    await userEvent.click(screen.getByRole("button", { name: /simular salvamento/i }));

    expect(screen.queryByText(/alterações não salvas/i)).not.toBeInTheDocument();
    expect(screen.getByText(/nenhuma informação foi armazenada/i)).toBeInTheDocument();
  });
});
