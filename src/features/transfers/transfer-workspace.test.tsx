import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Transferência escolar (Etapa 8F · jornada guiada 13UX 6B.2.2).
 * Operação histórica: nada é movido da origem, a matrícula do destino é criada
 * ou reutilizada, não há enturmação automática nem reclassificação.
 */
type User = ReturnType<typeof userEvent.setup>;

const UNIT = "Escola de destino";
const PERIOD = "Ano letivo no destino";
const OFFER = "Oferta educacional do destino";
const ORGANIZATION = "Etapa ou ano no destino";
const EFFECTIVE = "Data da transferência";
const TITLE = "Transferir aluno de escola";

async function pick(user: User, label: string, optionName: string | RegExp) {
  const trigger = await screen.findByLabelText(label);
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: optionName }));
}

async function chooseKind(user: User, name: string | RegExp) {
  await user.click(await screen.findByRole("radio", { name }));
}

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(EFFECTIVE), { target: { value } });
}

function concludeButton(name: RegExp) {
  return screen.getAllByRole("button", { name })[0]!;
}

async function next(user: User) {
  await user.click(await screen.findByRole("button", { name: /Continuar$/ }));
}

/** Passo 1 → passo 2 (tipo e destino). */
async function goToDestination(user: User) {
  await next(user);
  await screen.findByRole("radiogroup", { name: "Tipo de transferência" });
}

/** Preenche o destino interno demonstrativo padrão. */
async function fillInternalDestination(user: User, unit: string | RegExp) {
  await pick(user, UNIT, unit);
  await pick(user, OFFER, "Ensino Fundamental — 1º segmento · 1º ao 5º ano");
  await pick(user, ORGANIZATION, "Ensino Fundamental — 1º segmento · 1º ao 5º ano");
}

