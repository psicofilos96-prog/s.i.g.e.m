import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import {
  ASSIGNMENT_POSTING_VALIDATION,
  ASSIGNMENT_VERSION_CONFLICT,
  FUNCTION_CATALOG,
  assessAssignmentConflicts,
  assessAssignmentHours,
  assignmentScenarios,
  blankAssignmentDraft,
  currentAssignments,
  functionalTrajectory,
  getAssignmentContext,
  historicalAssignments,
  validateAssignmentDraft,
  validateCloseDraft,
} from "./assignment-draft";
import { getDemonstrationProfessional } from "./professionals-data";

const link = (professionalId: string, linkId: string) =>
  getAssignmentContext(professionalId, linkId).link!;

const pickFunction = (value = FUNCTION_CATALOG[1]!) =>
  fireEvent.change(screen.getByLabelText("Função (catálogo demonstrativo)"), {
    target: { value },
  });

const pickContext = (index = 0) => {
  const select = screen.getByLabelText("Unidade / contexto organizacional") as HTMLSelectElement;
  const option = [...select.options].filter((item) => item.value)[index]!;
  fireEvent.change(select, { target: { value: option.value } });
  return option.value;
};

const fillAssignment = async (start = "2026-03-02") => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  pickFunction();
  fireEvent.click(screen.getByLabelText("Unidade escolar"));
  pickContext();
  fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: start } });
  return user;
};

describe("Funções 9D2 — pré-condição e consulta", () => {
  it("exige vínculo funcional existente para registrar atribuição", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/inexistente/funcoes/nova");
    expect(
      await screen.findByRole("heading", { name: "Vínculo funcional existente obrigatório" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para novo vínculo funcional" }),
    ).toBeInTheDocument();
  });

  it("consulta atribuições atuais e históricas do vínculo", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes");
    expect(
      await screen.findByRole("heading", { name: "Atribuições de função do vínculo", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Atribuições atuais do vínculo")).toBeInTheDocument();
    expect(screen.getByLabelText("Atribuições históricas do vínculo")).toBeInTheDocument();
  });

  it("distingue ATUAL e HISTÓRICO por rótulo textual", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes");
    await screen.findByRole("heading", { name: "Atribuições atuais" });
    expect(screen.getAllByText(/ATUAL/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/HISTÓRICO/).length).toBeGreaterThan(0);
  });

  it("apresenta referência administrativa na consulta quando existente", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes");
    expect(
      await screen.findByText(/Referência administrativa demonstrativa DEMO-2025\/04/),
    ).toBeInTheDocument();
  });

  it("aceita vínculo sem função sem tratá-lo como inválido", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/funcoes");
    expect(
      await screen.findByText("Nenhuma atribuição de função registrada para este vínculo"),
    ).toBeInTheDocument();
  });

  it("impede nova atribuição posterior à vigência de vínculo encerrado", () => {
    const closed = link("pro-007", "vf-007");
    const conflicts = assessAssignmentConflicts(closed, {
      ...blankAssignmentDraft(),
      functionName: FUNCTION_CATALOG[0]!,
      contextKind: "Unidade escolar",
      context: "Instituição Educacional Demonstrativa Horizonte",
      start: "2026-02-01",
    });
    expect(conflicts.some((item) => item.level === "forte")).toBe(true);
  });

  it("mantém consulta histórica disponível em vínculo encerrado", async () => {
    renderOperationalRoutes("/profissionais/pro-007/vinculos/vf-007/funcoes");
    expect(await screen.findByText(/Vínculo funcional encerrado/)).toBeInTheDocument();
  });
});

describe("Funções 9D2 — conceito, catálogo e contexto", () => {
  it("separa catálogo de Função do registro de Atribuição", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/nova");
    expect(await screen.findByLabelText("Função (catálogo demonstrativo)")).toBeInTheDocument();
    expect(
      screen.getByText(/A Função possui identidade própria e não se confunde/),
    ).toBeInTheDocument();
  });

  it("não presume gratificação nem ato de designação de mesmo tipo", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/nova");
    expect(
      await screen.findByText(/Nenhuma função é presumida gratificada/),
    ).toBeInTheDocument();
  });

  it("suporta contextos institucionais distintos além de unidade escolar", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/nova");
    await screen.findByLabelText("Tipo de contexto institucional");
    expect(screen.getByLabelText("SEMED (órgão central demonstrativo)")).toBeInTheDocument();
    expect(screen.getByLabelText("Setor administrativo demonstrativo")).toBeInTheDocument();
  });

  it("não confunde unidade organizacional com prédio ou endereço", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/nova");
    expect(
      await screen.findByText(/não é prédio, endereço ou anexo físico/),
    ).toBeInTheDocument();
  });

  it("exibe cargo como contexto somente leitura e o preserva", async () => {
    renderOperationalRoutes("/profissionais/pro-001/vinculos/vf-001/funcoes/nova");
    expect(await screen.findByText("Cargo (somente leitura)")).toBeInTheDocument();
    expect(
      screen.getByText(/Esta operação não altera Cargo ou Lotação e não cria Atuação Pedagógica/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargo")).not.toBeInTheDocument();
  });
});

