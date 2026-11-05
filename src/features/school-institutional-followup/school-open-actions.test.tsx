import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SchoolOpenActionsPanel } from "./school-open-actions";
import type { FollowupAction, FollowupUpdate, SchoolSnapshot } from "./model";
import { exportFollowupPreparation } from "./preparation-report";

vi.mock("./preparation-report", () => ({ exportFollowupPreparation: vi.fn() }));

const action = (id: string, description: string, due_on: string | null): FollowupAction => ({
  id, school_id: "s1", visit_logical_id: "v1", description, responsible_label: "Equipe escolar",
  due_on, created_at: "2026-10-01T10:00:00Z", author_name: "Servidor",
});
const update = (id: string, situation: string): FollowupUpdate => ({
  id: "update-"+id, action_id: id, visit_logical_id: null,
  occurred_on: "2026-11-01", situation, done_text: null, not_done_text: null,
  results: null, referrals: null, created_at: "2026-11-01T15:00:00Z", author_name: "Servidor",
});
const snapshot = (actions: FollowupAction[], updates: FollowupUpdate[] = []): SchoolSnapshot => ({
  visits: [], visit_history: [], actions, updates,
});

describe("preparação da visita a partir da ficha já autorizada", () => {
  it("distingue prazo vencido de falta de atualização, excluindo conclusão declarada", () => {
    const inspect = vi.fn();
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null} today="2026-11-04" onInspect={inspect}
      snapshot={snapshot([
        action("a1", "Reorganizar biblioteca", "2026-11-02"),
        action("a2", "Instalar mobiliário", null),
        action("a3", "Plano concluído", "2026-10-31"),
      ], [update("a2", "em andamento"), update("a3", "concluída")])} />);
    expect(screen.getByText("2 sem conclusão declarada")).toBeTruthy();
    expect(screen.getByText("1 com prazo vencido")).toBeTruthy();
    expect(screen.getByText("1 sem atualização")).toBeTruthy();
    expect(screen.queryByText("Plano concluído")).toBeNull();
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).toBeTruthy();
    expect(screen.getByText(/inclui todas as medidas sem conclusão declarada/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver acompanhamento da medida: Reorganizar biblioteca" }));
    expect(inspect).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("mostra o relato da última evolução em detalhe expansível, sem substituir o histórico", () => {
    const old: FollowupUpdate = {
      ...update("a1", "prevista"), id: "old", occurred_on: "2026-10-10",
      created_at: "2026-10-10T09:00:00Z", done_text: "Primeira vistoria",
    };
    const last: FollowupUpdate = {
      ...update("a1", "em andamento"), id: "latest", occurred_on: "2026-11-03",
      created_at: "2026-11-03T10:00:00Z", done_text: "Materiais separados",
      not_done_text: "Entrega pendente", results: "Inventário conferido",
      referrals: "Revisar prazo", author_name: "Servidora de acompanhamento",
    };
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null}
      today="2026-11-04" onInspect={vi.fn()}
      snapshot={snapshot([action("a1", "Reorganizar almoxarifado", "2026-11-02")], [old, last])} />);

    const summary = screen.getByText("Última evolução declarada: 03/11/2026 — em andamento");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("Materiais separados");
    expect(details).toHaveTextContent("Entrega pendente");
    expect(details).toHaveTextContent("Inventário conferido");
    expect(details).toHaveTextContent("Revisar prazo");
    expect(details).toHaveTextContent("Servidora de acompanhamento");
    expect(details).not.toHaveTextContent("Primeira vistoria");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    expect(screen.queryByRole("button", { name: /Registrar evolução da medida:/ })).toBeNull();
  });

  it("gera roteiro de foco com IDs explícitos e preserva roteiro integral independente do filtro", async () => {
    vi.mocked(exportFollowupPreparation).mockResolvedValue(undefined);
    const data = snapshot([
      action("a1", "Reorganizar biblioteca", "2026-11-02"),
      action("a2", "Instalar mobiliário", null),
      action("a3", "Plano concluído", "2026-10-31"),
    ], [update("a3", "concluída")]);
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep="33000001"
      today="2026-11-04" onInspect={vi.fn()} snapshot={data} />);
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Incluir no roteiro selecionado: Reorganizar biblioteca",
    }));
    expect(screen.getByRole("combobox", { name: "Conteúdo do roteiro" }))
      .toHaveValue("selected");
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar providências da visita" }),
      { target: { value: "sem prazo" } });
    expect(screen.queryByRole("checkbox", {
      name: "Incluir no roteiro selecionado: Reorganizar biblioteca",
    })).toBeNull();
    expect(screen.getByText(/1 medidas selecionadas para roteiro de foco/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Roteiro PDF" }));
    await waitFor(() => expect(exportFollowupPreparation).toHaveBeenLastCalledWith(
      data, "s1", "Escola Centro", "33000001", "2026-11-04", "pdf", ["a1"],
    ));
    fireEvent.change(screen.getByRole("combobox", { name: "Conteúdo do roteiro" }),
      { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(exportFollowupPreparation).toHaveBeenLastCalledWith(
      data, "s1", "Escola Centro", "33000001", "2026-11-04", "xlsx", undefined,
    ));
    expect(screen.queryByText("Plano concluído")).toBeNull();
  });

  it("seleciona todas as correspondentes ao filtro mesmo além da prévia e não permite roteiro vazio", () => {
    const data = snapshot(Array.from({ length: 7 }, (_, i) =>
      action("a"+i, "Medida "+i, `2026-11-${String(5+i).padStart(2, "0")}`)));
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null}
      today="2026-11-04" onInspect={vi.fn()} snapshot={data} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todas do filtro (7)" }));
    expect(screen.getByText(/7 medidas selecionadas para roteiro de foco/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Conteúdo do roteiro" }),
      { target: { value: "selected" } });
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excel" })).toBeDisabled();
  });

  it("recusa exportar seleção desatualizada após atualização do histórico", () => {
    const data = snapshot([action("a1", "Providência pendente", null)]);
    const { rerender } = render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro"
      inep={null} today="2026-11-04" onInspect={vi.fn()} snapshot={data} />);
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Incluir no roteiro selecionado: Providência pendente",
    }));
    rerender(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro"
      inep={null} today="2026-11-04" onInspect={vi.fn()}
      snapshot={snapshot(data.actions, [update("a1", "concluída")])} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/não constam mais entre as pendentes/);
    expect(screen.queryByRole("button", { name: "Roteiro PDF" })).toBeNull();
    expect(screen.getByRole("button", { name: "Limpar seleção desatualizada" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção desatualizada" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Todas as medidas cadastradas constam como concluídas/)).toBeTruthy();
  });

  it("mantém aviso se uma medida selecionada foi concluída, preservando exportação integral", async () => {
    vi.mocked(exportFollowupPreparation).mockResolvedValue(undefined);
    const data = snapshot([
      action("a1", "Rever biblioteca", "2026-11-02"),
      action("a2", "Reparar iluminação", null),
    ]);
    const { rerender } = render(<SchoolOpenActionsPanel schoolId="s1"
      schoolName="Escola Centro" inep={null} today="2026-11-04"
      onInspect={vi.fn()} snapshot={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todas do filtro (2)" }));
    rerender(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro"
      inep={null} today="2026-11-04" onInspect={vi.fn()}
      snapshot={snapshot(data.actions, [update("a1", "concluída")])} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/não constam mais entre as pendentes/);
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Conteúdo do roteiro" }),
      { target: { value: "all" } });
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Roteiro PDF" }));
    await waitFor(() => expect(exportFollowupPreparation).toHaveBeenLastCalledWith(
      expect.objectContaining({ actions: data.actions }), "s1", "Escola Centro", null,
      "2026-11-04", "pdf", undefined,
    ));
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/0 medidas selecionadas para roteiro de foco/)).toBeTruthy();
  });

  it("revisa somente medidas selecionadas sem confundir filtro e conteúdo integral", () => {
    const data = snapshot([
      action("a1", "Rever transporte", "2026-11-02"),
      action("a2", "Ajustar biblioteca", "2026-11-06"),
      action("a3", "Revisar inventário", null),
    ]);
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro"
      inep={null} today="2026-11-04" onInspect={vi.fn()} snapshot={data} />);
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Incluir no roteiro selecionado: Rever transporte",
    }));
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Incluir no roteiro selecionado: Revisar inventário",
    }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar providências da visita" }),
      { target: { value: "selecionadas" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("Rever transporte")).toBeTruthy();
    expect(screen.getByText("Revisar inventário")).toBeTruthy();
    expect(screen.queryByText("Ajustar biblioteca")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Incluir no roteiro selecionado: Rever transporte",
    }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText(/1 de 3 medidas sem conclusão declarada correspondem aos filtros/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(screen.getByRole("combobox", { name: "Filtrar providências da visita" })).toHaveValue("todas");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("retira apenas seleções obsoletas sem perder as pendentes após atualização", async () => {
    vi.mocked(exportFollowupPreparation).mockResolvedValue(undefined);
    const data = snapshot([
      action("a1", "Providência concluída depois", "2026-11-02"),
      action("a2", "Providência ainda pendente", null),
    ]);
    const { rerender } = render(<SchoolOpenActionsPanel schoolId="s1"
      schoolName="Escola Centro" inep={null} today="2026-11-04"
      onInspect={vi.fn()} snapshot={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todas do filtro (2)" }));
    rerender(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro"
      inep={null} today="2026-11-04" onInspect={vi.fn()}
      snapshot={snapshot(data.actions, [update("a1", "concluída")])} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/não constam mais entre as pendentes/);
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retirar medidas não pendentes" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/1 medidas selecionadas para roteiro de foco/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Roteiro PDF" }));
    await waitFor(() => expect(exportFollowupPreparation).toHaveBeenLastCalledWith(
      expect.objectContaining({ actions: data.actions, updates: [expect.objectContaining({ situation: "concluída" })] }),
      "s1", "Escola Centro", null, "2026-11-04", "pdf", ["a2"],
    ));
  });

  it("informa ausência de evolução sem inferir falta de execução", () => {
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null}
      today="2026-11-04" onInspect={vi.fn()}
      snapshot={snapshot([action("a1", "Organizar arquivo", null)])} />);
    expect(screen.getByText("Sem evolução registrada para esta medida.")).toBeTruthy();
    expect(screen.queryByText(/Última evolução declarada:/)).toBeNull();
    expect(screen.getByText(/Sem atualização não significa não realizada/)).toBeTruthy();
  });

  it("permite iniciar uma evolução somente para equipe com escrita, sem gravar automaticamente", () => {
    const inspect = vi.fn();
    const startUpdate = vi.fn();
    const data = snapshot([
      action("a1", "Corrigir iluminação", "2026-11-03"),
      action("a2", "Concluída", "2026-11-01"),
    ], [update("a2", "concluída")]);
    const { rerender } = render(<SchoolOpenActionsPanel
      schoolId="s1" schoolName="Escola Centro" inep={null} today="2026-11-04"
      onInspect={inspect} snapshot={data} />);
    expect(screen.queryByRole("button", { name: /Registrar evolução da medida:/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Ver acompanhamento da medida: Corrigir iluminação" })).toBeTruthy();
    rerender(<SchoolOpenActionsPanel
      schoolId="s1" schoolName="Escola Centro" inep={null} today="2026-11-04"
      onInspect={inspect} onStartUpdate={startUpdate} snapshot={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar evolução da medida: Corrigir iluminação" }));
    expect(startUpdate).toHaveBeenCalledExactlyOnceWith("a1");
    expect(inspect).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Registrar evolução da medida: Concluída" })).toBeNull();
  });
  it("filtra somente pendências por prazo, atualização e responsável sem alterar totais", () => {
    const inspect = vi.fn();
    const data = snapshot([
      action("a1", "Reorganizar biblioteca", "2026-11-01"),
      { ...action("a2", "Instalar iluminação", null), responsible_label: "Coordenação pedagógica" },
      action("a3", "Organizar acervo", "2026-11-11"),
      action("a4", "Revisar manutenção", "2026-11-03"),
      action("a5", "Plano encerrado", "2026-10-01"),
    ], [
      update("a2", "em andamento"), update("a3", "em andamento"),
      update("a4", "prevista"), update("a5", "concluída"),
    ]);
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null}
      today="2026-11-04" onInspect={inspect} snapshot={data} />);

    const filter = screen.getByRole("combobox", { name: "Filtrar providências da visita" });
    const search = screen.getByRole("searchbox", { name: "Pesquisar descrição ou responsável" });
    expect(screen.getByText("4 sem conclusão declarada")).toBeTruthy();
    expect(screen.getByText("2 com prazo vencido")).toBeTruthy();
    expect(screen.getByText("1 sem atualização")).toBeTruthy();

    fireEvent.change(filter, { target: { value: "prazo vencido" } });
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(2);
    expect(screen.getByText(/2 de 4 medidas sem conclusão declarada correspondem aos filtros/)).toBeTruthy();
    expect(screen.queryByText("Instalar iluminação")).toBeNull();

    fireEvent.change(filter, { target: { value: "sem atualização" } });
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(1);
    expect(screen.getByText("Reorganizar biblioteca")).toBeTruthy();

    fireEvent.change(filter, { target: { value: "sem prazo" } });
    fireEvent.change(search, { target: { value: "COORDENACAO PEDAGOGICA" } });
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(1);
    expect(screen.getByText("Instalar iluminação")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver acompanhamento da medida: Instalar iluminação" }));
    expect(inspect).toHaveBeenCalledExactlyOnceWith("a2");

    fireEvent.change(search, { target: { value: "inexistente" } });
    expect(screen.queryByRole("button", { name: /Ver acompanhamento da medida:/ })).toBeNull();
    expect(screen.getByText(/Nenhuma providência corresponde aos filtros desta visita/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Roteiro PDF" })).not.toBeDisabled();
    expect(screen.getByText(/mesmo fora dos filtros ou da prévia/)).toBeTruthy();
    expect(screen.getByText("4 sem conclusão declarada")).toBeTruthy();
    expect(screen.queryByText("Plano encerrado")).toBeNull();
  });

  it("recolhe a prévia ao mudar filtros sem perder medidas", () => {
    const actions = Array.from({ length: 7 }, (_, i) =>
      action("a"+i, "Medida "+i, `2026-11-${String(5+i).padStart(2, "0")}`));
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null}
      today="2026-11-04" onInspect={vi.fn()} snapshot={snapshot(actions)} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas as 7 medidas" }));
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(7);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar descrição ou responsável" }),
      { target: { value: "Medida" } });
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Mostrar todas as 7 medidas" })).toHaveAttribute("aria-expanded", "false");
  });
  it("mostra mais medidas sob demanda, sem perdê-las ou mudar a ordenação", () => {
    const actions = Array.from({ length: 7 }, (_, i) => action("a"+i, "Medida "+i, `2026-11-${String(5+i).padStart(2, "0")}`));
    render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null} today="2026-11-04" onInspect={vi.fn()} snapshot={snapshot(actions)} />);
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas as 7 medidas" }));
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar menos medidas" }));
    expect(screen.getAllByRole("button", { name: /Ver acompanhamento da medida:/ })).toHaveLength(5);
  });
  it("não trata ausência de medidas ou conclusões declaradas como homologação", () => {
    const { rerender } = render(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null} today="2026-11-04"
      onInspect={vi.fn()} snapshot={snapshot([])} />);
    expect(screen.getByText("Nenhuma medida cadastrada para esta unidade.")).toBeTruthy();
    rerender(<SchoolOpenActionsPanel schoolId="s1" schoolName="Escola Centro" inep={null} today="2026-11-04" onInspect={vi.fn()}
      snapshot={snapshot([action("a1", "Medida declarada concluída", null)], [update("a1", "concluída")])} />);
    expect(screen.getByText(/A conclusão não foi homologada pelo Gabinete/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ver acompanhamento da medida:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Roteiro PDF" })).toBeNull();
  });
});
