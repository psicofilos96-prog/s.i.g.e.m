import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CalendarDocument } from "./calendar-document";
import { createCalendarFixtures } from "./calendar-fixtures";

describe("documento Calendário Escolar", () => {
  it("modo consulta/impressão não tem controles de aplicação", () => {
    const [regular] = createCalendarFixtures();
    const { container } = render(<CalendarDocument cal={regular!} />);
    expect(container.querySelectorAll("button, input, select")).toHaveLength(0);
    expect(
      screen.getByText("CALENDÁRIO ESCOLAR 2027 – ENSINO REGULAR / PERÍODO ANUAL"),
    ).toBeTruthy();
    // Mês/Dia + 31 dias + Total
    expect(container.querySelectorAll("thead th")).toHaveLength(33);
    // Legenda: 10 itens, sem PP
    const legend = screen.getByText("Legenda:").parentElement!;
    expect(legend.querySelectorAll(".cd-legenda-linha")).toHaveLength(10);
    expect(within(legend).queryByText(/Planejamento Pedagógico/)).toBeNull();
    // Rótulos de assinatura sem caixa
    expect(screen.getByText("Secretária Municipal de Educação")).toBeTruthy();
    expect(screen.getByText("Coordenadora da Supervisão de Ensino")).toBeTruthy();
    expect(document.querySelector(".cd-conselhos")!.textContent).toContain("Conselho de Classe Final");
  });
  it("EJA exibe blocos semestrais e conselhos no rodapé", () => {
    const [, eja] = createCalendarFixtures();
    render(<CalendarDocument cal={eja!} />);
    expect(screen.getByText("EJA - 1º SEMESTRE = 100 DIAS LETIVOS")).toBeTruthy();
    expect(screen.getByText("EJA - 2º SEMESTRE = 100 DIAS LETIVOS")).toBeTruthy();
    expect(screen.getByText("TOTAL DE DIAS LETIVOS DO 1° SEMESTRE")).toBeTruthy();
    expect(screen.getAllByText(/^Conselho de Classe do /)).toHaveLength(4);
  });
  it("texto do Conselho de Classe é configurável por período, com rótulo derivado como padrão", () => {
    const [, eja] = createCalendarFixtures();
    const custom = {
      ...eja!,
      periods: eja!.periods.map((p, i) =>
        i === 0 ? { ...p, councilLabel: "Conselho de Classe do 1° Período Letivo/1" } : p,
      ),
    };
    render(<CalendarDocument cal={custom} />);
    expect(screen.getByText("Conselho de Classe do 1° Período Letivo/1")).toBeTruthy();
    // Demais períodos mantêm o rótulo derivado do nome
    expect(screen.getAllByText(/^Conselho de Classe do /)).toHaveLength(4);
  });
  it("modo edição expõe um botão por dia do ano (fora das tarjas)", () => {
    const [regular] = createCalendarFixtures();
    const { container } = render(<CalendarDocument cal={regular!} editable />);
    expect(container.querySelector('[data-date="2027-02-04"]')).toBeTruthy();
  });
});

describe("conselhos no rodapé", () => {
  it("cada dia de conselho marcado vira uma linha própria", () => {
    const [regular] = createCalendarFixtures();
    const cal = regular!;
    const ccDate = cal.overrides.concat(cal.events).find((o) => o.date.endsWith("-12-10"))!;
    const extra = { ...cal, overrides: [...cal.overrides.filter((o) => o.date !== "2027-09-21"), { date: "2027-09-21", type: ccDate.type }] };
    render(<CalendarDocument cal={extra} />);
    const lines = [...document.querySelectorAll(".cd-conselho-linha b")].map((b) => b.textContent);
    expect(lines).toContain("21/09");
    expect(lines).toContain("10/12");
    expect(lines.every((t) => !t!.includes(" e "))).toBe(true);
  });
});
