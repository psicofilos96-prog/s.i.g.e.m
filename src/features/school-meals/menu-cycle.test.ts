import { describe, expect, it } from "vitest";
import { cycleProblems, menuOfDay, weekOf, weekdayIndex, type CyclePayload } from "./menu-cycle";

const p: CyclePayload = { competencia: "2027", tipo: "ciclo-4-semanas", modalidade: "Parcial", condicao: "Geral",
  entradas: [{ semana: 1, dia: 0, refeicao: "Almoço", preparacao: "Arroz, feijão e ovos", ingredientes: ["Arroz", "Feijão", "Ovos"] }],
  cronograma: [{ de: "2027-02-08", ate: "2027-02-12", semana: 1 }, { de: "2027-02-15", ate: "2027-02-19", semana: 2 }] };

describe("cardápio em 4 semanas", () => {
  it("semana vem só do cronograma", () => {
    expect(weekOf(p.cronograma, "2027-02-10")).toBe(1);
    expect(weekOf(p.cronograma, "2027-03-01")).toBeNull();
  });
  it("segunda da semana 1 mostra a preparação e ingredientes", () => {
    expect(weekdayIndex("2027-02-08")).toBe(0);
    expect(menuOfDay(p, "2027-02-08")!.cells[0]!.ingredientes).toContain("Feijão");
    expect(menuOfDay(p, "2027-02-13")).toBeNull();
  });
  it("cronograma sobreposto é recusado", () => {
    expect(cycleProblems({ ...p, cronograma: [...p.cronograma, { de: "2027-02-10", ate: "2027-02-11", semana: 3 }] })).toContain("Há períodos do cronograma sobrepostos.");
  });
});

import { plannedMenuText } from "./menu-cycle";
describe("cardápio previsto no Diário", () => {
  const base = { competencia: "2027-03", tipo: "ciclo-4-semanas" as const, modalidade: "Integral", condicao: "Geral",
    entradas: [{ semana: 1, dia: 0, refeicao: "Almoço", preparacao: "Arroz e feijão", ingredientes: [] }], cronograma: [{ de: "2027-03-01", ate: "2027-03-05", semana: 1 }] };
  it("dá o texto do dia pela semana do cronograma", () => { expect(plannedMenuText([base], "Integral", "2027-03-01")).toBe("Almoço: Arroz e feijão"); });
  it("fora do cronograma não presume", () => { expect(plannedMenuText([base], "Integral", "2027-03-08")).toBeNull(); });
});
