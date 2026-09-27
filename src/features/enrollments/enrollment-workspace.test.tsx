import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Matricular aluno em uma escola — jornada guiada (Pessoa → Aluno → Matrícula Escolar).
 *
 * A linguagem do primeiro nível é humana; o texto institucional continua
 * disponível no nível de revelação seguinte. Nenhum vínculo letivo,
 * participação, enturmação ou transferência é executado.
 */
type User = ReturnType<typeof userEvent.setup>;

async function search(user: User, term: string) {
  await user.type(await screen.findByLabelText("Procurar aluno"), term);
  await user.click(screen.getByRole("button", { name: "Pesquisar" }));
}

async function advance(user: User) {
  await user.click(await screen.findByRole("button", { name: /Continuar/ }));
}

async function pickUnit(user: User, unitName: string) {
  const trigger = await screen.findByLabelText("Escola onde o aluno vai estudar");
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: unitName }));
}

async function selectStudentAndConfirm(user: User, term: string, name: string) {
  await search(user, term);
  const results = await screen.findByRole("list", { name: "Alunos encontrados" });
  const row = within(results)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name))!;
  await user.click(within(row).getByRole("button", { name: "Selecionar aluno" }));
  await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
}

/** Confirma identidade do aluno pré-selecionado e avança para escola e ingresso. */
async function reachUnitStep(user: User) {
  await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
  await advance(user);
}

const HORIZONTE = "Instituição Educacional Demonstrativa Horizonte";
const CAMINHOS = "Centro Educacional Demonstrativo Caminhos";
const PONTE = "Núcleo Educacional Demonstrativo Ponte";

describe("Matrícula — localização e identidade", () => {
  it("abre a jornada de matrícula a partir da consulta de alunos", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos");

    await user.click(await screen.findByRole("link", { name: /Ingresso e matrícula escolar/ }));

    expect(
      await screen.findByRole("heading", { name: "Matricular aluno em uma escola", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Etapas da matrícula/ })).toBeInTheDocument();
  });

  it("pesquisa o cadastro com dados minimizados", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    await search(user, "SIGEM-AL-000101");

    const results = await screen.findByRole("list", { name: "Alunos encontrados" });
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
    await reachUnitStep(user);
    await pickUnit(user, HORIZONTE);

    expect(
      (await screen.findAllByText("Identificador da matrícula escolar")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("ME-DEMO-1001").length).toBeGreaterThan(0);
  });
});

describe("Matrícula — relação com a escola", () => {
  it("prepara a matrícula no primeiro ingresso na escola", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, CAMINHOS);

    expect(
      await screen.findByText("Nenhuma matrícula escolar anterior encontrada nesta unidade."),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Será criada a primeira matrícula`))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Será preparado: Aluno → Matrícula Escolar → ${CAMINHOS}`)),
    ).toBeInTheDocument();

    await advance(user);
    expect(screen.getByRole("button", { name: /Criar matrícula escolar/ })).toBeEnabled();
  });

  it("impede segunda matrícula escolar para a mesma combinação aluno + escola", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, HORIZONTE);

    expect(
      await screen.findByText("Este aluno já possui matrícula escolar nesta unidade."),
    ).toBeInTheDocument();
    await advance(user);
    expect(screen.queryByRole("button", { name: /Criar matrícula escolar/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Utilizar matrícula existente/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/criação de uma segunda matrícula permanente está impedida/).length,
    ).toBeGreaterThan(0);
  });

  it("reutiliza a matrícula anterior no retorno à mesma escola", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-007");

    await reachUnitStep(user);
    await pickUnit(user, PONTE);

    expect(await screen.findByText("Matrícula escolar anterior encontrada.")).toBeInTheDocument();
    expect(screen.getByText(/não exige nova identidade Pessoa\/Aluno/)).toBeInTheDocument();
    await advance(user);
    expect(screen.getByRole("button", { name: /Utilizar matrícula anterior/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar matrícula escolar/ })).toBeNull();
  });

  it("mostra relação escolar existente em outra escola sem inventar transferência", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-003");

    await reachUnitStep(user);
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

  it("apresenta anos letivos históricos dentro da mesma matrícula escolar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-002");

    await reachUnitStep(user);
    await pickUnit(user, HORIZONTE);

    expect(
      await screen.findByText(/3 vínculo\(s\) letivo\(s\) dentro desta mesma matrícula escolar/),
    ).toBeInTheDocument();
  });
});

