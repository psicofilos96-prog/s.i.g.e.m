import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataGrid, toggleVisibleSelection, type DataGridColumn } from "./data-grid";

type Row = { id: string; name: string };
const columns: Array<DataGridColumn<Row>> = [{ id: "name", header: "Nome", cell: (r) => r.name }];

describe("NTABLE.1 — tabelas densas", () => {
  it("região rolável é alcançável por teclado e nomeada", () => {
    render(<DataGrid label="Alunos" rows={[{ id: "a", name: "A" }]} columns={columns} getRowId={(r) => r.id} />);
    const region = screen.getByRole("region", { name: "Alunos" });
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("paginação é navegação com página atual anunciada", () => {
    render(
      <DataGrid label="Alunos" rows={[{ id: "a", name: "A" }]} columns={columns} getRowId={(r) => r.id}
        pagination={{ page: 2, pageCount: 5, onPageChange: () => {} }} />,
    );
    expect(screen.getByRole("navigation", { name: "Paginação" }).textContent).toContain("Página 2 de 5");
  });

  it("estado sem permissão não oferece botão sem efeito", () => {
    render(<DataGrid label="Alunos" state="permission" rows={[]} columns={columns} getRowId={(r) => r.id} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("seleção de 50.000 ids preserva outras páginas e é rápida", () => {
    const selected = Array.from({ length: 50_000 }, (_, i) => `s${i}`);
    const visible = Array.from({ length: 50_000 }, (_, i) => `v${i}`);
    const t = performance.now();
    const added = toggleVisibleSelection(selected, visible, true);
    const removed = toggleVisibleSelection(added, visible, false);
    expect(performance.now() - t).toBeLessThan(500);
    expect(added).toHaveLength(100_000);
    expect(removed).toEqual(selected);
  });
});
