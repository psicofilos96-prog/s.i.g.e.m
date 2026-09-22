import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Vínculo letivo, renovação e participação (Etapa 8D).
 * Nenhuma alocação em turma, transferência ou reclassificação é executada.
 */
type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, label: string, optionName: string | RegExp) {
  const trigger = await screen.findByLabelText(label);
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: optionName }));
}

const PERIOD = "Período letivo do vínculo";
const OFFER = "Oferta educacional da unidade";
const ORGANIZATION = "Organização acadêmica da oferta";
const EF1 = /Ensino Fundamental — 1º segmento/;

describe("Vínculo letivo — abertura e matrícula de origem", () => {
  it("abre o workspace a partir do detalhe do aluno", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-001");

    await user.click(
      await screen.findByRole("link", { name: "Vínculo letivo e participação" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Vínculo letivo e participação (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Etapas do vínculo letivo" })).toBeInTheDocument();
  });

  it("apresenta a matrícula escolar preselecionada com identificadores distintos", async () => {
    renderOperationalRoutes("/vinculos-letivos/novo?aluno=alu-001&matricula=alu-001-me1");

    expect((await screen.findAllByText("Identificador SIGEM do aluno")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Identificador da matrícula escolar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SIGEM-AL-000101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ME-DEMO-1001").length).toBeGreaterThan(0);
  });

  it("orienta ao ingresso quando não existe matrícula escolar no contexto", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?aluno=alu-000");

    expect(await screen.findByText("Nenhuma matrícula escolar encontrada.")).toBeInTheDocument();
    expect(
      screen.getByText(/O ingresso \(Aluno → Matrícula Escolar\) é uma operação anterior/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Registrar ingresso e matrícula escolar" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Ingresso e matrícula escolar (demonstrativo)",
        level: 1,
      }),
    ).toBeInTheDocument();
  });
});

describe("Vínculo letivo — período, oferta e organização", () => {
  it("seleciona período letivo distinguindo-o do ano civil", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=me-demo-1008");

    expect(
      await screen.findByText(
        /Período letivo é uma organização temporal própria: não equivale ao ano civil nem ao período avaliativo/,
      ),
    ).toBeInTheDocument();
    await pick(user, PERIOD, "Período letivo 2027");

    expect(
      await screen.findByText("Nenhum vínculo letivo registrado nesta matrícula escolar."),
    ).toBeInTheDocument();
  });

  it("lista ofertas da unidade da matrícula escolar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");
    await pick(user, OFFER, EF1);

    expect(await screen.findByLabelText(ORGANIZATION)).toBeInTheDocument();
  });

  it("define organização acadêmica sem tratar tudo como série", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");
    await pick(user, OFFER, EF1);
    await pick(user, ORGANIZATION, EF1);

    expect(
      screen.getByText(
        /Período da Educação Infantil, ano do Ensino Fundamental ou fase da EJA, conforme a oferta/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Série$/)).toBeNull();
  });

  it("apresenta a EJA organizada em fases próprias", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-004-me2");

    await pick(user, PERIOD, "Período letivo 2027");
    await pick(user, OFFER, /EJA — 1º segmento/);

    expect(
      await screen.findByText(
        /A EJA organiza-se em fases próprias e não utiliza anos escolares regulares/,
      ),
    ).toBeInTheDocument();
    await pick(user, ORGANIZATION, /Fases I a V/);
    expect(screen.getAllByText(/Fases I a V/).length).toBeGreaterThan(0);
  });

  it("consulta a matriz curricular contextual sem editá-la", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");
    await pick(user, OFFER, EF1);

    expect(
      screen.getByText(/A matriz é apenas consultada no contexto da oferta/),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Consultar matriz/ })).toBeInTheDocument();
  });
});

describe("Vínculo letivo — renovação, histórico e duplicidade", () => {
  it("renova preservando o vínculo letivo anterior como histórico", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");

    expect(
      await screen.findByText("Continuidade ainda não registrada neste período letivo."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Período letivo 2026/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /O vínculo anterior permanece histórico e imutável: a renovação cria novo contexto temporal e não sobrescreve o passado/,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/a MESMA matrícula escolar|MESMA matrícula escolar/).length).toBeGreaterThan(0);
  });

  it("mantém consultáveis os vínculos letivos históricos da mesma matrícula", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-002-me1");

    await pick(user, PERIOD, "Período letivo 2027");

    const history = await screen.findByRole("list", {
      name: "Vínculos letivos históricos desta matrícula escolar",
    });
    expect(within(history).getAllByRole("listitem")).toHaveLength(3);
    expect(within(history).getByText(/Período letivo 2024/)).toBeInTheDocument();
  });

  it("impede vínculo letivo equivalente no mesmo contexto", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-002-me1");

    await pick(user, PERIOD, "Período letivo 2026");

    expect(
      await screen.findByText(
        "Já existe vínculo letivo registrado para esta matrícula neste contexto.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Consultar vínculo letivo existente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Concluir vínculo letivo/ }),
    ).toBeDisabled();
  });

  it("indica que reclassificação depende de operações formais futuras", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");

    expect(
      await screen.findByText(
        /A edição direta de vínculo letivo não é mecanismo de reclassificação/,
      ),
    ).toBeInTheDocument();
  });
});

