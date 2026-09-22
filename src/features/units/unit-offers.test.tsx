import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

async function openOffersTab() {
  renderOperationalRoutes("/unidades/demo-001");
  const tab = await screen.findByRole("tab", { name: "Oferta educacional" });
  expect(tab).toBeEnabled();
  await userEvent.click(tab);
  return tab;
}

describe("Oferta educacional na unidade", () => {
  it("apresenta ofertas vigentes com organização acadêmica e matriz associada", async () => {
    const tab = await openOffersTab();
    expect(tab).toHaveAttribute("aria-selected", "true");

    const current = await screen.findByRole("list", { name: "Ofertas vigentes" });
    expect(within(current).getByText("Educação Infantil")).toBeInTheDocument();
    expect(
      within(current).getByText("Berçário, Maternal, 1º e 2º Período", { exact: false }),
    ).toBeInTheDocument();
    expect(within(current).getAllByText(/MC-EI-002/).length).toBeGreaterThan(0);
    expect(within(current).getAllByText(/Jornada integral — 35h semanais/).length).toBeGreaterThan(
      0,
    );
  });

  it("preserva ofertas anteriores sem sobrescrever o histórico", async () => {
    await openOffersTab();
    const historical = await screen.findByRole("list", { name: "Ofertas anteriores" });
    expect(
      within(historical).getByText("Ensino Fundamental — 2º segmento"),
    ).toBeInTheDocument();
    expect(within(historical).getAllByText(/Oferta encerrada/).length).toBeGreaterThan(0);
    expect(within(historical).getAllByText(/MC-EF2-001/).length).toBeGreaterThan(0);
  });

  it("distingue a matriz atual da matriz anteriormente aplicada", async () => {
    await openOffersTab();
    const current = await screen.findByRole("list", { name: "Ofertas vigentes" });
    expect(within(current).getAllByText("Matriz anteriormente aplicada").length).toBeGreaterThan(0);
    expect(within(current).getAllByText(/MC-EI-001/).length).toBeGreaterThan(0);
  });

  it("navega da oferta para o detalhe da matriz curricular", async () => {
    await openOffersTab();
    const current = await screen.findByRole("list", { name: "Ofertas vigentes" });
    const links = within(current).getAllByRole("link", { name: /Ver matriz/i });
    await userEvent.click(links[0]!);

    expect(
      await screen.findByRole("heading", {
        name: /Matriz curricular da Educação Infantil · Versão 2/,
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("mantém a ação de nova oferta apenas demonstrativa", async () => {
    await openOffersTab();
    expect(await screen.findByRole("button", { name: /Nova oferta/i })).toBeDisabled();
  });
});
