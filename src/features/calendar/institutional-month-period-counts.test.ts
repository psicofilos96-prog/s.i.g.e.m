import { describe, expect, it } from "vitest";
import { richFixture } from "./calendar-external-rich-fixture";
import { monthPeriodCounts } from "./institutional-calendar-print";

describe("totais mensais por período da folha interna e mista", () => {
  const model = richFixture().rawModel;
  const counts = (key: string) => {
    const month = model.months.find((m) => m.key === key);
    if (!month) throw new Error(`Mês ausente: ${key}`);
    return monthPeriodCounts(month, model.periods, `${key}-01`, `${key}-31`);
  };
  it("maio separa os 19 dias em 15 e 4", () => {
    expect(counts("2027-05").map((c) => c.schoolDays)).toEqual([15, 4]);
  });
  it("setembro separa os 21 dias em 7 e 14", () => {
    expect(counts("2027-09").map((c) => c.schoolDays)).toEqual([7, 14]);
  });
  it("preserva 200 dias e a soma mensal, sem dividir meses sem transição", () => {
    expect(model.total.schoolDays).toBe(200);
    expect(model.months.reduce((n, m) => n + (m.total.schoolDays ?? 0), 0)).toBe(200);
    expect(counts("2027-04")).toEqual([]);
  });
  it("efeito desconhecido em um lado não é transformado em zero", () => {
    const month = model.months.find((m) => m.key === "2027-05");
    if (!month) throw new Error("Maio ausente");
    const days = month.days.map((d) => d.on === "2027-05-03" ? { ...d, effect: "efeito-nao-declarado" as const } : d);
    expect(monthPeriodCounts({ ...month, days }, model.periods, "2027-05-01", "2027-05-31").map((c) => c.schoolDays)).toEqual([null, 4]);
  });
});