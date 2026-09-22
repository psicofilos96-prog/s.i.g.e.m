import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Enturmação e movimentação em turma (Etapa 8E).
 * Participação → Alocação → Turma. Nenhuma persistência, transferência,
 * reclassificação, atribuição docente ou regra oficial de capacidade.
 */
type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, label: string, optionName: string | RegExp) {
  const trigger = await screen.findByLabelText(label);
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: optionName }));
}

async function chooseClass(user: User, name: string | RegExp) {
  await user.click(await screen.findByRole("radio", { name }));
}

function setDate(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const GROUPING = "Agrupamento correspondente ao aluno";
const START = "Início da alocação";
const EFFECTIVE = "Data efetiva da movimentação";

describe("Enturmação — abertura e participação de origem", () => {
  it("abre a enturmação com a participação preselecionada e sem turma atual", async () => {
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    expect(
      await screen.findByRole("heading", {
        name: "Enturmação — alocação em turma (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Etapas da enturmação" })).toBeInTheDocument();
    expect(screen.getAllByText("Sem turma atual.").length).toBeGreaterThan(0);
  });

  it("orienta ao vínculo letivo quando não existe participação no contexto", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?aluno=alu-000");

    expect(await screen.findByText("Nenhuma participação disponível.")).toBeInTheDocument();
    expect(
      screen.getByText(/A participação pertence ao fluxo de vínculo letivo e não é criada dentro da enturmação/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Registrar vínculo letivo e participação" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Vínculo letivo e participação (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("abre a enturmação a partir do detalhe do aluno preservando a participação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-006");

    await user.click(await screen.findByRole("link", { name: "Enturmar esta participação" }));

    expect(
      await screen.findByRole("heading", {
        name: "Enturmação — alocação em turma (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /Compatibilidade requer validação\. As regras de alocação de AEE e de atividades complementares não são definidas/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("abre a enturmação a partir do detalhe da turma", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/turmas/tur-001");

    await user.click(await screen.findByRole("link", { name: "Enturmar nesta turma" }));

    expect(
      await screen.findByRole("heading", {
        name: "Enturmação — alocação em turma (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
  });
});

describe("Enturmação — turmas do contexto, agrupamento e vigência", () => {
  it("lista turmas contextuais separando turno e jornada", async () => {
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    const options = await screen.findByRole("radiogroup", {
      name: "Turmas compatíveis com o contexto",
    });
    expect(
      within(options).getByRole("radio", { name: "Turma demonstrativa 3º ano A" }),
    ).toBeInTheDocument();
    expect(within(options).getByText("Turno: Manhã")).toBeInTheDocument();
    expect(within(options).getByText("Jornada: Jornada parcial — 20h semanais")).toBeInTheDocument();
  });

  it("associa turma simples sem campo redundante de série", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    await chooseClass(user, "Turma demonstrativa 3º ano A");

    expect(
      await screen.findByText(/Agrupamento determinado pela organização da turma: Ano: 3º ano/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(GROUPING)).toBeNull();
  });

  it("exige o agrupamento correspondente em turma multisseriada", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9002");

    await chooseClass(user, "Turma demonstrativa multietapa do campo");

    expect(
      await screen.findByText(/Turma multisseriada\/multietapa com 3 agrupamentos/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/não são concatenados em uma série única|não são concatenados/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Concluir enturmação/ })).toBeDisabled();

    await pick(user, GROUPING, "Ano: 2º ano");
    expect(screen.getAllByText("2º ano").length).toBeGreaterThan(0);
  });

  it("preserva a organização por fase nas turmas de EJA", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=alu-004-p2");

    await chooseClass(user, "Turma demonstrativa EJA Fases II e III");

    expect(
      await screen.findByText(
        /Turma de EJA: a organização permanece por fase própria e não é convertida em ano\/série regular/,
      ),
    ).toBeInTheDocument();
    await pick(user, GROUPING, "Fase: Fase VII|Fase: Fase III");
    expect(screen.getAllByText(/Fase III/).length).toBeGreaterThan(0);
  });

  it("registra vigência temporal podendo permanecer sem término", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    await chooseClass(user, "Turma demonstrativa 3º ano A");
    setDate(START, "2026-02-09");

    expect(
      screen.getAllByText(/uma alocação atual pode permanecer aberta e não pressupõe durar todo o período letivo/)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("09/02/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem término definido").length).toBeGreaterThan(0);
  });

  it("não apresenta turma de outra organização acadêmica como opção", async () => {
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    const blocked = await screen.findByRole("list", { name: "Turmas não apresentadas como opção" });
    expect(
      within(blocked).getAllByText(/Alteração de organização acadêmica requer operação específica/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(blocked).getByRole("radio", { name: /Maternal II/ }),
    ).toBeUndefined;
  });

  it("apresenta aviso demonstrativo de capacidade sem bloquear", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    await chooseClass(user, "Turma demonstrativa multietapa da Educação Infantil");

    expect(screen.getAllByText(/Capacidade requer validação/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Nada é bloqueado por números fictícios e excedente autorizado poderá existir/)
        .length,
    ).toBeGreaterThan(0);
  });
});

describe("Enturmação — conflito de alocação ativa e conclusão", () => {
  it("sinaliza alocação vigente sem encerrá-la silenciosamente", async () => {
    renderOperationalRoutes("/enturmacoes/nova?participacao=alu-001-p1");

    expect(
      await screen.findByText(
        /Esta participação já possui alocação vigente\. Nenhuma alocação é encerrada silenciosamente/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ir para movimentação entre turmas/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir enturmação/ })).toBeDisabled();
  });

  it("conclui a enturmação sem alterar matrícula escolar nem vínculo letivo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    await chooseClass(user, "Turma demonstrativa 3º ano A");
    setDate(START, "2026-02-09");
    await user.click(screen.getByRole("button", { name: /Concluir enturmação/ }));

    expect(
      screen.getAllByText(
        "Esta operação não altera a matrícula escolar, o vínculo letivo nem a participação.",
      ).length,
    ).toBeGreaterThan(0);
    await user.click(await screen.findByRole("button", { name: "Confirmar enturmação" }));
    expect(await screen.findByText(/Alocação em turma preparada/)).toBeInTheDocument();
  });

  it("mostra a revisão da enturmação com aluno, participação e turma", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    await chooseClass(user, "Turma demonstrativa 3º ano A");

    expect(screen.getByRole("heading", { name: "Revisar e concluir" })).toBeInTheDocument();
    expect(screen.getAllByText("Participação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Turma").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Início da alocação").length).toBeGreaterThan(0);
  });
});

describe("Movimentação entre turmas", () => {
  it("apresenta a alocação atual e a turma de destino", async () => {
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    expect(
      await screen.findByRole("heading", {
        name: "Movimentação entre turmas (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Vigência atual: início 09 fev 2026/).length).toBeGreaterThan(0);
  });

  it("encerra a alocação anterior e cria a nova preservando o histórico", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    await chooseClass(user, "Turma demonstrativa multietapa da Educação Infantil");
    await pick(user, GROUPING, "Agrupamento: 1º Período");
    setDate(EFFECTIVE, "2026-05-18");

    const continuity = await screen.findByRole("list", {
      name: "Continuidade temporal demonstrativa",
    });
    expect(within(continuity).getByText(/09 fev 2026 → 17\/05\/2026/)).toBeInTheDocument();
    expect(within(continuity).getByText(/18\/05\/2026 → atual/)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Esta operação encerrará a alocação anterior e criará uma nova alocação, preservando o histórico.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("comunica a atomicidade conceitual da operação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    await chooseClass(user, "Turma demonstrativa multietapa da Educação Infantil");
    await pick(user, GROUPING, "Agrupamento: 1º Período");
    setDate(EFFECTIVE, "2026-05-18");
    await user.click(screen.getByRole("button", { name: /Concluir movimentação/ }));

    expect(
      screen.getAllByText(
        /Operação única: encerra a alocação anterior e cria a nova alocação, preservando ambas no histórico\. Sucesso parcial não é representado/,
      ).length,
    ).toBeGreaterThan(0);
    await user.click(await screen.findByRole("button", { name: "Confirmar movimentação" }));
    expect(
      await screen.findByText(/Movimentação demonstrativa preparada/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A implementação real futura deverá ser transacional/),
    ).toBeInTheDocument();
  });

  it("previne sobreposição de vigência", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    await chooseClass(user, "Turma demonstrativa multietapa da Educação Infantil");
    await pick(user, GROUPING, "Agrupamento: 1º Período");
    setDate(EFFECTIVE, "2026-01-05");

    expect(
      screen.getAllByText(/Sobreposição de vigência: a data efetiva deve ser posterior ao início/)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Concluir movimentação/ })).toBeDisabled();
  });

  it("diferencia movimentação de transferência", async () => {
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    expect(
      await screen.findByText(
        /Movimentação de turma é mudança interna de alocação dentro do contexto escolar apropriado\. Transferência envolve a relação escolar com a unidade/,
      ),
    ).toBeInTheDocument();
  });

  it("mantém o histórico de alocações anteriores navegável", async () => {
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-005-p1");

    const history = await screen.findByRole("list", {
      name: "Histórico de alocações desta participação",
    });
    expect(
      within(history).getByRole("link", { name: "Turma demonstrativa 3º ano A" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/a movimentação nunca substitui a alocação anterior/).length,
    ).toBeGreaterThan(0);
  });

  it("não oferece turma encerrada como destino", async () => {
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-003-p2");

    const blocked = await screen.findByRole("list", { name: "Turmas não apresentadas como opção" });
    expect(
      within(blocked).getByText(/Turma demonstrativa 6º ano A \(encerrada\)/),
    ).toBeInTheDocument();
    expect(
      within(blocked).getAllByText(
        /Turma encerrada: permanece consultável como fato histórico e não recebe nova alocação/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("indica que a troca de turma não é mecanismo de reclassificação", async () => {
    renderOperationalRoutes("/enturmacoes/movimentar?participacao=alu-006-p1");

    expect(
      await screen.findByText(
        /A troca de turma não é mecanismo de reclassificação: alteração de organização acadêmica requer operação específica/,
      ),
    ).toBeInTheDocument();
  });
});

describe("Alocação — dirty state, privacidade e trajetória", () => {
  it("sinaliza alterações não salvas e permite continuar editando", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    await chooseClass(user, "Turma demonstrativa 3º ano A");
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");

    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  });

  it("não expõe dados pessoais desnecessários", async () => {
    renderOperationalRoutes("/enturmacoes/nova?participacao=part-demo-9001");

    expect(
      await screen.findByText(
        /nenhum CPF, endereço, filiação, contato familiar, dado de saúde, laudo ou informação sensível/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Filiação:/i)).toBeNull();
    expect(screen.queryByText(/000\.000\.000-0/)).toBeNull();
  });

  it("apresenta o histórico de alocações na trajetória do aluno", async () => {
    renderOperationalRoutes("/alunos/alu-005");

    expect(
      (await screen.findAllByText("Histórico de alocações em turma")).length,
    ).toBeGreaterThan(0);
    const allocations = screen.getByRole("list", { name: "Alocações de Participação regular" });
    expect(within(allocations).getAllByRole("listitem")).toHaveLength(2);
  });
});
