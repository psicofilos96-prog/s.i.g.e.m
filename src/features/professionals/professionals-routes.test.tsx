import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

describe("Profissionais — consulta", () => {
  it("lista profissionais em tabela operacional enxuta", async () => {
    renderOperationalRoutes("/profissionais");
    expect(
      await screen.findByRole("heading", { name: "Profissionais", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Consulta de profissionais fictícios" }),
    ).toBeInTheDocument();
    for (const name of [
      "Profissional",
      "Vínculo principal / contextual",
      "Lotação atual",
      "Função atual",
      "Situação",
    ])
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    expect(screen.getByText("11 de 11 profissionais fictícios")).toBeInTheDocument();
  });

  it("pesquisa por nome e identificadores sem usar CPF", async () => {
    renderOperationalRoutes("/profissionais");
    const search = await screen.findByLabelText("Pesquisar profissionais");
    fireEvent.change(search, { target: { value: "Aurora Martins" } });
    expect(
      screen.getByRole("link", { name: "Profissional Fictícia Aurora Martins" }),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "VF-DEMO-2006" } });
    expect(
      screen.getByRole("link", { name: "Profissional Fictício Fábio Ribeiro" }),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "SIGEM-PR-000208" } });
    expect(
      screen.getByRole("link", { name: "Profissional Fictício Heitor Almeida" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /CPF/i })).not.toBeInTheDocument();
  });

  it("filtra profissionais por situação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais");
    const trigger = await screen.findByRole("combobox", { name: "Situação contextual" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("option", { name: "Histórico" }));
    expect(
      screen.getByRole("link", { name: "Profissional Fictícia Gabriela Torres" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Profissional Fictícia Aurora Martins" }),
    ).not.toBeInTheDocument();
  });

  it("expõe minimização e estado de permissão demonstrativo", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais");
    const disclosure = await screen.findByText("Informações e critérios desta consulta");
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText(/CPF, endereço residencial, dados bancários/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Filtros/i }));
    await user.click(screen.getByRole("combobox", { name: "Estado demonstrativo da consulta" }));
    await user.click(screen.getByRole("option", { name: "Permissão negada" }));
    expect(await screen.findByText("Consulta funcional não permitida")).toBeInTheDocument();
    expect(
      screen.getByText(/Você não tem permissão para esta consulta/),
    ).toBeInTheDocument();
  });
});

describe("Profissionais — detalhe", () => {
  it("distingue Pessoa, Profissional e dois vínculos sem duplicar a pessoa", async () => {
    renderOperationalRoutes("/profissionais/pro-002");
    expect(
      await screen.findByRole("heading", {
        name: "Profissional Fictício Bento Nogueira",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados do profissional" })).toBeInTheDocument();
    expect(
      screen.getByText(/ter dois\s+vínculos não cria dois cadastros de pessoa/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Vínculos funcionais do profissional")).toHaveTextContent(
      "VF-DEMO-2002-A",
    );
    expect(screen.getByLabelText("Vínculos funcionais do profissional")).toHaveTextContent(
      "VF-DEMO-2002-B",
    );
  });

  it("representa múltiplas lotações no mesmo vínculo", async () => {
    renderOperationalRoutes("/profissionais/pro-003");
    const list = await screen.findByRole("list", { name: "Lotações do vínculo VF-DEMO-2003" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByText(/Uma pessoa e um mesmo vínculo podem possuir múltiplas lotações/),
    ).toBeInTheDocument();
  });

  it("separa cargo de função e preserva múltiplas funções", async () => {
    renderOperationalRoutes("/profissionais/pro-005");
    expect(await screen.findByText("Cargo técnico — exemplo")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Funções do vínculo VF-DEMO-2005" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByText(/nenhuma delas substitui Cargo ou Vínculo Funcional/),
    ).toBeInTheDocument();
  });

  it("mostra atuação pedagógica separada e não inferida pelo cargo", async () => {
    renderOperationalRoutes("/profissionais/pro-006");
    expect(await screen.findByRole("heading", { name: "Atuação pedagógica" })).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Atuações pedagógicas demonstrativas" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/O cargo não concede automaticamente atuação/)).toBeInTheDocument();
  });

  it("não exige carga horária global", async () => {
    renderOperationalRoutes("/profissionais/pro-009");
    expect(
      await screen.findByText("Não informada; nenhum valor global foi presumido"),
    ).toBeInTheDocument();
  });

  it("mantém profissional histórico consultável", async () => {
    renderOperationalRoutes("/profissionais/pro-007");
    expect(await screen.findByRole("note")).toHaveTextContent(/sem vínculo vigente/);
    expect(screen.getAllByText("Histórico").length).toBeGreaterThan(0);
  });

  it("narra trajetória distinguindo Atual e Histórico", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-010");
    await user.click(await screen.findByRole("tab", { name: "Trajetória funcional" }));
    const timeline = await screen.findByRole("list", {
      name: "Trajetória funcional do profissional",
    });
    expect(within(timeline).getByText("Mudança de lotação")).toBeInTheDocument();
    expect(within(timeline).getByText("Atual")).toBeInTheDocument();
    expect(within(timeline).getByText("Histórico")).toBeInTheDocument();
    expect(
      within(timeline).getAllByText("Detalhes técnicos")[0]?.closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("mantém áreas futuras desabilitadas", async () => {
    renderOperationalRoutes("/profissionais/pro-001");
    expect(await screen.findByRole("tab", { name: "Visão geral" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Trajetória funcional" })).toBeEnabled();
    for (const name of [
      "Vínculos",
      "Lotações",
      "Funções",
      "Atuação pedagógica",
      "Documentos",
      "Histórico/Auditoria",
    ])
      expect(screen.getByRole("tab", { name })).toBeDisabled();
  });

  it("apresenta estado de profissional inexistente", async () => {
    renderOperationalRoutes("/profissionais/inexistente");
    expect(
      await screen.findByRole("heading", { name: "Profissional não encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para profissionais" })).toBeInTheDocument();
  });
});
