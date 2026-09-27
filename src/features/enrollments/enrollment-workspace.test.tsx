import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Ingresso e matrícula escolar (Pessoa → Aluno → Matrícula Escolar).
 * Nenhum vínculo letivo, participação, enturmação ou transferência é executado.
 */
async function search(user: ReturnType<typeof userEvent.setup>, term: string) {
  await user.type(await screen.findByLabelText("Pesquisar no cadastro mestre"), term);
  await user.click(screen.getByRole("button", { name: "Pesquisar" }));
}

async function pickUnit(user: ReturnType<typeof userEvent.setup>, unitName: string) {
  const trigger = await screen.findByLabelText("Unidade escolar de destino");
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: unitName }));
}

async function selectStudentAndConfirm(
  user: ReturnType<typeof userEvent.setup>,
  term: string,
  name: string,
) {
  await search(user, term);
  const results = await screen.findByRole("list", { name: "Resultados do cadastro mestre" });
  const row = within(results)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name))!;
  await user.click(within(row).getByRole("button", { name: "Selecionar aluno" }));
  await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
}

const HORIZONTE = "Instituição Educacional Demonstrativa Horizonte";
const CAMINHOS = "Centro Educacional Demonstrativo Caminhos";
const PONTE = "Núcleo Educacional Demonstrativo Ponte";

describe("Ingresso — localização e identidade", () => {
  it("abre o workspace de ingresso a partir da consulta de alunos", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos");

    await user.click(await screen.findByRole("link", { name: /Ingresso e matrícula escolar/ }));

    expect(
      await screen.findByRole("heading", {
        name: "Ingresso e matrícula escolar (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Etapas do ingresso" })).toBeInTheDocument();
  });

  it("pesquisa o cadastro mestre com dados minimizados", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    await search(user, "SIGEM-AL-000101");

    const results = await screen.findByRole("list", { name: "Resultados do cadastro mestre" });
    expect(within(results).getByText("SIGEM-AL-000101")).toBeInTheDocument();
    expect(within(results).getByText(/CPF ••• 01/)).toBeInTheDocument();
    expect(within(results).queryByText(/000\.000\.000-01/)).not.toBeInTheDocument();
  });

  it("encaminha ao cadastro de pessoa quando o aluno não é encontrado", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    await search(user, "Pessoa Inexistente Demonstrativa");

    expect(
      await screen.findByText("Nenhum aluno correspondente no cadastro mestre."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cadastro de identidade Pessoa\/Aluno é uma operação anterior/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Cadastrar nova pessoa\/aluno/ }));
    expect(
      await screen.findByRole("heading", { name: "Cadastrar aluno", level: 1 }),
    ).toBeInTheDocument();
  });

  it("confirma a identidade com resumo mínimo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    await selectStudentAndConfirm(user, "Demonstrativa Um", "Aluna Fictícia Demonstrativa Um");

    expect((await screen.findAllByText("Identidade confirmada")).length).toBeGreaterThan(0);
    expect(screen.getByText("É este o aluno?")).toBeInTheDocument();
    expect(screen.getAllByText("SIGEM-AL-000101").length).toBeGreaterThan(0);
  });

  it("distingue identificador SIGEM do aluno e identificador da matrícula escolar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    expect((await screen.findAllByText("Identificador SIGEM do aluno")).length).toBeGreaterThan(0);
    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, HORIZONTE);

    expect(
      (await screen.findAllByText("Identificador da matrícula escolar")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("ME-DEMO-1001").length).toBeGreaterThan(0);
  });
});

