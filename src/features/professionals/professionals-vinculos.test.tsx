import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import { functionalLinkScenarios } from "./functional-link-draft";

const fillRequired = async () => {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("Empregador ou contexto administrativo"),
    "Contexto municipal demonstrativo",
  );
  await user.click(screen.getByRole("combobox", { name: "Natureza ou contexto do vínculo" }));
  await user.click(screen.getByRole("option", { name: "Contexto municipal demonstrativo" }));
  await user.type(
    screen.getByLabelText("Cargo / referência administrativa"),
    "Cargo demonstrativo",
  );
  fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-02-01" } });
  return user;
};

describe("Profissionais — vínculos funcionais 9C", () => {
  it("abre novo vínculo no contexto obrigatório do profissional", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    expect(
      await screen.findByRole("heading", { name: "Novo vínculo funcional", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Profissional Fictícia Aurora Martins")).toBeInTheDocument();
    expect(screen.getByText("SIGEM-PE-000302")).toBeInTheDocument();
    expect(screen.getByText("SIGEM-PR-000201")).toBeInTheDocument();
  });

  it("bloqueia vínculo ad hoc quando Profissional não existe", async () => {
    renderOperationalRoutes("/profissionais/inexistente/vinculos/novo");
    expect(
      await screen.findByRole("heading", { name: "Profissional existente obrigatório" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para novo profissional" })).toHaveAttribute(
      "href",
      "/profissionais/novo",
    );
  });

  it("não repete cadastro civil e preserva privacidade", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    await screen.findByRole("heading", { name: "Novo vínculo funcional" });
    expect(screen.queryByText(/CPF/)).not.toBeInTheDocument();
    expect(screen.queryByText(/endereço|dados bancários|filiação|saúde/i)).not.toBeInTheDocument();
  });

  it("separa matrícula funcional do Identificador SIGEM", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    expect(await screen.findByText("SIGEM-PE-000302")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Matrícula / identificador funcional (opcional)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/matrícula funcional pertence ao Vínculo/)).toBeInTheDocument();
  });

  it("aceita ausência de matrícula funcional e carga horária", async () => {
    renderOperationalRoutes("/profissionais/pro-007/vinculos/novo");
    await screen.findByRole("heading", { name: "Novo vínculo funcional" });
    await fillRequired();
    expect(screen.getByRole("button", { name: "Criar vínculo funcional" })).toBeEnabled();
    const review = screen.getByRole("heading", { name: "Revisão" }).closest("section");
    expect(review).toHaveTextContent("Sem matrícula funcional");
    expect(review).toHaveTextContent("Não informada");
  });

  it("permite carga conhecida e mantém enquadramento opcional", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    await user.click(await screen.findByLabelText("Carga conhecida"));
    await user.type(screen.getByLabelText("Horas semanais"), "20");
    expect(screen.getByLabelText("Enquadramento (opcional)")).toHaveValue("");
    expect(screen.getByText("20 horas semanais")).toBeInTheDocument();
  });

  it("mostra múltiplos vínculos simultâneos sem tratá-los como função", async () => {
    renderOperationalRoutes("/profissionais/pro-002/vinculos/novo");
    const list = await screen.findByRole("list", { name: "Vínculos existentes do profissional" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("VF-DEMO-2002-A");
    expect(list).toHaveTextContent("VF-DEMO-2002-B");
    expect(
      screen.getByText(
        /Cargo igual, empregador igual ou vigências simultâneas não caracterizam duplicidade/,
      ),
    ).toBeInTheDocument();
  });

  it("detecta matrícula duplicada somente no mesmo contexto", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    await user.type(
      await screen.findByLabelText("Empregador ou contexto administrativo"),
      "Contexto municipal demonstrativo",
    );
    await user.type(
      screen.getByLabelText("Matrícula / identificador funcional (opcional)"),
      "VF-DEMO-2001",
    );
    expect(screen.getAllByText("Possível vínculo duplicado — requer verificação.")).toHaveLength(2);
  });

  it("não considera Cargo igual uma duplicidade automática", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-002/vinculos/novo");
    await user.type(
      await screen.findByLabelText("Empregador ou contexto administrativo"),
      "Contexto municipal demonstrativo",
    );
    await user.type(
      screen.getByLabelText("Cargo / referência administrativa"),
      "Professor — referência demonstrativa",
    );
    expect(screen.getAllByText("Nenhuma duplicidade óbvia identificada.")).toHaveLength(2);
  });

  it("exige somente campos conceitualmente seguros", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    const pending = await screen.findByRole("list", { name: "Pendências do vínculo" });
    expect(within(pending).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Criar vínculo funcional" })).toBeDisabled();
  });

  it("preserva início e término opcionais da vigência", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    fireEvent.change(await screen.findByLabelText("Data de início"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("Data de término (opcional)"), {
      target: { value: "2027-01-31" },
    });
    expect(screen.getByText("2026-02-01 — 2027-01-31")).toBeInTheDocument();
  });

  it("consulta detalhe de vínculo vigente", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001");
    expect(
      await screen.findByRole("heading", { name: "VF-DEMO-2001", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Contexto municipal demonstrativo").length).toBeGreaterThan(0);
    expect(screen.getByText("Docência — exemplo conceitual")).toBeInTheDocument();
  });

  it("mantém vínculo histórico encerrado consultável", async () => {
    renderOperationalRoutes("/profissionais/pro-007/vinculos/vf-007");
    expect(await screen.findByText("Encerrado")).toBeInTheDocument();
    expect(screen.getByText(/Encerrar vínculo funcional não exclui/)).toBeInTheDocument();
  });

  it("mantém Lotação, Função e Atuação como áreas futuras", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001");
    for (const name of ["Lotações", "Funções", "Atuação Pedagógica", "Histórico/Auditoria"])
      expect(await screen.findByRole("button", { name })).toBeDisabled();
  });

  it("não implementa encerramento jurídico", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001");
    expect(
      await screen.findByRole("button", { name: "Encerrar vínculo funcional" }),
    ).toBeDisabled();
  });

  it("abre edição sem alterar Pessoa ou Profissional", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001/editar");
    expect(
      await screen.findByRole("heading", { name: "Editar vínculo funcional" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nenhuma nova Pessoa ou novo papel Profissional será criado/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cargo / referência administrativa")).toHaveValue(
      "Docência — exemplo conceitual",
    );
  });

  it("avisa quando edição pode exigir histórico específico", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001/editar");
    const cargo = await screen.findByLabelText("Cargo / referência administrativa");
    await user.clear(cargo);
    await user.type(cargo, "Outro cargo demonstrativo");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta alteração pode exigir registro histórico específico.",
    );
  });

  it("intercepta saída quando há alterações não salvas", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/profissionais/pro-001/vinculos/novo");
    await user.type(
      await screen.findByLabelText("Cargo / referência administrativa"),
      "Cargo teste",
    );
    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Sair com alterações não salvas?");
    expect(screen.getByRole("button", { name: "Continuar editando" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar alterações e sair" })).toBeInTheDocument();
  });

  it("revisa o escopo e conclui sem criar relações futuras", async () => {
    const user = await fillRequiredAfterRender("/profissionais/pro-007/vinculos/novo");
    await user.click(screen.getByRole("button", { name: "Criar vínculo funcional" }));
    await user.click(screen.getByRole("button", { name: "Confirmar conclusão" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Vínculo funcional demonstrativo preparado. Nenhuma lotação, função ou atuação pedagógica foi criada.",
    );
    expect(screen.getByText("Próxima ação: Registrar lotação.")).toBeInTheDocument();
  });

  it("integra novo vínculo e acesso aos existentes no detalhe profissional", async () => {
    renderOperationalRoutes("/profissionais/pro-001");
    expect(await screen.findByRole("link", { name: "Novo vínculo funcional" })).toHaveAttribute(
      "href",
      "/profissionais/pro-001/vinculos/novo",
    );
    expect(screen.getByRole("link", { name: "Consultar vínculo" })).toHaveAttribute(
      "href",
      "/profissionais/pro-001/vinculos/vf-001",
    );
  });

  it("mantém os doze cenários fictícios A–L", () => {
    expect(functionalLinkScenarios).toHaveLength(12);
    expect(functionalLinkScenarios.map((item) => item.id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ]);
  });
});

async function fillRequiredAfterRender(path: string) {
  renderOperationalRoutes(path);
  await screen.findByRole("heading", { name: "Novo vínculo funcional" });
  return fillRequired();
}
