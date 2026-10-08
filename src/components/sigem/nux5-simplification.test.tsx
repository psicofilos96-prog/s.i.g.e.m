import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MoreFilters } from "./more-filters";
import { ActionDisclosure } from "./workspace-ui";

const read = (p: string) => readFileSync(p, "utf8");

describe("NUX.5 — simplificação sem perder funcionalidade", () => {
  it("Mais filtros fica fechado sem uso e abre quando há filtro preenchido", () => {
    const { container, rerender } = render(<MoreFilters><input aria-label="x" /></MoreFilters>);
    expect(container.querySelector("details")!.open).toBe(false);
    expect(screen.getByLabelText("x")).toBeTruthy(); // continua no DOM: nada removido
    rerender(<MoreFilters active><input aria-label="x" /></MoreFilters>);
    expect(container.querySelector("details")!.open).toBe(true);
    expect(screen.getByText("Mais filtros (em uso)")).toBeTruthy();
  });
  it("ação secundária continua clicável, só sem destaque", () => {
    render(<><ActionDisclosure label="Primeira" available /><ActionDisclosure label="Segunda" available secondary /></>);
    const [a, b] = [screen.getByRole("button", { name: /Primeira/ }), screen.getByRole("button", { name: /Segunda/ })];
    expect(a.className).not.toBe(b.className);
    expect((b as HTMLButtonElement).disabled).toBe(false);
  });
  it("acompanhamento: só a primeira ação do item é primária", () => {
    expect(read("src/components/sigem/follow-up-workspace.tsx")).toContain("secondary={index > 0}");
  });
  it("filtros avançados atrás de Mais filtros (Supervisão e Avaliação)", () => {
    expect(read("src/features/school-supervision/supervision-page.tsx")).toMatch(/<MoreFilters active=\{!!f\.knownAt\}>/);
    expect(read("src/features/performance/performance-page.tsx")).toMatch(/<MoreFilters active=\{!!cmp\}>/);
  });
  it("Secretaria: informações da unidade sob demanda, mas presentes", () => {
    const s = read("src/features/workspace/secretary-workspace-page.tsx");
    expect(s).toContain('data-nux5="unit-info"');
    expect(s).toContain("Indisponível — nenhuma fonte autorizada publicou este total");
  });
  it("botão Entrar não quebra em duas linhas", () => {
    expect(read("src/components/app-shell/app-shell.tsx")).toContain('className="shrink-0 whitespace-nowrap"');
  });
});
