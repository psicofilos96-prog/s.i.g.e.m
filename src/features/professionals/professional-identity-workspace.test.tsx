import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

async function searchPerson(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.type(await screen.findByLabelText(/Nome, nome social, identificador SIGEM/), query);
  await user.click(screen.getByRole("button", { name: "Pesquisar Pessoa" }));
}

describe("Cadastro profissional — resolução da Pessoa", () => {
  it("abre novo profissional pela consulta", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais");
    await user.click(await screen.findByRole("link", { name: "Novo profissional" }));
    expect(
      await screen.findByRole("heading", { name: "Novo profissional", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Seções do cadastro profissional" }),
    ).toBeInTheDocument();
  });

  it("pesquisa Pessoa com resultado minimizado e CPF mascarado", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Marina Vale");
    const results = screen.getByRole("list", { name: "Resultados minimizados de pessoas" });
    expect(within(results).getByText("Pessoa Fictícia Marina Vale")).toBeInTheDocument();
    expect(within(results).getByText(/•••\.•••\.•••-31/)).toBeInTheDocument();
    expect(within(results).queryByText("000.000.000-31")).not.toBeInTheDocument();
  });

  it("seleciona Pessoa existente e prepara somente o papel Profissional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "SIGEM-PE-000301");
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    expect(screen.getByText("Pessoa já cadastrada no SIGEM.")).toBeInTheDocument();
    expect(screen.getByText("Pessoa existente reutilizada")).toBeInTheDocument();
    expect(screen.getByText("Será preparado após a resolução da Pessoa")).toBeInTheDocument();
  });

  it("permite preparar nova Pessoa quando nenhuma é encontrada", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Pessoa Fictícia Nova Profissional");
    expect(screen.getByText("Nenhuma Pessoa encontrada.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cadastrar nova Pessoa" }));
    expect(screen.getByText("Nova Pessoa em preparação.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome civil")).toHaveValue("Pessoa Fictícia Nova Profissional");
  });

  it("não duplica Pessoa que já possui cadastro profissional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Aurora Martins");
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    expect(screen.getByText("Esta pessoa já possui cadastro profissional.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver cadastro profissional" })).toHaveAttribute(
      "href",
      "/profissionais/pro-001",
    );
    expect(screen.getByRole("button", { name: "Adicionar papel profissional" })).toBeDisabled();
  });

  it("mantém Aluno e Profissional como papéis distintos da mesma Pessoa", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Pessoa Fictícia Alex Santos");
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    expect(screen.getByText("Aluno · Profissional")).toBeInTheDocument();
    expect(screen.getAllByText("SIGEM-AL-000104").length).toBeGreaterThan(0);
  });

  it("aceita Pessoa sem CPF", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Samuel Rocha");
    expect(screen.getByText(/CPF Não informado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    expect(screen.getByLabelText("CPF (quando disponível)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Adicionar papel profissional" })).toBeEnabled();
  });

  it("pesquisa por identificador externo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "EXT-PESSOA-DEMO-307");
    expect(screen.getByText("Pessoa Fictícia Tânia Reis")).toBeInTheDocument();
    expect(screen.getByText("Correspondência forte")).toBeInTheDocument();
  });
});

describe("Cadastro profissional — duplicidade e decisão humana", () => {
  it("classifica correspondência forte por CPF sem fusão automática", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "000.000.000-34");
    expect(screen.getByText("Correspondência forte")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma Pessoa é selecionada, fundida ou sobrescrita automaticamente/),
    ).toBeInTheDocument();
  });

  it("classifica possível homônimo e permite decisão humana", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Renata");
    expect(screen.getAllByText("Possível homônimo").length).toBeGreaterThan(0);
    const list = screen.getByRole("list", { name: "Resultados minimizados de pessoas" });
    await user.click(within(list).getAllByRole("button", { name: "Revisar candidato" })[0]);
    expect(
      await screen.findByRole("heading", { name: "Revisar candidato de identidade" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Não é a mesma pessoa" }));
    expect(screen.getAllByText(/Marcados como pessoa diferente/).length).toBeGreaterThan(0);
  });

  it("permite confirmar o candidato somente após ação explícita", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Marina Vale");
    await user.click(screen.getByRole("button", { name: "Revisar candidato" }));
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    expect(screen.getByText("Pessoa já cadastrada no SIGEM.")).toBeInTheDocument();
  });
});

