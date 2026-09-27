import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import { isValidDemonstrativeDate } from "@/features/students/person-draft";

/**
 * Cadastrar aluno — padrão de interação do SIGEM 2.0 (13UX · Rodada 4).
 * A linguagem é humana; o domínio (identidade Pessoa/Aluno, duplicidade,
 * minimização de dados) permanece intacto. Nada é persistido e nenhuma
 * matrícula escolar é criada.
 */
async function fillBasics(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  birth: string,
) {
  await user.type(await screen.findByLabelText("Nome completo"), name);
  await user.type(screen.getByLabelText("Data de nascimento"), birth);
}

async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
}

describe("Cadastrar aluno — orientação e linguagem", () => {
  it("abre o cadastro a partir da consulta de alunos", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos");

    await user.click(await screen.findByRole("link", { name: /Novo aluno/ }));

    expect(
      await screen.findByRole("heading", { name: "Cadastrar aluno", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Etapas do cadastro/ })).toBeInTheDocument();
  });

  it("diz onde a pessoa está e o que fazer agora", async () => {
    renderOperationalRoutes("/alunos/novo");

    expect(await screen.findByRole("heading", { name: "Dados básicos", level: 2 })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dados básicos" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Informe o nome e a data de nascimento do aluno.")).toBeVisible();
  });

  it("mantém a explicação institucional fora da tela principal, sob demanda", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    expect(screen.queryByText(/identidade humana canônica/)).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Informações institucionais/ }));

    expect(
      await screen.findByText(/Não é matrícula escolar, não é matrícula anual e não é INEP/),
    ).toBeInTheDocument();
    expect(screen.getByText(/AEE é participação educacional/)).toBeInTheDocument();
    const relations = screen.getByRole("list", { name: "Relações de responsabilidade previstas" });
    expect(within(relations).getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
  });
});

describe("Cadastrar aluno — avanço, obrigatoriedade e retorno", () => {
  it("impede avançar sem nome e explica em linguagem simples", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    expect(await screen.findByRole("button", { name: /Continuar/ })).toBeDisabled();
    expect(
      screen.getByText(/Para avançar, informe o nome completo do aluno\./),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome completo"), "Pessoa Fictícia Nova Demonstrativa");
    await user.tab();
    expect(screen.getByText(/Para avançar, informe a data de nascimento\./)).toBeInTheDocument();
  });

  it("recusa data impossível no domínio", () => {
    expect(isValidDemonstrativeDate("31/02/2015")).toBe(false);
    expect(isValidDemonstrativeDate("10/10/2015")).toBe(true);
  });

  it("marca documentos e contato como opcionais e permite concluir sem CPF", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(await screen.findByRole("heading", { name: "Documentos", level: 2 })).toBeVisible();
    expect(screen.getByText("O aluno pode ser cadastrado sem CPF.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(
      await screen.findByText("Tudo pronto para concluir o cadastro"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir cadastro/ })).toBeEnabled();
  });

  it("volta uma etapa sem perder o que foi preenchido", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.type(screen.getByLabelText(/^CPF/), "000.000.000-99");
    await user.click(screen.getByRole("button", { name: /Voltar/ }));

    expect(screen.getByLabelText("Nome completo")).toHaveValue(
      "Pessoa Fictícia Nova Demonstrativa",
    );
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByLabelText(/^CPF/)).toHaveValue("000.000.000-99");
  });

  it("avisa que o preenchimento é descartado ao sair, sem prometer salvamento", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    expect(screen.getByText(/o preenchimento é descartado/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair sem concluir" }));
    expect(
      await screen.findByRole("heading", { name: "Sair sem concluir o cadastro?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar preenchendo" }));
  });
});

