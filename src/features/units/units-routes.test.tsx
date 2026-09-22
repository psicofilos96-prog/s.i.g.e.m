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
    expect(
      screen.getByRole("table", {
        name: /consulta institucional de unidades escolares fictícias/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Instituição Educacional Demonstrativa Horizonte")).toBeInTheDocument();
    expect(screen.getByText("INEP 33000001")).toBeInTheDocument();
  });

  it("filtra a listagem pela pesquisa por nome atual", async () => {
    renderUnitsRoutes("/unidades");
    const search = await screen.findByRole("textbox", { name: "Pesquisar unidades" });
    await userEvent.type(search, "Estação");
    expect(screen.getByText("Espaço Educacional Demonstrativo Estação")).toBeInTheDocument();
    expect(
      screen.queryByText("Instituição Educacional Demonstrativa Horizonte"),
    ).not.toBeInTheDocument();
  });

  it("filtra a listagem pela pesquisa por nome anterior preservado", async () => {
    renderUnitsRoutes("/unidades");
    const search = await screen.findByRole("textbox", { name: "Pesquisar unidades" });
    await userEvent.type(search, "Alto da Serra");
    expect(screen.getByText("Instituição Educacional Demonstrativa Serra")).toBeInTheDocument();
    expect(screen.getByText(/Antes: Unidade Demonstrativa Alto da Serra/i)).toBeInTheDocument();
  });

  it("renderiza a visão geral de uma unidade existente", async () => {
    renderUnitsRoutes("/unidades/demo-001");
    expect(
      await screen.findByRole("heading", {
        name: "Instituição Educacional Demonstrativa Horizonte",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("list", { name: "Histórico demonstrativo" })).toBeInTheDocument();
    expect(screen.getAllByText(/Unidade Demonstrativa Horizonte Antiga/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Instituição Educacional Demonstrativa Horizonte/).length,
    ).toBeGreaterThan(0);
  });

  it("mantém as áreas futuras desabilitadas e não navegáveis", async () => {
    renderUnitsRoutes("/unidades/demo-001");
    const futureTabs = await screen.findAllByRole("tab", {
      name: /Oferta educacional|Estrutura física/,
    });
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
