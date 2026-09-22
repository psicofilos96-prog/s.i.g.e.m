import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import { getCurriculumMatrix } from "@/features/curriculum/curriculum-data";
import {
  addGridElement,
  computeGridTotals,
  createDraftFromMatrix,
  diffStructures,
  removeGridElement,
  setGridValue,
  validateDraft,
} from "@/features/curriculum/matrix-draft";

/**
 * Testes de comportamento observável do versionamento de matrizes.
 * Nenhum fixture é persistido nem alterado por estes testes.
 */
describe("Versionamento de matrizes curriculares", () => {
  it("inicia nova versão a partir da matriz vigente mostrando a versão de origem", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/mc-ef2-2");

    await user.click(screen.getAllByRole("link", { name: /Nova versão/ })[0]!);

    expect(await screen.findByText(/Nova versão de Matriz curricular do Ensino Fundamental/)).toBeInTheDocument();
    expect(screen.getByText(/Origem: Versão 2/)).toBeInTheDocument();
    expect(screen.getAllByText(/Rascunho/).length).toBeGreaterThan(0);
  });

  it("não altera a versão anterior ao editar o rascunho da nova versão", () => {
    const origin = getCurriculumMatrix("mc-ef2-2")!;
    const before = JSON.stringify(origin.structure);
    let draft = createDraftFromMatrix(origin);
    draft = addGridElement(draft, "Elemento demonstrativo novo");
    const rows = draft.structure.kind === "grid" ? draft.structure.groups[0]!.rows : [];
    draft = setGridValue(draft, rows[0]!.id, 0, "99");

    expect(JSON.stringify(getCurriculumMatrix("mc-ef2-2")!.structure)).toBe(before);
    expect(JSON.stringify(draft.origin!.structure)).toBe(before);
  });

  it("permite adicionar e remover elemento curricular no workspace", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ef2-2");

    const before = screen.getAllByRole("textbox").length;
    await user.click(screen.getByRole("button", { name: "Adicionar elemento curricular" }));
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(before);

    await user.click(screen.getByRole("button", { name: /Remover Língua Portuguesa/ }));
    expect(screen.queryByDisplayValue("Língua Portuguesa")).not.toBeInTheDocument();
  });

  it("recalcula o total demonstrativo ao alterar uma carga", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ef2-2");

    const cell = screen.getByLabelText("Língua Portuguesa em 6º ano");
    await user.clear(cell);
    await user.type(cell, "8");

    const totalRow = screen.getByRole("row", { name: /Total calculado/ });
    expect(within(totalRow).getByText("30")).toBeInTheDocument();
  });

  it("aponta inconsistência entre total calculado e referência documentada", () => {
    const origin = getCurriculumMatrix("mc-ef2-2")!;
    let draft = createDraftFromMatrix(origin);
    draft = { ...draft, effectiveFrom: "2027-02-01", normativeReference: "Documento demonstrativo" };
    const rows = draft.structure.kind === "grid" ? draft.structure.groups[0]!.rows : [];
    draft = setGridValue(draft, rows[0]!.id, 0, "10");

    const issues = validateDraft(draft);
    expect(issues.some((issue) => /Total inconsistente em 6º ano/.test(issue.message))).toBe(true);
    expect(issues.some((issue) => issue.severity === "erro")).toBe(false);
  });

  it("valida campos obrigatórios, estrutura vazia e vigência inválida", () => {
    const origin = getCurriculumMatrix("mc-ef2-2")!;
    let draft = createDraftFromMatrix(origin);
    const rows = draft.structure.kind === "grid" ? [...draft.structure.groups[0]!.rows] : [];
    rows.forEach((row) => {
      draft = removeGridElement(draft, row.id);
    });
    draft = {
      ...draft,
      name: "",
      effectiveFrom: "2026-02-01",
      effectiveUntil: "2025-02-01",
    };

    const messages = validateDraft(draft).map((issue) => issue.message);
    expect(messages).toContain("Informe o nome da matriz curricular.");
    expect(messages).toContain(
      "Estrutura sem elementos curriculares: adicione ao menos um elemento.",
    );
    expect(messages).toContain("Vigência inválida: o término deve ser posterior ao início.");
  });

  it("compara versões identificando adição, remoção e carga alterada com texto", () => {
    const origin = getCurriculumMatrix("mc-ef2-2")!;
    let draft = createDraftFromMatrix(origin);
    draft = addGridElement(draft, "Projeto de leitura demonstrativo");
    const rows = draft.structure.kind === "grid" ? draft.structure.groups[0]!.rows : [];
    draft = setGridValue(draft, rows[0]!.id, 0, "7");
    draft = removeGridElement(draft, rows[rows.length - 2]!.id);

    const changes = diffStructures(draft.origin!.structure, draft.structure);
    expect(changes.some((change) => change.kind === "added")).toBe(true);
    expect(changes.some((change) => change.kind === "removed")).toBe(true);
    expect(changes.some((change) => change.kind === "load")).toBe(true);
  });

  it("exibe a comparação e o resumo de revisão no workspace", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ef2-2");

    await user.click(screen.getByRole("button", { name: "Adicionar elemento curricular" }));
    expect(screen.getByRole("list", { name: "Alterações" })).toBeInTheDocument();
    expect(screen.getByText(/Adicionado:/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Avisos e inconsistências" })).toBeInTheDocument();
    expect(screen.getByText(/Versão de origem/)).toBeInTheDocument();
  });

  it("sinaliza alterações não salvas e oferece continuar editando ou descartar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ef2-2");

    expect(screen.getByText("Nenhuma alteração registrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar elemento curricular" }));
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair do workspace" }));
    expect(await screen.findByText("Sair com alterações não salvas?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
  });

  it("conclui a versão de forma demonstrativa, sem aprovação normativa", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ef2-2");

    const from = screen.getByLabelText("Início da vigência");
    await user.type(from, "2027-02-01");
    await user.type(screen.getByLabelText("Documento de referência"), "Documento demonstrativo");
    await user.click(screen.getByRole("button", { name: /Concluir versão/ }));

    expect(
      await screen.findByText(/Não representa aprovação, homologação ou publicação normativa/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar conclusão" }));
    expect(await screen.findByText(/Conclusão demonstrativa registrada/)).toBeInTheDocument();
    expect(getCurriculumMatrix("mc-ef2-2")!.version).toBe("Versão 2");
  });

  it("edita rascunho existente partindo da versão anterior como origem", async () => {
    renderOperationalRoutes("/matrizes-curriculares/rascunho/mc-ef1-2-rascunho");

    expect(
      await screen.findByText(/Rascunho de Matriz curricular do Ensino Fundamental/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Origem: Versão 1/)).toBeInTheDocument();
  });

  it("mantém versão histórica em somente consulta, sem ação de edição", async () => {
    renderOperationalRoutes("/matrizes-curriculares/mc-ef2-1");

    expect(await screen.findByText(/Versão histórica em modo somente consulta/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Somente consulta/ })[0]).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Nova versão/ })).not.toBeInTheDocument();
  });

  it("edita campos de experiências da Educação Infantil sem grade de disciplinas", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ei-2");

    expect(await screen.findByRole("list", { name: "Campos de experiências" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar elemento curricular" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Adicionar campo de experiências" }));
    expect(
      within(screen.getByRole("list", { name: "Campos de experiências" })).getAllByRole("textbox")
        .length,
    ).toBe(6);
  });

  it("prepara a visualização de impressão com estrutura da matriz", async () => {
    renderOperationalRoutes("/matrizes-curriculares/impressao/mc-eja2-1");

    expect(await screen.findByRole("heading", { name: /EJA — 2º segmento/ })).toBeInTheDocument();
    expect(screen.getByText(/Documento demonstrativo com dados fictícios/)).toBeInTheDocument();
  });

  it("calcula totais demonstrativos da estrutura editada", () => {
    const origin = getCurriculumMatrix("mc-ef1-1")!;
    const draft = createDraftFromMatrix(origin);
    if (draft.structure.kind !== "grid") throw new Error("estrutura inesperada");
    expect(computeGridTotals(draft.structure)[0]).toBe(20);
  });
});
