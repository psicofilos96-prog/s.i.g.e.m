import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

const UNIT_AGUAS_CLARAS = "Escola Demonstrativa Águas Claras";
const PERIOD_2026 = "Período letivo 2026";
const OFFER_EF1 = /Ensino Fundamental — 1º segmento · 1º ao 5º ano/;

async function pick(comboboxName: string, optionName: string | RegExp) {
  await userEvent.click(screen.getByRole("combobox", { name: comboboxName }));
  await userEvent.click(screen.getByRole("option", { name: optionName }));
}

async function configureContext() {
  await pick("Unidade", UNIT_AGUAS_CLARAS);
  await pick("Período letivo", PERIOD_2026);
  await pick("Oferta educacional", OFFER_EF1);
}

describe("Workspace de turmas — criação", () => {
  it("abre o workspace de nova turma a partir da consulta", async () => {
    renderOperationalRoutes("/turmas");
    await userEvent.click(screen.getByRole("link", { name: /Nova turma/ }));

    expect(
      await screen.findByRole("heading", { name: /Nova turma \(configuração demonstrativa\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Seções do workspace" })).toBeInTheDocument();
  });

  it("comunica que a oferta depende da unidade e do período letivo", async () => {
    renderOperationalRoutes("/turmas/nova");

    expect(
      await screen.findByText(
        /Selecione unidade e período letivo para ver as ofertas educacionais possíveis/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Oferta educacional" })).not.toBeInTheDocument();

    await pick("Unidade", UNIT_AGUAS_CLARAS);
    await pick("Período letivo", PERIOD_2026);

    expect(screen.getByRole("combobox", { name: "Oferta educacional" })).toBeInTheDocument();
  });

  it("configura turma de organização simples com um único agrupamento", async () => {
    renderOperationalRoutes("/turmas/nova");
    await configureContext();

    await userEvent.click(screen.getByRole("checkbox", { name: /3º ano/ }));

    const selected = screen.getByRole("list", { name: "Agrupamentos selecionados" });
    expect(within(selected).getAllByRole("listitem")).toHaveLength(1);
    expect(within(selected).getByText("3º ano")).toBeInTheDocument();
  });

  it("permite selecionar múltiplos agrupamentos identificáveis individualmente", async () => {
    renderOperationalRoutes("/turmas/nova");
    await configureContext();

    await userEvent.click(screen.getByRole("checkbox", { name: /1º ano/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /2º ano/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /3º ano/ }));

    const selected = screen.getByRole("list", { name: "Agrupamentos selecionados" });
    expect(within(selected).getAllByRole("listitem")).toHaveLength(3);
    expect(within(selected).getByText("1º ano")).toBeInTheDocument();
    expect(within(selected).getByText("2º ano")).toBeInTheDocument();
  });

  it("remove um agrupamento selecionado", async () => {
    renderOperationalRoutes("/turmas/nova");
    await configureContext();

    await userEvent.click(screen.getByRole("checkbox", { name: /1º ano/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /2º ano/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remover agrupamento 1º ano" }));

    const selected = screen.getByRole("list", { name: "Agrupamentos selecionados" });
    expect(within(selected).getAllByRole("listitem")).toHaveLength(1);
    expect(within(selected).getByText("2º ano")).toBeInTheDocument();
  });

  it("apresenta matrizes do contexto com versão, vigência e aplicabilidade", async () => {
    renderOperationalRoutes("/turmas/nova");
    await configureContext();

    const matrices = screen.getByRole("list", { name: "Matrizes consideradas" });
    const first = within(matrices).getAllByRole("listitem")[0]!;
    expect(within(first).getByText(/Versão 1/)).toBeInTheDocument();
    expect(within(first).getByText(/vigência/)).toBeInTheDocument();
    expect(within(first).getByText(/Aplicabilidade:/)).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Consultar matriz" })).toBeInTheDocument();

    await userEvent.click(within(matrices).getAllByRole("radio")[0]!);
    expect(within(matrices).getAllByRole("radio")[0]!).toBeChecked();
  });

  it("exibe a revisão estrutural do contexto configurado", async () => {
    renderOperationalRoutes("/turmas/nova");
    await configureContext();
    await userEvent.click(screen.getByRole("checkbox", { name: /4º ano/ }));

    const review = screen.getByRole("region", { name: "Revisão" });
    expect(within(review).getByText(UNIT_AGUAS_CLARAS)).toBeInTheDocument();
    expect(within(review).getByText(PERIOD_2026)).toBeInTheDocument();
    expect(
      within(review).getByRole("list", { name: "Agrupamentos em revisão" }),
    ).toBeInTheDocument();
  });

  it("bloqueia a conclusão enquanto houver erros obrigatórios", async () => {
    renderOperationalRoutes("/turmas/nova");

    expect(await screen.findByRole("button", { name: /Concluir configuração/ })).toBeDisabled();
    const issues = screen.getByRole("list", { name: "Avisos e pendências" });
    expect(within(issues).getByText(/Unidade não informada/)).toBeInTheDocument();
    expect(within(issues).getByText(/Período letivo não informado/)).toBeInTheDocument();
    expect(within(issues).getByText(/Nenhum agrupamento selecionado/)).toBeInTheDocument();
    expect(within(issues).getByText(/Identificação da turma não informada/)).toBeInTheDocument();
  });

  it("avisa que a compatibilidade requer validação em turma multietapa", async () => {
    renderOperationalRoutes("/turmas/nova");
    await configureContext();

    await userEvent.click(screen.getByRole("checkbox", { name: /1º ano/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /2º ano/ }));

    const issues = screen.getByRole("list", { name: "Avisos e pendências" });
    expect(within(issues).getByText(/Compatibilidade requer validação/)).toBeInTheDocument();
  });

  it("registra dirty state e alerta antes de descartar alterações", async () => {
    renderOperationalRoutes("/turmas/nova");

    expect(await screen.findByText("Nenhuma alteração registrada")).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Identificação/nome da turma"),
      "Turma demonstrativa",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");

    await userEvent.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar alterações e sair" }),
    ).toBeInTheDocument();
  });
});

describe("Workspace de turmas — edição", () => {
  it("preserva o contexto atual e indica alterações estruturais", async () => {
    renderOperationalRoutes("/turmas/editar/tur-003");

    expect(
      await screen.findByRole("heading", { name: /Editar turma — Turma demonstrativa multietapa/ }),
    ).toBeInTheDocument();
    const selected = screen.getByRole("list", { name: "Agrupamentos selecionados" });
    expect(within(selected).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/Nenhuma alteração em relação ao contexto atual/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remover agrupamento 3º ano" }));

    const changes = screen.getByRole("list", { name: "Alterações estruturais" });
    expect(within(changes).getByText(/Agrupamentos:/)).toBeInTheDocument();
  });

  it("mantém turma histórica somente leitura", async () => {
    renderOperationalRoutes("/turmas/editar/tur-006");

    expect(await screen.findByText("Somente leitura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Concluir configuração/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar a turma" })).toBeInTheDocument();
  });
});
