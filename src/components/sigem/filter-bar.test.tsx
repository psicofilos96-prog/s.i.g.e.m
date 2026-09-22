import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FILTER_ALL,
  FilterBar,
  type FilterDefinition,
  type FilterValues,
} from "./filter-bar";

const filters: FilterDefinition[] = [
  {
    id: "marker",
    label: "Marcador",
    allLabel: "Todos os marcadores",
    options: [
      { value: "a", label: "Marcador A" },
      { value: "b", label: "Marcador B" },
    ],
  },
  {
    id: "context",
    label: "Contexto",
    allLabel: "Todos os contextos",
    options: [{ value: "1", label: "Contexto 1" }],
    advanced: true,
  },
];

function Harness({ initial = {} as FilterValues }: { initial?: FilterValues }) {
  const [values, setValues] = useState<FilterValues>({
    marker: FILTER_ALL,
    context: FILTER_ALL,
    ...initial,
  });
  const [query, setQuery] = useState("");
  return (
    <FilterBar
      search={{ value: query, onChange: setQuery, label: "Pesquisar" }}
      filters={filters}
      values={values}
      onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
      onClear={() => setValues({ marker: FILTER_ALL, context: FILTER_ALL })}
      advancedDescription="Filtros demonstrativos"
    />
  );
}

describe("FilterBar", () => {
  it("renderiza pesquisa e filtros em linha", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Pesquisar" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Marcador" })).toBeInTheDocument();
  });

  it("aplica um filtro e exibe o chip correspondente", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox", { name: "Marcador" }));
    await userEvent.click(screen.getByRole("option", { name: "Marcador A" }));

    expect(screen.getByRole("list", { name: "Filtros ativos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover filtro Marcador: Marcador A" }),
    ).toBeInTheDocument();
  });

  it("remove um filtro pelo chip", async () => {
    render(<Harness initial={{ marker: "a" }} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Remover filtro Marcador: Marcador A" }),
    );
    expect(screen.queryByRole("list", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("limpa todos os filtros", async () => {
    render(<Harness initial={{ marker: "a", context: "1" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.queryByRole("list", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("abre o painel de filtros avançados", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /filtros/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Filtros demonstrativos")).toBeInTheDocument();
  });

  it("permite abrir um filtro pelo teclado", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "Marcador" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("option", { name: "Marcador B" })).toBeInTheDocument();
  });

  it("não exibe chips quando nenhum filtro está aplicado", () => {
    const onValueChange = vi.fn();
    render(
      <FilterBar
        filters={filters}
        values={{ marker: FILTER_ALL, context: FILTER_ALL }}
        onValueChange={onValueChange}
        onClear={() => {}}
      />,
    );
    expect(screen.queryByRole("list", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });
});