describe("Ingresso — relação com a unidade", () => {
  it("prepara a matrícula escolar no primeiro ingresso na unidade", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, CAMINHOS);

    expect(
      await screen.findByText("Nenhuma matrícula escolar anterior encontrada nesta unidade."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Será preparado: Aluno → Matrícula Escolar → ${CAMINHOS}`)),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar matrícula escolar/ })).toBeEnabled();
  });

  it("impede segunda matrícula escolar para a mesma combinação aluno + unidade", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, HORIZONTE);

    expect(
      await screen.findByText("Este aluno já possui matrícula escolar nesta unidade."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar matrícula escolar/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Utilizar matrícula existente/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/criação de uma segunda matrícula permanente está impedida/).length,
    ).toBeGreaterThan(0);
  });

  it("reutiliza a matrícula anterior no retorno à mesma unidade", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-007");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, PONTE);

    expect(await screen.findByText("Matrícula escolar anterior encontrada.")).toBeInTheDocument();
    expect(screen.getByText(/não exige nova identidade Pessoa\/Aluno/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Utilizar matrícula anterior/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar matrícula escolar/ })).toBeNull();
  });

  it("mostra relação escolar existente em outra unidade sem inventar transferência", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-003");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, CAMINHOS);

    expect(
      (
        await screen.findAllByText(
          /Existe relação escolar registrada em outra unidade\. A situação deverá ser validada/,
        )
      ).length,
    ).toBeGreaterThan(0);
    const others = screen.getByRole("list", { name: "Relações em outras unidades" });
    expect(within(others).getByText(/ME-DEMO-1103/)).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma transferência é assumida, nada é encerrado automaticamente/),
    ).toBeInTheDocument();
  });

  it("apresenta vínculos letivos históricos dentro da mesma matrícula escolar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-002");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, HORIZONTE);

    expect(
      await screen.findByText(/3 vínculo\(s\) letivo\(s\) dentro desta mesma matrícula escolar/),
    ).toBeInTheDocument();
  });
});

describe("Ingresso — validações, revisão e conclusão", () => {
  it("exige aluno, identidade confirmada e unidade antes de concluir", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    expect(await screen.findByRole("button", { name: /Criar matrícula escolar/ })).toBeDisabled();
    expect(screen.getAllByText(/Aluno não selecionado/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unidade escolar não selecionada/).length).toBeGreaterThan(0);

    await selectStudentAndConfirm(user, "Demonstrativa Um", "Aluna Fictícia Demonstrativa Um");
    expect(screen.getAllByText(/Unidade escolar não selecionada/).length).toBeGreaterThan(0);
  });

  it("recusa data de ingresso inválida", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, CAMINHOS);
    await user.type(screen.getByLabelText("Data de ingresso (dd/mm/aaaa)"), "31/02/2026");

    expect(screen.getAllByText(/Data de ingresso inválida/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Criar matrícula escolar/ })).toBeDisabled();
  });

  it("mostra revisão com o escopo da operação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, CAMINHOS);
    await user.type(screen.getByLabelText("Data de ingresso (dd/mm/aaaa)"), "10/02/2026");

    expect(screen.getByRole("heading", { name: "Revisar e concluir" })).toBeInTheDocument();
    expect(screen.getByText("Matrícula escolar resultante")).toBeInTheDocument();
    expect(
      screen.getAllByText("Nova matrícula escolar demonstrativa será preparada").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Esta operação não cria vínculo letivo, participação ou alocação em turma.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Pendências e avisos" })).toBeInTheDocument();
  });

  it("conclui sem criar vínculo letivo nem enturmação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, CAMINHOS);
    await user.click(screen.getByRole("button", { name: /Criar matrícula escolar/ }));
    await user.click(await screen.findByRole("button", { name: "Confirmar criação" }));

    expect(
      await screen.findByText(
        /Matrícula escolar demonstrativa preparada\. Nenhum vínculo letivo ou enturmação foi criado/,
      ),
    ).toBeInTheDocument();
  });

  it("conclui o uso da matrícula existente sem duplicar o vínculo permanente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    await pickUnit(user, HORIZONTE);
    await user.click(screen.getByRole("button", { name: /Utilizar matrícula existente/ }));
    await user.click(
      await screen.findByRole("button", { name: "Confirmar uso da matrícula existente" }),
    );

    expect(
      await screen.findByText(/Nenhuma segunda matrícula permanente foi criada/),
    ).toBeInTheDocument();
  });

  it("sinaliza alterações não salvas e confirma antes de sair", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");

    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  });

  it("mantém documentação de ingresso como área futura", async () => {
    renderOperationalRoutes("/matriculas/nova");

    expect(
      await screen.findByRole("heading", { name: /Documentação de ingresso \(área futura\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma lista oficial de documentos é definida nesta etapa/),
    ).toBeInTheDocument();
  });

  it("não exibe dados pessoais excessivos no fluxo de ingresso", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));

    expect(screen.queryByText(/Endereço demonstrativo/)).toBeNull();
    expect(screen.queryByText(/Filiação:/i)).toBeNull();
    expect(screen.queryByText(/Contato de emergência/i)).toBeNull();
    expect(screen.queryByText(/000\.000\.000-01/)).toBeNull();
  });
});