describe("Transferência — abertura e contexto de origem", () => {
  it("abre a transferência com as etapas guiadas", async () => {
    renderOperationalRoutes("/transferencias/nova");

    expect(await screen.findByRole("heading", { name: TITLE, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Etapas da transferência/ })).toBeInTheDocument();
    expect(
      screen.getAllByText(/A transferência não altera simplesmente a escola do aluno/).length,
    ).toBeGreaterThan(0);
  });

  it("apresenta a relação escolar de origem com identificação mínima", async () => {
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");

    expect(await screen.findByText("SIGEM-AL-000101")).toBeInTheDocument();
    expect(screen.getAllByText("ME-DEMO-1001").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Instituição Educacional Demonstrativa Horizonte").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Turma demonstrativa 3º ano A/ }).length,
    ).toBeGreaterThan(0);
  });

  it("não permite simular transferência sem relação escolar apropriada", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-007");

    expect(
      await screen.findByText("Ainda não há relação escolar que possa ser transferida."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /Matrícula escolar, vínculo letivo e participação não são criados aqui apenas para permitir a operação/,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Aluno e escola de origem")).toBeNull();
    expect(screen.getByRole("button", { name: /Continuar$/ })).toBeDisabled();
    await goToDestination(user).catch(() => undefined);
  });

  it("abre a transferência a partir do detalhe do aluno preservando a participação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-001");

    await user.click((await screen.findAllByRole("link", { name: "Transferência escolar" }))[1]!);

    expect(await screen.findByRole("heading", { name: TITLE, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("ME-DEMO-1001").length).toBeGreaterThan(0);
  });

  it("oferece acesso contextual a partir da matrícula escolar e da trajetória", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-001");

    expect(
      await screen.findByRole("link", { name: "Transferência escolar desta matrícula" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Trajetória escolar" }));
    expect(
      await screen.findByRole("link", { name: "Registrar transferência escolar" }),
    ).toBeInTheDocument();
  });
});

describe("Transferência interna — destino, matrícula e continuidade", () => {
  it("prepara nova matrícula escolar quando o aluno nunca frequentou o destino", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await pick(user, UNIT, "Escola Demonstrativa Águas Claras");

    expect(
      (await screen.findAllByText(/A matrícula escolar da origem permanece intacta/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Nova matrícula escolar no destino").length).toBeGreaterThan(0);
  });

  it("reutiliza a matrícula escolar já existente na unidade de destino", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await pick(user, UNIT, "Núcleo Educacional Demonstrativo Ponte");

    expect(await screen.findByText("Matrícula escolar existente no destino")).toBeInTheDocument();
    expect(screen.getAllByText("ME-DEMO-1501").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /Nenhuma segunda matrícula permanente é criada para a mesma combinação aluno \+ unidade/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("reutiliza a relação histórica no retorno a unidade já frequentada", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-003");
    await goToDestination(user);

    await pick(user, UNIT, "Escola Demonstrativa Águas Claras");

    expect(await screen.findByText("Retorno a unidade já frequentada")).toBeInTheDocument();
    expect(screen.getAllByText("ME-DEMO-1003").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/seu histórico permanece preservado/).length).toBeGreaterThan(0);
  });

  it("preserva a matrícula escolar da origem sem convertê-la em matrícula do destino", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    const preserved = (await screen.findAllByRole("list", { name: "Permanece preservado" }))[0]!;
    expect(within(preserved).getByText(/ME-DEMO-1001/)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /A matrícula escolar da origem não é excluída nem reutilizada como matrícula do destino/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("explicita o encerramento temporal da alocação vigente na origem", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    const ended = (await screen.findAllByRole("list", { name: "Será encerrado na origem" }))[0]!;
    expect(
      within(ended).getByText(/Alocação ativa em turma: Turma demonstrativa 3º ano A/),
    ).toBeInTheDocument();
    expect(within(ended).getByText(/Participação regular vigente/)).toBeInTheDocument();
  });

  it("não enturma automaticamente no destino", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await pick(user, UNIT, "Escola Demonstrativa Águas Claras");

    expect(
      screen.getAllByText(
        /a turma do destino será escolhida posteriormente pelo fluxo de enturmação/i,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("indica continuidade possível quando a organização acadêmica é equivalente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");

    expect(await screen.findByText("Continuidade possível")).toBeInTheDocument();
  });

  it("não corrige silenciosamente organizações acadêmicas incompatíveis", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await pick(user, UNIT, "Instituição Educacional Demonstrativa Serra");
    await pick(user, OFFER, "Educação Infantil · 1º e 2º Período");
    await pick(user, ORGANIZATION, "Educação Infantil · 1º e 2º Período");

    expect(await screen.findByText("Organizações acadêmicas divergentes")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Alteração de organização acadêmica requer operação específica/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Compatibilidade acadêmica requer validação/).length).toBeGreaterThan(
      0,
    );
  });

  it("exige data e evita sobreposição temporal", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);

    expect(screen.getByRole("button", { name: /Continuar$/ })).toBeDisabled();

    setDate("2026-01-05");
    expect(
      screen.getAllByText(/Escolha uma data posterior ao início da turma atual do aluno/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Continuar$/ })).toBeDisabled();

    setDate("2026-08-03");
    expect(screen.getByRole("button", { name: /Continuar$/ })).toBeEnabled();
  });
});

describe("Transferência — saída e entrada externas", () => {
  it("registra saída para instituição externa conhecida", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await chooseKind(user, "Saída para instituição externa");
    await user.click(screen.getByLabelText("Sei para qual escola o aluno vai"));
    await user.type(screen.getByLabelText("Escola de destino"), "Escola Externa Demonstrativa");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    expect(screen.getAllByText("Escola Externa Demonstrativa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nenhuma unidade interna é criada").length).toBeGreaterThan(0);
    expect(concludeButton(/Registrar saída da rede/)).toBeEnabled();
  });

  it("permite registrar saída com destino externo não informado", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await chooseKind(user, "Saída para instituição externa");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    expect(screen.getAllByText(/Destino externo não informado/).length).toBeGreaterThan(0);
    expect(concludeButton(/Registrar saída da rede/)).toBeEnabled();
  });

  it("prepara ingresso proveniente de outra rede sem criar unidade externa", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova");
    await goToDestination(user);

    await chooseKind(user, "Entrada proveniente de instituição externa");
    await fillInternalDestination(user, "Instituição Educacional Demonstrativa Horizonte");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await pick(user, "Aluno que está chegando", /Aluna Fictícia Demonstrativa Sete/);
    await user.type(screen.getByLabelText("Escola de onde ele vem"), "Rede Externa Demonstrativa");
    await next(user);
    await next(user);
    setDate("2026-08-03");
    await next(user);

    expect(
      screen.getAllByText(/nenhuma Unidade Escolar do SIGEM é criada para representá-la/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Aluno ainda não enturmado no destino/).length).toBeGreaterThan(0);
    expect(concludeButton(/Preparar ingresso proveniente de outra rede/)).toBeEnabled();
  });
});

