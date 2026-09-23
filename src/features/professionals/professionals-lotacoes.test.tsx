import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import {
  assessHoursDistribution,
  assessMovementConflicts,
  assessPostingConflicts,
  blankMovementDraft,
  blankPostingDraft,
  currentPostings,
  getPostingContext,
  historicalPostings,
  postingScenarios,
  postingTrajectory,
  validateMovementDraft,
  validatePostingDraft,
} from "./posting-draft";
import { getDemonstrationProfessional } from "./professionals-data";

const openSelect = (name: string) =>
  fireEvent.pointerDown(screen.getByRole("combobox", { name }), {
    pointerType: "mouse",
    button: 0,
  });

const pickOption = (element: HTMLElement) => {
  fireEvent.click(element);
};

const section = (name: string) => screen.getByRole("heading", { name }).closest("section");

const fillPosting = async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  openSelect("Tipo de contexto organizacional");
  pickOption(screen.getByRole("option", { name: "Unidade escolar" }));
  openSelect("Unidade ou contexto organizacional");
  pickOption(screen.getAllByRole("option")[0]!);
  fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-02-02" } });
  return user;
};

describe("Lotações 9D1 — consulta e pré-condição", () => {
  it("consulta lotações vigentes e históricas do vínculo", async () => {
    renderOperationalRoutes("/profissionais/pro-010/vinculos/vf-010/lotacoes");
    expect(
      await screen.findByRole("heading", { name: "Lotações do vínculo funcional", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lotações atuais do vínculo")).toBeInTheDocument();
    expect(screen.getByLabelText("Lotações históricas do vínculo")).toBeInTheDocument();
  });

  it("distingue ATUAL e HISTÓRICO por rótulo textual, não apenas por cor", async () => {
    renderOperationalRoutes("/profissionais/pro-010/vinculos/vf-010/lotacoes");
    await screen.findByRole("heading", { name: "Lotações atuais" });
    expect(screen.getAllByText(/ATUAL/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/HISTÓRICO/).length).toBeGreaterThan(0);
  });

  it("exige vínculo funcional existente para registrar lotação", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/inexistente/lotacoes/nova");
    expect(
      await screen.findByRole("heading", { name: "Vínculo funcional existente obrigatório" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para novo vínculo funcional" }),
    ).toBeInTheDocument();
  });

  it("apresenta vínculo vigente sem lotação sem tratá-lo como inválido", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes");
    expect(
      await screen.findByText("Nenhuma lotação registrada para este vínculo"),
    ).toBeInTheDocument();
  });

  it("torna inequívoca a diferença entre adicionar e movimentar", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes");
    await screen.findByRole("heading", { name: "Lotações do vínculo funcional" });
    expect(
      screen.getByText(/Adicionar lotação mantém as lotações anteriores vigentes/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Movimentar\s+lotação encerra uma lotação específica/),
    ).toBeInTheDocument();
  });

  it("mantém lotações históricas consultáveis em vínculo encerrado", async () => {
    renderOperationalRoutes("/profissionais/pro-007/vinculos/vf-007/lotacoes");
    expect(await screen.findByRole("note")).toHaveTextContent(
      /Vínculo funcional encerrado|lotações históricas permanecem consultáveis/,
    );
  });
});

describe("Lotações 9D1 — nova lotação", () => {
  it("registra a primeira lotação a partir do vínculo", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação", level: 1 });
    await fillPosting();
    expect(screen.getByRole("button", { name: "Registrar lotação" })).toBeEnabled();
  });

  it("oferece destinos organizacionais além de escola", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    openSelect("Tipo de contexto organizacional");
    expect(screen.getByRole("option", { name: /SEMED/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Setor administrativo/ })).toBeInTheDocument();
  });

  it("não confunde prédio ou endereço com lotação institucional", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
    expect(
      await screen.findByText(/Prédio, endereço ou anexo físico não determinam/),
    ).toBeInTheDocument();
  });

  it("permite lotação sem carga distribuída informada", async () => {
    renderOperationalRoutes("/profissionais/pro-009/vinculos/vf-009/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    await fillPosting();
    expect(
      screen.getAllByText("Distribuição de carga horária não informada.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Registrar lotação" })).toBeEnabled();
  });

  it("não solicita Função nem Atuação Pedagógica na criação", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    expect(screen.queryByLabelText(/Função/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/turma|componente|disciplina|horário/i)).not.toBeInTheDocument();
  });

  it("mostra Cargo apenas como contexto não editável", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    expect(section("Vínculo funcional")).toHaveTextContent("Cargo");
    expect(screen.queryByLabelText(/Cargo/)).not.toBeInTheDocument();
  });

  it("revisa profissional, vínculo, lotação, existentes, avisos e escopo", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    await fillPosting();
    const review = section("Revisão");
    expect(review).toHaveTextContent("Profissional");
    expect(review).toHaveTextContent("Lotações existentes");
    expect(review).toHaveTextContent("NÃO cria Função nem Atuação Pedagógica");
  });

  it("conclui de forma demonstrativa e prepara Registrar função", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    const user = await fillPosting();
    await user.click(screen.getByRole("button", { name: "Registrar lotação" }));
    await user.click(screen.getByRole("button", { name: "Confirmar conclusão" }));
    expect(
      await screen.findByText(
        "Lotação demonstrativa preparada. Nenhuma função ou atuação pedagógica foi criada.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Próxima ação: Registrar função.")).toBeInTheDocument();
  });

  it("intercepta a saída com alterações não salvas", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    const user = await fillPosting();
    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar editando" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar alterações e sair" }),
    ).toBeInTheDocument();
  });

  it("preserva privacidade no workspace de lotação", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001/lotacoes/nova");
    await screen.findByRole("heading", { name: "Nova lotação" });
    expect(screen.queryByText(/CPF/)).not.toBeInTheDocument();
    expect(screen.queryByText(/endereço residencial|dados bancários|saúde/i)).not.toBeInTheDocument();
  });

  it("mantém navegação por seções acessível", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001/lotacoes/nova");
    expect(await screen.findByRole("navigation", { name: "Seções da lotação" })).toBeInTheDocument();
  });
});

