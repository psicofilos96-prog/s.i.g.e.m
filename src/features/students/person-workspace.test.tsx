import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Cadastro e identidade do aluno (Pessoa → Aluno).
 * Nenhum dado é persistido e nenhuma matrícula escolar é criada.
 */
async function fillNewPerson(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  birth: string,
) {
  await user.type(await screen.findByLabelText("Nome completo"), name);
  await user.type(screen.getByLabelText("Data de nascimento (dd/mm/aaaa)"), birth);
}

describe("Cadastro de aluno — identidade Pessoa/Aluno", () => {
  it("abre o workspace de novo aluno a partir da consulta", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos");

    await user.click(await screen.findByRole("link", { name: /Novo aluno/ }));

    expect(
      await screen.findByRole("heading", { name: /Novo aluno \(cadastro demonstrativo/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Seções do cadastro" })).toBeInTheDocument();
  });

  it("distingue pessoa de aluno e apresenta o identificador SIGEM como permanente", async () => {
    renderOperationalRoutes("/alunos/novo");

    expect(await screen.findByRole("heading", { name: "Identificação" })).toBeInTheDocument();
    expect(
      screen.getByText(/o aluno é o papel educacional dessa pessoa no SIGEM/),
    ).toBeInTheDocument();
    expect(screen.getByText("Gerado pelo SIGEM após conclusão do cadastro")).toBeInTheDocument();
    expect(
      screen.getByText(/não é matrícula escolar, não é matrícula anual e não é INEP/),
    ).toBeInTheDocument();
  });

  it("permite concluir sem CPF, tratando a ausência como aviso", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");

    expect(
      screen.getByText(/CPF não é identidade primária do aluno e não é exigido/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir cadastro/ })).toBeEnabled();
  });

  it("exige nome e data de nascimento válida antes da conclusão", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    expect(await screen.findByRole("button", { name: /Concluir cadastro/ })).toBeDisabled();
    await user.type(screen.getByLabelText("Nome completo"), "Pessoa Fictícia Sem Data");
    await user.type(screen.getByLabelText("Data de nascimento (dd/mm/aaaa)"), "31/02/2015");
    expect(screen.getAllByText(/Data de nascimento inválida/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Concluir cadastro/ })).toBeDisabled();
  });

  it("mantém identificador SIGEM separado dos identificadores externos", async () => {
    renderOperationalRoutes("/alunos/novo");

    expect(
      await screen.findByLabelText("Identificador educacional externo"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Externo à rede; distinto do identificador SIGEM/)).toBeInTheDocument();
  });

  it("não cria matrícula escolar ao concluir o cadastro", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");
    await user.click(screen.getByRole("button", { name: /Concluir cadastro/ }));

    expect(await screen.findByText(/Não cria matrícula escolar/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar conclusão" }));
    expect(
      await screen.findByText(/Cadastro demonstrativo concluído\. Nenhuma matrícula escolar/),
    ).toBeInTheDocument();
  });
});

describe("Cadastro de aluno — duplicidade e ambiguidade", () => {
  it("apresenta possíveis cadastros correspondentes com dados minimizados", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");

    expect(
      await screen.findByText("Encontramos possíveis cadastros correspondentes."),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Possíveis cadastros correspondentes" });
    expect(within(list).getAllByText(/Identidade requer verificação/).length).toBeGreaterThan(0);
    expect(within(list).getByText(/CPF ••• 01/)).toBeInTheDocument();
    expect(within(list).queryByText(/000\.000\.000-01/)).not.toBeInTheDocument();
  });

  it("permite revisar o possível cadastro existente sem alterá-lo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");
    await user.click(
      (await screen.findAllByRole("button", { name: "Revisar possível cadastro" }))[0]!,
    );

    expect(
      await screen.findByRole("heading", { name: "Revisar possível cadastro correspondente" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma fusão ocorre/)).toBeInTheDocument();
  });

  it("trata homônimo como pessoa diferente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Aluna Fictícia Demonstrativa Um", "01/01/2010");

    const list = await screen.findByRole("list", {
      name: "Possíveis cadastros correspondentes",
    });
    expect(within(list).getAllByText("Possível homônimo").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Homônimo identificado: nome coincidente não caracteriza a mesma pessoa/),
    ).toBeInTheDocument();
  });

  it("não funde cadastros automaticamente quando o operador indica pessoa diferente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");
    const list = await screen.findByRole("list", { name: "Possíveis cadastros correspondentes" });
    const before = within(list).getAllByRole("listitem").length;
    await user.click(within(list).getAllByRole("button", { name: "Não é a mesma pessoa" })[0]!);

    expect(
      await screen.findByText(/candidato\(s\) marcados pelo operador como pessoa diferente/),
    ).toBeInTheDocument();
    const remaining = screen.queryAllByRole("listitem", { name: undefined }).length;
    expect(remaining).toBeLessThan(before + remaining);
  });

  it("registra a marcação de identidade que requer verificação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Aluna Fictícia Demonstrativa Um", "12/03/2016");
    await user.click(
      await screen.findByRole("button", { name: /Marcar como "Identidade requer verificação"/ }),
    );

    expect(
      screen.getByText(/reconciliação humana pendente, registrada pelo operador/),
    ).toBeInTheDocument();
  });
});

