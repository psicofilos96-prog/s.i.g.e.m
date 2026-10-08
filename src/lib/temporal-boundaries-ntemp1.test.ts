import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { operationalToday, isIsoDate, parseAcademicDate } from "./academic-date";

describe("NTEMP.1 — fronteiras de data", () => {
  it("23h30 de Brasília ainda é o mesmo dia (UTC já virou)", () => {
    expect(operationalToday(new Date("2026-12-31T02:30:00Z"))).toBe("2026-12-30");
  });
  it("00h00 de Brasília já é o dia seguinte", () => {
    expect(operationalToday(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });
  it("virada de ano às 20h59 de Brasília permanece em 31/12", () => {
    expect(operationalToday(new Date("2027-01-01T00:59:00Z"))).toBe("2026-12-31");
  });
  it("29/02 só existe em ano bissexto", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(parseAcademicDate("29/02/2027")).toBeNull();
  });
  it("comparação ISO lexical respeita início/término inclusivos", () => {
    const within = (d: string, from: string, to: string | null) => d >= from && (to === null || d <= to);
    expect(within("2027-02-01", "2027-02-01", "2027-12-20")).toBe(true);
    expect(within("2027-12-20", "2027-02-01", "2027-12-20")).toBe(true);
    expect(within("2027-12-21", "2027-02-01", "2027-12-20")).toBe(false);
    expect(within("2027-01-31", "2027-02-01", null)).toBe(false);
  });
  it("nenhuma tela calcula 'hoje' pelo dia UTC", () => {
    const out = execSync(
      `rg -l "new Date\\(\\)\\.toISOString\\(\\)\\.slice\\(0, ?10\\)" src --glob '!*.test.*' || true`,
    ).toString().trim();
    expect(out.split("\n").filter((f) => f && !f.endsWith("academic-date.ts"))).toEqual([]);
  });
});
