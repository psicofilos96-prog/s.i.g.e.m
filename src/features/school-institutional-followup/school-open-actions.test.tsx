import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SchoolOpenActionsPanel } from "./school-open-actions";
import type { FollowupAction, FollowupUpdate, SchoolSnapshot } from "./model";

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
