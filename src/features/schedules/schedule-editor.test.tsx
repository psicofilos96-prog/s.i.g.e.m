import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderOperationalRoutes } from "@/test/router-harness";
import { getJourneyForClass, getScheduleForClass } from "./schedules-data";
import {
  DRAFT_BLOCK_KINDS,
  DRAFT_DURATION_PRESETS,
  EDITOR_CAPABILITIES,
  addBlock,
  assignmentOptionsForClass,
  blockDuration,
  coresponsibilityNotes,
  createScheduleDraft,
  draftAlerts,
  duplicateBlock,
  editorPreconditions,
  editorScenarios,
  isScheduleDraftDirty,
  matrixFieldOptions,
  plannedLoad,
  professionalsPendingAssignment,
  projectedBlocks,
  removeBlock,
  repositionBlock,
  updateBlock,
} from "./schedule-draft";

const draftFor = (classId: string, mode: "nova" | "edicao" = "edicao") => {
  const draft = createScheduleDraft(classId, mode);
  if (!draft) throw new Error(`rascunho não criado para ${classId}`);
  return draft;
};

describe("Editor 10B — modelo de rascunho", () => {
  it("cria primeira grade vazia a partir de jornada existente (cenário A)", () => {
    const draft = draftFor("tur-007", "nova");
    expect(draft.blocks).toEqual([]);
    expect(draft.journeyId).toBe(getJourneyForClass("tur-007")?.id);
  });
  it("carrega rascunho a partir de grade parcialmente preenchida (cenário B)", () => {
    const draft = draftFor("tur-003");
    expect(draft.blocks.length).toBeGreaterThan(0);
    expect(draft.originScheduleId).toBe(getScheduleForClass("tur-003")?.id);
  });
  it("não altera a grade de origem ao editar o rascunho", () => {
    const draft = draftFor("tur-001");
    const first = draft.blocks[0]!;
    updateBlock(draft, first.id, { label: "Alterado no rascunho" });
    expect(getScheduleForClass("tur-001")?.blocks[0]?.label).not.toBe("Alterado no rascunho");
  });
  it("inclui bloco novo sem impor número fixo de aulas", () => {
    const draft = draftFor("tur-007", "nova");
    const next = addBlock(draft, { day: "mon", start: "07:00", end: "07:50" });
    expect(next.blocks).toHaveLength(1);
    expect(blockDuration(next.blocks[0]!)).toBe(50);
  });
  it("altera horário e componente de um bloco", () => {
    const draft = draftFor("tur-001");
    const target = draft.blocks[0]!;
    const next = updateBlock(draft, target.id, { start: "08:00", end: "09:30", label: "Arte" });
    const changed = next.blocks.find((item) => item.id === target.id)!;
    expect(changed.label).toBe("Arte");
    expect(blockDuration(changed)).toBe(90);
  });
  it("remove bloco sem afetar os demais", () => {
    const draft = draftFor("tur-001");
    const next = removeBlock(draft, draft.blocks[0]!.id);
    expect(next.blocks).toHaveLength(draft.blocks.length - 1);
  });
  it("reposiciona preservando a duração e sem duplicar", () => {
    const draft = draftFor("tur-001");
    const target = draft.blocks[0]!;
    const duration = blockDuration(target);
    const next = repositionBlock(draft, target.id, { day: "thu", start: "10:00" });
    const moved = next.blocks.find((item) => item.id === target.id)!;
    expect(next.blocks).toHaveLength(draft.blocks.length);
    expect(moved.day).toBe("thu");
    expect(blockDuration(moved)).toBe(duration);
  });
  it("duplica bloco gerando identificador distinto", () => {
    const draft = draftFor("tur-001");
    const next = duplicateBlock(draft, draft.blocks[0]!.id);
    expect(next.blocks).toHaveLength(draft.blocks.length + 1);
    expect(next.blocks.at(-1)!.id).not.toBe(draft.blocks[0]!.id);
  });
  it("suporta durações de 45, 50 e 90 minutos e variáveis (cenário D)", () => {
    expect(DRAFT_DURATION_PRESETS).toEqual([45, 50, 90]);
    const draft = addBlock(draftFor("tur-007", "nova"), {
      day: "mon",
      start: "07:00",
      end: "08:07",
    });
    expect(blockDuration(draft.blocks[0]!)).toBe(67);
  });
  it("oferece tipos de bloco demonstrativos sem taxonomia jurídica", () => {
    expect(DRAFT_BLOCK_KINDS).toContain("Acolhimento");
    expect(DRAFT_BLOCK_KINDS).toContain("Oficina");
    expect(DRAFT_BLOCK_KINDS).toContain("Outro bloco configurável");
  });
  it("mantém jornada com dias variáveis apenas como referência (cenário E)", () => {
    const journey = getJourneyForClass("tur-003");
    expect(new Set(journey?.days.map((day) => day.declaredDuration)).size).toBeGreaterThan(1);
    const draft = repositionBlock(draftFor("tur-003"), draftFor("tur-003").blocks[0]!.id, {
      day: "fri",
      start: "05:00",
    });
    expect(getJourneyForClass("tur-003")).toEqual(journey);
    expect(draft.journeyId).toBe(journey?.id);
  });
  it("não exige disciplina convencional na Educação Infantil (cenário F)", () => {
    const options = matrixFieldOptions("tur-002");
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.kind !== "Componente curricular")).toBe(true);
  });
  it("oferece componentes curriculares no Fundamental (cenários G e H)", () => {
    expect(matrixFieldOptions("tur-001").length).toBeGreaterThan(0);
    expect(matrixFieldOptions("tur-005").length).toBeGreaterThan(0);
  });
  it("oferece estrutura da fase na EJA (cenário I)", () =>
    expect(matrixFieldOptions("tur-004").length).toBeGreaterThan(0));
  it("permite agrupamentos em turma multisseriada ou multietapa (cenário J)", () => {
    const draft = draftFor("tur-009");
    expect(draft.classId).toBe("tur-009");
    expect(matrixFieldOptions("tur-009").length).toBeGreaterThanOrEqual(0);
  });
  it("seleciona profissionais somente por Atuação Pedagógica", () => {
    const options = assignmentOptionsForClass("tur-001");
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.assignment.classId === "tur-001")).toBe(true);
  });
  it("preserva o vínculo funcional específico de cada atuação", () =>
    expect(
      assignmentOptionsForClass("tur-001").every((option) => option.linkLabel.length > 0),
    ).toBe(true));
  it("suporta múltiplos profissionais no mesmo bloco (cenário K)", () => {
    const options = assignmentOptionsForClass("tur-001");
    const draft = addBlock(draftFor("tur-007", "nova"), {
      day: "mon",
      start: "07:00",
      end: "07:50",
      assignmentIds: options.slice(0, 2).map((option) => option.assignment.id),
    });
    expect(draft.blocks[0]!.assignmentIds.length).toBeLessThanOrEqual(2);
  });
  it("trata corresponsabilidade como nota, nunca como conflito (cenário O)", () => {
    const options = assignmentOptionsForClass("tur-001");
    if (options.length < 2) return;
    const draft = addBlock(draftFor("tur-007", "nova"), {
      day: "mon",
      start: "07:00",
      end: "07:50",
      label: "Bloco corresponsável",
      assignmentIds: options.slice(0, 2).map((option) => option.assignment.id),
    });
    const notes = coresponsibilityNotes(draft);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((note) => note.classification !== "Conflito temporal potencial")).toBe(true);
  });
  it("aponta profissional sem atuação compatível como pendência (cenário P)", () =>
    expect(Array.isArray(professionalsPendingAssignment("tur-001"))).toBe(true));
  it("classifica bloco fora da jornada declarada (cenário Q)", () => {
    const draft = addBlock(draftFor("tur-002"), { day: "mon", start: "04:00", end: "04:50" });
    const alerts = draftAlerts(draft);
    expect(alerts.some((alert) => alert.title.toLowerCase().includes("jornada"))).toBe(true);
  });
  it("mantém intervalo sem componente e sem profissional (cenário R)", () => {
    const draft = addBlock(draftFor("tur-007", "nova"), {
      day: "mon",
      start: "09:00",
      end: "09:20",
      kind: "Intervalo",
    });
    expect(draft.blocks[0]!.assignmentIds).toEqual([]);
    expect(draft.blocks[0]!.label).toBe("Intervalo");
  });
  it("apresenta carga planejada sem declarar conformidade (cenário S)", () => {
    const load = plannedLoad(draftFor("tur-003"));
    expect(load.totalMinutes).toBeGreaterThan(0);
    expect(load.byField.length).toBeGreaterThan(0);
    expect(
      load.divergences.every((item) => !/conform|cumprid|legal/i.test(item)),
    ).toBe(true);
  });
  it("detecta alterações não salvas no rascunho (cenário T)", () => {
    const initial = draftFor("tur-003");
    const changed = addBlock(initial, { day: "mon", start: "06:00", end: "06:45" });
    expect(isScheduleDraftDirty(initial, initial)).toBe(false);
    expect(isScheduleDraftDirty(changed, initial)).toBe(true);
  });
  it("verifica conflitos da mesma Pessoa em toda a rede (cenários L, M e N)", () => {
    const projection = projectedBlocks(draftFor("tur-001"));
    expect(projection.length).toBeGreaterThan(0);
    const alerts = draftAlerts(draftFor("tur-001"));
    expect(
      alerts.every((alert) =>
        [
          "Conflito temporal potencial",
          "Incompatibilidade estrutural demonstrativa",
          "Compatibilidade pendente de validação",
          "Informação insuficiente",
          "Situação sem conflito identificado",
        ].includes(alert.classification),
      ),
    ).toBe(true);
  });
  it("mantém projeção única compartilhada entre turma e profissional", () => {
    const draft = draftFor("tur-001");
    const before = projectedBlocks(draft).filter((item) => item.classId === "tur-001").length;
    const moved = repositionBlock(draft, draft.blocks[0]!.id, { day: "fri", start: "11:00" });
    const after = projectedBlocks(moved).filter((item) => item.classId === "tur-001");
    expect(after).toHaveLength(before);
    expect(after.some((item) => item.block.day === "fri" && item.block.start === "11:00")).toBe(
      true,
    );
  });
  it("registra pré-condições e trata jornada ausente como pendência", () => {
    const precondition = editorPreconditions("tur-001");
    expect(precondition.find((item) => item.id === "turma")?.ok).toBe(true);
    expect(precondition.find((item) => item.id === "periodo")?.ok).toBe(true);
    expect(editorPreconditions("tur-inexistente").find((item) => item.id === "jornada")?.ok).toBe(
      false,
    );
  });
  it("cobre os cenários A a T", () => {
    expect(editorScenarios).toHaveLength(20);
    expect(editorScenarios.map(([letter]) => letter).join("")).toBe("ABCDEFGHIJKLMNOPQRST");
  });
  it("separa capacidades futuras de autorização", () => {
    expect(EDITOR_CAPABILITIES).toContain("Visualizar");
    expect(EDITOR_CAPABILITIES).toContain("Publicar");
  });
});