describe("Vínculo letivo — participação e coexistência", () => {
  it("apresenta a participação regular como escolarização principal", async () => {
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    expect(await screen.findByLabelText("Participação regular")).toBeChecked();
    expect(
      screen.getByText(/A participação regular representa a escolarização principal/),
    ).toBeInTheDocument();
  });

  it("demonstra coexistência de participação regular e AEE", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await user.click(
      await screen.findByLabelText("Atendimento educacional especializado (AEE)"),
    );

    expect(screen.getByLabelText("Participação regular")).toBeChecked();
    expect(
      screen.getByText(
        "Coexistência demonstrada: participação regular e AEE convivem no mesmo vínculo letivo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pode coexistir com a participação regular e não a substitui/),
    ).toBeInTheDocument();
  });

  it("aceita atividade complementar separada da regular com regra por validar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await user.click(await screen.findByLabelText("Atividade complementar demonstrativa"));

    expect(screen.getByLabelText("Participação regular")).toBeChecked();
    expect(screen.getAllByText("Regra de coexistência requer validação.").length).toBeGreaterThan(
      0,
    );
  });

  it("admite participação sem regular sem inventar bloqueio", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await user.click(
      await screen.findByLabelText("Atendimento domiciliar/hospitalar demonstrativo"),
    );
    await user.click(screen.getByLabelText("Participação regular"));

    expect(screen.getByLabelText("Participação regular")).not.toBeChecked();
    expect(
      screen.getByText(/poderão não depender de participação regular simultânea/),
    ).toBeInTheDocument();
  });

  it("exige pelo menos uma participação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await user.click(await screen.findByLabelText("Participação regular"));

    expect(screen.getAllByText(/Nenhuma participação definida/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Concluir vínculo letivo/ })).toBeDisabled();
  });

  it("sinaliza conflito de participação regular em outra unidade sem resolvê-lo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-003-me1");

    await pick(user, PERIOD, "Período letivo 2026");

    expect(
      await screen.findByText(
        /Existe participação regular registrada em outra unidade para período sobreposto/,
      ),
    ).toBeInTheDocument();
    const conflicts = screen.getByRole("list", {
      name: "Participações regulares em outras unidades",
    });
    expect(within(conflicts).getByText(/ME-DEMO-1103/)).toBeInTheDocument();
    expect(
      screen.getByText(/Nada é transferido, encerrado ou resolvido automaticamente/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir vínculo letivo/ })).toBeDisabled();
  });
});

describe("Vínculo letivo — revisão, conclusão e salvaguardas", () => {
  it("mostra revisão com o escopo da operação e sem alocação em turma", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");
    await pick(user, OFFER, EF1);
    await pick(user, ORGANIZATION, EF1);

    expect(screen.getByRole("heading", { name: "Revisar e concluir" })).toBeInTheDocument();
    expect(
      screen.getAllByText("Esta operação não aloca o aluno em uma turma.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Pendências e avisos" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Alocação em turma \(área futura\)/ }),
    ).toBeInTheDocument();
  });

  it("conclui sem criar alocação em turma", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");
    await pick(user, OFFER, EF1);
    await pick(user, ORGANIZATION, EF1);
    await user.click(screen.getByRole("button", { name: /Concluir vínculo letivo/ }));
    await user.click(await screen.findByRole("button", { name: "Confirmar vínculo letivo" }));

    expect(
      await screen.findByText(
        /Vínculo letivo demonstrativo preparado\. Nenhuma alocação em turma foi criada/,
      ),
    ).toBeInTheDocument();
  });

  it("sinaliza alterações não salvas e confirma antes de sair", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-001-me1");

    await pick(user, PERIOD, "Período letivo 2027");
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");

    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  });

  it("não expõe dados pessoais excessivos", async () => {
    renderOperationalRoutes("/vinculos-letivos/novo?matricula=alu-006-me1");

    expect(
      await screen.findByText(/nenhum endereço, filiação, CPF completo, dado de saúde, laudo/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/000\.000\.000-0/)).toBeNull();
    expect(screen.queryByText(/Endereço demonstrativo/)).toBeNull();
    expect(screen.queryByText(/Filiação:/i)).toBeNull();
  });
});