describe("Funções 9D2 — lotação relacionada e múltiplas funções", () => {
  it("exibe lotações do vínculo para orientar a atribuição", async () => {
    renderOperationalRoutes("/profissionais/pro-005/vinculos/vf-005/funcoes/nova");
    expect(
      await screen.findByLabelText("Lotações atuais e históricas do vínculo"),
    ).toBeInTheDocument();
  });

  it("permite atribuição sem lotação específica e sinaliza validação", async () => {
    renderOperationalRoutes("/profissionais/pro-005/vinculos/vf-005/funcoes/nova");
    await screen.findByLabelText("Lotação relacionada (opcional)");
    await fillAssignment();
    expect(screen.getAllByText(ASSIGNMENT_POSTING_VALIDATION).length).toBeGreaterThan(0);
  });

  it("registra referência contextual a uma lotação específica", () => {
    const vf004 = link("pro-004", "vf-004");
    const current = currentAssignments(vf004)[0]!;
    expect(current.postingId).toBe("lot-004");
  });

  it("não cria nem movimenta lotações automaticamente", async () => {
    renderOperationalRoutes("/profissionais/pro-005/vinculos/vf-005/funcoes/nova");
    expect(
      await screen.findByText("Nenhuma lotação é criada ou movimentada a partir desta tela."),
    ).toBeInTheDocument();
  });

  it("suporta duas funções simultâneas no mesmo vínculo", () => {
    const vf005 = link("pro-005", "vf-005");
    expect(currentAssignments(vf005).length).toBeGreaterThanOrEqual(2);
  });

  it("sinaliza funções simultâneas como requer validação, sem bloquear", () => {
    const vf005 = link("pro-005", "vf-005");
    const conflicts = assessAssignmentConflicts(vf005, {
      ...blankAssignmentDraft(),
      functionName: "Função administrativa demonstrativa",
      contextKind: "Unidade escolar",
      context: "Escola Demonstrativa Águas Claras",
      start: "2026-03-01",
    });
    expect(conflicts.some((item) => item.title === "Funções simultâneas — requer validação.")).toBe(
      true,
    );
    expect(conflicts.some((item) => item.level === "forte")).toBe(false);
  });

  it("não trata a mesma função em contextos distintos como duplicidade", () => {
    const vf005 = link("pro-005", "vf-005");
    const conflicts = assessAssignmentConflicts(vf005, {
      ...blankAssignmentDraft(),
      functionName: "Direção — função demonstrativa",
      contextKind: "Unidade escolar",
      context: "Núcleo Educacional Demonstrativo Ponte",
      start: "2026-03-01",
    });
    expect(conflicts.some((item) => item.title.startsWith("Possível atribuição duplicada"))).toBe(
      false,
    );
    expect(
      conflicts.some((item) => item.title === "Mesma função em contexto institucional distinto."),
    ).toBe(true);
  });

  it("não bloqueia vínculos funcionais distintos do mesmo profissional", () => {
    const professional = getDemonstrationProfessional("pro-008")!;
    expect(professional.links.length).toBeGreaterThan(1);
    const other = professional.links.find((item) => item.id === "vf-008-b")!;
    const conflicts = assessAssignmentConflicts(other, {
      ...blankAssignmentDraft(),
      functionName: "Apoio institucional — função demonstrativa",
      contextKind: "Unidade escolar",
      context: "Núcleo Educacional Demonstrativo Ponte",
      start: "2026-03-01",
    });
    expect(conflicts.some((item) => item.title.startsWith("Possível atribuição duplicada"))).toBe(
      false,
    );
  });

  it("detecta possível duplicidade de mesma função, contexto e vigência", () => {
    const vf001 = link("pro-001", "vf-001");
    const conflicts = assessAssignmentConflicts(vf001, {
      ...blankAssignmentDraft(),
      functionName: "Coordenação — função demonstrativa",
      contextKind: "Unidade escolar",
      context: "Instituição Educacional Demonstrativa Horizonte",
      start: "2025-06-01",
    });
    expect(
      conflicts.find((item) => item.title.startsWith("Possível atribuição duplicada"))?.level,
    ).toBe("aviso");
  });
});

