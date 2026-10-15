import { describe, expect, it } from "vitest";
import { councilItemText } from "./calendar-final-council-label";

const eja = [
  { on: "2027-04-30", name: "Conselho de Classe" },
  { on: "2027-07-09", name: "Conselho de Classe Final" },
  { on: "2027-12-21", name: "Término do ano letivo" },
];

describe("Término do Ano Letivo só no último dia", () => {
  it("09/07 fica apenas Conselho de Classe Final", () => {
    expect(councilItemText("Conselho de Classe Final", "2027-07-09", eja)).toBe("Conselho de Classe Final");
  });
  it("21/12 vira Conselho de Classe Final / Término do Ano Letivo", () => {
    expect(councilItemText("Término do ano letivo", "2027-12-21", eja)).toBe("Conselho de Classe Final / Término do Ano Letivo");
  });
  it("Conselho Final numerado no último dia ganha o sufixo", () => {
    const items = [{ on: "2027-07-09", name: "Conselho de Classe Final / 1" }, { on: "2027-12-21", name: "Conselho de Classe Final / 2" }];
    expect(councilItemText("Conselho de Classe Final / 1", "2027-07-09", items)).toBe("Conselho de Classe Final / 1");
    expect(councilItemText("Conselho de Classe Final / 2", "2027-12-21", items)).toBe("Conselho de Classe Final / 2 - Término do Ano Letivo");
  });
});
