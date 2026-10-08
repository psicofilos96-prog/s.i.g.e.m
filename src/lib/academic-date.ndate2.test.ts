import { describe, expect, it } from "vitest";
import { civilDateOf, monthBounds, operationalClock, operationalMonthKey, operationalToday, shiftMonthKey } from "./academic-date";
import { operationalToday as refToday } from "@/features/academic/academic-reference-date";

describe("NDATE.2 — datas civis e fuso da rede", () => {
  it("registro às 22h em Brasília continua no mesmo dia", () => {
    expect(civilDateOf("2026-10-09T01:30:00+00:00")).toBe("2026-10-08");
    expect(civilDateOf("2026-10-09T01:30:00Z")).toBe("2026-10-08");
    expect(civilDateOf("2026-10-09 01:30:00+00")).toBe("2026-10-08");
  });
  it("virada de ano e de mês por instante", () => {
    expect(civilDateOf("2027-01-01T02:59:59Z")).toBe("2026-12-31");
    expect(civilDateOf("2027-01-01T03:00:00Z")).toBe("2027-01-01");
    expect(civilDateOf("2026-03-01T01:00:00Z")).toBe("2026-02-28");
  });
  it("data civil pura nunca é deslocada", () => {
    expect(civilDateOf("2027-02-01")).toBe("2027-02-01");
    expect(civilDateOf(null)).toBeUndefined();
  });
  it("competência seguinte e anterior viram o ano", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2027-01", -1)).toBe("2026-12");
    expect(operationalMonthKey(new Date("2027-01-01T01:00:00Z"))).toBe("2026-12");
  });
  it("limites inclusivos do mês, com bissexto", () => {
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("hora e hoje operacionais vêm do mesmo utilitário", () => {
    const d = new Date("2026-10-09T01:05:00Z");
    expect(operationalClock(d).hhmm).toBe("22:05");
    expect(refToday(d)).toBe(operationalToday(d));
    expect(refToday(d)).toBe("2026-10-08");
  });
});