describe("Cadastrar aluno — conferência e conclusão", () => {
  it("aponta a pendência com atalho de correção", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    await goToReview(user);
    await user.click(screen.getAllByRole("button", { name: /Editar/ })[0]!);
    await user.clear(screen.getByLabelText("Nome completo"));
    await user.click(screen.getByRole("button", { name: /4Conferência|Conferência/ }));

    expect(await screen.findByText("Falta 1 informação para concluir")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Corrigir agora" }));
    expect(screen.getByRole("button", { name: "Dados básicos" })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("apresenta a conferência por blocos com identificadores minimizados", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.type(screen.getByLabelText(/^CPF/), "000.000.000-99");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(await screen.findByRole("heading", { name: "Documentos", level: 2 })).toBeVisible();
    expect(screen.getByText("••• 99")).toBeInTheDocument();
    expect(screen.queryByText("000.000.000-99")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Editar/ }).length).toBe(3);
  });

  it("não cria matrícula escolar e oferece a próxima ação ao concluir", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /Concluir cadastro/ }));

    expect(
      await screen.findByRole("heading", { name: "Concluir o cadastro deste aluno?" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getAllByText(/não coloca o aluno em turma/).length,
    ).toBeGreaterThan(0);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Concluir cadastro" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Aluno cadastrado com sucesso", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Iniciar matrícula deste aluno/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cadastrar outro aluno/ })).toBeInTheDocument();
    expect(screen.getByText(/Ver ficha do aluno/)).toBeInTheDocument();
  });
});

describe("Cadastrar aluno — possível duplicidade", () => {
  it("privilegia conferir o cadastro encontrado antes de qualquer outra decisão", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");

    expect(
      await screen.findByText("Encontramos um cadastro parecido na rede"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Possíveis cadastros correspondentes" });
    expect(within(list).getByText(/CPF ••• 01/)).toBeInTheDocument();
    expect(within(list).queryByText(/000\.000\.000-01/)).not.toBeInTheDocument();
    expect(
      within(list).queryByRole("button", { name: /Confirmar que é outra pessoa/ }),
    ).not.toBeInTheDocument();
  });

  it("libera declarar pessoa diferente somente após a conferência, sem fundir cadastros", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");
    await user.click(
      (await screen.findAllByRole("button", { name: "Conferir cadastro encontrado" }))[0]!,
    );
    expect(
      await screen.findByRole("heading", { name: "Conferir cadastro encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma fusão ocorre/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar ao cadastro" }));

    const list = await screen.findByRole("list", { name: "Possíveis cadastros correspondentes" });
    expect(within(list).getAllByRole("listitem").length).toBe(2);
    await user.click(
      within(list).getByRole("button", { name: "Confirmar que é outra pessoa e continuar" }),
    );

    const remaining = await screen.findByRole("list", {
      name: "Possíveis cadastros correspondentes",
    });
    expect(within(remaining).getAllByRole("listitem").length).toBe(1);
  });

  it("trata nome igual com nascimento diferente como outra pessoa", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Aluna Fictícia Demonstrativa Um", "01/01/2010");

    expect(
      await screen.findByText("Existe alguém com o mesmo nome na rede"),
    ).toBeInTheDocument();
  });

  it("permite pedir conferência de identidade sem bloquear o atendimento", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillBasics(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");
    await user.click(
      await screen.findByRole("button", { name: "Pedir conferência de identidade depois" }),
    );

    expect(
      await screen.findByRole("button", { name: "Retirar pedido de conferência de identidade" }),
    ).toBeInTheDocument();
  });
});

describe("Editar dados do aluno", () => {
  it("abre o cadastro existente preservando o identificador permanente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/editar/alu-002");

    expect(
      await screen.findByRole("heading", { name: "Editar dados do aluno", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Aluno Fictício Demonstrativo Dois");

    await user.click(screen.getByRole("button", { name: /Informações institucionais/ }));
    expect(await screen.findByText(/SIGEM-AL-000102/)).toBeInTheDocument();
  });

  it("mostra o que mudou e a natureza da alteração sob demanda", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/editar/alu-002");

    await user.type(await screen.findByLabelText("Nome completo"), " Editado");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    const changes = await screen.findByRole("list", { name: "Alterações do cadastro" });
    await user.click(within(changes).getAllByText("Ver natureza da alteração")[0]!);
    expect(within(changes).getByText("Alteração histórica relevante")).toBeInTheDocument();
  });

  it("mantém o aluno histórico como identidade válida e editável", async () => {
    renderOperationalRoutes("/alunos/editar/alu-007");

    expect(
      await screen.findByRole("heading", { name: "Editar dados do aluno", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Aluna Fictícia Demonstrativa Sete");
  });

  it("informa quando o cadastro não existe", async () => {
    renderOperationalRoutes("/alunos/editar/alu-999");

    expect(
      await screen.findByRole("heading", { name: "Cadastro não encontrado" }),
    ).toBeInTheDocument();
  });
});