describe("Lotações 9D1 — detalhe, edição e encerramento", () => {
  it("apresenta o detalhe da lotação com contexto e futuras relações", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/lot-003-a");
    await screen.findByRole("heading", { level: 1 });
    expect(section("Lotação")).toHaveTextContent("Carga distribuída");
    expect(
      screen.getByRole("complementary", { name: "Relações futuras da lotação" }),
    ).toBeInTheDocument();
  });

  it("informa que encerrar lotação não encerra o vínculo", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/lot-003-a");
    expect(
      await screen.findByText(/Encerrar lotação não encerra o Vínculo Funcional/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encerrar lotação" })).toBeDisabled();
  });

  it("não deriva atuação pedagógica da lotação", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/lot-003-a");
    expect(
      await screen.findByText(/não significa automaticamente atuação docente/),
    ).toBeInTheDocument();
  });

  it("orienta para movimentação quando a edição troca a unidade", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/lot-003-a/editar");
    await screen.findByRole("heading", { name: "Editar lotação", level: 1 });
    openSelect("Unidade ou contexto organizacional");
    const options = screen.getAllByRole("option");
    pickOption(options[options.length - 1]!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /pode representar movimentação funcional/,
    );
  });

  it("distingue correção administrativa de alteração historicamente relevante", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/lot-003-a/editar");
    expect(
      await screen.findByLabelText("Correção administrativa da lotação"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Alteração historicamente relevante")).toBeInTheDocument();
  });

  it("prepara o conflito de versão demonstrativo", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-010/vinculos/vf-010/lotacoes/lot-010-b/editar");
    await user.click(await screen.findByRole("button", { name: "Simular conflito de versão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta lotação foi alterada por outro usuário durante a operação.",
    );
  });
});

