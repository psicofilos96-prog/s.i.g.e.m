import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("NBUNDLE.1 bibliotecas pesadas sob demanda", () => {
  it("página de desempenho não importa recharts estaticamente", () => {
    const src = readFileSync("src/features/performance/performance-page.tsx", "utf8");
    expect(src).not.toMatch(/from "recharts"/);
    expect(src).toMatch(/lazy\(\(\) => import\("\.\/group-bar-chart"\)\)/);
  });
  it("exceljs continua carregado por import dinâmico", () => {
    const src = readFileSync("src/features/reports/report-engine.ts", "utf8");
    expect(src).toMatch(/await import\("exceljs"\)/);
    expect(src).not.toMatch(/from "exceljs"/);
  });
});
