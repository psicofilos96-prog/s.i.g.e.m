import { describe, expect, it } from "vitest";
import { addDays, daysInMonth, formatDateTime, operationalToday } from "./academic-date";

describe("NDATE.1 — datas e fuso", () => {
  it("timestamp depois das 21h de Brasília continua no mesmo dia civil", () => {
    expect(formatDateTime("2027-02-04T01:30:00Z")).toBe("03/02/2027 22:30");
    expect(operationalToday(new Date("2027-02-04T01:30:00Z"))).toBe("2027-02-03");
  });
  it("respeita horário de verão histórico (fev/2018 era UTC-2)", () => {
    expect(formatDateTime("2018-02-01T12:00:00Z")).toBe("01/02/2018 10:00");
    expect(formatDateTime("2018-07-01T12:00:00Z")).toBe("01/07/2018 09:00");
  });
  it("virada de ano no fuso local", () => {
    expect(operationalToday(new Date("2027-01-01T02:00:00Z"))).toBe("2026-12-31");
  });
  it("aritmética de data civil sem deslocamento em virada de mês/ano e bissexto", () => {
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysInMonth(2027, 2)).toBe(28);
  });
});