describe("Matrícula — condução, conferência e conclusão", () => {
  it("não acusa pendência na abertura e orienta em linguagem humana", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    // Nada de bloqueio no topo: a tela recebe quem chega, não o acusa.
    expect(screen.queryByText(/Aluno não selecionado/)).toBeNull();
    expect(
      await screen.findByText(/Para avançar, escolha o aluno que será matriculado/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();

    await selectStudentAndConfirm(user, "Demonstrativa Um", "Aluna Fictícia Demonstrativa Um");
    await advance(user);
    expect(
      await screen.findByText(/Para avançar, escolha a escola onde o aluno vai estudar/),
    ).toBeInTheDocument();
  });

  it("aceita a data de ingresso em dia/mês/ano", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, CAMINHOS);
    await user.type(screen.getByLabelText("Data de ingresso"), "10/02/2026");

    expect(screen.getByLabelText("Data de ingresso")).toHaveValue("10/02/2026");
    await advance(user);
    expect(screen.getAllByText("10/02/2026").length).toBeGreaterThan(0);
  });

  it("avisa quando a data de ingresso não foi informada, sem impedir a conclusão", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, CAMINHOS);
    await advance(user);

    expect(
      screen.getAllByText(/Data de ingresso ainda não informada/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Criar matrícula escolar/ })).toBeEnabled();
  });

  it("mostra a conferência com quem, onde, quando e o que a ação fará", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, CAMINHOS);
    await user.type(screen.getByLabelText("Data de ingresso"), "10/02/2026");
    await advance(user);

    expect(screen.getByRole("heading", { name: "Quem" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Onde e quando" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O que esta ação fará" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Efeitos da ação" })).toBeInTheDocument();
    expect(
      screen.getByText(/Não coloca o aluno em uma turma e não abre o ano letivo dele/),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Pendências e avisos" })).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Esta operação não cria vínculo letivo, participação ou alocação em turma.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("conclui sem criar vínculo letivo nem enturmação e oferece o próximo passo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, CAMINHOS);
    await advance(user);
    await user.click(screen.getByRole("button", { name: /Criar matrícula escolar/ }));
    await user.click(await screen.findByRole("button", { name: "Confirmar criação" }));

    expect(
      await screen.findByRole("heading", { name: "Matrícula criada", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Colocar o aluno em uma turma" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Matrícula escolar demonstrativa preparada\. Nenhum vínculo letivo ou enturmação foi criado/,
      ),
    ).toBeInTheDocument();
  });

  it("conclui o uso da matrícula existente sem duplicar o vínculo permanente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await reachUnitStep(user);
    await pickUnit(user, HORIZONTE);
    await advance(user);
    await user.click(screen.getByRole("button", { name: /Utilizar matrícula existente/ }));
    await user.click(
      await screen.findByRole("button", { name: "Confirmar uso da matrícula existente" }),
    );

    expect(
      (await screen.findAllByText(/Nenhuma segunda matrícula permanente foi criada/)).length,
    ).toBeGreaterThan(0);
  });

  it("sinaliza alterações não salvas e confirma antes de sair", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));
    expect(
      screen.getAllByRole("status").some((node) => /Alterações não salvas/.test(node.textContent ?? "")),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Sair sem concluir" }));
    expect(
      await screen.findByRole("heading", { name: "Sair sem concluir a matrícula?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  });

  it("mantém documentação de ingresso como área futura no nível institucional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova");

    await user.click(await screen.findByRole("button", { name: /Informações institucionais/ }));

    expect(
      await screen.findByRole("heading", { name: /Documentação de ingresso \(área futura\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma lista oficial de documentos é definida nesta etapa/),
    ).toBeInTheDocument();
  });

  it("não exibe dados pessoais excessivos no fluxo de matrícula", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matriculas/nova?aluno=alu-001");

    await user.click(await screen.findByRole("button", { name: "Sim, confirmar identidade" }));

    expect(screen.queryByText(/Endereço demonstrativo/)).toBeNull();
    expect(screen.queryByText(/Filiação:/i)).toBeNull();
    expect(screen.queryByText(/Contato de emergência/i)).toBeNull();
    expect(screen.queryByText(/000\.000\.000-01/)).toBeNull();
  });
});
