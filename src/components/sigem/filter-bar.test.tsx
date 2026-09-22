import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FILTER_ALL, FilterBar, type FilterDefinition, type FilterValues } from "./filter-bar";

const filters: FilterDefinition[] = [
  {
    id: "situation",
    label: "Situação operacional",
    allLabel: "Todas as situações",
    options: [
      { value: "registered", label: "Operação registrada" },
      { value: "review", label: "Cadastro em conferência" },
    ],
  },
  {
    id: "location",
    label: "Localização",
    allLabel: "Todas as localizações",
    options: [{ value: "urban", label: "Área urbana demonstrativa" }],
    advanced: true,
  },
];

function Harness({ initial = {} as FilterValues }: { initial?: FilterValues }) {
  const [values, setValues] = useState<FilterValues>({
    situation: FILTER_ALL,
    location: FILTER_ALL,
    ...initial,
  });
  const [query, setQuery] = useState("");
  return (
    <FilterBar
      search={{ value: query, onChange: setQuery, label: "Pesquisar" }}
      filters={filters}
      values={values}
      onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
      onClear={() => setValues({ situation: FILTER_ALL, location: FILTER_ALL })}
      advancedDescription="Filtros demonstrativos"
    />
  );
}

describe("FilterBar", () => {
  it("renderiza pesquisa e filtros em linha", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Pesquisar" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Situação operacional" })).toBeInTheDocument();
  });

  it("aplica um filtro e exibe o chip correspondente", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox", { name: "Situação operacional" }));
    await userEvent.click(screen.getByRole("option", { name: "Operação registrada" }));

    expect(screen.getByRole("list", { name: "Filtros ativos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Remover filtro Situação operacional: Operação registrada",
      }),
    ).toBeInTheDocument();
  });

  it("remove um filtro pelo chip", async () => {
    render(<Harness initial={{ situation: "registered" }} />);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Remover filtro Situação operacional: Operação registrada",
      }),
    );
    expect(screen.queryByRole("list", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("limpa todos os filtros", async () => {
    render(<Harness initial={{ situation: "registered", location: "urban" }} />);
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
    const trigger = screen.getByRole("combobox", { name: "Situação operacional" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("option", { name: "Cadastro em conferência" }),
    ).toBeInTheDocument();
  });

  it("não exibe chips quando nenhum filtro está aplicado", () => {
    const onValueChange = vi.fn();
    render(
      <FilterBar
        filters={filters}
        values={{ situation: FILTER_ALL, location: FILTER_ALL }}
        onValueChange={onValueChange}
        onClear={() => {}}
      />,
    );
    expect(screen.queryByRole("list", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });
});
