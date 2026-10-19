import { describe, expect, it } from "vitest";
import { guardianshipLetterText } from "./guardianship-letter-pdf";

describe("ofício ao Conselho Tutelar", () => {
  it("usa só os números lidos e cita o ECA art. 56", () => {
    const t = guardianshipLetterText({ schoolName: "E", studentName: "Ana", from: "2027-02-01", to: "2027-03-31", present: 30, absent: 20, rate: 60, limitPct: 75, today: "2027-04-01" }).join(" ");
    expect(t).toContain("20 falta(s) em 50 aula(s)");
    expect(t).toContain("01/02/2027 a 31/03/2027");
    expect(t).toContain("60% de frequência, abaixo do limite de 75%");
    expect(t).toContain("art. 56");
  });
});
