import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUnitsRoutes } from "@/test/router-harness";

describe("Rotas de unidades", () => {
  it("renderiza a central de consulta em /unidades", async () => {
    renderUnitsRoutes("/unidades");
    expect(
      await screen.findByRole("heading", { name: "Unidades escolares", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /unidades escolares demonstrativas/i })).toBeInTheDocument();
    expect(screen.getByText("Unidade Demonstrativa Horizonte")).toBeInTheDocument();
  });

  it("filtra a listagem pela pesquisa", async () => {
    renderUnitsRoutes("/unidades");
    const search = await screen.findByRole("textbox", { name: "Pesquisar unidades" });
    await userEvent.type(search, "Estação");
    expect(screen.getByText("Unidade Demonstrativa Estação")).toBeInTheDocument();
    expect(screen.queryByText("Unidade Demonstrativa Horizonte")).not.toBeInTheDocument();
  });

  it("renderiza a visão geral de uma unidade existente", async () => {
    renderUnitsRoutes("/unidades/demo-001");
    expect(
      await screen.findByRole("heading", { name: "Unidade Demonstrativa Horizonte", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("list", { name: "Histórico demonstrativo" })).toBeInTheDocument();
  });

  it("mantém as áreas futuras desabilitadas e não navegáveis", async () => {
    renderUnitsRoutes("/unidades/demo-001");
    const futureTabs = await screen.findAllByRole("tab", { name: "Área a definir" });
    expect(futureTabs.length).toBeGreaterThan(0);
    for (const tab of futureTabs) {
      expect(tab).toBeDisabled();
      await userEvent.click(tab);
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("apresenta o estado Not Found demonstrativo para identificador inexistente", async () => {
    renderUnitsRoutes("/unidades/inexistente");
    expect(await screen.findByText("Unidade não encontrada")).toBeInTheDocument();
  });
});