describe("Cadastro profissional — escopo, edição e conclusão", () => {
  it("não apresenta campos funcionais no cadastro de identidade", async () => {
    renderOperationalRoutes("/profissionais/editar/pro-003");
    expect(await screen.findByLabelText("Nome civil")).toBeInTheDocument();
    expect(screen.queryByLabelText("Matrícula funcional")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cargo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Lotação")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Função")).not.toBeInTheDocument();
  });

  it("abre edição pelo detalhe profissional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-003");
    await user.click(await screen.findByRole("link", { name: "Editar cadastro" }));
    expect(
      await screen.findByRole("heading", {
        name: /Editar cadastro — Profissional Fictícia Cecília Andrade/,
      }),
    ).toBeInTheDocument();
  });

  it("preserva o identificador SIGEM da Pessoa na edição", async () => {
    renderOperationalRoutes("/profissionais/editar/pro-003");
    expect((await screen.findAllByText("SIGEM-PE-000313")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Nome civil")).toHaveValue(
      "Profissional Fictícia Cecília Andrade",
    );
  });

  it("distingue correção cadastral de alteração historicamente relevante", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/editar/pro-003");
    await user.type(await screen.findByLabelText("Nome civil"), " Corrigido");
    const changes = screen.getByRole("list", { name: "Alterações do cadastro profissional" });
    expect(within(changes).getByText("Alteração historicamente relevante")).toBeInTheDocument();
    expect(screen.getByText(/não são alterados por esta edição/)).toBeInTheDocument();
  });

  it("mantém profissional histórico editável sem alterar vínculos", async () => {
    renderOperationalRoutes("/profissionais/editar/pro-007");
    expect(await screen.findByLabelText("Nome civil")).toHaveValue(
      "Profissional Fictícia Gabriela Torres",
    );
    expect(
      screen.getByText(/Vínculos funcionais existentes permanecem somente leitura/),
    ).toBeInTheDocument();
  });

  it("trata profissional sem vínculo funcional como estado válido", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Marina Vale");
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    expect(
      screen.getAllByText("Cadastro profissional sem vínculo funcional.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Próximo passo: criar vínculo funcional/ }),
    ).toBeDisabled();
  });

  it("mostra revisão com identidade, papéis, duplicidade e escopo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Marina Vale");
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    const review = screen.getByRole("heading", { name: "Revisão" }).closest("section");
    expect(review).toHaveTextContent("Pessoa existente");
    expect(review).toHaveTextContent("NÃO cria Vínculo Funcional");
    expect(review).toHaveTextContent("decisão humana registrada");
  });

  it("conclui demonstrativamente sem criar vínculo funcional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Marina Vale");
    await user.click(screen.getByRole("button", { name: "É esta a pessoa" }));
    await user.click(screen.getByRole("button", { name: "Adicionar papel profissional" }));
    await user.click(screen.getByRole("button", { name: "Confirmar conclusão" }));
    expect(
      await screen.findByText(
        "Cadastro profissional demonstrativo preparado. Nenhum vínculo funcional foi criado.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Próximo passo: criar vínculo funcional.")).toBeInTheDocument();
  });

  it("usa conclusão específica para Pessoa nova e edição", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/novo");
    await searchPerson(user, "Pessoa Fictícia Nova Profissional");
    await user.click(screen.getByRole("button", { name: "Cadastrar nova Pessoa" }));
    await user.type(screen.getByLabelText("Data de nascimento (dd/mm/aaaa)"), "10/10/1990");
    expect(screen.getByRole("button", { name: "Cadastrar pessoa e profissional" })).toBeEnabled();
  });

  it("usa conclusão específica para atualização cadastral", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/editar/pro-003");
    await user.type(await screen.findByLabelText("Nome civil"), " Ajustado");
    expect(screen.getByRole("button", { name: "Concluir atualização cadastral" })).toBeEnabled();
  });

  it("mantém dados sensíveis fora da experiência", async () => {
    renderOperationalRoutes("/profissionais/novo");
    expect(await screen.findByRole("heading", { name: "Novo profissional" })).toBeInTheDocument();
    for (const sensitive of ["Endereço residencial", "Dados bancários", "Saúde", "Filiação"])
      expect(screen.queryByLabelText(sensitive)).not.toBeInTheDocument();
  });

  it("sinaliza alterações não salvas e intercepta a saída", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/editar/pro-003");
    await user.type(await screen.findByLabelText("Nome civil"), " Ajustado");
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");
    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar editando" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar alterações e sair" })).toBeInTheDocument();
  });

  it("apresenta not found acessível para edição inválida", async () => {
    renderOperationalRoutes("/profissionais/editar/pro-inexistente");
    expect(
      await screen.findByRole("heading", { name: "Cadastro profissional não encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para profissionais" })).toBeInTheDocument();
  });
});
