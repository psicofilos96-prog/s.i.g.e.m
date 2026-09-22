import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataGrid, type DataGridColumn } from "./data-grid";

type Row = { id: string; name: string; value: string };

const rows: Row[] = [
  { id: "a", name: "Registro Alfa", value: "10" },
  { id: "b", name: "Registro Beta", value: "20" },
];

const columns: Array<DataGridColumn<Row>> = [
  { id: "name", header: "Nome", sortable: true, cell: (row) => row.name },
  { id: "value", header: "Valor", cell: (row) => row.value },
];

function setup(props: Partial<React.ComponentProps<typeof DataGrid<Row>>> = {}) {
  return render(
    <DataGrid
      label="Registros de teste"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      {...props}
    />,
  );
}

describe("DataGrid", () => {
  it("renderiza uma tabela acessível com cabeçalhos e linhas", () => {
    setup();
    const table = screen.getByRole("table", { name: "Registros de teste" });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /nome/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Valor" })).toBeInTheDocument();
    expect(screen.getByText("Registro Alfa")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("apresenta o estado vazio quando não há registros", () => {
    setup({ rows: [], emptyTitle: "Nada por aqui" });
    expect(screen.getByText("Nada por aqui")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("apresenta o estado de carregamento", () => {
    setup({ state: "loading" });
    expect(screen.getByRole("status", { name: /carregando/i })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("apresenta o estado de erro e permite tentar novamente", async () => {
    const onRetry = vi.fn();
    setup({ state: "error", onRetry });
    await userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("permite selecionar uma linha e todas as linhas visíveis", async () => {
    const onSelectionChange = vi.fn();
    setup({
      selection: {
        selectedIds: [],
        onSelectionChange,
        rowLabel: (row) => `Selecionar ${row.name}`,
        allLabel: "Selecionar todos",
      },
    });

    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar Registro Beta" }));
    expect(onSelectionChange).toHaveBeenCalledWith(["b"]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(onSelectionChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("emite intenção de ordenação e expõe aria-sort", async () => {
    const onSortChange = vi.fn();
    setup({ sort: { columnId: "name", direction: "asc", onSortChange } });

    expect(screen.getByRole("columnheader", { name: /nome/i })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await userEvent.click(screen.getByRole("button", { name: /nome/i }));
    expect(onSortChange).toHaveBeenCalledWith("name", "desc");
  });

  it("renderiza ações de linha e paginação controlada", async () => {
    const onPageChange = vi.fn();
    setup({
      rowActions: (row) => <button type="button">Abrir {row.name}</button>,
      pagination: { page: 2, pageCount: 3, onPageChange },
    });
    expect(screen.getByRole("button", { name: "Abrir Registro Alfa" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