describe("Transferência — conflitos, participações e concorrência", () => {
  it("apresenta conflito forte de participação regular ativa sem resolvê-lo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-002");

    const conflicts = await screen.findByRole("list", {
      name: "Conflitos de participação regular",
    });
    expect(
      within(conflicts).getByText(/Participação regular ativa em Instituição Demonstrativa Ipê/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Nenhuma segunda participação regular sobreposta é criada/).length,
    ).toBeGreaterThan(0);

    await goToDestination(user);
    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    expect(concludeButton(/Concluir transferência interna/)).toBeDisabled();
  });

  it("trata AEE e participações complementares separadamente", async () => {
    renderOperationalRoutes("/transferencias/nova?aluno=alu-006");

    const complementary = await screen.findByRole("list", {
      name: "Participações complementares da origem",
    });
    expect(
      within(complementary).getByText(/Atendimento educacional especializado \(AEE\)/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /não são transferidos, encerrados nem recriados automaticamente no destino/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("apresenta conflito de versão demonstrativo impedindo a conclusão", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    await user.click(
      await screen.findByLabelText("Simular alteração concorrente durante a operação"),
    );

    expect(
      screen.getAllByText(
        "Os dados acadêmicos deste aluno foram alterados por outro usuário durante a operação.",
      ).length,
    ).toBeGreaterThan(0);
    expect(concludeButton(/Concluir transferência interna/)).toBeDisabled();
  });

  it("registra estados documentais sem checklist legal", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    await pick(user, "Situação dos documentos", "Pendência documental");

    expect(
      screen.getAllByText(/nenhum checklist legal definitivo existe nesta etapa/).length,
    ).toBeGreaterThan(0);
  });
});

describe("Transferência — conferência, atomicidade e conclusão", () => {
  it("compara origem e destino com os registros afetados", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await pick(user, PERIOD, "Período letivo 2026");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    expect(
      await screen.findByRole("heading", { name: "O que será alterado" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Origem" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Destino" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Registros criados" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Mantidos pendentes" })).toBeInTheDocument();
  });

  it("comunica a atomicidade conceitual e a sequência transacional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    setDate("2026-08-03");
    await next(user);

    expect(
      (
        await screen.findAllByText(
          /A transferência interna é uma única operação administrativa: ou tudo é concluído, ou nada é concluído/,
        )
      ).length,
    ).toBeGreaterThan(0);
    const steps = screen.getByRole("list", { name: "Sequência transacional conceitual" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(7);
    expect(within(steps).getByText(/Encerrar o contexto aplicável na origem/)).toBeInTheDocument();
  });

  it("conclui a transferência interna sem sucesso parcial e sem persistência", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    await next(user);
    setDate("2026-08-03");
    await next(user);
    await user.click(concludeButton(/Concluir transferência interna/));

    expect(
      await screen.findByText(/A situação na escola atual é encerrada e a nova é preparada/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText(
        "Transferência demonstrativa preparada. Histórico da origem preservado e contexto do destino preparado.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Colocar o aluno em uma turma no destino" }),
    ).toBeInTheDocument();
  });

  it("conclui saída externa preservando o histórico da rede", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await chooseKind(user, "Saída para instituição externa");
    await next(user);
    setDate("2026-08-03");
    await next(user);
    await user.click(concludeButton(/Registrar saída da rede/));
    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText(
        "Saída demonstrativa preparada. O histórico da rede permanece preservado.",
      ),
    ).toBeInTheDocument();
  });

  it("conclui entrada externa sem criar enturmação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova");
    await goToDestination(user);

    await chooseKind(user, "Entrada proveniente de instituição externa");
    await fillInternalDestination(user, "Instituição Educacional Demonstrativa Horizonte");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await pick(user, "Aluno que está chegando", /Aluna Fictícia Demonstrativa Sete/);
    await next(user);
    await next(user);
    setDate("2026-08-03");
    await next(user);
    await user.click(concludeButton(/Preparar ingresso proveniente de outra rede/));
    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText(
        "Ingresso externo demonstrativo preparado. Nenhuma enturmação foi criada.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Transferência — dirty state, privacidade e trajetória", () => {
  it("sinaliza alterações não salvas e permite continuar editando", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");
    await goToDestination(user);

    await fillInternalDestination(user, "Escola Demonstrativa Águas Claras");
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");

    await user.click(screen.getByRole("button", { name: "Sair sem concluir" }));
    expect(await screen.findByRole("heading", { name: "Sair sem concluir?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");
  });

  it("não expõe dados pessoais desnecessários", async () => {
    renderOperationalRoutes("/transferencias/nova?aluno=alu-001");

    expect(
      await screen.findByText(
        /nenhum CPF completo, endereço, filiação, contato familiar, dado de saúde, laudo ou informação sensível/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Filiação:/i)).toBeNull();
    expect(screen.queryByText(/000\.000\.000-0/)).toBeNull();
  });

  it("narra a trajetória da origem ao destino sem reinterpretar a unidade anterior", async () => {
    renderOperationalRoutes("/alunos/alu-003");

    expect(
      await screen.findByText(/Matrícula escolar de origem: encerrada na escola, mas preservada/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Matrícula escolar no destino: novo vínculo permanente com esta escola/)
        .length,
    ).toBeGreaterThan(0);
  });
});