describe("Cadastro de aluno — edição", () => {
  it("abre o cadastro existente preservando o identificador permanente", async () => {
    renderOperationalRoutes("/alunos/editar/alu-002");

    expect(
      await screen.findByRole("heading", { name: /Editar cadastro —/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue(
      "Aluno Fictício Demonstrativo Dois",
    );
    expect(screen.getAllByText("SIGEM-AL-000102").length).toBeGreaterThan(0);
  });

  it("distingue correção cadastral de alteração histórica relevante", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/editar/alu-002");

    await user.type(await screen.findByLabelText("Nome completo"), " Editado");
    await user.type(screen.getByLabelText("Telefone de contato"), "9");

    const changes = screen.getByRole("list", { name: "Alterações do cadastro" });
    expect(within(changes).getByText("Alteração histórica relevante")).toBeInTheDocument();
    expect(within(changes).getAllByText("Correção cadastral").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/permanecem emitidos com o nome vigente na época/),
    ).toBeInTheDocument();
  });

  it("sinaliza alterações não salvas e confirma antes de sair", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/editar/alu-002");

    await user.type(await screen.findByLabelText("Nome completo"), " Editado");
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");

    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  });

  it("mantém o aluno histórico como identidade válida e editável", async () => {
    renderOperationalRoutes("/alunos/editar/alu-007");

    expect(
      await screen.findByRole("heading", { name: /Editar cadastro —/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue(
      "Aluna Fictícia Demonstrativa Sete",
    );
  });

  it("informa quando o cadastro não existe", async () => {
    renderOperationalRoutes("/alunos/editar/alu-999");

    expect(
      await screen.findByRole("heading", { name: "Cadastro não encontrado" }),
    ).toBeInTheDocument();
  });
});

describe("Cadastro de aluno — áreas conceituais e revisão", () => {
  it("mantém responsáveis como relações distintas e área futura", async () => {
    renderOperationalRoutes("/alunos/novo");

    expect(
      await screen.findByRole("heading", { name: /Responsáveis e relações \(área futura\)/ }),
    ).toBeInTheDocument();
    const relations = screen.getByRole("list", {
      name: "Relações de responsabilidade previstas",
    });
    expect(within(relations).getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
    expect(within(relations).getByText(/Responsável financeiro/)).toBeInTheDocument();
    expect(within(relations).getByText(/Contato de emergência/)).toBeInTheDocument();
  });

  it("mantém saúde, NEE e AEE fora do cadastro de identidade", async () => {
    renderOperationalRoutes("/alunos/novo");

    expect(
      (await screen.findAllByText(/AEE é participação educacional/)).length,
    ).toBeGreaterThan(0);
  });

  it("apresenta revisão com identificadores mascarados e escopo do cadastro", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/novo");

    await fillNewPerson(user, "Pessoa Fictícia Nova Demonstrativa", "10/10/2015");

    expect(screen.getByRole("heading", { name: "Revisão" })).toBeInTheDocument();
    expect(screen.getAllByText("Correspondências analisadas").length).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Pendências e avisos" })).toBeInTheDocument();
    expect(screen.getAllByText(/Não cria matrícula escolar/).length).toBeGreaterThan(0);
  });
});
