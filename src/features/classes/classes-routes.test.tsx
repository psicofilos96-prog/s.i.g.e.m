import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/** Testes de comportamento observável das telas de turmas. Nenhum dado é persistido. */
describe("Turmas — consulta", () => {
  it("lista turmas fictícias com colunas de contexto", async () => {
    renderOperationalRoutes("/turmas");

    expect(await screen.findByRole("heading", { name: "Turmas", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Período letivo/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Organização acadêmica/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Agrupamentos/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Turno e jornada/ })).toBeInTheDocument();
    expect(screen.getByText(/8 de 8 turmas fictícias/)).toBeInTheDocument();
  });

  it("filtra por pesquisa de agrupamento", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/turmas");

    await user.type(await screen.findByLabelText("Pesquisar turmas"), "Fase VII");
    expect(
      screen.getByRole("link", { name: /Turma demonstrativa EJA Fases VII e VIII/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /3º ano A/ })).not.toBeInTheDocument();
  });

  it("filtra por período letivo mantendo turmas históricas consultáveis", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/turmas");

    const trigger = await screen.findByRole("combobox", { name: "Período letivo" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("option", { name: "Período letivo 2025" }));

    expect(screen.getByRole("link", { name: /6º ano A \(encerrada\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /3º ano A/ })).not.toBeInTheDocument();
  });
});

describe("Turmas — detalhe", () => {
  it("apresenta contexto acadêmico distinguindo período letivo e organização", async () => {
    renderOperationalRoutes("/turmas/tur-001");

    expect(
      await screen.findByRole("heading", { name: /Turma demonstrativa 3º ano A/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contexto acadêmico" })).toBeInTheDocument();
    expect(screen.getAllByText("Período letivo").length).toBeGreaterThan(0);
    expect(screen.getByText("Organização acadêmica")).toBeInTheDocument();
    expect(screen.getAllByText(/não se confunde com período avaliativo/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /Instituição Educacional Demonstrativa Horizonte/ }),
    ).toBeInTheDocument();
  });

  it("mostra turma de organização simples com um único agrupamento", async () => {
    renderOperationalRoutes("/turmas/tur-001");

    const list = await screen.findByRole("list", { name: "Agrupamentos atendidos" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByText(/Organização simples/).length).toBeGreaterThan(0);
  });

  it("distingue os agrupamentos de uma turma multietapa", async () => {
    renderOperationalRoutes("/turmas/tur-003");

    const list = await screen.findByRole("list", { name: "Agrupamentos atendidos" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(list).getByText(/1º ano/)).toBeInTheDocument();
    expect(within(list).getByText(/2º ano/)).toBeInTheDocument();
    expect(within(list).getByText(/3º ano/)).toBeInTheDocument();
    expect(screen.getByText(/3 agrupamentos atendidos/)).toBeInTheDocument();
  });

  it("apresenta a EJA por fases, não por anos", async () => {
    renderOperationalRoutes("/turmas/tur-004");

    const list = await screen.findByRole("list", { name: "Agrupamentos atendidos" });
    const phases = within(list).getAllByRole("listitem");
    expect(phases).toHaveLength(2);
    expect(phases[0]!).toHaveTextContent("Fase II");
    expect(phases[1]!).toHaveTextContent("Fase III");
    expect(within(list).queryByText(/º ano/)).not.toBeInTheDocument();
  });

  it("trata jornada e turno como informações distintas", async () => {
    renderOperationalRoutes("/turmas/tur-002");

    expect(await screen.findByRole("heading", { name: "Jornada e turno" })).toBeInTheDocument();
    expect(screen.getByText("Turno")).toBeInTheDocument();
    expect(screen.getByText("Jornada")).toBeInTheDocument();
    expect(screen.getByText(/nunca um atributo Sim\/Não/)).toBeInTheDocument();
  });

  it("navega da turma para a matriz curricular aplicável", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/turmas/tur-005");

    await user.click(await screen.findByRole("link", { name: /MC-EF2-002 · Versão 2/ }));
    expect(
      await screen.findByRole("heading", { name: /Matriz curricular do Ensino Fundamental/ }),
    ).toBeInTheDocument();
  });

  it("mantém turma histórica consultável com o contexto registrado", async () => {
    renderOperationalRoutes("/turmas/tur-006");

    expect(await screen.findByText(/Turma histórica em modo somente consulta/)).toBeInTheDocument();
    expect(screen.getAllByText("Período letivo 2025").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /MC-EF2-001 · Versão 1/ })).toBeInTheDocument();
    expect(screen.getByText(/versões posteriores não alteram este registro/)).toBeInTheDocument();
  });

  it("mantém as áreas futuras desabilitadas", async () => {
    renderOperationalRoutes("/turmas/tur-001");

    expect(await screen.findByRole("tab", { name: "Visão geral" })).toBeEnabled();
    for (const label of ["Estudantes", "Componentes", "Profissionais", "Horários", "Histórico"]) {
      expect(screen.getByRole("tab", { name: label })).toBeDisabled();
    }
  });

  it("apresenta estado de turma não encontrada", async () => {
    renderOperationalRoutes("/turmas/inexistente");

    expect(await screen.findByText("Turma não encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para turmas" })).toBeInTheDocument();
  });

  it("expõe estrutura acessível: cabeçalho, abas rotuladas e seções nomeadas", async () => {
    renderOperationalRoutes("/turmas/tur-003");

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: /Áreas da turma/ })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Contexto da turma" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organização da turma" })).toBeInTheDocument();
  });
});