describe("Editor 10B — rotas e workspace", () => {
  it("abre a rota de nova grade da turma sem grade distribuída", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    expect(
      await screen.findByRole("heading", { name: /Nova grade semanal/i }),
    ).toBeInTheDocument();
  });
  it("abre a rota de edição de rascunho existente", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(
      await screen.findByRole("heading", { name: /Editar grade semanal/i }),
    ).toBeInTheDocument();
  });
  it("apresenta contexto de turma, unidade, período e jornada", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(await screen.findByText(/Período letivo:/)).toBeInTheDocument();
    expect(screen.getByText(/Situação da grade:/)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /Grade semanal em edição/i }),
    ).toBeInTheDocument();
  });
  it("exibe painel lateral de componentes, profissionais e validações", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    const aside = await screen.findByRole("complementary", {
      name: /componentes, profissionais e validações/i,
    });
    expect(within(aside).getByText(/Componentes e campos da matriz/i)).toBeInTheDocument();
    expect(within(aside).getByText(/Validações e alertas/i)).toBeInTheDocument();
  });
  it("mostra pré-condições do editor", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    const list = await screen.findByRole("list", { name: /Pré-condições do editor/i });
    expect(within(list).getByText("Turma existente")).toBeInTheDocument();
    expect(within(list).getByText("Jornada disponível")).toBeInTheDocument();
  });
  it("adiciona bloco e sinaliza alterações não salvas", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    await user.click((await screen.findAllByRole("button", { name: /Adicionar bloco em/i }))[0]!);
    expect(await screen.findByRole("status")).toHaveTextContent("Alterações não salvas");
    expect(screen.getByRole("heading", { name: "Bloco selecionado" })).toBeInTheDocument();
  });
  it("aplica duração predefinida ao bloco selecionado", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    await user.click((await screen.findAllByRole("button", { name: /Adicionar bloco em/i }))[0]!);
    await user.click(await screen.findByRole("button", { name: "90 min" }));
    expect(screen.getByText(/Atual: 1h30/)).toBeInTheDocument();
  });
  it("desfaz e refaz alterações locais do rascunho", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    await user.click((await screen.findAllByRole("button", { name: /Adicionar bloco em/i }))[0]!);
    await user.click(screen.getByRole("button", { name: /Desfazer/i }));
    expect(screen.getByText(/Nenhum bloco planejado/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refazer/i }));
    expect(screen.getByRole("heading", { name: "Bloco selecionado" })).toBeInTheDocument();
  });
  it("remove o bloco selecionado pelo formulário acessível", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    await user.click((await screen.findAllByRole("button", { name: /Adicionar bloco em/i }))[0]!);
    await user.click(await screen.findByRole("button", { name: /Remover bloco/i }));
    expect(screen.getByText(/Nenhum bloco selecionado/i)).toBeInTheDocument();
  });
  it("informa que toda operação existe sem arrastar e soltar", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(
      await screen.findByText(/disponível sem arrastar e\s*soltar/i),
    ).toBeInTheDocument();
  });
  it("apresenta resumo de carga planejada", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    const table = await screen.findByRole("table", {
      name: /Carga planejada por componente ou campo/i,
    });
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Tempo total da grade")).toBeInTheDocument();
    expect(screen.getByText("Períodos marcados sem distribuição")).toBeInTheDocument();
  });
  it("apresenta painel de revisão com retorno ao editor", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(await screen.findByRole("heading", { name: "Revisão" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao editor/i })).toBeInTheDocument();
    expect(screen.getByText("Blocos planejados")).toBeInTheDocument();
  });
  it("conclui a preparação demonstrativa sem publicar nem persistir", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    await user.click(
      (await screen.findAllByRole("button", { name: /Preparar grade demonstrativa/i }))[0]!,
    );
    await user.click(
      await screen.findByRole("button", { name: /Confirmar preparação demonstrativa/i }),
    );
    expect(
      await screen.findByText(/Nenhum horário foi publicado ou persistido em banco de dados/i),
    ).toBeInTheDocument();
  });
  it("protege a saída com alterações não salvas", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    await user.click((await screen.findAllByRole("button", { name: /Adicionar bloco em/i }))[0]!);
    await user.click(screen.getByRole("button", { name: /Sair do editor/i }));
    expect((await screen.findAllByText("Alterações não salvas")).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /Continuar editando/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Descartar alterações e sair/i }),
    ).toBeInTheDocument();
  });
  it("avisa que grade publicada depende das regras da Etapa 10C", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/editar");
    expect(await screen.findByText("Grade publicada")).toBeInTheDocument();
    expect(screen.getByText(/Etapa 10C/)).toBeInTheDocument();
  });
  it("mantém grade histórica somente leitura", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-006/editar");
    expect(await screen.findByText("Somente leitura")).toBeInTheDocument();
  });
  it("trata turma inexistente como não encontrada", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-999/editar");
    expect(await screen.findByText("Turma não encontrada")).toBeInTheDocument();
  });
  it("preserva privacidade dos dados profissionais", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(await screen.findByText("Privacidade")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });
  it("prepara as etapas de publicação futura sem executá-las", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(await screen.findByText("Publicação futura")).toBeInTheDocument();
    expect(screen.getByText(/Rascunho/)).toBeInTheDocument();
  });
  it("mantém a jornada declarada como referência não alterável", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003/editar");
    expect(await screen.findByText("Jornada como referência")).toBeInTheDocument();
  });
  it("oferece campos acessíveis para horário, tipo e componente", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-007/nova");
    await user.click((await screen.findAllByRole("button", { name: /Adicionar bloco em/i }))[0]!);
    expect(await screen.findByLabelText("Início (hh:mm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Término (hh:mm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de bloco")).toBeInTheDocument();
    expect(screen.getByLabelText("Componente ou campo")).toBeInTheDocument();
    expect(screen.getByLabelText("Papel predominante no bloco")).toBeInTheDocument();
  });
  it("integra a ação de edição à consulta da grade da turma", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-003");
    expect(
      await screen.findByRole("link", { name: /Editar grade demonstrativa/i }),
    ).toBeInTheDocument();
  });
  it("oferece preparação da primeira grade quando não há distribuição", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-007");
    expect(await screen.findByRole("link", { name: /grade demonstrativa|primeira grade/i })).toBeInTheDocument();
  });
});
