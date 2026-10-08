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
  it("NBUNDLE.2: arquivos de rota não exportam componentes (só Route e tipos), para a divisão automática", async () => {
    const { readdirSync } = await import("node:fs");
    const bad = readdirSync("src/routes").filter((f) => /\.tsx$/.test(f) && !f.includes(".test."))
      .filter((f) => /^export (function|const) (?!Route\b)[A-Z]/m.test(readFileSync(`src/routes/${f}`, "utf8")));
    expect(bad).toEqual([]);
  });
});
