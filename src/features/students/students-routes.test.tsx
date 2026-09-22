import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Testes de comportamento observável das telas de alunos.
 * Nenhum dado é persistido e nenhuma regra operacional é executada.
 */
describe("Alunos — consulta", () => {
  it("lista alunos fictícios com colunas mínimas de identificação", async () => {
    renderOperationalRoutes("/alunos");

    expect(await screen.findByRole("heading", { name: "Alunos", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Identificador SIGEM/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Vínculo escolar atual/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Turma atual/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Situação contextual/ })).toBeInTheDocument();
    expect(screen.getByText(/7 de 7 alunos fictícios/)).toBeInTheDocument();
  });

  it("pesquisa por nome", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos");

    await user.type(await screen.findByLabelText("Pesquisar alunos"), "Demonstrativa Sete");
    expect(
      screen.getByRole("link", { name: /Aluna Fictícia Demonstrativa Sete/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Aluna Fictícia Demonstrativa Um/ }),
    ).not.toBeInTheDocument();
  });

  it("pesquisa por identificador SIGEM e por matrícula escolar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos");

    const field = await screen.findByLabelText("Pesquisar alunos");
    await user.type(field, "SIGEM-AL-000103");
    expect(
      screen.getByRole("link", { name: /Aluna Fictícia Demonstrativa Três/ }),
    ).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "ME-DEMO-1002");
    expect(
      screen.getByRole("link", { name: /Aluno Fictício Demonstrativo Dois/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Aluna Fictícia Demonstrativa Três/ }),
    ).not.toBeInTheDocument();
  });

  it("respeita a minimização de dados pessoais na consulta geral", async () => {
    renderOperationalRoutes("/alunos");

    expect(await screen.findByRole("note")).toHaveTextContent(/Minimização de dados/);
    expect(screen.queryByRole("columnheader", { name: /CPF/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Filiação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Endereço/ })).not.toBeInTheDocument();
  });

  it("expõe rótulos acessíveis de tabela e filtros", async () => {
    renderOperationalRoutes("/alunos");

    expect(await screen.findByRole("table", { name: /Consulta de alunos/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Situação contextual" })).toBeInTheDocument();
  });
});

describe("Alunos — detalhe", () => {
  it("apresenta identidade permanente distinguindo pessoa e aluno", async () => {
    renderOperationalRoutes("/alunos/alu-001");

    expect(
      await screen.findByRole("heading", { name: /Aluna Fictícia Demonstrativa Um/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identidade" })).toBeInTheDocument();
    expect(screen.getAllByText("SIGEM-AL-000101").length).toBeGreaterThan(0);
    expect(screen.getByText(/não cria uma nova pessoa nem um novo aluno/)).toBeInTheDocument();
  });

  it("informa quando o aluno não existe", async () => {
    renderOperationalRoutes("/alunos/alu-999");

    expect(
      await screen.findByRole("heading", { name: "Aluno não encontrado" }),
    ).toBeInTheDocument();
  });

  it("mostra vários vínculos letivos dentro da mesma matrícula escolar", async () => {
    renderOperationalRoutes("/alunos/alu-002");

    expect((await screen.findAllByText(/ME-DEMO-1002/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Vínculos letivos desta matrícula escolar \(3\)/)).toBeInTheDocument();
    const links = screen.getByRole("list", {
      name: /Vínculos letivos da matrícula ME-DEMO-1002/,
    });
    expect(within(links).getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });

  it("separa participação de alocação em turma", async () => {
    renderOperationalRoutes("/alunos/alu-001");

    expect(await screen.findByText("Alocações em turma")).toBeInTheDocument();
    expect(screen.getAllByText(/Participação regular/).length).toBeGreaterThan(0);
  });

  it("preserva a escola de origem após transferência", async () => {
    renderOperationalRoutes("/alunos/alu-003");

    expect((await screen.findAllByText(/ME-DEMO-1003/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ME-DEMO-1103/).length).toBeGreaterThan(0);
  });

  it("representa o retorno à mesma escola sem duplicar a pessoa", async () => {
    renderOperationalRoutes("/alunos/alu-004");

    expect((await screen.findAllByText(/ME-DEMO-1004/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ME-DEMO-1204/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("SIGEM-AL-000104").length).toBeGreaterThan(0);
  });

  it("mantém a turma anterior após mudança de turma", async () => {
    renderOperationalRoutes("/alunos/alu-005");

    expect((await screen.findAllByText(/Turma demonstrativa 3º ano A/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Turma demonstrativa 3º ano B/).length).toBeGreaterThan(0);
  });

  it("mostra AEE coexistindo com a participação regular", async () => {
    renderOperationalRoutes("/alunos/alu-006");

    expect(
      await screen.findByText(/Atendimento educacional especializado \(AEE\)/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Participação regular").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Participação complementar").length).toBeGreaterThan(0);
  });

  it("navega do aluno para a turma alocada", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-001");

    await user.click(
      (await screen.findAllByRole("link", { name: /Turma demonstrativa 3º ano A/ }))[0]!,
    );

    expect(
      await screen.findByRole("heading", { name: /Turma demonstrativa 3º ano A/, level: 1 }),
    ).toBeInTheDocument();
  });

  it("mantém o aluno histórico consultável sem participação atual", async () => {
    renderOperationalRoutes("/alunos/alu-007");

    expect(
      await screen.findByRole("heading", { name: /Aluna Fictícia Demonstrativa Sete/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Sem participação atual").length).toBeGreaterThan(0);
    expect(screen.getByText(/não reinterpretam o passado/)).toBeInTheDocument();
  });

  it("apresenta a trajetória escolar em ordem temporal e as áreas futuras desabilitadas", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-003");

    expect(await screen.findByRole("tab", { name: "Matrículas escolares" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Documentos" })).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: "Trajetória escolar" }));

    const timeline = await screen.findByRole("list", { name: "Trajetória escolar do aluno" });
    expect(within(timeline).getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
    expect(within(timeline).getAllByText(/Transferência/).length).toBeGreaterThan(0);
  });
});