describe("Lotações 9D1 — movimentação funcional", () => {
  it("exige lotação de origem explícita e data efetiva", async () => {
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/movimentar");
    await screen.findByRole("heading", { name: "Movimentação funcional", level: 1 });
    expect(screen.getByRole("button", { name: "Concluir movimentação" })).toBeDisabled();
    expect(screen.getByLabelText("Data efetiva da movimentação")).toBeInTheDocument();
  });

  it("apresenta comparação DE / PARA com preservação do histórico", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/movimentar");
    await user.click(
      await screen.findByRole("radio", {
        name: /Origem Instituição Educacional Demonstrativa Horizonte/,
      }),
    );
    expect(screen.getByLabelText("DE — lotação atual")).toHaveTextContent(
      "Instituição Educacional Demonstrativa Horizonte",
    );
    expect(screen.getByLabelText("PARA — nova lotação")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Esta operação encerra a lotação selecionada e cria uma nova lotação, preservando o histórico.",
      ),
    ).toBeInTheDocument();
  });

  it("comunica atomicidade conceitual sem sucesso parcial", async () => {
    renderOperationalRoutes("/profissionais/pro-010/vinculos/vf-010/lotacoes/movimentar");
    expect(await screen.findByText(/tudo\s*ou\s*nada/i)).toBeInTheDocument();
  });

  it("mostra as demais lotações preservadas em movimentação parcial", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/movimentar");
    await user.click(
      await screen.findByRole("radio", {
        name: /Origem Instituição Educacional Demonstrativa Horizonte/,
      }),
    );
    expect(screen.getByText(/Lotações que permanecerão vigentes/)).toHaveTextContent(
      "Escola Demonstrativa Águas Claras",
    );
  });

  it("conclui a movimentação de forma demonstrativa", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-003/vinculos/vf-003/lotacoes/movimentar");
    await user.click(
      await screen.findByRole("radio", {
        name: /Origem Instituição Educacional Demonstrativa Horizonte/,
      }),
    );
    openSelect("Tipo de contexto organizacional");
    pickOption(screen.getByRole("option", { name: /SEMED/ }));
    openSelect("Unidade ou contexto organizacional");
    pickOption(screen.getByRole("option", { name: /Secretaria demonstrativa/ }));
    fireEvent.change(screen.getByLabelText("Data efetiva da movimentação"), {
      target: { value: "2026-03-01" },
    });
    await user.click(screen.getByRole("button", { name: "Concluir movimentação" }));
    await user.click(screen.getByRole("button", { name: "Confirmar conclusão" }));
    expect(
      await screen.findByText(
        "Movimentação funcional demonstrativa preparada. A lotação anterior foi preservada no histórico e a nova lotação foi preparada.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Lotações 9D1 — modelo conceitual", () => {
  it("cobre os cenários fictícios A–M", () => {
    expect(postingScenarios).toHaveLength(13);
    for (const scenario of postingScenarios) {
      const { professional, link } = getPostingContext(scenario.professionalId, scenario.linkId);
      expect(professional, scenario.id).toBeDefined();
      expect(link, scenario.id).toBeDefined();
    }
  });

  it("suporta múltiplas lotações simultâneas no mesmo vínculo", () => {
    const { link } = getPostingContext("pro-003", "vf-003");
    expect(currentPostings(link!).length).toBeGreaterThan(1);
  });

  it("mantém lotação histórica sem sobrescrever", () => {
    const { link } = getPostingContext("pro-010", "vf-010");
    expect(historicalPostings(link!).length).toBeGreaterThan(0);
    expect(currentPostings(link!).length).toBeGreaterThan(0);
  });

  it("marca conflito forte quando a lotação inicia após o término do vínculo", () => {
    const { link } = getPostingContext("pro-007", "vf-007");
    const conflicts = assessPostingConflicts(link!, {
      ...blankPostingDraft(),
      contextKind: "Unidade escolar",
      destination: "Unidade demonstrativa qualquer",
      start: "2030-02-01",
    });
    expect(conflicts.some((item) => item.level === "forte")).toBe(true);
  });

  it("soma cargas distribuídas explicitamente informadas", () => {
    const { link } = getPostingContext("pro-003", "vf-003");
    expect(assessHoursDistribution(link!).level).not.toBe("validar");
  });

  it("avisa quando a distribuição de carga requer validação", () => {
    const { link } = getPostingContext("pro-003", "vf-003");
    const result = assessHoursDistribution(link!, { hours: 20 });
    expect(result.title).toBe("Distribuição de carga horária requer validação.");
  });

  it("aceita ausência de distribuição de carga", () => {
    const { link } = getPostingContext("pro-009", "vf-009");
    expect(assessHoursDistribution(link!).level).toBe("desconhecida");
  });

  it("sinaliza possível duplicidade na mesma unidade", () => {
    const { link, posting } = getPostingContext("pro-003", "vf-003", "lot-003-a");
    const conflicts = assessPostingConflicts(link!, {
      ...blankPostingDraft(),
      contextKind: "Unidade escolar",
      destination: posting!.place,
      start: "2025-01-01",
    });
    expect(
      conflicts.some((item) => item.title === "Possível lotação duplicada — requer verificação."),
    ).toBe(true);
  });

  it("não trata simultaneidade em unidades distintas como duplicidade", () => {
    const { link } = getPostingContext("pro-003", "vf-003");
    const conflicts = assessPostingConflicts(link!, {
      ...blankPostingDraft(),
      contextKind: "Unidade escolar",
      destination: "Outra unidade demonstrativa distinta",
      start: "2026-01-01",
    });
    expect(conflicts.some((item) => item.title.includes("Simultaneidade legítima"))).toBe(true);
    expect(conflicts.some((item) => item.title.includes("duplicada"))).toBe(false);
  });

  it("valida pendências de lotação e de movimentação", () => {
    expect(validatePostingDraft(blankPostingDraft()).length).toBeGreaterThan(0);
    expect(validateMovementDraft(blankMovementDraft()).length).toBeGreaterThan(0);
  });

  it("rejeita data efetiva anterior ao início da lotação de origem", () => {
    const { link } = getPostingContext("pro-003", "vf-003");
    const conflicts = assessMovementConflicts(link!, {
      ...blankMovementDraft("lot-003-a"),
      contextKind: "Unidade escolar",
      destination: "Outra unidade demonstrativa distinta",
      effectiveDate: "2020-01-01",
    });
    expect(conflicts.some((item) => item.level === "forte")).toBe(true);
  });

  it("atualiza a trajetória funcional compreendendo lotações", () => {
    const professional = getDemonstrationProfessional("pro-010")!;
    const trajectory = postingTrajectory(professional);
    expect(trajectory.length).toBeGreaterThan(1);
    expect(trajectory.some((item) => item.entries.some((entry) => entry.includes("encerrada")))).toBe(
      true,
    );
  });
});