describe("Funções 9D2 — vigência, carga e referência", () => {
  it("exige função, contexto e início", () => {
    expect(validateAssignmentDraft(blankAssignmentDraft()).length).toBeGreaterThanOrEqual(4);
  });

  it("recusa término anterior ao início", () => {
    const errors = validateAssignmentDraft({
      ...blankAssignmentDraft(),
      functionName: FUNCTION_CATALOG[0]!,
      contextKind: "Unidade escolar",
      context: "Unidade demonstrativa",
      start: "2026-03-01",
      end: "2026-01-01",
    });
    expect(errors).toContain("Data de término anterior à data de início.");
  });

  it("avisa quando o início antecede o vínculo", () => {
    const vf004 = link("pro-004", "vf-004");
    const conflicts = assessAssignmentConflicts(vf004, {
      ...blankAssignmentDraft(),
      functionName: FUNCTION_CATALOG[0]!,
      contextKind: "Unidade escolar",
      context: "Instituição Educacional Demonstrativa Serra",
      start: "2019-01-01",
    });
    expect(conflicts.some((item) => item.title === "Início anterior ao início do vínculo.")).toBe(
      true,
    );
  });

  it("aceita carga contextual ausente", () => {
    const vf004 = link("pro-004", "vf-004");
    const hours = assessAssignmentHours(vf004, blankAssignmentDraft());
    expect(hours.level).toBe("desconhecida");
    expect(hours.title).toBe("Carga contextual da atribuição não informada.");
  });

  it("avisa sobre carga contextual maior que a do vínculo sem inventar regra", () => {
    const vf004 = link("pro-004", "vf-004");
    const hours = assessAssignmentHours(vf004, {
      ...blankAssignmentDraft(),
      hoursMode: "informada",
      contextualHours: "60",
    });
    expect(hours.level).toBe("validar");
    expect(hours.title).toBe("Compatibilidade de carga horária requer validação.");
    expect(hours.detail).toMatch(/nenhuma gratificação foi calculada/);
  });

  it("mantém referência administrativa opcional", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/nova");
    expect(
      await screen.findByLabelText("Referência ao ato ou documento (opcional)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma portaria fictícia é exigida/)).toBeInTheDocument();
  });

  it("não reescreve atribuições históricas ao registrar outra", () => {
    const vf004 = link("pro-004", "vf-004");
    expect(historicalAssignments(vf004).map((item) => item.id)).toContain("fun-004-hist");
    expect(currentAssignments(vf004).map((item) => item.id)).toContain("fun-004");
  });
});

describe("Funções 9D2 — detalhe, edição e encerramento", () => {
  it("apresenta o detalhe da atribuição com contexto e lotação relacionada", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/fun-004");
    expect(
      await screen.findByRole("heading", { name: "Coordenação — função demonstrativa", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lotação relacionada")).toBeInTheDocument();
    expect(screen.getByText("Cargo (somente leitura)")).toBeInTheDocument();
  });

  it("rejeita atribuição inexistente no vínculo", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/fun-999");
    expect(
      await screen.findByRole("heading", { name: "Atribuição de função não encontrada" }),
    ).toBeInTheDocument();
  });

  it("orienta para nova designação quando a edição altera função ou contexto", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/fun-004/editar");
    await screen.findByLabelText("Função (catálogo demonstrativo)");
    pickFunction("Direção — função demonstrativa");
    expect(
      await screen.findByText(/representa nova designação/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para encerramento da atribuição" }),
    ).toBeInTheDocument();
  });

  it("registra alterações de edição com natureza explícita", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/fun-004/editar");
    await screen.findByLabelText("Referência ao ato ou documento (opcional)");
    fireEvent.change(screen.getByLabelText("Referência ao ato ou documento (opcional)"), {
      target: { value: "Referência demonstrativa revisada" },
    });
    expect(await screen.findByLabelText("Alterações da atribuição")).toBeInTheDocument();
  });

  it("encerra atribuição preservando vínculo, lotação e cargo", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-005/vinculos/vf-005/funcoes/fun-005-a/encerrar");
    await screen.findByRole("heading", { name: "Encerrar atribuição de função", level: 1 });
    expect(screen.getByLabelText("Efeitos preservados do encerramento")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data de término"), {
      target: { value: "2026-06-30" },
    });
    await user.click(screen.getByRole("button", { name: "Encerrar atribuição de função" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar encerramento" }));
    expect(
      await screen.findByText(
        "Encerramento demonstrativo preparado. O histórico da atribuição foi preservado.",
      ),
    ).toBeInTheDocument();
  });

  it("valida a data de término do encerramento", () => {
    const vf005 = link("pro-005", "vf-005");
    const assignment = vf005.functions[0]!;
    expect(validateCloseDraft({ endDate: "", administrativeReference: "" }, assignment)).toContain(
      "Data de término da atribuição não informada.",
    );
    expect(
      validateCloseDraft({ endDate: "2000-01-01", administrativeReference: "" }, assignment),
    ).toContain("Data de término anterior ao início da atribuição.");
  });

  it("apresenta revisão DE / PARA no encerramento", async () => {
    renderOperationalRoutes("/profissionais/pro-005/vinculos/vf-005/funcoes/fun-005-a/encerrar");
    expect(await screen.findByRole("heading", { name: "Revisão DE / PARA" })).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getByText("PARA")).toBeInTheDocument();
  });

  it("não implementa exoneração ou dispensa jurídica", async () => {
    renderOperationalRoutes("/profissionais/pro-005/vinculos/vf-005/funcoes/fun-005-a/encerrar");
    expect(
      await screen.findByText(/Exoneração e dispensa jurídicas não estão implementadas/),
    ).toBeInTheDocument();
  });
});

describe("Funções 9D2 — revisão, conclusão e estados", () => {
  it("conclui atribuição demonstrativa com feedback exato", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/funcoes/nova");
    await screen.findByLabelText("Função (catálogo demonstrativo)");
    const user = await fillAssignment();
    await user.click(screen.getByRole("button", { name: "Registrar atribuição de função" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar conclusão" }));
    expect(
      await screen.findByText(
        "Atribuição de função demonstrativa preparada. Nenhum cargo, lotação ou atuação pedagógica foi alterado.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Próxima ação: Atuação Pedagógica.")).toBeInTheDocument();
  });

  it("bloqueia a conclusão diante de conflito estrutural forte", async () => {
    renderOperationalRoutes("/profissionais/pro-007/vinculos/vf-007/funcoes/nova");
    await screen.findByLabelText("Função (catálogo demonstrativo)");
    await fillAssignment("2026-04-01");
    expect(screen.getByRole("button", { name: "Registrar atribuição de função" })).toBeDisabled();
  });

  it("intercepta a saída com alterações não salvas", async () => {
    renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/funcoes/nova");
    await screen.findByLabelText("Função (catálogo demonstrativo)");
    const user = await fillAssignment();
    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(
      await screen.findByRole("heading", { name: "Sair com alterações não salvas?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar editando" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar alterações e sair" }),
    ).toBeInTheDocument();
  });

  it("prepara conflito de versão demonstrativo", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/fun-004/editar");
    await user.click(await screen.findByRole("button", { name: "Simular conflito de versão" }));
    expect(await screen.findByText(new RegExp(ASSIGNMENT_VERSION_CONFLICT))).toBeInTheDocument();
  });

  it("narra a trajetória funcional com vínculos, lotações e funções", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes");
    expect(await screen.findByLabelText("Trajetória funcional com funções")).toBeInTheDocument();
    expect(screen.getAllByText(/atribuição de função iniciada/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/atribuição de função encerrada/).length).toBeGreaterThan(0);
    const trajectory = functionalTrajectory(getDemonstrationProfessional("pro-004")!);
    expect(trajectory.some((item) => item.entries.some((e) => e.includes("lotação")))).toBe(true);
  });

  it("preserva privacidade na consulta e no detalhe", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes");
    await screen.findByRole("heading", { name: "Atribuições de função do vínculo" });
    expect(screen.queryByText(/CPF/)).not.toBeInTheDocument();
    expect(screen.queryByText(/filiação/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/endereço residencial/i)).not.toBeInTheDocument();
  });

  it("mantém acessibilidade básica com seções navegáveis e títulos", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes/nova");
    expect(await screen.findByLabelText("Seções da atribuição")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nova atribuição de função", level: 1 }),
    ).toBeInTheDocument();
  });

  it("mantém Atuação Pedagógica como área futura", async () => {
    renderOperationalRoutes("/profissionais/pro-004/vinculos/vf-004/funcoes");
    expect(await screen.findByRole("button", { name: "Atuação Pedagógica" })).toBeDisabled();
  });

  it("documenta os cenários fictícios A–O", () => {
    expect(assignmentScenarios).toHaveLength(15);
    expect(assignmentScenarios.map((item) => item.id)).toEqual([
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
      "M",
      "N",
      "O",
    ]);
    for (const scenario of assignmentScenarios)
      expect(getAssignmentContext(scenario.professionalId, scenario.linkId).link).toBeTruthy();
  });
});
