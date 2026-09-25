import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

describe("Matrizes curriculares", () => {
  it("renderiza a consulta de matrizes com versão, vigência e situação", async () => {
    renderOperationalRoutes("/matrizes-curriculares");
    expect(
      await screen.findByRole("heading", { name: "Matrizes curriculares", level: 1 }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: /consulta demonstrativa de matrizes curriculares/i,
    });
    expect(within(table).getByText("MC-EI-002")).toBeInTheDocument();
    expect(within(table).getAllByText("Versão 1").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Histórica").length).toBeGreaterThan(0);
  });

  it("pesquisa matrizes por segmento", async () => {
    renderOperationalRoutes("/matrizes-curriculares");
    const search = await screen.findByRole("textbox", {
      name: "Pesquisar matrizes curriculares",
    });
    await userEvent.type(search, "EJA — 2º");
    expect(screen.getByText("MC-EJA2-001")).toBeInTheDocument();
    expect(screen.queryByText("MC-EF1-001")).not.toBeInTheDocument();
  });

  it("apresenta a Educação Infantil por campos de experiências e jornadas", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-ei-2");
    expect(
      await screen.findByRole("heading", { name: /Educação Infantil · Versão 2/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Campos de experiências")).toBeInTheDocument();
    expect(screen.getByText("O eu, o outro e o nós")).toBeInTheDocument();
    expect(screen.getByText("35h semanais")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("apresenta o Ensino Fundamental em leitura matricial com totais", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-ef2-2");
    const table = await screen.findByRole("table", {
      name: /Estrutura curricular de Matriz curricular do Ensino Fundamental — 2º segmento/,
    });
    expect(within(table).getByRole("columnheader", { name: /6º ano/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /9º ano/ })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: /Língua Portuguesa/ })).toBeInTheDocument();
    const totalsRow = within(table).getByRole("rowheader", { name: "Total semanal" }).closest("tr");
    expect(totalsRow).not.toBeNull();
    expect(within(totalsRow as HTMLElement).getByText("29")).toBeInTheDocument();
  });

  it("representa as fases da EJA sem tratá-las como anos escolares", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-eja1-1");
    const table = await screen.findByRole("table", {
      name: /Estrutura curricular de Matriz curricular da EJA — 1º segmento/,
    });
    expect(within(table).getByRole("columnheader", { name: /Fase I$/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /Fase V$/ })).toBeInTheDocument();
    expect(screen.getByText(/não equivalem diretamente a anos escolares/i)).toBeInTheDocument();
  });

  it("trata o tempo integral como organização de oferta e jornada", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-int-1");
    expect(
      await screen.findByRole("heading", {
        name: /Ampliação curricular em tempo integral/,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/não como atributo Sim\/Não/i)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Itens não modelados" })).toBeInTheDocument();
  });

  it("mantém a versão anterior consultável e distinta da vigente", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-ef2-2");
    const versions = await screen.findByRole("list", { name: "Versões da matriz" });
    const previousLink = within(versions).getByRole("link", { name: "Versão 1" });
    await userEvent.click(previousLink);

    expect(
      await screen.findByRole("heading", {
        name: /Ensino Fundamental — 2º segmento · Versão 1/,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Histórica/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/31\/01\/2026/).length).toBeGreaterThan(0);
  });

  it("mostra onde a matriz está demonstrativamente aplicada", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-ef1-1");
    const applications = await screen.findByRole("list", { name: "Aplicações" });
    expect(
      within(applications).getByRole("link", {
        name: "Instituição Educacional Demonstrativa Horizonte",
      }),
    ).toBeInTheDocument();
    expect(within(applications).getAllByText("Matriz atualmente aplicada").length).toBeGreaterThan(
      0,
    );
  });

  it("oferece nova versão apenas para matriz vigente, levando ao workspace", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-ef1-1");
    const links = await screen.findAllByRole("link", { name: /Nova versão/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/matrizes-curriculares/nova-versao/mc-ef1-1");
    }
  });

  it("apresenta o estado Not Found demonstrativo para matriz inexistente", async () => {
    renderOperationalRoutes("/matrizes-curriculares/inexistente");
    expect(await screen.findByText("Matriz curricular não encontrada")).toBeInTheDocument();
  });
});
